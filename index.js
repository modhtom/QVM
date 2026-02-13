import express from "express";
import fs from "fs";
import path from "path";
import { EventEmitter } from 'events';
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
import rateLimit from 'express-rate-limit';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3_CONFIG } from "./utility/config.js";
import { uploadToStorage, deleteFromStorage } from "./utility/storage.js";
import { getSurahDataRange } from './utility/data.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const progressEmitter = new EventEmitter();

const sanitizeFilename = (name) => {
  return name.replace(/[^a-z0-9.]/gi, '_').replace(/_{2,}/g, '_');
};

const safePath = (baseDir, userInput) => {
  const resolved = path.resolve(baseDir, userInput);
  const normalizedBase = path.resolve(baseDir);
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    return null;
  }
  return resolved;
};

const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a', 'audio/x-m4a'];
const ALLOWED_BACKGROUND_MIMES = [...ALLOWED_VIDEO_MIMES, ...ALLOWED_IMAGE_MIMES];

const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'Data/Background_Video/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const uploadBackground = multer({
  storage: backgroundStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit 50MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_BACKGROUND_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: video/image files only.`), false);
    }
  }
});

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'Data/audio/custom';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Limit 100MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_AUDIO_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: audio files only.`), false);
    }
  }
});

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});
const videoQueue = new Queue('video-queue', { connection });
console.log('Server connected to video-queue.');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const videoGenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many video generation requests. Please try again later.' }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many upload requests. Please try again later.' }
});

app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.resolve(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public/index.html"));
});

app.get('/job-status/:id', async (req, res) => {
  const jobId = req.params.id;
  const job = await videoQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue;
  const failedReason = job.failedReason;

  res.json({ id: job.id, state, progress, result, failedReason });
});


app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const sendProgress = (progress) => res.write(`data: ${JSON.stringify(progress)}\n\n`);
  progressEmitter.on('progress', sendProgress);
  req.on('close', () => progressEmitter.removeListener('progress', sendProgress));
});

app.get("/api/videos", async (req, res) => {
  try {
    const s3 = new S3Client(S3_CONFIG);
    const command = new ListObjectsV2Command({
      Bucket: S3_CONFIG.bucketName,
      Prefix: "videos/",
      Suffix: "?download=true"
    });

    const response = await s3.send(command);
    const videos = response.Contents ? response.Contents.map(item => item.Key) : [];
    res.json({ videos });
  } catch (error) {
    console.error("S3 List Error:", error);
    res.status(500).json({ error: "Could not list videos" });
  }
});

app.use("/videos", express.static(path.resolve(__dirname, "Output_Video")));

app.get("/video-preview/:video", (req, res) => {
  const video = req.params.video;
  const filePath = safePath(path.resolve(__dirname, "Output_Video"), video);
  if (!filePath) {
    return res.status(403).json({ error: 'Forbidden: invalid path' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video not found' });
  }
  res.sendFile(filePath);
});


app.post('/upload-image', uploadLimiter, (req, res) => {
  if (!req.files || !req.files.image) {
    return res.status(400).send('No image uploaded.');
  }

  const image = req.files.image;
  const safeName = sanitizeFilename(image.name);
  const destDir = path.resolve(__dirname, 'Data/Background_Images');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const imagePath = safePath(destDir, `${Date.now()}_${safeName}`);
  if (!imagePath) {
    return res.status(403).json({ error: 'Forbidden: invalid filename' });
  }

  if (!ALLOWED_IMAGE_MIMES.includes(image.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
  }

  image.mv(imagePath, (err) => {
    if (err) {
      console.error('Image upload error:', err);
      return res.status(500).json({ error: 'Failed to save image' });
    }

    res.json({ imagePath });
  });
});

app.get("/Output_Video/:video", (req, res) => {
  const video = req.params.video;
  const filePath = safePath(path.resolve(__dirname, "Output_Video"), video);
  if (!filePath) {
    return res.status(403).json({ error: 'Forbidden: invalid path' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  if (req.query.download) {
    res.download(filePath);
  } else {
    res.sendFile(filePath);
  }
});

app.post("/generate-partial-video", videoGenLimiter, async (req, res) => {
  try {
    const job = await videoQueue.add('process-video', { type: 'partial', videoData: req.body });
    res.status(202).json({ message: "Queued", jobId: job.id });
  } catch (error) {
    console.error('Queue error:', error);
    res.status(500).json({ error: 'Failed to queue video generation.' });
  }
});

app.post("/generate-full-video", videoGenLimiter, async (req, res) => {
  try {
    const job = await videoQueue.add('process-video', { type: 'full', videoData: req.body });
    res.status(202).json({ message: "Queued", jobId: job.id });
  } catch (error) {
    console.error('Queue error:', error);
    res.status(500).json({ error: 'Failed to queue video generation.' });
  }
});

app.get('/api/surah-verses-text', async (req, res) => {
  const { surahNumber, startVerse, endVerse } = req.query;
  const surah = parseInt(surahNumber);
  const start = parseInt(startVerse);
  const end = parseInt(endVerse);

  if (isNaN(surah) || isNaN(start) || isNaN(end)) {
    return res.status(400).json({ error: 'Invalid parameters: must be numbers' });
  }
  if (surah < 1 || surah > 114) {
    return res.status(400).json({ error: 'Invalid surah number (must be 1-114)' });
  }
  if (start < 1 || end < start || end > 300) {
    return res.status(400).json({ error: 'Invalid verse range' });
  }

  try {
    const { combinedText } = await getSurahDataRange(
      surah, start, end,
      null, "quran-simple", null, null, true
    );
    res.json({ verses: combinedText.split('\n').filter(Boolean) });
  } catch (error) {
    console.error("Error fetching text:", error);
    res.status(500).json({ error: 'Failed to fetch text' });
  }
});

app.get("/videos/*", (req, res) => {
  const fileKey = req.params[0];
  if (!fileKey || fileKey.includes('..') || fileKey.startsWith('/') || fileKey.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid file key' });
  }
  if (!process.env.R2_PUBLIC_URL) {
    return res.status(500).json({ error: 'Storage not configured' });
  }
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${encodeURI(fileKey)}`;
  res.redirect(publicUrl);
});

app.delete('/api/videos/*', async (req, res) => {
  const fileKey = req.params[0];
  if (!fileKey || fileKey.includes('..') || !fileKey.startsWith('videos/')) {
    return res.status(403).json({ error: 'Forbidden: invalid file key' });
  }
  try {
    await deleteFromStorage(fileKey);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete remote file' });
  }
});

app.post('/upload-background', uploadLimiter, uploadBackground.single('backgroundFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const localPath = req.file.path.split(path.sep).join('/');
  const filename = path.basename(localPath);
  const r2Key = `uploads/backgrounds/${filename}`;

  try {
    await uploadToStorage(localPath, r2Key, req.file.mimetype);
    fs.unlinkSync(localPath);
    res.json({ backgroundPath: r2Key, isRemote: true });
  } catch (error) {
    console.error("R2 Upload Failed:", error);
    res.status(500).json({ error: "Failed to upload background" });
  }
});

app.post('/upload-audio', uploadLimiter, uploadAudio.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio uploaded.' });

  const localPath = req.file.path.split(path.sep).join('/');
  const filename = path.basename(localPath);
  const r2Key = `uploads/audio/${filename}`;

  try {
    await uploadToStorage(localPath, r2Key, req.file.mimetype);
    fs.unlinkSync(localPath);
    console.log('Audio moved to cloud:', r2Key);
    res.json({ audioPath: r2Key, isRemote: true });
  } catch (error) {
    console.error("R2 Upload Failed:", error);
    res.status(500).json({ error: "Failed to upload audio to cloud" });
  }
});

app.get('/api/metadata', (req, res) => {
  const metadataPath = path.resolve(__dirname, 'Data/metadata.json');
  if (fs.existsSync(metadataPath)) {
    res.sendFile(metadataPath);
  } else {
    res.status(404).json({ error: "Metadata not found. Please run fetchMetaData.js" });
  }
});

app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
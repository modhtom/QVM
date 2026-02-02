import express from "express";
import fs from "fs";
import path from "path";
import { EventEmitter } from 'events';
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
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
  limits: { fileSize: 50 * 1024 * 1024 } // Limit 50MB
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
const uploadAudio = multer({ storage: audioStorage });

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  maxRetriesPerRequest: null,
});
const videoQueue = new Queue('video-queue', { connection });
console.log('Server connected to video-queue.');

app.use(cors());
app.use(express.json());
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
  res.sendFile(path.resolve(__dirname, "Output_Video", video));
});


app.post('/upload-image', (req, res) => {
  if (!req.files || !req.files.image) {
    return res.status(400).send('No image uploaded.');
  }

  const image = req.files.image;
  const imagePath = path.join(__dirname, 'Data/Background_Images', image.name);

  image.mv(imagePath, (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.json({ imagePath });
  });
});

app.get("/Output_Video/:video", (req, res) => {
  const video = req.params.video;
  const filePath = path.resolve(__dirname, "Output_Video", video);

  if (req.query.download) {
    res.download(filePath);
  } else {
    res.sendFile(filePath);
  }
});

app.post("/generate-partial-video", async (req, res) => {
  try {
    const job = await videoQueue.add('process-video', { type: 'partial', videoData: req.body });
    res.status(202).json({ message: "Queued", jobId: job.id });
  } catch (error) {
    res.status(500).send("Failed to queue.");
  }
});

app.post("/generate-full-video", async (req, res) => {
  try {
    const job = await videoQueue.add('process-video', { type: 'full', videoData: req.body });
    res.status(202).json({ message: "Queued", jobId: job.id });
  } catch (error) {
    res.status(500).send("Failed to queue.");
  }
});

app.get('/api/surah-verses-text', async (req, res) => {
  const { surahNumber, startVerse, endVerse } = req.query;
  if (!surahNumber || !startVerse || !endVerse || isNaN(surahNumber) || isNaN(startVerse)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const { combinedText } = await getSurahDataRange(
      parseInt(surahNumber), parseInt(startVerse), parseInt(endVerse),
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
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
  res.redirect(publicUrl);
});

app.delete('/api/videos/*', async (req, res) => {
  const fileKey = req.params[0];
  try {
    await deleteFromStorage(fileKey);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete remote file' });
  }
});

app.post('/upload-background', uploadBackground.single('backgroundFile'), async (req, res) => {
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

app.post('/upload-audio', uploadAudio.single('audio'), async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
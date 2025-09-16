import express from "express";
import fs from "fs";
import path from "path";
import { EventEmitter } from 'events';
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {getSurahDataRange} from './utility/data.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const progressEmitter = new EventEmitter();

const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'Data/Background_Video/uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const uploadBackground = multer({ storage: backgroundStorage });

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'Data/audio/custom';
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ audioStorage });

const connection = new IORedis({
  maxRetriesPerRequest: null,
});
const videoQueue = new Queue('video-queue', { connection });
console.log('Server connected to video-queue.');

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "public")));

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

  const sendProgress = (progress) => {
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  };

  progressEmitter.on('progress', sendProgress);

  req.on('close', () => {
    progressEmitter.removeListener('progress', sendProgress);
  });
});

app.get("/api/videos", (req, res) => {
  const videoDir = path.resolve(__dirname, "Output_Video");
  fs.readdir(videoDir, (err, files) => {
    if (err) {
      console.error('Error reading video directory:', err);
      return res.status(500).json({ error: 'Unable to read videos' });
    }
    // Filter for video files
    const videoFiles = files.filter(file =>
      ['.mp4', '.mov', '.avi'].includes(path.extname(file).toLowerCase())
    );
    res.json({ videos: videoFiles });
  });
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

app.get("/videos/:video", (req, res) => {
  const video = req.params.video;
  const filePath = path.resolve(__dirname, "Output_Video", video);
  
  if (req.query.download) {
    res.download(filePath);
  } else {
    res.sendFile(filePath);
  }
});

app.post("/generate-partial-video", async (req, res) => {
  console.log("Received request for partial video. Adding to queue...");
  try {
    const job = await videoQueue.add('process-video', { type: 'partial', videoData: req.body });
    res.status(202).json({ message: "Video generation has been queued.", jobId: job.id });
  } catch (error) {
    console.error("Error adding partial video job to queue:", error);
    res.status(500).send("Failed to queue video generation.");
  }
});

app.post("/generate-full-video", async (req, res) => {
  console.log("Received request for full video. Adding to queue...");
  try {
    const job = await videoQueue.add('process-video', { type: 'full', videoData: req.body });
    res.status(202).json({ message: "Video generation has been queued.", jobId: job.id });
  } catch (error) {
    console.error("Error adding full video job to queue:", error);
    res.status(500).send("Failed to queue video generation.");
  }
});

app.get('/api/surah-verses-text', async (req, res) => {
  const { surahNumber, startVerse, endVerse } = req.query;
  if (!surahNumber || !startVerse || !endVerse) {
    return res.status(400).json({ error: 'Missing surahNumber, startVerse, or endVerse' });
  }

  try {
    const { combinedText } = await getSurahDataRange(
      parseInt(surahNumber),
      parseInt(startVerse),
      parseInt(endVerse),
      null, // reciterEdition (not needed)
      "quran-simple", // textEdition
      null, // translationEdition (not needed)
      null, // transliterationEdition (not needed)
      true // textOnly
    );
    const verses = combinedText.split('\n').filter(Boolean);
    res.json({ verses });
  } catch (error) {
    console.error("Error fetching surah verses text:", error);
    res.status(500).json({ error: 'Failed to fetch verse text' });
  }
});

app.post('/upload-background', uploadBackground.single('backgroundFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.json({ backgroundPath: req.file.path });
});

app.post('/upload-audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No audio uploaded.');
  }
  res.json({ audioPath: req.file.path });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
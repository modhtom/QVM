import express from "express";
import { generatePartialVideo, generateFullVideo } from "./video.js";
import fs from "fs";
import path from "path";
import { EventEmitter } from 'events';
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const progressEmitter = new EventEmitter();

app.use(cors());
app.use(express.json());

app.use(express.static(path.resolve(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public/index.html"));
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
  const {
    surahNumber,
    startVerse,
    endVerse,
    removeFilesAfterCreation,
    color,
    useCustomBackground,
    videoNumber,
    edition,
    size,
    crop,
  } = req.body;

  try {
    const vidPath = await generatePartialVideo(
      surahNumber,
      startVerse,
      endVerse,
      removeFilesAfterCreation,
      color,
      useCustomBackground,
      videoNumber,
      edition,
      size,
      crop,
      null,
      (progress) => {
        console.log("Partial video progress:", progress);
        progressEmitter.emit('progress', progress);
      }
    );
    res.status(200).json({
      message: "Partial video generation completed successfully.",
      vidPath: path.basename(vidPath),
    });
  } catch (error) {
    console.error("Error generating partial video:", error);
    res.status(500).send("Failed to generate partial video.");
  }
});
app.post("/generate-full-video", async (req, res) => {
  const {
    surahNumber,
    edition,
    color,
    useCustomBackground,
    removeFilesAfterCreation,
    videoNumber,
    size,
    crop,
  } = req.body;
  try {
    const vidPath = await generateFullVideo(
      surahNumber,
      removeFilesAfterCreation,
      color,
      useCustomBackground,
      videoNumber,
      edition,
      size,
      crop,
      (progress) => {
        console.log("Full video progress:", progress);
        progressEmitter.emit('progress', progress);
      }
    );
    res.status(200).json({
      message: "Full video generation completed successfully.",
      vidPath:path.basename(vidPath),
    });
  } catch (error) {
    console.error("Error generating full video:", error);
    res.status(500).send("Failed to generate full video.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

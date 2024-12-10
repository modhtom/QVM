//TODO: login / private videos / use DB ? 
import express from "express";
import { generatePartialVideo, generateFullVideo } from "./video.js";
import fs from "fs";
import path from "path";
import { EventEmitter } from 'events';

const app = express();
const PORT = 3001;
const progressEmitter = new EventEmitter();

// Middleware to parse JSON requests
app.use(express.json());

const OUTPUT_VIDEO_FOLDER = path.join(
  "C:/Users/moham/OneDrive/Desktop/QVM",
  "Output_Video",
);

const PUBLIC_FOLDER = path.join(
  "C:/Users/moham/OneDrive/Desktop/QVM",
  "public",
);
app.use(express.static(PUBLIC_FOLDER));

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

// Add a route for serving video files
app.use("/videos", express.static(OUTPUT_VIDEO_FOLDER));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_FOLDER, "index.html"));
});

app.get("/videos", (req, res) => {
  fs.readdir(OUTPUT_VIDEO_FOLDER, (err, files) => {
    if (err) {
      console.error("Error reading video directory:", err);
      return res.status(500).send("Failed to retrieve videos.");
    }

    // Filter files to include only video files (e.g., with `.mp4` extension)
    const videos = files.filter((file) => file.endsWith(".mp4"));

    res.json({ videos });
  });
});

// Route to generate a partial video
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
  } = req.body;

    
  console.log(`Surah number:${surahNumber}, remove files after creation:${removeFilesAfterCreation}
    color:${color}, use custom background:${useCustomBackground}, video number:${videoNumber},
     edition:${edition}.`);
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
      (progress) => progressEmitter.emit('progress', progress)
    );
    res.status(200).json({
      message: "Partial video generation completed successfully.",
      vidPath,
    });
  } catch (error) {
    console.error("Error generating partial video:", error);
    res.status(500).send("Failed to generate partial video.");
  }
});

// Route to generate a full video
app.post("/generate-full-video", async (req, res) => {
  const {
    surahNumber,
    removeFilesAfterCreation,
    color,
    useCustomBackground,
    videoNumber,
    edition,
  } = req.body;
  console.log(`Surah number:${surahNumber}, remove files after creation:${removeFilesAfterCreation}
    color:${color}, use custom background:${useCustomBackground}, video number:${videoNumber},
     edition:${edition}.`);
  try {
    const vidPath = await generateFullVideo(
      surahNumber,
      removeFilesAfterCreation,
      color,
      useCustomBackground,
      videoNumber,
      edition,
      (progress) => progressEmitter.emit('progress', progress)
    );
    res.status(200).json({
      message: "Full video generation completed successfully.",
      vidPath,
    });
  } catch (error) {
    console.error("Error generating full video:", error);
    res.status(500).send("Failed to generate full video.");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

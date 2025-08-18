import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import youtubedl from "youtube-dl-exec";
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export async function getBackgroundPath(newBackground, videoNumber, len, crop) {
  const backgroundVideoPath = "Data/Background_Video/";
  const backgroundVideos = ["CarDrive.mp4"];
  if (videoNumber < 1) {
    videoNumber = 1;
  }

  if (newBackground) {
    if (typeof videoNumber === 'string' && fs.existsSync(videoNumber)) {
      console.log(`Using local uploaded file: ${videoNumber}`);
      const fileExtension = path.extname(videoNumber).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
        return await createBackgroundFromImage(videoNumber, len, crop);
      } else {
        return await createBackgroundVideo(videoNumber, len, crop);
      }
    }

    if (typeof videoNumber === 'string' && videoNumber.startsWith('pexels:')) {
      const query = videoNumber.split(':')[1];
      return await downloadVideoFromPexels(query, len, crop);
    }
    if (typeof videoNumber === 'string' && (videoNumber.endsWith('.jpg') || videoNumber.endsWith('.png') || videoNumber.endsWith('.jpeg'))) {
      return await createBackgroundFromImage(videoNumber, len, crop);
    } else {
      const url = videoNumber;
      const start = 0;
      try {
        const downloadedPath = await downloadVideoFromYoutube(url, start, len, crop);
        return await createBackgroundVideo(downloadedPath, len, crop);
      } catch (error) {
        console.error("Error downloading video:", error.message);
        throw new Error("Failed to download and process custom background video.");
      }
    }
  } else {
    const defaultVideoPath = backgroundVideoPath + backgroundVideos[videoNumber - 1];
    if (fs.existsSync(defaultVideoPath)) {
      console.log(`Using existing default background video: ${defaultVideoPath}`);
      return await createBackgroundVideo(defaultVideoPath, len, crop);
    } else {
      console.log("Downloading default background video from YouTube...");
      try {
        const fallbackPath = await downloadVideoFromYoutube(
          "https://youtu.be/nABR88G_2cE?si=vHPIVmRCbZGWg8X7",
          20,
          len
        );
        return await createBackgroundVideo(fallbackPath, len, crop);
      } catch (error) {
        console.error("Error downloading default background video:", error.message);
        throw new Error("Failed to download and process default background video.");
      }
    }
  }
}

async function createBackgroundFromImage(imagePath, len, crop) {
  const outputPath = `Data/Background_Video/processed_image_${Date.now()}.mp4`;

  return new Promise((resolve, reject) => {
    const filters = crop === 'vertical' ? [
      'scale=-1:1920',
      'crop=1080:1920',
      'setsar=1:1'
    ] : [
      'scale=1920:-1',
      'crop=1920:1080',
      'setsar=1:1'
    ];

    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1'])
      .output(outputPath)
      .videoFilters(filters)
      .duration(len)
      .noAudio()
      .videoCodec("libx264")
      .on("end", () => {
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("FFMPEG Error: ", err.message);
        reject(new Error("Failed to create background video from image."));
      })
      .run();
  });
}
async function downloadVideoFromPexels(query, length, crop) {
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
  if (!PEXELS_API_KEY) {
    throw new Error("PEXELS_API_KEY is not set in environment variables.");
  }
  try {
    const searchResponse = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const video = searchResponse.data.videos[0];
    if (!video) throw new Error('No videos found');

    const videoFile = video.video_files
      .filter(file => file.file_type === 'video/mp4')
      .sort((a, b) => b.width - a.width)[0];

    const tempPath = `Data/Background_Video/pexels_temp_${Date.now()}.mp4`;
    const writer = fs.createWriteStream(tempPath);

    const downloadResponse = await axios({
      url: videoFile.link,
      method: 'GET',
      responseType: 'stream'
    });
    downloadResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const finalPath = await createBackgroundVideo(tempPath, length, crop);
    fs.unlinkSync(tempPath);
    return finalPath;

  } catch (error) {
    console.error('Pexels Error Message:', error.message);
    console.error('Full Error:', error.response?.data || error);
    throw new Error('Failed to download from Pexels');
  }
}


function downloadVideoFromYoutube(url, start, length, name = "temp") {
  return new Promise((resolve, reject) => {
    const outputDir = "Data/Background_Video";
    const outputName = `video_${name || url.slice(0, 9)}.mp4`;
    const outputPath = path.join(outputDir, outputName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const options = {
      output: outputPath,
      format: 'best[ext=mp4]/mp4',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0'
      ],
      postprocessorArgs: [
        '-ss', start.toString(),
        '-t', length.toString()
      ]
    };


    youtubedl(url, options)
      .then(() => {
        console.log("Video segment downloaded successfully:", outputPath);

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Downloaded file not found or empty at ${outputPath}`));
        }
      })
      .catch((error) => {
        console.error("Error downloading video:", error.message);
        reject(new Error(`Failed to download video: ${error.message}`));
      });
  });
}

function createBackgroundVideo(videoPath, len, crop) {
  const outputPath = `Data/Background_Video/processed_${Date.now()}.mp4`;

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Input video ${videoPath} does not exist`);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath).ffprobe((err, data) => {
      if (err) return reject(err);

      const videoStream = data.streams.find(s => s.codec_type === 'video');
      if (!videoStream) return reject(new Error("No video stream found"));

      const width = videoStream.width;
      const height = videoStream.height;
      
      let filters = [];
      if (crop === "vertical") { // Target is 9:16
        filters = [
          `scale=1080:1920:force_original_aspect_ratio=increase`,
          `crop=1080:1920`,
          'setsar=1:1'
        ];
      } else { // Target is 16:9
        filters = [
          `scale=1920:1080:force_original_aspect_ratio=increase`,
          `crop=1920:1080`,
          'setsar=1:1'
        ];
      }
      
      ffmpeg()
        .input(videoPath)
        .duration(len)
        .noAudio()
        .videoCodec("libx264")
        .videoFilters(filters)
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", (err, stdout, stderr) => {
          console.error("FFMPEG Error: ", err.message);
          console.error("FFmpeg stderr: ", stderr);
          reject(new Error(`FFmpeg failed: ${stderr}`));
        })
        .run();
    });
  });
}
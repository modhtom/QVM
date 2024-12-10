import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { exec } from "child_process";
import youtubedl from "youtube-dl-exec";
import path from 'path';

export async function getBackgroundPath(newBackground, videoNumber, len) {
  const backgroundVideoPath = "Data/Background_Video/";
  const backgroundVideos = ["CarDrive.mp4"];

  if (newBackground) {
    const url = videoNumber;
    const start = 0;

    try {
      const downloadedPath = await downloadVideoFromYoutube(url, start, len);
      return await createBackgroundVideo(downloadedPath, len);
    } catch (error) {
      console.error("Error downloading video:", error.message);
      throw new Error("Failed to download and process custom background video.");
    }
  } else {
    const defaultVideoPath = backgroundVideoPath + backgroundVideos[videoNumber - 1];
    if (fs.existsSync(defaultVideoPath)) {
      console.log(`Using existing default background video: ${defaultVideoPath}`);
      return await createBackgroundVideo(defaultVideoPath, len);
    } else {
      console.log("Downloading default background video from YouTube...");
      alert("Downloading default background video from YouTube...\nit may take a while...");
      try {
        const fallbackPath = await downloadVideoFromYoutube(
          "https://youtu.be/nABR88G_2cE?si=vHPIVmRCbZGWg8X7",
          20,
          len
        );
        return await createBackgroundVideo(fallbackPath, len);
      } catch (error) {
        console.error("Error downloading default background video:", error.message);
        throw new Error("Failed to download and process default background video.");
      }
    }
  }
}


async function downloadVideoFromPexels(description, length) {
  // TODO: Implement Pexels API integration
  throw new Error("Pexels download not implemented yet");
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

        // Verify file exists and has content
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

function createBackgroundVideo(videoPath, len) {
  const outputPath = `Data/Background_Video/processed_${Date.now()}.mp4`;

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Input video ${videoPath} does not exist`);
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .output(outputPath)
      .duration(len)
      .noAudio()
      .videoCodec("libx264")
      .on("end", () => {
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("FFMPEG Error: ", err.message);
        reject(new Error("Failed to create background video."));
      })
      .run();
  });
}

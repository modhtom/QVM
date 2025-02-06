import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import youtubedl from "youtube-dl-exec";
import path from 'path';
import axios from 'axios';

export async function getBackgroundPath(newBackground, videoNumber, len) {
  const backgroundVideoPath = "Data/Background_Video/";
  const backgroundVideos = ["CarDrive.mp4"];
  if (newBackground) {
    if (typeof videoNumber === 'string' && videoNumber.startsWith('pexels:')) {
      // Handle background using pexels 
      const query = videoNumber.split(':')[1];
      return await downloadVideoFromPexels(query, len);
    }
    if (typeof videoNumber === 'string' && (videoNumber.endsWith('.jpg') || videoNumber.endsWith('.png') || videoNumber.endsWith('.jpeg'))) {
      // Handle image background
      return await createBackgroundFromImage(videoNumber, len);
    } else {
      // Handle video background
      const url = videoNumber;
      const start = 0;
      try {
        const downloadedPath = await downloadVideoFromYoutube(url, start, len);
        return await createBackgroundVideo(downloadedPath, len);
      } catch (error) {
        console.error("Error downloading video:", error.message);
        throw new Error("Failed to download and process custom background video.");
      }
    }
  } else {
    const defaultVideoPath = backgroundVideoPath + backgroundVideos[videoNumber - 1];
    if (fs.existsSync(defaultVideoPath)) {
      console.log(`Using existing default background video: ${defaultVideoPath}`);
      return await createBackgroundVideo(defaultVideoPath, len);
    } else {
      console.log("Downloading default background video from YouTube...");
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

async function createBackgroundFromImage(imagePath, len) {
  const outputPath = `Data/Background_Video/processed_image_${Date.now()}.mp4`;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1'])
      .output(outputPath)
      .videoFilters([
        'scale=-1:1920',
        'crop=1080:1920',
        'setsar=1:1'
      ])
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
async function downloadVideoFromPexels(query, length) {
  const PEXELS_API_KEY = 'V5r0CFeFOnjtoWoe515SJd8ZgN2KZRbAp2aX6vdOowplbDOmxzYCecWy'; //TODO: add your api key here
  try {
    const searchResponse = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const video = searchResponse.data.videos[0];
    if (!video) throw new Error('No videos found');
    
    // Get best quality MP4
    const videoFile = video.video_files
      .filter(file => file.file_type === 'video/mp4')
      .sort((a, b) => b.width - a.width)[0];

    // Download video
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

    // Process video
    const finalPath = await createBackgroundVideo(tempPath, length);
    fs.unlinkSync(tempPath);
    return finalPath;

  } catch (error) {
    console.error('Pexels Error:', error);
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
      .videoFilters([
        'scale=-1:1920',
        'crop=1080:1920',
        'setsar=1:1'
      ])
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

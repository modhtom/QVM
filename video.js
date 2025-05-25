import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { partAudioAndText } from "./utility/data.js";
import { getBackgroundPath } from "./utility/background.js";
import { deleteVidData, deleteOldVideos } from "./utility/delete.js";
import { generateSubtitles } from "./utility/subtitle.js";
import fs from "fs";
import * as mm from "music-metadata";
import path from "path";

const fontPosition = "1920,1080";
const fontName = "Tasees Regular"

export async function generateFullVideo(
  surahNumber,
  removeFiles,
  color,
  useCustomBackground,
  videoNumber,
  edition,
  size,
  progressCallback = () => {}
) {
  const endVerse = await getEndVerse(surahNumber);
  progressCallback({ step: 'Starting full video generation', percent: 0 });
  generatePartialVideo(
    surahNumber,
    1,
    endVerse,
    removeFiles,
    color,
    useCustomBackground,
    videoNumber,
    edition,
    size,
    crop,
    progressCallback
  );
}

export async function generatePartialVideo(
  surahNumber,
  startVerse,
  endVerse,
  removeFiles,
  color,
  useCustomBackground,
  videoNumber,
  edition,
  size,
  crop,
   customAudioPath = null,
  progressCallback = () => {}
) {
  progressCallback({ step: 'Starting video generation', percent: 0 });
  const limit = await getEndVerse(surahNumber);
  if (endVerse > limit) endVerse = limit;

  if(color===undefined)
    color = "#ffffff";

  let audioPath, textPath, durationsFile;
  if(customAudioPath) {
    audioPath = customAudioPath;
  } else {
    progressCallback({ step: 'Fetching audio and text', percent: 10 });
     audioPath, textPath, durationsFile = await fetchAudioAndText(
      surahNumber,
      startVerse,
      endVerse,
      edition,
    );
  }
  let audioHeld = false;
  await new Promise((resolve, reject) => {
    audioHeld = true;
    const checkAudioFile = setInterval(() => {
      if (
        fs.existsSync(audioPath) &&
        !fs.existsSync(`temp_${surahNumber}_${startVerse}.mp3`)
      ) {
        setTimeout(() => {
          if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
            clearInterval(checkAudioFile);
            audioHeld = false;
            resolve();
          }
        }, 1000);
      }
    }, 500);
  });
  
  progressCallback({ step: 'Processing audio', percent: 30 });
  let audioLen;
  if (!audioHeld) {
    audioLen = await getAudioDuration(audioPath);
    if (audioLen == -1) {
      console.error("Error: Invalid audio file.");
      return null;
    } else if (audioLen == NaN) {
      setTimeout(() => {
        console.log("waiting for audio len");
      }, 1000);
    }
  } else {
    setTimeout(() => {
      console.log("waiting for audio len");
    }, 10000);
  }
  if (audioLen == NaN)
    console.error(`Audio length: ${audioLen}`);
  
  progressCallback({ step: 'Preparing background video', percent: 40 });
  const backgroundPath = await getBackgroundPath(
    useCustomBackground,
    videoNumber,
    audioLen,
    crop,
  );

  progressCallback({ step: 'Generating subtitles', percent: 50 });
  const subPath = `Data/subtitles/Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.ass`;
  
  const aColor = cssColorToASS(color);

  const ret = await generateSubtitles(
    surahNumber,
    startVerse,
    endVerse,
    aColor,
    fontPosition,
    fontName,
    size
);

  if (ret != 1) {
    console.log(`no subtitle file at ${subPath}`);
    return;
  }


  const outputDir = path.resolve("Output_Video");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(
    outputDir,
    `Surah_${surahNumber}_Video_from_${startVerse}_to_${endVerse}.mp4`
  );
  
  if (!fs.existsSync(subPath)) {
    console.error(`Subtitle file does not exist at ${subPath}`);
    return;
  }
  
  progressCallback({ step: 'Rendering final video', percent: 60 });
    await new Promise((resolve, reject) => {
      ffmpeg()
      .input(backgroundPath)
      .input(audioPath)
      .audioCodec("aac")
      .audioFilters("aformat=sample_fmts=fltp:channel_layouts=stereo")
      .videoCodec("libx264")
      .outputOptions(
        "-vf",
        `subtitles='${subPath}:force_style=Fontname=${fontName},Encoding=1,format=yuv444p'`
      )
      .outputOptions("-preset", "fast")
      .output(outputPath)
      .on('progress', (progress) => {
        const mappedProgress = 60 + (progress.percent * 0.3);
        progressCallback({ 
          step: 'Rendering video', 
          percent: Math.min(90, mappedProgress)
        });
        console.log(`Rendered video progress ${progress.percent}% complete`);
      })
      .on("end", async () => {
        console.log("Video created successfully.");
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Error processing video: ", err);
        console.error("FFmpeg stderr: ", stderr); // Log stderr for more details
        reject(err);
      })
      .run();
  });
  progressCallback({ step: 'Cleaning up', percent: 98 });
  deleteVidData(
    removeFiles,
    audioPath,
    textPath,
    backgroundPath,
    durationsFile,
    subPath,
  );
  deleteOldVideos();

  progressCallback({ step: 'Complete', percent: 100 });
}

async function fetchAudioAndText(surahNumber, startVerse, endVerse, edition) {
  const audioPath = `Data/audio/Surah_${surahNumber}_Audio_from_${startVerse}_to_${endVerse}.mp3`;
  const textPath = `Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`;
  const durationsFile = `Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`;

  const DATA = await partAudioAndText(
    surahNumber,
    startVerse,
    endVerse,
    edition,
  );
  if (DATA === -1) return null;

  return { audioPath, textPath, durationsFile };
}

async function getAudioDuration(audioPath) {
  try {
    const metadata = await mm.parseFile(audioPath);
    const durationInSeconds = metadata.format.duration;
    return Math.round(durationInSeconds);
  } catch (error) {
    console.error("Error reading audio file:", error);
    return -1;
  }
}

async function getEndVerse(surahNumber) {
  try {
    const response = await axios.get(
      `http://api.alquran.cloud/v1/surah/${surahNumber}`,
    );
    return response.data?.data.numberOfAyahs || -1;
  } catch (error) {
    console.error("Error fetching end verse: ", error);
    return -1;
  }
}

const cssColorToASS = (cssColor) => {
  const hex = cssColor.replace("#", "");
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `&H00${b}${g}${r}`;
};
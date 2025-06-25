import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { partAudioAndText } from "./utility/data.js";
import { getBackgroundPath } from "./utility/background.js";
import { deleteVidData, deleteOldVideos } from "./utility/delete.js";
import { generateSubtitles } from "./utility/subtitle.js";
import {getSurahDataRange} from './utility/data.js'
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
  crop,
  customAudioPath,
  progressCallback = () => { },
  userVerseTimings = null
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
    customAudioPath,
    progressCallback,
    userVerseTimings
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
  customAudioPath,
  progressCallback = () => { },
  userVerseTimings = null
) {
  console.log("MAKING A VIDEO")
  if (!surahNumber || !startVerse || !endVerse) {
    progressCallback({ step: 'Validation failed', percent: 100, error: true });
    throw new Error("Missing required parameters");
  }
  progressCallback({ step: 'Starting video generation', percent: 0 });
  const limit = await getEndVerse(surahNumber);
  if (endVerse > limit) endVerse = limit;
  if (color === undefined)
    color = "#ffffff";
  if (!crop) crop = "vertical";

  let audioPath, textPath, durationsFile;
  if (customAudioPath) {
    audioPath = customAudioPath;
    progressCallback({ step: 'Using custom audio', percent: 10 });
    
    progressCallback({ step: 'Fetching text data', percent: 20 });
    const result = await fetchTextOnly(
      surahNumber,
      startVerse,
      endVerse,
      edition
    );
    textPath = result.textPath;
    durationsFile = result.durationsFile;
  } else {
    
    progressCallback({ step: 'Fetching audio and text', percent: 10 });
    const result = await fetchAudioAndText(
      surahNumber,
      startVerse,
      endVerse,
      edition,
    );
    audioPath = result.audioPath;
    textPath = result.textPath;
    durationsFile = result.durationsFile;
  }
  let audioHeld = false;
  await new Promise((resolve, reject) => {
    
    audioHeld = true;
    let attempts = 0;
    const maxAttempts = 60;
    
    const checkAudioFile = setInterval(() => {
      attempts++;
      // Timeout handling
      if (attempts > maxAttempts) {
        clearInterval(checkAudioFile);
        reject(new Error("Audio file creation timed out"));
        return;
      }

      if (
        fs.existsSync(audioPath) &&
        fs.statSync(audioPath).size > 0
      ) {
        clearInterval(checkAudioFile);
        audioHeld = false;
        resolve();
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
    } else if (isNaN(audioLen)) {
      setTimeout(() => {
        console.log("waiting for audio len");
      }, 1000);
    }
  } else {
    setTimeout(() => {
      console.log("waiting for audio len");
    }, 10000);
  }
  if (isNaN(audioLen))
    console.error(`Audio length: ${audioLen}`);

  progressCallback({ step: 'Preparing background video', percent: 40 });
  const backgroundPath = await getBackgroundPath(
    useCustomBackground,
    videoNumber || 1,
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
    size,
    customAudioPath || audioPath,
    userVerseTimings 
  );

  if (ret != 1) {
    console.log(`no subtitle file at ${subPath}`);
    progressCallback({ step: 'Error generating subtitle file', percent: 100, error: true });
    return null;
  }

  const outputDir = path.resolve("Output_Video");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFileName = `Surah_${surahNumber}_Video_from_${startVerse}_to_${endVerse}.mp4`;
  const outputPath = path.join(
    outputDir,
    outputFileName
  );

  if (!fs.existsSync(subPath)) {
    console.error(`Subtitle file does not exist at ${subPath}`);
    progressCallback({ step: 'Error: Subtitle file missing before render', percent: 100, error: true });
    return null;
  }

  progressCallback({ step: 'Rendering final video', percent: 60 });
  await new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(backgroundPath)
      .input(audioPath)
      .audioCodec("aac")
      .audioFilters("aformat=sample_fmts=fltp:channel_layouts=stereo")
      .videoCodec("libx264")
      .outputOptions("-preset", "fast")
      .output(outputPath);

    // Add subtitles with proper timing handling
    command.complexFilter([
      `subtitles='${subPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}':force_style='Fontname=${fontName},Encoding=1'`
    ]);

    command.on('progress', (progress) => {
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
      console.error("FFmpeg stderr: ", stderr);
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
  return outputFileName;
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
    if (DATA === -1) {
    throw new Error("Failed to fetch audio and text data");
  }

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

async function fetchTextOnly(surahNumber, startVerse, endVerse, edition) {
  const textPath = `Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`;
  const durationsFile = `Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`;

  const { combinedText, durationPerAyah } = await getSurahDataRange(
    surahNumber,
    startVerse,
    endVerse,
    edition,
    "quran-simple",
    true
  );

  if (combinedText) {
    const textOutputDir = path.resolve("Data/text");
    fs.mkdirSync(textOutputDir, { recursive: true });
    fs.writeFileSync(textPath, combinedText, "utf-8");
    fs.writeFileSync(durationsFile, JSON.stringify(durationPerAyah), "utf-8");
  }

  return { textPath, durationsFile };
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
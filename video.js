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

export async function generateFullVideo(
  surahNumber, removeFiles, color, useCustomBackground, videoNumber, edition, size, crop, customAudioPath, fontName, translationEdition, transliterationEdition,
  progressCallback = () => { },
  userVerseTimings = null
) {
  const endVerse = await getEndVerse(surahNumber);
  progressCallback({ step: 'Starting full video generation', percent: 0 });
  return generatePartialVideo(
    surahNumber, 1, endVerse, removeFiles, color, useCustomBackground, videoNumber, edition, size, crop, customAudioPath, fontName, translationEdition, transliterationEdition, progressCallback, userVerseTimings
  );
}

export async function generatePartialVideo(
  surahNumber, startVerse, endVerse, removeFiles, color, useCustomBackground, videoNumber, edition, size, crop, customAudioPath, fontName, translationEdition, transliterationEdition,
  progressCallback = () => { },
  userVerseTimings = null
) {
  console.log("MAKING A VIDEO");
  if (!surahNumber || !startVerse || !endVerse) {
    throw new Error("Missing required parameters");
  }
  progressCallback({ step: 'Starting video generation', percent: 0 });
  const limit = await getEndVerse(surahNumber);
  if (endVerse > limit) endVerse = limit;
  if (!color) color = "#ffffff";
  if (!crop) crop = "vertical";

  let audioPath, textPath, durationsFile;
  if (customAudioPath) {
    audioPath = customAudioPath;
    progressCallback({ step: 'Using custom audio', percent: 10 });
    progressCallback({ step: 'Fetching text data', percent: 20 });
    const result = await fetchTextOnly(surahNumber, startVerse, endVerse, translationEdition, transliterationEdition);
    textPath = result.textPath;
    durationsFile = result.durationsFile;
  } else {
    progressCallback({ step: 'Fetching audio and text', percent: 10 });
    // FIX WAS HERE: Added translationEdition and transliterationEdition to this call
    const result = await fetchAudioAndText(surahNumber, startVerse, endVerse, edition, translationEdition, transliterationEdition);
    audioPath = result.audioPath;
    textPath = result.textPath;
    durationsFile = result.durationsFile;
  }
  
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const checkAudioFile = setInterval(() => {
      if (++attempts > 60) {
        clearInterval(checkAudioFile);
        return reject(new Error("Audio file creation timed out"));
      }
      if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
        clearInterval(checkAudioFile);
        resolve();
      }
    }, 500);
  });

  progressCallback({ step: 'Processing audio', percent: 30 });
  const audioLen = await getAudioDuration(audioPath);
  if (isNaN(audioLen)) {  
    throw new Error("Audio length is not a number");
  }

  progressCallback({ step: 'Preparing background video', percent: 40 });
  const backgroundPath = await getBackgroundPath(useCustomBackground, videoNumber || 1, audioLen, crop);

  progressCallback({ step: 'Generating subtitles', percent: 50 });
  const subPath = `Data/subtitles/Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.ass`;
  const aColor = cssColorToASS(color);
  await generateSubtitles(surahNumber, startVerse, endVerse, aColor, fontPosition, fontName, size, customAudioPath || audioPath, userVerseTimings);

  const outputDir = path.resolve("Output_Video");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputFileName = `Surah_${surahNumber}_Video_from_${startVerse}_to_${endVerse}.mp4`;
  const outputPath = path.join(outputDir, outputFileName);
  if (!fs.existsSync(subPath)) throw new Error("Subtitle file missing");

  progressCallback({ step: 'Rendering final video', percent: 60 });
  await new Promise((resolve, reject) => {
    const subtitleFilter = `subtitles='${subPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}':force_style='Fontname=${fontName},Encoding=1'`;
    ffmpeg()
      .input(backgroundPath)
      .input(audioPath)
      .audioCodec("aac")
      .videoCodec("libx264")
      .outputOptions("-preset", "ultrafast")
      .outputOptions(['-map', '1:a:0'])
      .complexFilter(`[0:v]${subtitleFilter}[v_out]`)
      .map('[v_out]')
      .output(outputPath)
      .on('progress', (progress) => {
        const mappedProgress = 60 + (progress.percent * 0.3);
        progressCallback({ step: 'Rendering video', percent: Math.min(90, mappedProgress) });
      })
      .on("end", () => {
        console.log("Video created successfully.");
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("Error processing video: ", stderr);
        reject(new Error(stderr));
      })
      .run();
  });
  
  progressCallback({ step: 'Cleaning up', percent: 98 });
  deleteVidData(removeFiles, audioPath, textPath, backgroundPath, durationsFile, subPath, customAudioPath);
  deleteOldVideos();

  progressCallback({ step: 'Complete', percent: 100 });
  return outputPath;
}

async function fetchAudioAndText(surahNumber, startVerse, endVerse, edition, translationEdition, transliterationEdition) {
  const audioPath = `Data/audio/Surah_${surahNumber}_Audio_from_${startVerse}_to_${endVerse}.mp3`;
  const textPath = `Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`;
  const durationsFile = `Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`;
  await partAudioAndText(surahNumber, startVerse, endVerse, edition, "quran-simple", translationEdition, transliterationEdition);
  return { audioPath, textPath, durationsFile };
}

async function getAudioDuration(audioPath) {
  try {
    const metadata = await mm.parseFile(audioPath);
    return metadata.format.duration;
  } catch (error) {
    console.error("Error reading audio file:", error);
    return 0;
  }
}

async function fetchTextOnly(surahNumber, startVerse, endVerse, translationEdition, transliterationEdition) {
  const textPath = `Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`;
  const durationsFile = `Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`;
  const { combinedText, combinedTranslation, combinedTransliteration, durationPerAyah } = await getSurahDataRange(surahNumber, startVerse, endVerse, null, "quran-simple", translationEdition, transliterationEdition, true);

  if (combinedText) {
    const textOutputDir = path.resolve("Data/text");
    if (!fs.existsSync(textOutputDir)) fs.mkdirSync(textOutputDir, { recursive: true });
    fs.writeFileSync(textPath, combinedText, "utf-8");
    
    if (combinedTranslation) {
        const translationOutputFile = path.resolve(textOutputDir, `Surah_${surahNumber}_Translation_from_${startVerse}_to_${endVerse}.txt`);
        fs.writeFileSync(translationOutputFile, combinedTranslation, "utf-8");
    }
    if (combinedTransliteration) {
        const transliterationOutputFile = path.resolve(textOutputDir, `Surah_${surahNumber}_Transliteration_from_${startVerse}_to_${endVerse}.txt`);
        fs.writeFileSync(transliterationOutputFile, combinedTransliteration, "utf-8");
    }
    fs.writeFileSync(durationsFile, JSON.stringify(durationPerAyah), "utf-8");
  }
  return { textPath, durationsFile };
}
async function getEndVerse(surahNumber) {
  try {
    const response = await axios.get(`http://api.alquran.cloud/v1/surah/${surahNumber}`);
    return response.data?.data.numberOfAyahs || -1;
  } catch (error) {
    console.error("Error fetching end verse: ", error);
    return -1;
  }
}

const cssColorToASS = (cssColor) => {
  if (!cssColor) return '&H00FFFFFF';
  const hex = cssColor.replace("#", "");
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
};
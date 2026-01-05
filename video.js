import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { partAudioAndText, getSurahDataRange } from "./utility/data.js";
import { getBackgroundPath } from "./utility/background.js";
import { deleteVidData, deleteOldVideosAndTempFiles } from "./utility/delete.js";
import { generateSubtitles } from "./utility/subtitle.js";
import { uploadToStorage, downloadFromStorage } from "./utility/storage.js";
import fs from "fs";
import * as mm from "music-metadata";
import path from "path";
import os from 'os';

const fontPosition = "1920,1080";
const api = axios.create({
  timeout: 10000 // 10 seconds timeout
});

let cachedEncoder = null;
async function detectBestEncoder() {
  if (cachedEncoder) return cachedEncoder;

  return new Promise((resolve) => {
    ffmpeg.getAvailableCodecs((err, codecs) => {
      if (err) {
        console.warn("Failed to query FFmpeg codecs, defaulting to libx264");
        cachedEncoder = 'libx264';
        return resolve('libx264');
      }

      const platform = os.platform();
      if (codecs['h264_nvenc']) {
        cachedEncoder = 'h264_nvenc'; // NVIDIA GPU
      } else if (platform === 'darwin' && codecs['h264_videotoolbox']) {
        cachedEncoder = 'h264_videotoolbox'; // macOS Apple Silicon/Intel
      } else if (codecs['h264_amf']) {
        cachedEncoder = 'h264_amf'; // AMD GPU
      } else if (codecs['h264_qsv']) {
        cachedEncoder = 'h264_qsv'; // Intel QuickSync
      } else if (codecs['h264_vaapi']) {
        cachedEncoder = 'h264_vaapi'; // Linux Generic HW
      } else {
        cachedEncoder = 'libx264'; // CPU Fallback
      }

      console.log(`[FFmpeg] Optimal Encoder Detected: ${cachedEncoder}`);
      resolve(cachedEncoder);
    });
  });
}
function getEncoderSettings(encoder) {
  const common = ['-pix_fmt yuv420p', '-movflags +faststart'];

  switch (encoder) {
    case 'h264_nvenc':
      // p4 = medium preset, rc=vbr_hq for better quality control
      return [...common, '-preset p4', '-rc vbr_hq', '-cq 23', '-b:v 0'];
    
    case 'h264_videotoolbox':
      // q:v is quality (0-100 on modern ffmpeg, roughly)
      return [...common, '-q:v 60', '-allow_sw 1'];
    
    case 'h264_amf':
      return [...common, '-usage transcoding', '-rc cqp', '-qp_i 23', '-qp_p 23'];
    
    case 'h264_qsv':
      return [...common, '-global_quality 23', '-look_ahead 1'];
    
    case 'libx264':
    default:
      return [...common, '-preset veryfast', '-crf 23', '-tune film'];
  }
}

async function getMetadataInfo(surahNumber, editionIdentifier) {
    try {
        const surahRes = await axios.get(`http://api.alquran.cloud/v1/surah/${surahNumber}`);
        const surahName = surahRes.data.data.name;
        let reciterName = "";
        if (editionIdentifier) {
            try {
                const editionRes = await axios.get(`http://api.alquran.cloud/v1/edition`);
                const edition = editionRes.data.data.find(e => e.identifier === editionIdentifier);
                if (edition) reciterName = edition.name;
            } catch(e) {
                console.warn("Could not fetch reciter name");
            }
        }
        return { surahName, reciterName };
    } catch (error) {
        console.error("Error fetching metadata info:", error.message);
        return { surahName: `Surah ${surahNumber}`, reciterName: "" };
    }
}

export async function generateFullVideo(
  surahNumber, removeFiles, color, useCustomBackground, videoNumber, edition, size, crop, customAudioPath, fontName, translationEdition, transliterationEdition,
  progressCallback = () => { },
  userVerseTimings = null,
  subtitlePosition = 'bottom',
  showMetadata = false,
  audioSource = 'api'
) {
  const endVerse = await getEndVerse(surahNumber);
  if (endVerse === -1) {
    throw new Error(`Could not retrieve data for Surah ${surahNumber}. The API might be down or the Surah number is invalid.`);
  }
  progressCallback({ step: 'Starting full video generation', percent: 0 });
  return generatePartialVideo(
    surahNumber, 1, endVerse, removeFiles, color, useCustomBackground, videoNumber, edition, size, crop, customAudioPath, fontName, translationEdition, transliterationEdition, progressCallback, userVerseTimings, subtitlePosition, showMetadata, audioSource
  );
}
export async function generatePartialVideo(
  surahNumber, startVerse, endVerse, removeFiles, color, useCustomBackground, videoNumber, edition, size, crop, customAudioPath, fontName, translationEdition, transliterationEdition,
  progressCallback = () => { },
  userVerseTimings = null,
  subtitlePosition = 'bottom',
  showMetadata = false,
  audioSource = 'api'
) {
  console.log("MAKING A VIDEO");
  console.log("DEBUG ARGS:", { surahNumber, startVerse, edition, customAudioPath });
  progressCallback({ step: 'Starting video generation', percent: 0 });

  const limit = await getEndVerse(surahNumber);
  if (limit === -1) {
    throw new Error(`Could not get Surah data for S${surahNumber}.`);
  }
  
  if (!surahNumber || !startVerse || !endVerse) throw new Error("Missing required parameters.");
  if (endVerse > limit) endVerse = limit;
  color = color || "#ffffff";
  crop = crop || "vertical";
  
  let audioPath, textPath, durationsFile;

if (customAudioPath.startsWith('uploads/')) {
        progressCallback({ step: 'Downloading Audio from Cloud', percent: 5 });
        const localTempAudio = path.resolve(`Data/temp/${path.basename(customAudioPath)}`);
        await downloadFromStorage(customAudioPath, localTempAudio);
        audioPath = localTempAudio;
        customAudioPath = localTempAudio;
    } else {
    progressCallback({ step: 'Fetching audio and text', percent: 10 });
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
        return reject(new Error(`Audio file access timed out: ${audioPath}`));
      }
      if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
        clearInterval(checkAudioFile);
        resolve();
      }
    }, 500);
  });

  progressCallback({ step: 'Processing audio', percent: 30 });
  let audioLen = await getAudioDuration(audioPath);
  audioLen = Math.ceil(audioLen || 0) + 1;
  
  if (isNaN(audioLen) || audioLen <= 0) {
    if (userVerseTimings && userVerseTimings.length > 0) {
        audioLen = Math.ceil(userVerseTimings[userVerseTimings.length - 1].end) + 2;
    } else {
        throw new Error("Could not determine audio length.");
    }
  }

  progressCallback({ step: 'Preparing background video', percent: 40 });
  const verseInfo = { surahNumber, startVerse, endVerse, translationEdition };
  const backgroundPath = await getBackgroundPath(useCustomBackground, videoNumber || 1, audioLen, crop, verseInfo);

  progressCallback({ step: 'Generating subtitles', percent: 50 });
  const subPath = `Data/subtitles/Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.ass`;
  const aColor = cssColorToASS(color);
  let metadata = null;
  if (showMetadata) {
      metadata = await getMetadataInfo(surahNumber, edition);
  }

  await generateSubtitles(
      surahNumber, startVerse, endVerse, aColor, fontPosition, fontName, size, 
      audioLen, customAudioPath || audioPath, userVerseTimings, 
      subtitlePosition, metadata
  );

  const outputDir = path.resolve("Output_Video");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputFileName = `Surah_${surahNumber}_Video_from_${startVerse}_to_${endVerse}_${Date.now()}.mp4`;
  const outputPath = path.join(outputDir, outputFileName);

  const encoder = await detectBestEncoder();
  const encoderOptions = getEncoderSettings(encoder);

  progressCallback({ step: 'Rendering final video', percent: 60 });
  await new Promise((resolve, reject) => {
    const escapedSubPath = subPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
    const subtitleFilter = `subtitles='${escapedSubPath}':force_style='Fontname=${fontName},Encoding=1'`;
    
    const command = ffmpeg()
      .input(backgroundPath)
      .input(audioPath)
      .audioCodec("aac")
      .videoCodec(encoder)
      .outputOptions(['-map', '0:v:0', '-map', '1:a:0'])
      .outputOptions(encoderOptions)
      .videoFilter(subtitleFilter)
      .output(outputPath);

    if (encoder === 'libx264') command.outputOptions("-preset", "veryfast");
      
    command.on('progress', (progress) => {
        const mappedProgress = 60 + (progress.percent * 0.3);
        progressCallback({ step: `Rendering: ${Math.round(progress.percent || 0)}%`, percent: Math.min(90, mappedProgress) });
      })
      .on("end", () => resolve())
      .on("error", (err, stdout, stderr) => {
        console.error("FFmpeg error:", stderr);
        if (encoder !== 'libx264') {
          console.warn("Hardware encoding failed, retrying with CPU...");
          cachedEncoder = 'libx264';
          const cpuCommand = ffmpeg()
            .input(backgroundPath)
            .input(audioPath)
            .audioCodec("aac")
            .videoCodec("libx264")
            .outputOptions(['-preset veryfast', '-crf 23', '-pix_fmt yuv420p', '-map 0:v:0', '-map 1:a:0'])
            .videoFilter(subtitleFilter)
            .output(outputPath)
            .on('end', resolve)
            .on('error', (e) => reject(new Error(e)));
          cpuCommand.run();
        } else {
          reject(new Error(stderr));
        }
      })
      .run();
  });
  
  progressCallback({ step: 'Uploading to Cloud', percent: 95 });
  try {
      const s3Key = `videos/${outputFileName}`;
      await uploadToStorage(outputPath, s3Key, 'video/mp4');

      if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
      }

      try {
        deleteVidData(removeFiles, audioPath, textPath, null, durationsFile, null, customAudioPath);
      } catch(e) { console.warn('Cleanup warning:', e.message); }
      
      deleteOldVideosAndTempFiles();

      progressCallback({ step: 'Complete', percent: 100 });
      
      return { vidPath: s3Key, isRemote: true };

  } catch (error) {
      console.error("Cloud upload failed:", error);
      throw new Error("Video generated but failed to upload to cloud.");
  }
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

async function getEndVerse(surahNumber, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await api.get(`http://api.alquran.cloud/v1/surah/${surahNumber}`);
      if (response.data?.data?.numberOfAyahs) {
        return response.data.data.numberOfAyahs;
      }
    } catch (error) {
      console.error(`Error fetching end verse (Attempt ${i + 1}/${retries}): ${error.message}`);
      if (i === retries - 1) return -1;
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  return -1;
}

const cssColorToASS = (cssColor) => {
  if (!cssColor) return '&H00FFFFFF';
  const hex = cssColor.replace("#", "");
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
};
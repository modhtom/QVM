//TODO: FONT IS NOT APPLIED
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { partAudioAndText } from "./utility/data.js";
import { getBackgroundPath } from "./utility/background.js";
import { deleteVidData, deleteOldVideos } from "./utility/delete.js";
import { generateSubtitles } from "./utility/subtitle.js";
import { pickColor } from "./utility/color.js";
import fs from "fs";
import * as mm from "music-metadata";
import path from "path";

// Parameters
// const surahNumber = 1;
// const edition = "ar.alafasy";
// const useCustomBackground = false; 
// const videoNumber = 1;
// const removeFilesAfterCreation = true;
// const downloadType = "p";
// const startVerse = 1;
// const endVerse = 2;
// const color = pickColor(videoNumber, useCustomBackground);
const fontPath = "Data/Font/QCF_P440.ttf";
const position = "1920,1080";

// (async () => {
//   if (downloadType.toLowerCase() === "p") {
//     await generatePartialVideo(
//       surahNumber,
//       startVerse,
//       endVerse,
//       removeFilesAfterCreation,
//       color,
//       useCustomBackground,
//       videoNumber,
//       edition,
//     );
//   } else {
//     await generateFullVideo(
//       surahNumber,
//       removeFilesAfterCreation,
//       color,
//       useCustomBackground,
//       videoNumber,
//       edition,
//     );
//   }

//   deleteOldVideos();
// })();

export async function generateFullVideo(
  surahNumber,
  removeFiles,
  color,
  useCustomBackground,
  videoNumber,
  edition,
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
  progressCallback = () => {}
) {
  let startTime = Date.now();
  progressCallback({ step: 'Starting video generation', percent: 0 });

  const limit = await getEndVerse(surahNumber);
  if (endVerse > limit) endVerse = limit;

  progressCallback({ step: 'Fetching audio and text', percent: 10 });
  const { audioPath, textPath, durationsFile } = await fetchAudioAndText(
    surahNumber,
    startVerse,
    endVerse,
    edition,
  );

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

  let audioLen;
  if (!audioHeld) {
    audioLen = await getAudioDuration(audioPath);

    if (audioLen == -1) {
      console.log("Error: Invalid audio file.");
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
  progressCallback({ step: 'Processing audio', percent: 30 });

  progressCallback({ step: 'Preparing background video', percent: 40 });
  const backgroundPath = await getBackgroundPath(
    useCustomBackground,
    videoNumber,
    audioLen,
  );
  
  if (!fs.existsSync(backgroundPath)) {
    console.log(
      `Output file Data/Background_Video/CarDrive${len}.mp4 doesn't exists.`,
    );
  }

  progressCallback({ step: 'Generating subtitles', percent: 50 });
  const subPath = `Data/subtitles/Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.srt`;
  const ret = await generateSubtitles(
    surahNumber,
    startVerse,
    endVerse,
    fontPath,
    color,
    position,
  );

  if (ret != 1) {
    console.log(`no subtitle file at ${subPath}`);
    return;
  }

  const aColor = cssColorToASS(color);

  const outputPath = path.join(
    "Output_Video/",
    `Surah_${surahNumber}_Video_from_${startVerse}_to_${endVerse}.mp4`
  );

  // console.log('Paths used by ffmpeg:');
  // console.log(`Background Path: ${backgroundPath}`);
  // console.log(`Audio Path: ${audioPath}`);
  // console.log(`Subtitle Path: ${subPath}`);
  // console.log(`Output Path: ${outputPath}`);
  progressCallback({ step: 'Rendering final video', percent: 60 });
    await new Promise((resolve, reject) => {
      let progress = 60;
      ffmpeg()
        .input(backgroundPath)
        .input(audioPath)
        .audioCodec("aac")
        .audioFilters("aformat=sample_fmts=fltp:channel_layouts=stereo")
        .videoCodec("libx264")
        .outputOptions(
          "-vf",
          `scale='if(gte(iw/ih,9/16), 1080, -1)':'if(gte(iw/ih,9/16), -1, 1920)',pad=1080:1920:(ow-iw)/2:(oh-ih)/2,subtitles=${subPath}:fontsdir=${fontPath}:force_style='FontName=QCF_P440,FontSize=9,MarginV=90,Alignment=2,PrimaryColour=${aColor}'`,
        )
        .outputOptions("-preset", "fast")
        .output(
          outputPath,
        )
        .on('progress', (progress) => {
          const mappedProgress = 60 + (progress.percent * 0.3);
          progressCallback({ 
            step: 'Rendering video', 
            percent: Math.min(90, mappedProgress)
          });
        })
        .on("end", async () => {
          console.log("Video created successfully.");
          resolve();
        })
        .on("error", (err) => {
          console.error("Error processing video: ", err);
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

  let elapsedTime = (Date.now() - startTime) / 1000;
  if (elapsedTime > 60) {
    console.log(
      `Time taken to Make the video : ${(elapsedTime / 60).toFixed(2)} minutes.`,
    );
  } else {
    console.log(
      `Time taken to Make the video : ${elapsedTime.toFixed(2)} seconds.`,
    );
  }
  progressCallback({ step: 'Complete', percent: 100 });
  console.log(
    `Video at location :Output_Video/Surah_${surahNumber}_Video_from_${startVerse}_to_${endVerse}.mp4`,
  );
}

async function fetchAudioAndText(surahNumber, startVerse, endVerse, edition) {
  console.log(`Fetching audio and text`)
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
    console.log(`Audio length: ${durationInSeconds} seconds`);
    return Math.round(durationInSeconds);
  } catch (error) {
    console.error("Error reading audio file:", error);
    return -1;
  }
}

async function getEndVerse(surahNumber) {
console.log(`getting end verse to surah number: ${surahNumber}`);
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

import fs from "fs";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import * as mm from "music-metadata";
import NodeCache from "node-cache"; 

const audioCache = new NodeCache({ stdTTL: 60 * 60 }); 
const textCache = new NodeCache({ stdTTL: 60 * 60 });

async function getSurahDataRange(
  surahNumber,
  startVerse,
  endVerse,
  reciterEdition,
  textEdition,
) {
  const audioBuffers = [];
  const durationPerAyah = [];
  let combinedText = "";

  for (let verse = startVerse; verse <= endVerse; verse++) {
    const { audio, text, duration } = await getSurahData(
      surahNumber,
      verse,
      reciterEdition,
      textEdition,
    );
    if (audio && text) {
      audioBuffers.push({ verse, audio });
      durationPerAyah.push(duration);
      combinedText += text + "\n";
    } else {
      console.error(`Error fetching data for verse ${verse}`);
    }
  }

  return { audioBuffers, combinedText, durationPerAyah };
}

async function getSurahData(
  surahNumber,
  verseNumber,
  reciterEdition,
  textEdition,
) {
  const baseUrl = `http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${reciterEdition}`;
  console.log(`Base URL: ${baseUrl}`)
  if (
    audioCache.has(`${surahNumber}-${verseNumber}`) &&
    textCache.has(`${surahNumber}-${verseNumber}`)
  ) {
    const cachedAudio = audioCache.get(`${surahNumber}-${verseNumber}`);
    const duration = await getAudioDurationFromBuffer(cachedAudio);
    return {
      audio: cachedAudio,
      text: textCache.get(`${surahNumber}-${verseNumber}`),
      duration,
    };
  }

  try {
    const response = await axios.get(baseUrl);
    const data = response.data.data;

    const audioUrl = data.audio;
    const audioContent = await axios.get(audioUrl, {
      responseType: "arraybuffer",
    });
    const audioBuffer = Buffer.from(audioContent.data, "binary");
    const duration = await getAudioDurationFromBuffer(audioBuffer);

    audioCache.set(`${surahNumber}-${verseNumber}`, audioBuffer);
    textCache.set(`${surahNumber}-${verseNumber}`, data.text);

    return { audio: audioBuffer, text: data.text, duration };
  } catch (error) {
    console.error(
      `Failed to fetch data for Surah ${surahNumber}, Verse ${verseNumber}:`,
      error,
    );
    return { audio: null, text: null, duration: 0 };
  }
}

async function getAudioDurationFromBuffer(buffer) {
  const audioDir = path.resolve("Data/audio");
  fs.mkdirSync(audioDir, { recursive: true });
  const tempFile = path.join(audioDir, `temp_audio_${Date.now()}.mp3`);

  try {
    fs.writeFileSync(tempFile, buffer);

    const metadata = await mm.parseFile(tempFile);
    const duration = metadata.format.duration;

    return Math.round(duration);
  } catch (error) {
    console.error("Error calculating audio duration:", error);
    return 0;
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (unlinkError) {
      console.error(`Error deleting temporary file ${tempFile}:`, unlinkError);
    }
  }
}


export async function partAudioAndText(
  surahNumber,
  startVerse,
  endVerse,
  reciterEdition = "ar.alafasy",
  textEdition = "quran-simple",
) {

  const { audioBuffers, combinedText, durationPerAyah } =
    await getSurahDataRange(
      surahNumber,
      startVerse,
      endVerse,
      reciterEdition,
      textEdition,
    );

  if (audioBuffers.length) {
    const audioOutputDir = path.resolve("Data/audio");
    fs.mkdirSync(audioOutputDir, { recursive: true });
    const audioOutputFile = path.join(
      audioOutputDir,
      `Surah_${surahNumber}_Audio_from_${startVerse}_to_${endVerse}.mp3`,
    );

    const ffmpegCommand = ffmpeg();
    audioBuffers.forEach(({ audio }, index) => {
      const audioPath = path.join(
        audioOutputDir,
        `temp_${surahNumber}_${index}.mp3`,
      );
      fs.writeFileSync(audioPath, audio);
      ffmpegCommand.input(audioPath);
    });

    ffmpegCommand
      .mergeToFile(audioOutputFile)
      .on("end", () => {
        audioBuffers.forEach((_, index) => {
          const tempPath = path.join(
            audioOutputDir,
            `temp_${surahNumber}_${index}.mp3`,
          );
          setTimeout(() => {
            try {
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
            } catch (error) {
              console.error(
                `Error deleting temporary file ${tempPath}:`,
                error,
              );
            }
          }, 500);
        });
      })
      .on("error", (err) =>
        console.error("Error during audio concatenation:", err),
      );

    await new Promise((resolve) => {
      const checkAudioFile = setInterval(() => {
        if (fs.existsSync(audioOutputFile)) {
          clearInterval(checkAudioFile);
          resolve();
        }
      }, 500);
    });
  }

  if (combinedText) {
    const textOutputDir = path.resolve("Data/text");
    fs.mkdirSync(textOutputDir, { recursive: true });
    const textOutputFile = path.join(
      textOutputDir,
      `Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`,
    );
    fs.writeFileSync(textOutputFile, combinedText, "utf-8");

    const durationsOutputFile = path.join(
      textOutputDir,
      `Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`,
    );
    fs.writeFileSync(
      durationsOutputFile,
      JSON.stringify(durationPerAyah),
      "utf-8",
    );

    return 1;
  } else {
    return -1;
  }
}


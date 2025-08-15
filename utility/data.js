import fs from "fs";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import * as mm from "music-metadata";
import NodeCache from "node-cache";

const audioCache = new NodeCache({ stdTTL: 60 * 60 });
const textCache = new NodeCache({ stdTTL: 60 * 60 });

export async function getSurahDataRange(
  surahNumber,
  startVerse,
  endVerse,
  reciterEdition,
  textEdition,
  translationEdition = null,
  transliterationEdition = null,
  textOnly = false
) {
  const audioBuffers = [];
  const durationPerAyah = [];
  let combinedText = "";
  let combinedTranslation = "";
  let combinedTransliteration = "";

  for (let verse = startVerse; verse <= endVerse; verse++) {
    const { audio, text, duration, translation, transliteration } = await getSurahData(
      surahNumber,
      verse,
      textOnly ? null : reciterEdition,
      textEdition,
      translationEdition,
      transliterationEdition,
      textOnly
    );
    if (!textOnly && audio) {
      audioBuffers.push({ verse, audio });
    }
    
    if (text) {
      durationPerAyah.push(textOnly ? 1 : (duration || 0));
      combinedText += text + "\n";
      if (translation) combinedTranslation += translation + "\n";
      if (transliteration) combinedTransliteration += transliteration + "\n";
    } else {
      console.error(`No text found for Surah ${surahNumber}, Verse ${verse}`);
      durationPerAyah.push(defaultDuration);
    }
  }

  return { audioBuffers, combinedText, combinedTranslation, combinedTransliteration, durationPerAyah };
}

async function getSurahData(
  surahNumber,
  verseNumber,
  reciterEdition,
  textEdition,
  translationEdition,
  transliterationEdition,
  textOnly = false
) {
  const cacheKey = `${surahNumber}-${verseNumber}`;
  
  if (textCache.has(cacheKey)) {
    const cachedText = textCache.get(cacheKey);
    
    if (textOnly) {
      return { audio: null, text: cachedText, duration: 0 };
    }
    
    if (audioCache.has(cacheKey)) {
      const cachedAudio = audioCache.get(cacheKey);
      const duration = await getAudioDurationFromBuffer(cachedAudio);
      return { audio: cachedAudio, text: cachedText, duration };
    }
  }

  try {
    let audioBuffer = null;
    let duration = 0;
    let translationText = null;
    let transliterationText = null;

    if (!textOnly) {
      const response = await axios.get(
        `http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${reciterEdition}`
      );
      const audioData = response.data.data;
      const audioUrl = audioData.audio;
      const audioContent = await axios.get(audioUrl, {
        responseType: "arraybuffer",
      });
      audioBuffer = Buffer.from(audioContent.data, "binary");
      audioCache.set(cacheKey, audioBuffer);
      duration = await getAudioDurationFromBuffer(audioBuffer);
    }

    const textResponse = await axios.get(
      `http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${textEdition}`
    );
    const textData = textResponse.data.data;
    const text = textData.text;
    textCache.set(cacheKey, text);

    if (translationEdition) {
      const translationResponse = await axios.get(
        `http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${translationEdition}`
      );
      translationText = translationResponse.data.data.text;
    }

    if (transliterationEdition) {
      const transliterationResponse = await axios.get(
        `http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${transliterationEdition}`
      );
      transliterationText = transliterationResponse.data.data.text;
    }


    return {
      audio: audioBuffer,
      text: text,
      translation: translationText,
      transliteration: transliterationText,
      duration: textOnly ? 1 : duration
    };
  } catch (error) {
    console.error(
      `Failed to fetch data for Surah ${surahNumber}, Verse ${verseNumber}:`,
      error
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

    return duration || 0;
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
  translationEdition = null,
  transliterationEdition = null
) {
  console.log(`Fetching data for S${surahNumber}:${startVerse}-${endVerse}. Translation: ${translationEdition || 'None'}`);

  const {
    audioBuffers,
    combinedText,
    combinedTranslation,
    combinedTransliteration,
    durationPerAyah
  } = await getSurahDataRange(
      surahNumber,
      startVerse,
      endVerse,
      reciterEdition,
      textEdition,
      translationEdition,
      transliterationEdition
    );
  console.log(`Received translation text: ${combinedTranslation ? 'Yes' : 'No'}`);

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

    if (combinedTranslation) {
      const translationOutputFile = path.join(
        textOutputDir,
        `Surah_${surahNumber}_Translation_from_${startVerse}_to_${endVerse}.txt`,
      );
      fs.writeFileSync(translationOutputFile, combinedTranslation, "utf-8");
    }

    if (combinedTransliteration) {
        const transliterationOutputFile = path.join(
          textOutputDir,
          `Surah_${surahNumber}_Transliteration_from_${startVerse}_to_${endVerse}.txt`,
        );
        fs.writeFileSync(transliterationOutputFile, combinedTransliteration, "utf-8");
        console.log('Translation file saved to:', translationOutputFile);
    }

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


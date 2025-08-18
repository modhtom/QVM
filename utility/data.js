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

  if (startVerse !== 1 && surahNumber != 9) {
    console.log("Prepending Bismillah...");

    const bismillahData = await getSurahData(
      1,
      1,
      textOnly ? null : reciterEdition,
      textEdition,
      translationEdition,
      transliterationEdition,
      textOnly
    );

    if (!textOnly && bismillahData.audio) {
      audioBuffers.push({ verse: 0, audio: bismillahData.audio });
    }
    if (bismillahData.text) {
      durationPerAyah.push(textOnly ? 2 : (bismillahData.duration || 2));
      combinedText += bismillahData.text + "\n";
      if (bismillahData.translation) combinedTranslation += bismillahData.translation + "\n";
      if (bismillahData.transliteration) combinedTransliteration += bismillahData.transliteration + "\n";
    }
  }

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
      durationPerAyah.push(0); // Default duration if text is missing
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
  const cacheKey = `${surahNumber}-${verseNumber}-${reciterEdition}-${textEdition}-${translationEdition}-${transliterationEdition}`;
  
  // Check cache first
  const cachedData = textCache.get(cacheKey);
  if (cachedData) {
      if (textOnly) return { ...cachedData, audio: null, duration: 0 };
      if (audioCache.has(cacheKey)) {
          const cachedAudio = audioCache.get(cacheKey);
          const duration = await getAudioDurationFromBuffer(cachedAudio);
          return { ...cachedData, audio: cachedAudio, duration };
      }
  }

  try {
    let audioBuffer = null;
    let duration = 0;
    let text = null;
    let translationText = null;
    let transliterationText = null;
    
    const textEditionIdentifier = textEdition || 'quran-simple';
    const editions = [textEditionIdentifier, translationEdition, transliterationEdition, reciterEdition].filter(Boolean).join(',');
    const apiUrl = `http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/editions/${editions}`;

    const response = await axios.get(apiUrl);
    const ayahData = response.data.data;

    const textAyah = ayahData.find(a => a.edition.identifier === textEditionIdentifier);
    if (textAyah) text = textAyah.text;

    if (translationEdition) {
        const translationAyah = ayahData.find(a => a.edition.identifier === translationEdition);
        if (translationAyah) translationText = translationAyah.text;
    }

    if (transliterationEdition) {
        const transliterationAyah = ayahData.find(a => a.edition.identifier === transliterationEdition);
        if (transliterationAyah) transliterationText = transliterationAyah.text;
    }
    
    if (!textOnly && reciterEdition) {
        const audioAyah = ayahData.find(a => a.edition.identifier === reciterEdition);
        if (audioAyah && audioAyah.audio) {
            const audioContent = await axios.get(audioAyah.audio, { responseType: "arraybuffer" });
            audioBuffer = Buffer.from(audioContent.data, "binary");
            duration = await getAudioDurationFromBuffer(audioBuffer);
            audioCache.set(cacheKey, audioBuffer);
        }
    }
    
    const dataToCache = { text, translation: translationText, transliteration: transliterationText };
    textCache.set(cacheKey, dataToCache);

    return {
      audio: audioBuffer,
      ...dataToCache,
      duration: textOnly ? 1 : duration
    };
  } catch (error) {
    console.error(
      `Failed to fetch data for Surah ${surahNumber}, Verse ${verseNumber}:`,
      error.message
    );
    return { audio: null, text: null, translation: null, transliteration: null, duration: 0 };
  }
}

async function getAudioDurationFromBuffer(buffer) {
  try {
    const metadata = await mm.parseBuffer(buffer, 'audio/mpeg');
    return metadata.format.duration || 0;
  } catch (error) {
    // Fallback for files that music-metadata struggles with
    const tempFile = `temp_audio_${Date.now()}.mp3`;
    fs.writeFileSync(tempFile, buffer);
    try {
        const metadata = await mm.parseFile(tempFile);
        fs.unlinkSync(tempFile);
        return metadata.format.duration || 0;
    } catch (fileError) {
        if(fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        console.error("Error calculating audio duration from buffer/file:", fileError);
        return 0;
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

  if (audioBuffers.length) {
    const audioOutputDir = path.resolve("Data/audio");
    fs.mkdirSync(audioOutputDir, { recursive: true });
    const audioOutputFile = path.join(
      audioOutputDir,
      `Surah_${surahNumber}_Audio_from_${startVerse}_to_${endVerse}.mp3`,
    );

    const ffmpegCommand = ffmpeg();
    const tempFiles = [];
    audioBuffers.forEach(({ audio }, index) => {
      const audioPath = path.join(
        audioOutputDir,
        `temp_${surahNumber}_${startVerse}_${index}.mp3`,
      );
      fs.writeFileSync(audioPath, audio);
      ffmpegCommand.input(audioPath);
      tempFiles.push(audioPath);
    });

    await new Promise((resolve, reject) => {
        ffmpegCommand
          .mergeToFile(audioOutputFile)
          .on("end", () => {
            tempFiles.forEach(file => {
                try { if (fs.existsSync(file)) fs.unlinkSync(file); }
                catch (e) { console.error("Error deleting temp file:", e); }
            });
            resolve();
          })
          .on("error", (err) => {
            console.error("Error during audio concatenation:", err);
            reject(err);
          });
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
  }
}

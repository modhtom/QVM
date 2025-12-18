import fs from "fs";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import * as mm from "music-metadata";

const audioCacheDir = path.resolve("Data/audio/cache");
if (!fs.existsSync(audioCacheDir)) {
    fs.mkdirSync(audioCacheDir, { recursive: true });
}

async function getCachedAudio(reciterEdition, surahNumber, verseNumber) {
    const reciterDir = path.join(audioCacheDir, reciterEdition);
    const audioFile = path.join(reciterDir, `${surahNumber}_${verseNumber}.mp3`);
    if (fs.existsSync(audioFile)) {
        return fs.readFileSync(audioFile);
    }
    return null;
}

async function cacheAudio(reciterEdition, surahNumber, verseNumber, buffer) {
    const reciterDir = path.join(audioCacheDir, reciterEdition);
    if (!fs.existsSync(reciterDir)) {
        fs.mkdirSync(reciterDir, { recursive: true });
    }
    const audioFile = path.join(reciterDir, `${surahNumber}_${verseNumber}.mp3`);
    fs.writeFileSync(audioFile, buffer);
}

export async function getSurahDataRange(
  surahNumber,
  startVerse,
  endVerse,
  reciterEdition,
  textEdition,
  translationEdition = null,
  transliterationEdition = null,
  textOnly = false,
) {
  if (surahNumber !== "1" && surahNumber !== "9") {
      const bismillahData = await getSurahData(1, 1, reciterEdition, textEdition, translationEdition, transliterationEdition, textOnly, true);
      const mainData = await fetchRange(surahNumber, startVerse, endVerse, reciterEdition, textEdition, translationEdition, transliterationEdition, textOnly);
      
      return {
          audioBuffers: [bismillahData, ...mainData.audioBuffers].filter(b => b.audio),
          combinedText: `${bismillahData.text}\n${mainData.combinedText}`,
          combinedTranslation: `${bismillahData.translation || ''}\n${mainData.combinedTranslation}`,
          combinedTransliteration: `${bismillahData.transliteration || ''}\n${mainData.combinedTransliteration}`,
          durationPerAyah: [bismillahData.duration, ...mainData.durationPerAyah]
      };
  }
  return fetchRange(surahNumber, startVerse, endVerse, reciterEdition, textEdition, translationEdition, transliterationEdition, textOnly);
}

async function fetchRange(surahNumber, startVerse, endVerse, reciterEdition, textEdition, translationEdition, transliterationEdition, textOnly) {
    const audioBuffers = [];
    const durationPerAyah = [];
    let combinedText = "";
    let combinedTranslation = "";
    let combinedTransliteration = "";

    for (let verse = startVerse; verse <= endVerse; verse++) {
        const { audio, text, duration, translation, transliteration } = await getSurahData(
            surahNumber, verse, reciterEdition, textEdition, translationEdition, transliterationEdition, textOnly
        );
        if (audio) audioBuffers.push({ verse, audio });
        if (text) {
            durationPerAyah.push(duration || 0);
            combinedText += text + "\n";
            if (translation) combinedTranslation += translation + "\n";
            if (transliteration) combinedTransliteration += transliteration + "\n";
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
  textOnly = false,
  isBismillah = false
) {
  try {
    let audioBuffer = null;
    let duration = 0;
    let translationText = null;
    let transliterationText = null;

    if (!textOnly && reciterEdition) {
        audioBuffer = await getCachedAudio(reciterEdition, surahNumber, verseNumber);
        
        if (!audioBuffer) {
            const response = await axios.get(`http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${reciterEdition}`);
            const audioUrl = response.data?.data?.audio;
            if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
                try {
                    const audioContent = await axios.get(audioUrl, { responseType: "arraybuffer" });
                    audioBuffer = Buffer.from(audioContent.data, "binary");
                    await cacheAudio(reciterEdition, surahNumber, verseNumber, audioBuffer);
                    duration = await getAudioDurationFromBuffer(audioBuffer);
                } catch(e) {
                    console.warn(`Failed to download audio from ${audioUrl}: ${e.message}`);
                }
            } else {
                console.warn(`No valid audio URL found for edition ${reciterEdition} at ${surahNumber}:${verseNumber}`);
            }
        } else {
            duration = await getAudioDurationFromBuffer(audioBuffer);
        }
    }

    const textResponse = await axios.get(`http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${textEdition}`);
    const text = textResponse.data.data.text;

    if (!isBismillah) {
        if (translationEdition) {
            const translationResponse = await axios.get(`http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${translationEdition}`);
            translationText = translationResponse.data.data.text;
        }
        if (transliterationEdition) {
            const transliterationResponse = await axios.get(`http://api.alquran.cloud/v1/ayah/${surahNumber}:${verseNumber}/${transliterationEdition}`);
            transliterationText = transliterationResponse.data.data.text;
        }
    } else {
        translationText = "In the name of Allah, the Entirely Merciful, the Especially Merciful.";
    }

    return { audio: audioBuffer, text, duration, translation: translationText, transliteration: transliterationText };

  } catch (error) {
    console.error(`Failed to fetch data for Surah ${surahNumber}, Verse ${verseNumber}:`, error.message);
    return { audio: null, text: null, duration: 0, translation: "", transliteration: "" };
  }
}

async function getAudioDurationFromBuffer(buffer) {
  try {
    const metadata = await mm.parseBuffer(buffer, 'audio/mpeg');
    return metadata.format.duration || 0;
  } catch (error) {
    console.error("Error calculating audio duration:", error);
    return 0;
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
  console.log(`Fetching data for S${surahNumber}:${startVerse}-${endVerse}.`);
  const { audioBuffers, combinedText, combinedTranslation, combinedTransliteration, durationPerAyah } = await getSurahDataRange(
    surahNumber, startVerse, endVerse, reciterEdition, textEdition, translationEdition, transliterationEdition
  );

  const audioOutputDir = path.resolve("Data/audio");
  const textOutputDir = path.resolve("Data/text");
  if (!fs.existsSync(audioOutputDir)) fs.mkdirSync(audioOutputDir, { recursive: true });
  if (!fs.existsSync(textOutputDir)) fs.mkdirSync(textOutputDir, { recursive: true });

  const audioOutputFile = path.join(audioOutputDir, `Surah_${surahNumber}_Audio_from_${startVerse}_to_${endVerse}.mp3`);

  if (audioBuffers && audioBuffers.length > 0) {
    const ffmpegCommand = ffmpeg();
    const tempFiles = [];

    audioBuffers.forEach(({ audio }, index) => {
        if (audio) {
            const tempPath = path.join(audioOutputDir, `temp_${surahNumber}_${startVerse}_${index}.mp3`);
            fs.writeFileSync(tempPath, audio);
            ffmpegCommand.input(tempPath);
            tempFiles.push(tempPath);
        }
    });

    if (tempFiles.length > 0) {
        await new Promise((resolve, reject) => {
            ffmpegCommand
                .mergeToFile(audioOutputFile)
                .on("end", () => {
                    tempFiles.forEach(file => { if(fs.existsSync(file)) fs.unlinkSync(file) });
                    resolve();
                })
                .on("error", (err) => {
                    tempFiles.forEach(file => { if(fs.existsSync(file)) fs.unlinkSync(file) });
                    reject(new Error("Error during audio concatenation: " + err.message));
                });
        });
    }
  }

  if (combinedText) {
    fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`), combinedText.trim(), "utf-8");
    if (combinedTranslation) {
      fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Translation_from_${startVerse}_to_${endVerse}.txt`), combinedTranslation.trim(), "utf-8");
    }
    if (combinedTransliteration) {
        fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Transliteration_from_${startVerse}_to_${endVerse}.txt`), combinedTransliteration.trim(), "utf-8");
    }
    fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`), JSON.stringify(durationPerAyah), "utf-8");
    return 1;
  } else {
    return -1;
  }
}
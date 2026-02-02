import fs from "fs";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import * as mm from "music-metadata";
import { cache } from "./cache.js";

const audioCacheDir = path.resolve("Data/audio/cache");
if (!fs.existsSync(audioCacheDir)) {
    fs.mkdirSync(audioCacheDir, { recursive: true });
}

// --- HELPER: AUDIO CACHING ---
async function getCachedAudio(reciterEdition, surahNumber, verseNumber) {
    const reciterDir = path.join(audioCacheDir, reciterEdition);
    const audioFile = path.join(reciterDir, `${surahNumber}_${verseNumber}.mp3`);
    if (fs.existsSync(audioFile)) return fs.readFileSync(audioFile);
    return null;
}

async function cacheAudio(reciterEdition, surahNumber, verseNumber, buffer) {
    const reciterDir = path.join(audioCacheDir, reciterEdition);
    if (!fs.existsSync(reciterDir)) fs.mkdirSync(reciterDir, { recursive: true });
    const audioFile = path.join(reciterDir, `${surahNumber}_${verseNumber}.mp3`);
    fs.writeFileSync(audioFile, buffer);
}

// --- CORE: SMART DATA FETCHING ---

// Fetch FULL Surah Text/Translation from API (1 Call instead of 286)
async function fetchFullSurahData(surahNumber, edition) {
    const cacheKey = `surah:${surahNumber}:edition:${edition}`;
    
    // 1. Check Redis
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // 2. Fetch from API (Single Request for whole Surah)
    console.log(`[API] Fetching full Surah ${surahNumber} (${edition})...`);
    try {
        const response = await axios.get(`http://api.alquran.cloud/v1/surah/${surahNumber}/${edition}`);
        const data = response.data.data;
        
        // 3. Save to Redis (TTL 24h)
        await cache.set(cacheKey, data, 86400);
        return data;
    } catch (e) {
        console.error(`[API Error] Failed to fetch Surah ${surahNumber}: ${e.message}`);
        throw e;
    }
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
    // Logic: Only include Basmalah if it's the very start of the Surah (Verse 1)
    // AND it's not Surah 1 or 9 (which handle Basmalah differently/internally)
    const shouldAddBasmalah = surahNumber !== "1" && surahNumber !== "9" && parseInt(startVerse) === 1;

    let bismillahData = null;
    if (shouldAddBasmalah) {
        // Fetch Verse 1 of Surah 1 as the Basmalah reference
        const bsText = await fetchFullSurahData(1, textEdition);
        const bsTrans = translationEdition ? await fetchFullSurahData(1, translationEdition) : null;
        const bsTranslit = transliterationEdition ? await fetchFullSurahData(1, transliterationEdition) : null;
        
        // Audio for Basmalah (Verse 1:1)
        let bsAudio = null;
        if (!textOnly && reciterEdition) {
            bsAudio = await getOrFetchAudio(1, 1, reciterEdition);
        }

        bismillahData = {
            text: bsText.ayahs[0].text,
            translation: bsTrans ? bsTrans.ayahs[0].text : "",
            transliteration: bsTranslit ? bsTranslit.ayahs[0].text : "",
            audio: bsAudio ? bsAudio.buffer : null,
            duration: bsAudio ? bsAudio.duration : 0
        };
    }

    // --- OPTIMIZED FETCHING ---
    // Fetch full surah texts once (cached), then slice arrays
    const fullTextObj = await fetchFullSurahData(surahNumber, textEdition);
    const fullTransObj = translationEdition ? await fetchFullSurahData(surahNumber, translationEdition) : null;
    const fullTranslitObj = transliterationEdition ? await fetchFullSurahData(surahNumber, transliterationEdition) : null;

    const audioBuffers = [];
    const durationPerAyah = [];
    let combinedText = "";
    let combinedTranslation = "";
    let combinedTransliteration = "";

    // Add Basmalah if needed
    if (bismillahData) {
        if (bismillahData.audio) audioBuffers.push({ verse: 0, audio: bismillahData.audio });
        durationPerAyah.push(bismillahData.duration);
        combinedText += bismillahData.text + "\n";
        combinedTranslation += bismillahData.translation + "\n";
        combinedTransliteration += bismillahData.transliteration + "\n";
    }

    // Loop through requested range (In-Memory Slicing)
    // Note: API arrays are 0-indexed, Verse numbers are 1-indexed.
    for (let v = startVerse; v <= endVerse; v++) {
        const idx = v - 1; // Array index
        
        // 1. Text
        if (fullTextObj.ayahs[idx]) {
            combinedText += fullTextObj.ayahs[idx].text + "\n";
        }
        
        // 2. Translation
        if (fullTransObj && fullTransObj.ayahs[idx]) {
            combinedTranslation += fullTransObj.ayahs[idx].text + "\n";
        }

        // 3. Transliteration
        if (fullTranslitObj && fullTranslitObj.ayahs[idx]) {
            combinedTransliteration += fullTranslitObj.ayahs[idx].text + "\n";
        }

        // 4. Audio (Recitation) - Still needs individual fetches/cache checks per verse
        // (Optimizing audio is harder as it's binary, but we use the disk cache)
        if (!textOnly && reciterEdition) {
            const verseAudio = await getOrFetchAudio(surahNumber, v, reciterEdition);
            if (verseAudio && verseAudio.buffer) {
                audioBuffers.push({ verse: v, audio: verseAudio.buffer });
                durationPerAyah.push(verseAudio.duration);
            } else {
                durationPerAyah.push(0); // Fallback
            }
        }
    }

    return {
        audioBuffers,
        combinedText: combinedText.trim(),
        combinedTranslation: combinedTranslation.trim(),
        combinedTransliteration: combinedTransliteration.trim(),
        durationPerAyah
    };
}

// Helper to handle Audio Caching logic separately
async function getOrFetchAudio(surah, verse, edition) {
    try {
        let buffer = await getCachedAudio(edition, surah, verse);
        let duration = 0;

        if (!buffer) {
            // API Call for Audio
            const url = `http://api.alquran.cloud/v1/ayah/${surah}:${verse}/${edition}`;
            const res = await axios.get(url);
            const audioUrl = res.data?.data?.audio;
            
            if (audioUrl) {
                const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer' });
                buffer = Buffer.from(audioRes.data);
                await cacheAudio(edition, surah, verse, buffer);
            }
        }

        if (buffer) {
            duration = await getAudioDurationFromBuffer(buffer);
        }
        return { buffer, duration };
    } catch (e) {
        console.warn(`Audio fetch failed for ${surah}:${verse}: ${e.message}`);
        return null;
    }
}

async function getAudioDurationFromBuffer(buffer) {
  try {
    const metadata = await mm.parseBuffer(buffer, 'audio/mpeg');
    return metadata.format.duration || 0;
  } catch (error) {
    return 0;
  }
}

// Existing helper, largely unchanged but uses new getSurahDataRange
export async function partAudioAndText(
  surahNumber, startVerse, endVerse, reciterEdition, textEdition, translationEdition, transliterationEdition
) {
  console.log(`Processing Data: S${surahNumber}:${startVerse}-${endVerse}`);
  const data = await getSurahDataRange(
    surahNumber, startVerse, endVerse, reciterEdition, textEdition, translationEdition, transliterationEdition
  );

  const audioOutputDir = path.resolve("Data/audio");
  const textOutputDir = path.resolve("Data/text");
  if (!fs.existsSync(audioOutputDir)) fs.mkdirSync(audioOutputDir, { recursive: true });
  if (!fs.existsSync(textOutputDir)) fs.mkdirSync(textOutputDir, { recursive: true });

  const audioOutputFile = path.join(audioOutputDir, `Surah_${surahNumber}_Audio_from_${startVerse}_to_${endVerse}.mp3`);

  // Merge Audio if exists
  if (data.audioBuffers.length > 0) {
    const ffmpegCommand = ffmpeg();
    const tempFiles = [];

    data.audioBuffers.forEach(({ audio }, index) => {
        const tempPath = path.join(audioOutputDir, `temp_${surahNumber}_${startVerse}_${index}.mp3`);
        fs.writeFileSync(tempPath, audio);
        ffmpegCommand.input(tempPath);
        tempFiles.push(tempPath);
    });

    await new Promise((resolve, reject) => {
        ffmpegCommand.mergeToFile(audioOutputFile)
            .on("end", () => {
                tempFiles.forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f) });
                resolve();
            })
            .on("error", (err) => {
                tempFiles.forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f) });
                reject(err);
            });
    });
  }

  return data.combinedText ? 1 : -1;
}
import fs from "fs";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import * as mm from "music-metadata";
import { cache } from "./cache.js";
import { PassThrough } from "stream";

const audioCacheDir = path.resolve("Data/audio/cache");
if (!fs.existsSync(audioCacheDir)) {
    fs.mkdirSync(audioCacheDir, { recursive: true });
}

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

async function fetchFullSurahData(surahNumber, edition) {
    const cacheKey = `surah:${surahNumber}:edition:${edition}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    console.log(`[API] Fetching full Surah ${surahNumber} (${edition})...`);
    try {
        const response = await axios.get(`http://api.alquran.cloud/v1/surah/${surahNumber}/${edition}`);
        const data = response.data.data;
        await cache.set(cacheKey, data, 86400);
        return data;
    } catch (e) {
        console.error(`[API Error] Failed to fetch Surah ${surahNumber}: ${e.message}`);
        throw e;
    }
}

async function getOrFetchAudio(surah, verse, edition) {
    try {
        let buffer = await getCachedAudio(edition, surah, verse);
        let duration = 0;

        if (!buffer) {
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
    const shouldAddBasmalah = surahNumber !== "1" && surahNumber !== "9" && parseInt(startVerse) === 1;

    let bismillahData = null;
    if (shouldAddBasmalah) {
        const bsText = await fetchFullSurahData(1, textEdition);
        const bsTrans = translationEdition ? await fetchFullSurahData(1, translationEdition) : null;
        const bsTranslit = transliterationEdition ? await fetchFullSurahData(1, transliterationEdition) : null;
        
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

    const fullTextObj = await fetchFullSurahData(surahNumber, textEdition);
    const fullTransObj = translationEdition ? await fetchFullSurahData(surahNumber, translationEdition) : null;
    const fullTranslitObj = transliterationEdition ? await fetchFullSurahData(surahNumber, transliterationEdition) : null;

    const audioBuffers = [];
    const durationPerAyah = [];
    let combinedText = "";
    let combinedTranslation = "";
    let combinedTransliteration = "";

    if (bismillahData) {
        if (bismillahData.audio) audioBuffers.push({ verse: 0, audio: bismillahData.audio });
        durationPerAyah.push(bismillahData.duration);
        combinedText += bismillahData.text + "\n";
        combinedTranslation += bismillahData.translation + "\n";
        combinedTransliteration += bismillahData.transliteration + "\n";
    }

    for (let v = startVerse; v <= endVerse; v++) {
        const idx = v - 1;
        
        if (fullTextObj.ayahs[idx]) combinedText += fullTextObj.ayahs[idx].text + "\n";
        if (fullTransObj && fullTransObj.ayahs[idx]) combinedTranslation += fullTransObj.ayahs[idx].text + "\n";
        if (fullTranslitObj && fullTranslitObj.ayahs[idx]) combinedTransliteration += fullTranslitObj.ayahs[idx].text + "\n";

        if (!textOnly && reciterEdition) {
            const verseAudio = await getOrFetchAudio(surahNumber, v, reciterEdition);
            if (verseAudio && verseAudio.buffer) {
                audioBuffers.push({ verse: v, audio: verseAudio.buffer });
                durationPerAyah.push(verseAudio.duration);
            } else {
                durationPerAyah.push(0);
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

    if (data.audioBuffers.length > 0) {
        const audioStream = new PassThrough();
        
        data.audioBuffers.forEach(({ audio }) => {
            audioStream.write(audio);
        });
        audioStream.end();

        await new Promise((resolve, reject) => {
            ffmpeg(audioStream)
                .inputFormat('mp3')
                .audioCodec('copy')
                .save(audioOutputFile)
                .on("end", resolve)
                .on("error", (err) => reject(new Error("FFmpeg Streaming Error: " + err.message)));
        });
    }

    if (data.combinedText) {
        fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`), data.combinedText, "utf-8");
        if (data.combinedTranslation) {
        fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Translation_from_${startVerse}_to_${endVerse}.txt`), data.combinedTranslation, "utf-8");
        }
        if (data.combinedTransliteration) {
            fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Transliteration_from_${startVerse}_to_${endVerse}.txt`), data.combinedTransliteration, "utf-8");
        }
        fs.writeFileSync(path.join(textOutputDir, `Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`), JSON.stringify(data.durationPerAyah), "utf-8");
    }

    return data.combinedText ? 1 : -1;
}
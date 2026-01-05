import Groq from "groq-sdk";
import fs from "fs";
import stringSimilarity from "string-similarity";
import { getSurahDataRange } from "./data.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
function normalizeArabic(text) {
    if (!text) return "";
    return text
        .replace(/[\u064B-\u065F\u0670]/g, "") // Remove Tashkeel
        .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // Normalize Alef
        .replace(/\u0629/g, "\u0647") // Taa Marbuta -> Haa
        .replace(/[^\u0600-\u06FF\s]/g, "") // Remove punctuation/numbers
        .replace(/\s+/g, " ")
        .trim();
}

export async function runAutoSync(audioPath, surah, startVerse, endVerse) {
    console.log(`[AutoSync] Processing Surah ${surah}:${startVerse}-${endVerse} via Groq...`);
    const { combinedText } = await getSurahDataRange(surah, startVerse, endVerse, null, "quran-simple-clean");
    const officialVerses = combinedText.split('\n').filter(v => v.trim()).map((text, idx) => ({
        verseNum: parseInt(startVerse) + idx,
        text: text,
        normText: normalizeArabic(text)
    }));
    const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
        language: "ar"
    });

    if (!transcription.segments) throw new Error("AI returned no segments");
    let aiSegments = transcription.segments.map(seg => ({
        text: normalizeArabic(seg.text),
        start: seg.start,
        end: seg.end
    })).filter(s => s.text.length > 0);

    const timings = [];
    let searchStartIndex = 0;
    for (const verse of officialVerses) {
        let bestScore = 0;
        let bestMatch = null;
        let bestEndIndex = searchStartIndex;
        let currentString = "";
        let currentStart = -1;

        for (let i = searchStartIndex; i < Math.min(aiSegments.length, searchStartIndex + 15); i++) {
            const seg = aiSegments[i];
            if (currentString === "") currentStart = seg.start;
            
            currentString += (currentString ? " " : "") + seg.text;
            const similarity = stringSimilarity.compareTwoStrings(currentString, verse.normText);
            const lengthRatio = Math.min(currentString.length, verse.normText.length) / Math.max(currentString.length, verse.normText.length);
            const finalScore = similarity * 0.8 + lengthRatio * 0.2;

            if (finalScore > bestScore && finalScore > 0.3) {
                bestScore = finalScore;
                bestMatch = {
                    start: currentStart,
                    end: seg.end
                };
                bestEndIndex = i + 1;
            }
        }

        if (bestMatch) {
            timings.push({
                verse_num: verse.verseNum,
                start: bestMatch.start,
                end: bestMatch.end
            });
            searchStartIndex = bestEndIndex;
        } else {
            console.warn(`Low match for Verse ${verse.verseNum}. Interpolating...`);
            const lastEnd = timings.length > 0 ? timings[timings.length - 1].end : 0;
            timings.push({
                verse_num: verse.verseNum,
                start: lastEnd,
                end: lastEnd + 3
            });
        }
    }

    for (let i = 0; i < timings.length - 1; i++) {
        if (timings[i].end < timings[i+1].start) {
            timings[i].end = timings[i+1].start;
        }
    }
    if (timings.length > 0 && transcription.duration) {
        timings[timings.length - 1].end = transcription.duration;
    }

    return timings;
}
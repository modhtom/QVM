import Groq from "groq-sdk";
import fs from "fs";
import { getSurahDataRange } from "./data.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
function normalizeToken(text) {
    if (!text) return "";
    return text
        .replace(/[\u064B-\u065F\u0670]/g, "") // Remove Tashkeel
        .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // Normalize Alef
        .replace(/\u0629/g, "\u0647") // Taa Marbuta -> Haa
        .replace(/[^\u0600-\u06FF]/g, "") // Keep ONLY Arabic letters (Remove punctuation/numbers)
        .trim();
}

// LCS Algorithm (Longest Common Subsequence)
function alignTokens(officialTokens, aiTokens) {
    const N = officialTokens.length;
    const M = aiTokens.length;
    
    // DP Matrix
    const dp = Array(N + 1).fill(0).map(() => Array(M + 1).fill(0));

    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            if (officialTokens[i - 1].norm === aiTokens[j - 1].norm) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack
    const matches = [];
    let i = N, j = M;
    while (i > 0 && j > 0) {
        if (officialTokens[i - 1].norm === aiTokens[j - 1].norm) {
            matches.push({
                verseNum: officialTokens[i - 1].verseNum,
                start: aiTokens[j - 1].start,
                end: aiTokens[j - 1].end
            });
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    return matches.reverse();
}

export async function runAutoSync(audioPath, surah, startVerse, endVerse) {
    console.log(`[AutoSync] LCS Processing Surah ${surah}:${startVerse}-${endVerse}...`);
    const { combinedText } = await getSurahDataRange(surah, startVerse, endVerse, null, "quran-simple-clean");
    // Filter empty lines immediately to prevent "Ghost Verses"
    const verses = combinedText.split('\n').filter(line => line.trim().length > 0);
    const officialTokens = [];
    verses.forEach((verseText, idx) => {
        const verseNum = parseInt(startVerse) + idx;
        const words = verseText.trim().split(/\s+/);
        words.forEach(w => {
            const norm = normalizeToken(w);
            if (norm) officialTokens.push({ norm, verseNum, raw: w });
        });
    });

    const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
        language: "ar"
    });

    if (!transcription.segments && !transcription.words) throw new Error("AI returned no content");

    let aiTokens = [];
    if (transcription.words && transcription.words.length > 0) {
        console.log("[AutoSync] Using Native Word Timestamps");
        aiTokens = transcription.words.map(w => ({
            norm: normalizeToken(w.word),
            start: w.start,
            end: w.end
        })).filter(t => t.norm.length > 0);
    } else {
        console.log("[AutoSync] Fallback: Interpolating Word Timestamps");
        transcription.segments.forEach(seg => {
            const words = seg.text.trim().split(/\s+/);
            const totalChars = words.reduce((acc, w) => acc + w.length, 0);
            const duration = seg.end - seg.start;
            let currentTime = seg.start;
            words.forEach(w => {
                const norm = normalizeToken(w);
                if (norm) {
                    const wordDuration = (w.length / totalChars) * duration;
                    aiTokens.push({ norm, start: currentTime, end: currentTime + wordDuration });
                    currentTime += wordDuration;
                }
            });
        });
    }

    const matchedTokens = alignTokens(officialTokens, aiTokens);
    if (matchedTokens.length === 0) {
        console.warn("[AutoSync] LCS found 0 matches. Using fallback duration.");
        return [];
    }

    //  AGGREGATE VERSE TIMINGS
    const verseTimings = [];
    const requestedVerses = verses.map((_, i) => parseInt(startVerse) + i);
    requestedVerses.forEach(vNum => {
        const vMatches = matchedTokens.filter(m => m.verseNum === vNum);
        if (vMatches.length > 0) {
            verseTimings.push({
                verse_num: vNum,
                start: vMatches[0].start,
                end: vMatches[vMatches.length - 1].end
            });
        } else {
            verseTimings.push({ verse_num: vNum, start: -1, end: -1 });
        }
    });

    // GAP FILLING (Smart-ish Estimation)
    for (let i = 0; i < verseTimings.length; i++) {
        if (verseTimings[i].start === -1) {
            let prevEnd = (i > 0) ? verseTimings[i - 1].end : 0;
            // Find Gap End
            let nextStart = -1;
            let j = i + 1;
            while (j < verseTimings.length) {
                if (verseTimings[j].start !== -1) {
                    nextStart = verseTimings[j].start;
                    break;
                }
                j++;
            }

            // If gap is at the end, Estimate based on character length (avg 0.13s per char for recitation)
            if (nextStart === -1) {
                const avgSecPerChar = 0.13;
                let pendingChars = 0;
                for(let k = i; k < j; k++) {
                    pendingChars += verses[k-i].length;
                }
                // Cap at file duration, but prefer the estimated end
                const estimatedEnd = prevEnd + (pendingChars * avgSecPerChar) + 2; // +2s buffer
                nextStart = Math.min(transcription.duration || estimatedEnd, estimatedEnd);
            }

            const gapDuration = nextStart - prevEnd;
            const missingCount = j - i;
            const durationPerVerse = gapDuration / missingCount;
            console.log(`[AutoSync] Filling gap Verses ${verseTimings[i].verse_num}-${verseTimings[j-1].verse_num} (${gapDuration.toFixed(2)}s)`);
            for (let k = i; k < j; k++) {
                verseTimings[k].start = prevEnd + ((k - i) * durationPerVerse);
                verseTimings[k].end = prevEnd + ((k - i + 1) * durationPerVerse);
            }
            
            i = j - 1;
        }
    }

    // CONTINUITY
    for (let i = 0; i < verseTimings.length - 1; i++) {
        if (verseTimings[i].end < verseTimings[i+1].start) {
            verseTimings[i].end = verseTimings[i+1].start;
        }
    }

    return verseTimings;
}
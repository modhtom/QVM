import Groq from "groq-sdk";
import fs from "fs";
import stringSimilarity from "string-similarity";
import ffmpeg from "fluent-ffmpeg";
import { getSurahDataRange } from "./data.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function normalizeToken(text) {
    if (!text) return "";
    return text
        .replace(/[\u064B-\u065F\u0670]/g, "") 
        .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") 
        .replace(/\u0629/g, "\u0647") 
        .replace(/[\u0649\u06CC]/g, "\u064A") 
        .replace(/[^\u0600-\u06FF]/g, "") 
        .trim();
}

async function compressAudio(inputPath) {
    const outputPath = inputPath.replace('.mp3', `_lowres_${Date.now()}.mp3`);
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioChannels(1)
            .audioFrequency(16000)
            .audioBitrate('64k') 
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .run();
    });
}

async function createSafeChunk(inputPath, startVerse, endVerse, totalVerses) {
    const startRatio = Math.max(0, (startVerse - 5) / totalVerses);
    const endRatio = Math.min(1, (endVerse + 5) / totalVerses);
    
    const duration = await new Promise((resolve) => {
        ffmpeg.ffprobe(inputPath, (err, meta) => resolve(meta?.format?.duration || 3600));
    });

    const BUFFER = 300; 
    const startTime = Math.max(0, (duration * startRatio) - BUFFER);
    const endTime = Math.min(duration, (duration * endRatio) + BUFFER);
    const chunkDuration = endTime - startTime;

    console.log(`[AutoSync] Creating Safe Chunk: ${startTime.toFixed(0)}s to ${endTime.toFixed(0)}s`);

    const chunkPath = inputPath.replace('.mp3', `_chunk_${Date.now()}.mp3`);
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(chunkDuration)
            .audioCodec('copy') 
            .output(chunkPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    return { chunkPath, offset: startTime };
}

async function transcribeWithRetry(audioPath) {
    try {
        const t = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            timestamp_granularities: ["word"],
            language: "ar"
        });
        if (t.words?.length > 0) return { ...t, mode: 'words' };
        if (t.segments?.length > 0) return { ...t, mode: 'segments' };
    } catch (e) {
        console.warn(`[AutoSync] Word Sync failed (${e.message}). Retrying...`);
    }

    try {
        const t = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            language: "ar"
        });
        if (t.segments?.length > 0) return { ...t, mode: 'segments' };
    } catch (e) { throw new Error(`AI Transcription failed: ${e.message}`); }
    throw new Error("AI returned empty content");
}

function alignTokens(officialTokens, aiTokens) {
    const N = officialTokens.length;
    const M = aiTokens.length;
    const dp = Array(N + 1).fill(0).map(() => Array(M + 1).fill(0));

    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            const off = officialTokens[i - 1].norm;
            const ai = aiTokens[j - 1].norm;
            const isMatch = off === ai || stringSimilarity.compareTwoStrings(off, ai) > 0.85;
            if (isMatch) dp[i][j] = dp[i - 1][j - 1] + 1;
            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const matches = [];
    let i = N, j = M;
    while (i > 0 && j > 0) {
        const off = officialTokens[i - 1].norm;
        const ai = aiTokens[j - 1].norm;
        const isMatch = off === ai || stringSimilarity.compareTwoStrings(off, ai) > 0.85;
        if (isMatch) {
            matches.push({ verseNum: officialTokens[i - 1].verseNum, start: aiTokens[j - 1].start, end: aiTokens[j - 1].end });
            i--; j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
        else j--;
    }
    return matches.reverse();
}

export async function runAutoSync(originalAudioPath, surah, startVerse, endVerse, totalVerses) {
    console.log(`[AutoSync] Processing Surah ${surah} (${startVerse}-${endVerse})`);

    const { combinedText } = await getSurahDataRange(surah, 1, totalVerses, null, "quran-simple-clean");
    const allVerses = combinedText.split('\n').filter(l => l.trim().length > 0);
    
    // --- BASMALAH DETECTION ---
    let indexOffset = 0;
    const firstLineNorm = normalizeToken(allVerses[0]);
    const hasBasmalahHeader = allVerses.length > totalVerses && firstLineNorm.includes("بسم") && surah != 1 && surah != 9;

    if (hasBasmalahHeader) {
        console.log("[AutoSync] Detected Basmalah header. Indexing as Verse 0.");
        indexOffset = 1; 
    }

    const officialTokens = [];
    allVerses.forEach((txt, idx) => {
        if (indexOffset === 1 && idx === 0) return; // Skip Header for ALIGNMENT (we inject manually later)
        
        const verseNum = idx + 1 - indexOffset; 
        txt.trim().split(/\s+/).forEach(w => {
            officialTokens.push({ norm: normalizeToken(w), verseNum: verseNum });
        });
    });

    let processPath = originalAudioPath;
    let timeOffset = 0;
    let tempFiles = [];

    try {
        console.log("[AutoSync] Compressing audio for AI analysis...");
        const compressedPath = await compressAudio(originalAudioPath);
        tempFiles.push(compressedPath);
        
        const stats = fs.statSync(compressedPath);
        const sizeMB = stats.size / (1024 * 1024);

        if (sizeMB > 24) {
            console.warn("[AutoSync] File too large. Using Safety Chunking...");
            const chunkData = await createSafeChunk(compressedPath, startVerse, endVerse, totalVerses);
            processPath = chunkData.chunkPath;
            timeOffset = chunkData.offset;
            tempFiles.push(processPath);
        } else {
            processPath = compressedPath;
        }

        const transcription = await transcribeWithRetry(processPath);
        let aiTokens = [];
        
        if (transcription.mode === 'words') {
            aiTokens = transcription.words.map(w => ({
                norm: normalizeToken(w.word), start: w.start + timeOffset, end: w.end + timeOffset
            })).filter(t => t.norm);
        } else {
            transcription.segments.forEach(seg => {
                const words = seg.text.trim().split(/\s+/);
                const dur = seg.end - seg.start;
                let cursor = seg.start;
                words.forEach(w => {
                    const norm = normalizeToken(w);
                    if (norm) {
                        const wDur = (w.length / seg.text.length) * dur;
                        aiTokens.push({ norm, start: cursor + timeOffset, end: cursor + wDur + timeOffset });
                        cursor += wDur;
                    }
                });
            });
        }

        const allMatches = alignTokens(officialTokens, aiTokens);
        if (allMatches.length === 0) return [];

        const verseTimings = [];
        // If Basmalah exists and we are starting from 1, we must process Verse 1...End
        // Verse 0 is handled manually below
        const targetStart = parseInt(startVerse);
        const targetEnd = parseInt(endVerse);

        for (let v = targetStart; v <= targetEnd; v++) {
            const vMatches = allMatches.filter(m => m.verseNum === v);
            if (vMatches.length > 0) {
                verseTimings.push({
                    verse_num: v,
                    start: vMatches[0].start,
                    end: vMatches[vMatches.length - 1].end
                });
            } else {
                verseTimings.push({ verse_num: v, start: -1, end: -1 });
            }
        }

        // --- GAP FILLING ---
        for (let i = 0; i < verseTimings.length; i++) {
            if (verseTimings[i].start === -1) {
                let prevEnd = (i > 0) ? verseTimings[i-1].end : Math.max(0, timeOffset);
                let nextStart = -1;
                let j = i + 1;
                while (j < verseTimings.length) {
                    if (verseTimings[j].start !== -1) { nextStart = verseTimings[j].start; break; }
                    j++;
                }

                if (nextStart === -1) {
                    const nextContext = allMatches.filter(m => m.verseNum === targetEnd + 1);
                    if (nextContext.length) nextStart = nextContext[0].start;
                    else nextStart = prevEnd + ((j-i) * 5); 
                }

                const step = (nextStart - prevEnd) / (j - i);
                for (let k = i; k < j; k++) {
                    verseTimings[k].start = prevEnd + ((k-i)*step);
                    verseTimings[k].end = prevEnd + ((k-i+1)*step);
                }
                i = j - 1;
            }
        }

        for (let i = 0; i < verseTimings.length - 1; i++) {
            if (verseTimings[i].end < verseTimings[i+1].start) {
                verseTimings[i].end = verseTimings[i+1].start;
            }
        }

        // --- INJECT BASMALAH (Verse 0) ---
        // If the API text has Basmalah (Line 0) and we requested Verse 1, we MUST provide a timing for Verse 0
        // otherwise subtitle.js will fail to map Line 0.
        if (hasBasmalahHeader && parseInt(startVerse) === 1) {
            console.log("[AutoSync] Injecting Verse 0 (Basmalah) timing.");
            const verse1Start = verseTimings.length > 0 ? verseTimings[0].start : 5.0;
            verseTimings.unshift({
                verse_num: 0,
                start: Math.max(0, timeOffset),
                end: verse1Start
            });
        }

        return verseTimings;

    } finally {
        tempFiles.forEach(f => {
            if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch(e){}
        });
    }
}
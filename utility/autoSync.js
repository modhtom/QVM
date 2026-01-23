import Groq from "groq-sdk";
import fs from "fs";
import stringSimilarity from "string-similarity";
import ffmpeg from "fluent-ffmpeg";
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

async function compressAudio(inputPath) {
    const outputPath = inputPath.replace('.mp3', `_lowres_${Date.now()}.mp3`);
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioChannels(1)       // Mono (Stereo unnecessary for text sync)
            .audioFrequency(16000)  // 16kHz (Whisper native sample rate)
            .audioBitrate('64k')    // Low bitrate (Speech is clear at 64k)
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .run();
    });
}

async function createSafeChunk(inputPath, startVerse, endVerse, totalVerses) {
    // FALLBACK STRATEGY: Smart Windowing
    // Only used if file is HUGE
    // Calculate rough position based on text ratio
    const startRatio = Math.max(0, (startVerse - 5) / totalVerses);
    const endRatio = Math.min(1, (endVerse + 5) / totalVerses);
    const duration = await new Promise((resolve) => {
        ffmpeg.ffprobe(inputPath, (err, meta) => {
            resolve(meta?.format?.duration || 3600);
        });
    });

    const BUFFER = 300; // MASSIVE safety buffer (5 minutes padding) prevents "Drift" and "Missed Boundaries"
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

// LCS Algorithm (Longest Common Subsequence)
function alignTokens(officialTokens, aiTokens) {
    const N = officialTokens.length;
    const M = aiTokens.length;
    
    // DP Matrix
    const dp = Array(N + 1).fill(0).map(() => Array(M + 1).fill(0));

    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            const offNorm = officialTokens[i - 1].norm;
            const aiNorm = aiTokens[j - 1].norm;
            const isMatch = offNorm === aiNorm || stringSimilarity.compareTwoStrings(offNorm, aiNorm) > 0.9;

            if (isMatch) {
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
        const offNorm = officialTokens[i - 1].norm;
        const aiNorm = aiTokens[j - 1].norm;
        const isMatch = offNorm === aiNorm || stringSimilarity.compareTwoStrings(offNorm, aiNorm) > 0.9;

        if (isMatch) {
            matches.push({
                verseNum: officialTokens[i - 1].verseNum,
                start: aiTokens[j - 1].start,
                end: aiTokens[j - 1].end
            });
            i--; j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
        else j--;
    }

    return matches.reverse();
}

async function transcribe(audioPath) {
    try {
        const t = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            timestamp_granularities: ["word"],
            language: "ar"
        });
        if (t.words && t.words.length > 0) return { ...t, mode: 'words' };
        if (t.segments && t.segments.length > 0) return { ...t, mode: 'segments' };
        throw new Error("Empty response");
    } catch (e) {
        console.warn(`[AutoSync] Word Sync failed (${e.message}). Retrying with Segments...`);
    }

    try {
        const t = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            language: "ar"
        });
        if (t.segments && t.segments.length > 0) return { ...t, mode: 'segments' };
    } catch (e) {
        console.error(`[AutoSync] Segment Sync failed: ${e.message}`);
    }

    throw new Error("AI returned no content (Both Word and Segment modes failed)");
}

export async function runAutoSync(audioPath, surah, startVerse, endVerse, totalVerses) {
    console.log(`[AutoSync] Context-Aware LCS Processing Surah ${surah} (Target: ${startVerse}-${endVerse}, Total: ${totalVerses})...`);

    const { combinedText } = await getSurahDataRange(surah, 1, totalVerses, null, "quran-simple-clean");
    const allVerses = combinedText.split('\n').filter(line => line.trim().length > 0);

    const officialTokens = [];
    allVerses.forEach((verseText, idx) => {
        const verseNum = idx + 1;
        const words = verseText.trim().split(/\s+/);
        words.forEach(w => {
            const norm = normalizeToken(w);
            if (norm) officialTokens.push({ norm, verseNum });
        });
    });

    let processPath = audioPath;
    let tempFiles = [];
    try {
        // COMPRESSION FIRST
        console.log("[AutoSync] Compressing audio for AI analysis...");
        const compressedPath = await compressAudio(audioPath);
        tempFiles.push(compressedPath);
        
        const stats = fs.statSync(compressedPath);
        const sizeMB = stats.size / (1024 * 1024);
        console.log(`[AutoSync] Compressed Size: ${sizeMB.toFixed(2)}MB`);

        if (sizeMB < 24) {
            processPath = compressedPath;
        } else {
            // SAFETY CHUNK
            console.warn("[AutoSync] File still too large. Using Safety Chunking...");
            const chunkData = await createSafeChunk(compressedPath, startVerse, endVerse, totalVerses);
            processPath = chunkData.chunkPath;
            timeOffset = chunkData.offset;
            tempFiles.push(processPath);
        }

        console.log(`[AutoSync] Loaded ${processPath.length} verses for context.`);

        const transcription = await transcribe(processPath);
        let aiTokens = [];
        if (transcription.mode === 'words') {
            console.log("[AutoSync] Using Native Word Timestamps");
            aiTokens = transcription.words.map(w => ({
                norm: normalizeToken(w.word), start: w.start, end: w.end
            })).filter(t => t.norm);
        } else {
            console.log("[AutoSync] Fallback: Interpolating from Segments");
            transcription.segments.forEach(seg => {
                const words = seg.text.trim().split(/\s+/);
                const dur = seg.end - seg.start;
                let cursor = seg.start;
                words.forEach(w => {
                    const norm = normalizeToken(w);
                    if (norm) {
                        const wDur = (w.length / seg.text.length) * dur;
                        aiTokens.push({ norm, start: cursor, end: cursor + wDur });
                        cursor += wDur;
                    }
                });
            });
        }

        const allMatches = alignTokens(officialTokens, aiTokens);
        if (allMatches.length === 0) {
            console.warn("[AutoSync] LCS found 0 matches.");
            return [];
        }
        
        const verseTimings = [];
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

        // GAP FILLING (Smart-ish Estimation)
        for (let i = 0; i < verseTimings.length; i++) {
            if (verseTimings[i].start === -1) {
                let prevEnd = (i > 0) ? verseTimings[i-1].end : 0;
                if (i === 0) {
                    const prevContext = allMatches.filter(m => m.verseNum === (targetStart - 1));
                    if (prevContext.length > 0) prevEnd = prevContext[prevContext.length-1].end;
                }

                let nextStart = -1;
                let j = i + 1;
                while (j < verseTimings.length) {
                    if (verseTimings[j].start !== -1) {
                        nextStart = verseTimings[j].start;
                        break;
                    }
                    j++;
                }
                
                if (nextStart === -1) {
                    const nextContext = allMatches.filter(m => m.verseNum === (targetEnd + 1));
                    if (nextContext.length > 0) nextStart = nextContext[0].start;
                    else {
                        const pendingVerses = targetEnd - (targetStart + i) + 1;
                        nextStart = prevEnd + (pendingVerses * 5);
                        nextStart = Math.min(transcription.duration || 9999, nextStart);
                    }
                }

                const dur = nextStart - prevEnd;
                const step = dur / (j - i);
                for (let k = i; k < j; k++) {
                    verseTimings[k].start = prevEnd + ((k-i)*step);
                    verseTimings[k].end = prevEnd + ((k-i+1)*step);
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
    
    } finally {
        tempFiles.forEach(f => {
            if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch(e){}
        });
    }
}
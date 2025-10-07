import fs from "fs";
import path from "path";
import * as mm from "music-metadata";

const MAX_CHARS_PER_LINE = 70;

function splitTextIntoChunks(text, maxLength) {
    if (!text) return [];
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = "";

    for (const word of words) {
        if (currentChunk.length === 0) {
            currentChunk = word;
        } else if (currentChunk.length + word.length + 1 <= maxLength) {
            currentChunk += " " + word;
        } else {
            chunks.push(currentChunk);
            currentChunk = word;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}

function buildFullLine(mainText, transliterationText, translationText, color, fontName, size) {
    let line = `{\\c${color}\\an5\\q1\\bord2\\fn${fontName}}${mainText || ''}`;
    if (transliterationText) {
        line += `\\N{\\fs${size * 5}}${transliterationText}`;
    }
    if (translationText) {
        line += `\\N{\\fs${size * 5}}${translationText}`;
    }
    return line;
}

export async function generateSubtitles(
    surahNumber,
    startVerse,
    endVerse,
    color,
    position,
    fontName,
    size,
    audioLen = null,
    audioPath = null,
    userVerseTimings = null
) {
    const textFilePath = path.resolve(`Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`);
    const durationsFilePath = path.resolve(`Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`);
    const subtitlesOutputDir = path.resolve("Data/subtitles");
    const subtitlesOutputFile = path.join(subtitlesOutputDir, `Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.ass`);
    if (!fs.existsSync(textFilePath)) {
        console.error("Text or durations file not found.");
        throw new Error(`Subtitle generation failed: Text file not found at ${textFilePath}`);
    }

    try {
        const textContent = fs.readFileSync(textFilePath, "utf-8").split("\n").filter(Boolean);
        const translationFilePath = path.resolve(`Data/text/Surah_${surahNumber}_Translation_from_${startVerse}_to_${endVerse}.txt`);
        const transliterationFilePath = path.resolve(`Data/text/Surah_${surahNumber}_Transliteration_from_${startVerse}_to_${endVerse}.txt`);

        const hasTranslation = fs.existsSync(translationFilePath);
        const hasTransliteration = fs.existsSync(transliterationFilePath);

        const translationContent = hasTranslation ? fs.readFileSync(translationFilePath, "utf-8").split("\n").filter(Boolean) : [];
        const transliterationContent = hasTransliteration ? fs.readFileSync(transliterationFilePath, "utf-8").split("\n").filter(Boolean) : [];

        // Ensure we have audio length; if not provided, try to read it from audioPath
        if ((!audioLen || isNaN(audioLen) || audioLen <= 0) && audioPath && fs.existsSync(audioPath)) {
            try {
                const meta = await mm.parseFile(audioPath);
                audioLen = Math.ceil(meta.format.duration || 0);
            } catch (e) {
                console.warn("Could not read audio metadata in subtitles generator:", e.message);
                audioLen = null;
            }
        }

        let pos = position.split(',');
        
        let subtitles = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${pos[0]}\nPlayResY: ${pos[1]}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${fontName},${size * 8},${color},&H0300FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        if (userVerseTimings && userVerseTimings.length === textContent.length) {
            for (let i = 0; i < textContent.length; i++) {
                const startTime = userVerseTimings[i].start;
                let endTime = userVerseTimings[i].end;
                if (i === textContent.length - 1 && audioLen) {
                    endTime = Math.max(endTime, audioLen);
                }
                let fullLine = buildFullLine(
                    textContent[i],
                    transliterationContent[i],
                    translationContent[i],
                    color,
                    fontName,
                    size
                );
                subtitles += `Dialogue: 0,${formatTime(startTime)},${formatTime(endTime)},Default,,0,0,0,,${fullLine}\n`;
            }
        } else {
            const durationPerAyah = JSON.parse(fs.readFileSync(durationsFilePath, "utf-8"));
            if (textContent.length !== durationPerAyah.length) {
                console.error("Mismatch between texts and durations.");
                const avg = durationPerAyah.reduce((a,b)=>a+b,0)/durationPerAyah.length || 1;
                while (durationPerAyah.length < textContent.length) durationPerAyah.push(avg);
            }
            let currentTime = 0;
            for (let i = 0; i < textContent.length; i++) {
                const verseText = textContent[i];
                const verseTranslation = translationContent[i] || '';
                const verseTransliteration = transliterationContent[i] || '';
                const totalDuration = durationPerAyah[i];

                const startTime = currentTime;

                if (verseText.length > MAX_CHARS_PER_LINE) {
                    const textChunks = splitTextIntoChunks(verseText, MAX_CHARS_PER_LINE);
                    const translationChunks = splitTextIntoChunks(verseTranslation, MAX_CHARS_PER_LINE);
                    const numChunks = Math.max(textChunks.length, translationChunks.length);
                    const chunkDuration = totalDuration / numChunks;

                    for (let j = 0; j < numChunks; j++) {
                        const chunkStartTime = startTime + (j * chunkDuration);
                        let chunkEndTime = chunkStartTime + chunkDuration;
                        if (i === textContent.length - 1 && audioLen) {
                            if (j === numChunks - 1) chunkEndTime = Math.max(chunkEndTime, audioLen);
                        }
                        const chunkText = textChunks[j] || '';
                        const chunkTranslation = translationChunks[j] || '';

                        const fullLine = buildFullLine(chunkText, '', chunkTranslation, color, fontName, size);
                        subtitles += `Dialogue: 0,${formatTime(chunkStartTime)},${formatTime(chunkEndTime)},Default,,0,0,0,,${fullLine}\n`;
                    }
                } else {
                    let endTime = startTime + totalDuration;
                    if (i === textContent.length - 1 && audioLen) {
                        endTime = Math.max(endTime, audioLen);
                    }
                    const fullLine = buildFullLine(verseText, verseTransliteration, verseTranslation, color, fontName, size);
                    subtitles += `Dialogue: 0,${formatTime(startTime)},${formatTime(endTime)},Default,,0,0,0,,${fullLine}\n`;
                }

                if (!userVerseTimings) {
                    currentTime += totalDuration;
                }
            }
        }

        fs.mkdirSync(subtitlesOutputDir, { recursive: true });
        fs.writeFileSync(subtitlesOutputFile, subtitles, "utf-8");
    } catch (error) {
        console.error("Error generating styled subtitles:", error);
        throw error;
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const totalMs = Math.floor(seconds * 1000);
    const ms = totalMs % 1000;
    const totalSec = Math.floor(totalMs / 1000);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60) % 60;
    const hr = Math.floor(totalSec / 3600);
    return `${hr}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${Math.floor(ms/10).toString().padStart(2, '0')}`;
}
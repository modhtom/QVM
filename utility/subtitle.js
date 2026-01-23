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
function buildFullLine(mainText, transliterationText, translationText, color, fontName, size, alignment) {
    const safeFont = fontName || "Arial";
    let line = `{\\an${alignment}\\c${color}\\q1\\bord2\\fn${safeFont}}${mainText || ''}`;
    if (transliterationText) {
        line += `\\N{\\fs${Math.round(size * 5)}}${transliterationText}`;
    }
    if (translationText) {
        line += `\\N{\\fs${Math.round(size * 5)}}${translationText}`;
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
    userVerseTimings = null,
    subtitlePosition = 'bottom',
    metadata = null
) {
    const textFilePath = path.resolve(`Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`);
    const durationsFilePath = path.resolve(`Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`);
    const subtitlesOutputDir = path.resolve("Data/subtitles");
    const subtitlesOutputFile = path.join(subtitlesOutputDir, `Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.ass`);
    if (!fs.existsSync(textFilePath)) {
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

        if ((!audioLen || isNaN(audioLen) || audioLen <= 0) && audioPath && fs.existsSync(audioPath)) {
            try {
                const meta = await mm.parseFile(audioPath);
                audioLen = meta.format.duration || 0;
            } catch (e) {
                console.warn("Could not read audio metadata:", e.message);
            }
        }

        let pos = position.split(',');
        const alignment = subtitlePosition === 'middle' ? 5 : 2;
        const marginV = subtitlePosition === 'middle' ? 0 : 50;

        let subtitles = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${pos[0]}\nPlayResY: ${pos[1]}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
        
        subtitles += `Style: Default,${fontName},${size * 8},${color},&H0300FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,${alignment},10,10,${marginV},1\n`;

        if (metadata) {
            subtitles += `Style: Info,${fontName},30,&H00FFFFFF,&H0300FFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,1,1,8,10,10,20,1\n`;
        }

        subtitles += `\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        if (metadata && audioLen) {
            const infoText = `${metadata.surahName} | ${metadata.reciterName || 'Recitation'} | ${metadata.rewayat || 'Rewayat'}`;
            subtitles += `Dialogue: 1,0:00:00.00,${formatTime(audioLen)},Info,,0,0,0,,${infoText}\n`;
        }

        const useUserTimings = userVerseTimings && userVerseTimings.length > 0;

        if (useUserTimings) {
            console.log("Using User Custom Timings");
            for (let i = 0; i < textContent.length; i++) {
                const timing = userVerseTimings[i];
                if (!timing) {
                    console.warn(`[Subtitles] Warning: No timing found for line ${i+1}. Skipping.`);
                    continue;
                }
                const startTime = userVerseTimings[i].start;
                let endTime = userVerseTimings[i].end;
                if (i === textContent.length - 1 && audioLen) endTime = Math.max(endTime, audioLen);
                
                let fullLine = buildFullLine(textContent[i], transliterationContent[i], translationContent[i], color, fontName, size, alignment);
                subtitles += `Dialogue: 0,${formatTime(startTime)},${formatTime(endTime)},Default,,0,0,0,,${fullLine}\n`;
            }
        } else {
            console.log("Using Automatic Timings with Scaling");
            
            let durationPerAyah = [];
            try {
                durationPerAyah = JSON.parse(fs.readFileSync(durationsFilePath, "utf-8"));
            } catch(e) { console.warn("Duration file corrupt, using defaults"); }

            if (textContent.length !== durationPerAyah.length) {
                const avg = durationPerAyah.reduce((a,b)=>a+b,0)/durationPerAyah.length || 3;
                while (durationPerAyah.length < textContent.length) durationPerAyah.push(avg);
            }

            const totalApiDuration = durationPerAyah.reduce((a, b) => a + b, 0);
            
            const actualDuration = audioLen || totalApiDuration;
            
            const timeRatio = (actualDuration > 0 && totalApiDuration > 0)
                ? (actualDuration / totalApiDuration)
                : 1;

            console.log(`Timing Scaling: API Total=${totalApiDuration.toFixed(2)}s, Actual=${actualDuration.toFixed(2)}s, Ratio=${timeRatio.toFixed(3)}`);

            let currentTime = 0;
            
            for (let i = 0; i < textContent.length; i++) {
                const verseText = textContent[i];
                const originalDuration = durationPerAyah[i];
                const scaledDuration = originalDuration * timeRatio;

                const startTime = currentTime;
                let endTime = startTime + scaledDuration;

                const wrappedMain = splitTextIntoChunks(textContent[i], MAX_CHARS_PER_LINE).join("\\N");
                const wrappedTranslit = splitTextIntoChunks(transliterationContent[i], MAX_CHARS_PER_LINE).join("\\N");
                const wrappedTrans = splitTextIntoChunks(translationContent[i], MAX_CHARS_PER_LINE).join("\\N");

                const fullLine = buildFullLine(wrappedMain, wrappedTranslit, wrappedTrans, color, fontName, size, alignment);
                
                subtitles += `Dialogue: 0,${formatTime(startTime)},${formatTime(endTime)},Default,,0,0,0,,${fullLine}\n`;

                currentTime += scaledDuration;
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
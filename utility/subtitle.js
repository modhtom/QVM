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
        if (currentChunk.length === 0) currentChunk = word;
        else if (currentChunk.length + word.length + 1 <= maxLength) currentChunk += " " + word;
        else { chunks.push(currentChunk); currentChunk = word; }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

function buildFullLine(mainText, transliterationText, translationText, color, fontName, size, alignment) {
    const safeFont = fontName || "Arial";
    let line = `{\\an${alignment}\\c${color}\\q1\\bord2\\fn${safeFont}}${mainText || ''}`;
    if (transliterationText) line += `\\N{\\fs${Math.round(size * 5)}}${transliterationText}`;
    if (translationText) line += `\\N{\\fs${Math.round(size * 5)}}${translationText}`;
    return line;
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const totalMs = Math.floor(seconds * 1000);
    const ms = totalMs % 1000;
    const totalSec = Math.floor(totalMs / 1000);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60) % 60;
    const hr = Math.floor(totalSec / 3600);
    return `${hr}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${Math.floor(ms/10).toString().padStart(2,'0')}`;
}

export async function generateSubtitles(
    surahNumber, startVerse, endVerse, color, position, fontName, size,
    audioLen = null, audioPath = null, userVerseTimings = null,
    subtitlePosition = 'bottom', metadata = null, startTimeOffset = 0
) {
    const textFilePath = path.resolve(`Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`);
    const subtitlesOutputDir = path.resolve("Data/subtitles");
    const subtitlesOutputFile = path.join(subtitlesOutputDir, `Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.ass`);

    if (!fs.existsSync(textFilePath)) throw new Error(`Subtitle gen failed: Text file missing`);

    try {
        const textContent = fs.readFileSync(textFilePath, "utf-8").split("\n").filter(Boolean);
        const transPath = path.resolve(`Data/text/Surah_${surahNumber}_Translation_from_${startVerse}_to_${endVerse}.txt`);
        const translitPath = path.resolve(`Data/text/Surah_${surahNumber}_Transliteration_from_${startVerse}_to_${endVerse}.txt`);
        
        const transContent = fs.existsSync(transPath) ? fs.readFileSync(transPath, "utf-8").split("\n").filter(Boolean) : [];
        const translitContent = fs.existsSync(translitPath) ? fs.readFileSync(translitPath, "utf-8").split("\n").filter(Boolean) : [];

        const hasBasmalahHeader = parseInt(startVerse) === 1 && surahNumber != 1 && surahNumber != 9;

        let pos = position.split(',');
        const alignment = subtitlePosition === 'middle' ? 5 : 2;
        const marginV = subtitlePosition === 'middle' ? 0 : 50;

        let subtitles = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${pos[0]}\nPlayResY: ${pos[1]}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
        subtitles += `Style: Default,${fontName},${size * 8},${color},&H0300FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,${alignment},10,10,${marginV},1\n`;
        if (metadata) subtitles += `Style: Info,${fontName},30,&H00FFFFFF,&H0300FFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,1,1,8,10,10,20,1\n`;
        subtitles += `\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        if (metadata) {
            const infoText = [metadata.surahName, metadata.reciterName, metadata.rewayat].filter(Boolean).join(" | ");
            subtitles += `Dialogue: 1,0:00:00.00,${formatTime(Math.min(5, audioLen || 5))},Info,,0,0,0,,${infoText}\n`;
        }

        if (userVerseTimings && userVerseTimings.length > 0) {
            console.log(`[Subtitles] Mapping ${textContent.length} lines. HasBasmalah: ${hasBasmalahHeader}`);
            
            for (let i = 0; i < textContent.length; i++) {
                let currentVerseNum;
                if (hasBasmalahHeader) {
                    currentVerseNum = i;
                } else {
                    currentVerseNum = parseInt(startVerse) + i;
                }

                const timing = userVerseTimings.find(t => t.verse_num === currentVerseNum);
                
                if (timing) {
                    let start = Math.max(0, timing.start - startTimeOffset);
                    let end = Math.max(0, timing.end - startTimeOffset);
                    
                    if (end > audioLen) end = audioLen;
                    
                    if (end > start) {
                        const wrappedMain = splitTextIntoChunks(textContent[i], MAX_CHARS_PER_LINE).join("\\N");
                        const wrappedTranslit = splitTextIntoChunks(translitContent[i] || "", MAX_CHARS_PER_LINE).join("\\N");
                        const wrappedTrans = splitTextIntoChunks(transContent[i] || "", MAX_CHARS_PER_LINE).join("\\N");

                        const line = buildFullLine(wrappedMain, wrappedTranslit, wrappedTrans, color, fontName, size, alignment);
                        subtitles += `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,,0,0,0,,${line}\n`;
                    }
                } else {
                    console.log(`[Subtitles] Skipping text line ${i} (Verse ${currentVerseNum}) - No timing found.`);
                }
            }
        }
        else {
            const durPerVerse = (audioLen || 10) / textContent.length;
            for (let i = 0; i < textContent.length; i++) {
                const start = i * durPerVerse;
                const end = (i + 1) * durPerVerse;
                const wrappedMain = splitTextIntoChunks(textContent[i], MAX_CHARS_PER_LINE).join("\\N");
                const line = buildFullLine(wrappedMain, translitContent[i], transContent[i], color, fontName, size, alignment);
                subtitles += `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,,0,0,0,,${line}\n`;
            }
        }

        fs.mkdirSync(subtitlesOutputDir, { recursive: true });
        fs.writeFileSync(subtitlesOutputFile, subtitles, "utf-8");
        return subtitlesOutputFile;

    } catch (error) {
        console.error("Error generating styled subtitles:", error);
        throw error;
    }
}
import fs from "fs";
import path from "path"; 

export async function generateSubtitles(
    surahNumber,
    startVerse,
    endVerse,
    color,
    position,
    fontName,
    size,
    audioPath = null,
    userVerseTimings = null
) {
    const textFilePath = path.resolve(
        `Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`
    );
    const durationsFilePath = path.resolve(
        `Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`
    );
    const subtitlesOutputDir = path.resolve("Data/subtitles");
    const subtitlesOutputFile = path.join(
        subtitlesOutputDir,
        `Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.ass`
    );

    if (!fs.existsSync(textFilePath) || !fs.existsSync(durationsFilePath)) {
        console.error(
            "Text or durations file not found. Ensure partAudioAndText was executed successfully."
        );
        return -1;
    }

    try {
        const textContent = fs.readFileSync(textFilePath, "utf-8").split("\n").filter(Boolean);
        let pos = position.split(',');
        
        let subtitles = "[Script Info]\n";
        subtitles += "ScriptType: v4.00+\n";
        subtitles += `vPlayResX: ${pos[0]}\n`;
        subtitles += `PlayResY: ${pos[1]}\n\n`;
        
        subtitles += "[V4+ Styles]\n";
        subtitles += "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n";
        subtitles += `Style: Default,${fontName},${size * 8},${color},&H0300FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n`;
        
        if (userVerseTimings && userVerseTimings.length === textContent.length) {
            // Use user-provided timings if available
            for (let i = 0; i < textContent.length; i++) {
                const startTime = userVerseTimings[i].start;
                const endTime = userVerseTimings[i].end;
                subtitles += `Dialogue: 0,${formatTime(startTime)},${formatTime(endTime)},Default,,0,0,0,,{\\c${color}\\an5\\q1\\bord2\\fn${fontName}}${textContent[i]}\n`;
            }
        } else {
            // Fallback to default duration calculation
            let durationPerAyah = [];
            if (fs.existsSync(durationsFilePath)) {
                durationPerAyah = JSON.parse(fs.readFileSync(durationsFilePath, "utf-8"));
            }

            const totalCalculatedDuration = durationPerAyah.reduce((a, b) => a + b, 0);
            if (totalCalculatedDuration === 0) {
                console.warn("Calculated total duration is zero. Falling back to 1 second per verse.");
                durationPerAyah = new Array(textContent.length).fill(1);
            }

            if (textContent.length !== durationPerAyah.length) {
                console.error("Mismatch between the number of Ayah texts and durations.");
                return -1;
            }

            let currentTime = 0;
            for (let i = 0; i < durationPerAyah.length; i++) {
                const startTime = formatTime(currentTime);
                currentTime += durationPerAyah[i];
                const endTime = formatTime(currentTime);
                subtitles += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,{\\c${color}\\an5\\q1\\bord2\\fn${fontName}}${textContent[i]}\n`;
            }
        }

        fs.mkdirSync(subtitlesOutputDir, { recursive: true });
        fs.writeFileSync(subtitlesOutputFile, subtitles, "utf-8");
        return 1;
    } catch (error) {
        console.error("Error generating styled subtitles:", error);
        return -1;
    }
}

function formatTime(seconds) {
  const totalMs = Math.floor(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);

  return `${hr.toString().padStart(1, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${Math.floor(ms/10).toString().padStart(2, '0')}`;
}
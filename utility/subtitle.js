import fs from "fs";
import path from "path";

export async function generateSubtitles(
    surahNumber,
    startVerse,
    endVerse,
    fontPath,
    color,
    position,
  ) {
  
    const textFilePath = path.resolve(
        `Data/text/Surah_${surahNumber}_Text_from_${startVerse}_to_${endVerse}.txt`,
    );
    const durationsFilePath = path.resolve(
      `Data/text/Surah_${surahNumber}_Durations_from_${startVerse}_to_${endVerse}.json`,
    );
    const subtitlesOutputDir = path.resolve("Data/subtitles");
    const subtitlesOutputFile = path.join(
      subtitlesOutputDir,
      `Surah_${surahNumber}_Subtitles_from_${startVerse}_to_${endVerse}.srt`,
    );
  
    if (!fs.existsSync(textFilePath) || !fs.existsSync(durationsFilePath)) {
      console.error(
        "Text or durations file not found. Ensure partAudioAndText was executed successfully.",
      );
      return -1;
    }
  
    try {
      const textContent = fs
        .readFileSync(textFilePath, "utf-8")
        .split("\n")
        .filter(Boolean);
      const durationPerAyah = JSON.parse(
        fs.readFileSync(durationsFilePath, "utf-8"),
      );
  
      if (textContent.length !== durationPerAyah.length) {
        console.error("Mismatch between the number of Ayah texts and durations.");
        return -1;
      }
  
      let subtitles = "";
      let currentTime = 0;
  
      for (let i = 0; i < durationPerAyah.length; i++) {
        const startTime = formatTime(currentTime);
        currentTime += durationPerAyah[i];
        const endTime = formatTime(currentTime);

        subtitles += `${i + 1}\n`;
        subtitles += `${startTime} --> ${endTime}\n`;
        subtitles += `{\\fontstyle${fontPath}\\c&H${color}&\\pos(${position})}${textContent[i]}\n\n`;
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
    const ms = Math.floor((seconds % 1) * 1000)
      .toString()
      .padStart(3, "0");
    const sec = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    const min = Math.floor((seconds / 60) % 60)
      .toString()
      .padStart(2, "0");
    const hr = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
  
    return `${hr}:${min}:${sec},${ms}`;
  }
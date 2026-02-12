import fs from "fs";
import { readdir, stat } from "fs";
import { join } from "path";

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;

async function safeUnlink(filePath) {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      await fs.promises.unlink(filePath);
      console.log(`Deleted: ${filePath}`);
      return;
    } catch (err) {
      if (err.code === 'ENOENT') return; // File already deleted
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.warn(`Failed to delete ${filePath} after ${RETRY_ATTEMPTS} attempts:`, err.message);
      }
    }
  }
}

export async function deleteVidData(
  removeFiles,
  audioPath,
  textPath,
  backgroundPath,
  durationsFile,
  subFile,
  customAudioPath
) {
  if (!removeFiles) return;

  const filesToDelete = [
    audioPath,
    textPath,
    backgroundPath,
    durationsFile,
    subFile,
    customAudioPath,
  ].filter(Boolean);

  await Promise.allSettled(
    filesToDelete.map(f => safeUnlink(f))
  );
}

export function deleteOldVideosAndTempFiles() {
  const videoFolder = "Output_Video/";
  const tempFolder = "Data/temp/";
  const videoThresholdMs = 24 * 60 * 60 * 1000; // 24 hours
  const tempThresholdMs = 2000; // 2 seconds
  const currentTime = Date.now();

  cleanDirectory(tempFolder, currentTime, tempThresholdMs);
  cleanDirectory(videoFolder, currentTime, videoThresholdMs);
}

function cleanDirectory(dirPath, currentTime, thresholdMs) {
  readdir(dirPath, (err, files) => {
    if (err) return console.log("Error reading directory", err);
    files.forEach((file) => {
      const filePath = join(dirPath, file);
      stat(filePath, (err, stats) => {
        if (err) return console.log("Error getting file stats", err);
        const age = currentTime - stats.ctimeMs;
        if (age > thresholdMs) {
          fs.unlink(filePath, (err) => {
            if (err) console.log("Error deleting file", err);
            else console.log(`Deleted: ${filePath}`);
          });
        }
      });
    });
  });
}
import {readdir, stat, unlink } from "fs";
import { join } from "path";
import fs from "fs";
export function deleteVidData(
    removeFiles,
    audioPath,
    textPath,
    backgroundPath,
    durationsFile,
    subFile,
  ) {
    if (removeFiles) {
      try {
        if (fs.existsSync(audioPath)) {
          unlink(audioPath, (err) => {
            if (err) console.log("Error deleting file", err);
            else console.log(`Deleted: ${audioPath}`);
          });
        }
  
        if (fs.existsSync(textPath)) {
          unlink(textPath, (err) => {
            if (err) console.log("Error deleting file", err);
            else console.log(`Deleted: ${textPath}`);
          });
        }
  
        if (fs.existsSync(backgroundPath)) {
          unlink(backgroundPath, (err) => {
            if (err) console.log("Error deleting file", err);
            else console.log(`Deleted: ${backgroundPath}`);
          });
        }
  
        if (fs.existsSync(durationsFile)) {
          unlink(durationsFile, (err) => {
            if (err) console.log("Error deleting file", err);
            else console.log(`Deleted: ${durationsFile}`);
          });
        }
  
        if (fs.existsSync(subFile)) {
          unlink(subFile, (err) => {
            if (err) console.log("Error deleting file", err);
            else console.log(`Deleted: ${subFile}`);
          });
        }
      } catch (err) {
        console.error("Error deleting files:", err);
      }
    }
  }
  
export function deleteOldVideos() {
    const videoFolder = "Output_Video/";
    const threshold = 24 * 60 * 60 ; // 24 hours
    const currentTime = Date.now();
  
    readdir(videoFolder, (err, files) => {
      if (err) return console.log("Error reading directory", err);
      files.forEach((file) => {
        const filePath = join(videoFolder, file);
        stat(filePath, (err, stats) => {
          if (err) return console.log("Error getting file stats", err);
          const age = currentTime - stats.ctimeMs;
          if (age > threshold) {
            unlink(filePath, (err) => {
              if (err) console.log("Error deleting file", err);
              else console.log(`Deleted: ${filePath}`);
            });
          }
        });
      });
    });
  }
  
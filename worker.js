import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generatePartialVideo, generateFullVideo } from './video.js';
import { runAutoSync } from './utility/autoSync.js';

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  maxRetriesPerRequest: null
});
console.log('Worker connecting to Redis...');

const worker = new Worker('video-queue', async (job) => {
  console.log(`Processing job ${job.id}:`, job.data.type);
  const { type, videoData } = job.data;

  try {
    const progressCallback = (progress) => {
      job.updateProgress(progress);
      if (progress.percent % 10 === 0 || progress.step.includes('Starting') || progress.step.includes('Complete')) {
        console.log(`Job ${job.id}: ${progress.step} (${Math.round(progress.percent)}%)`);
      }
    };

    let finalTimings = videoData.userVerseTimings;
    if (videoData.audioSource === 'custom' && videoData.autoSync === true) {
        progressCallback({ step: 'Running AI Auto-Sync...', percent: 15 });
        try {
            // Ensure we have a local file path (downloaded from R2 by video.js logic later, 
            // but for now we assume video.js handles the download. 
            // WAIT: worker.js calls video.js which downloads the file.
            // We need to download the file HERE if we want to sync it before generation, 
            // OR update video.js to expose a "download only" method.
            
            // SIMPLER APPROACH: Let video.js handle download, but we pass a flag to generate* functions
            // asking them to run sync after download.
            // HOWEVER, video.js is structured to run linearly. 
            
            // FOR NOW: We assume the user uploaded the file and it's available locally 
            // OR we rely on the fact that Munajjam needs a local file.
            
            // NOTE: Since we moved to R2, the file in videoData.customAudioPath is an R2 key (uploads/audio/...).
            // We cannot run Python on an R2 key.
            // We must download it first.
            
            // To avoid code duplication, we will let generatePartialVideo handle the download
            // and we will inject the "runAutoSync" call INSIDE generatePartialVideo/FullVideo
            // right after it downloads the custom audio.
            
            // SEE UPDATED video.js BELOW for this integration.
            
        } catch (e) {
            console.error("Auto-sync preparation failed:", e);
        }
    }

    let result;
    if (type === 'partial') {
      result = await generatePartialVideo(
        videoData.surahNumber,
        videoData.startVerse,
        videoData.endVerse,
        videoData.removeFilesAfterCreation,
        videoData.color,
        videoData.useCustomBackground,
        videoData.videoNumber,
        videoData.edition,
        videoData.size,
        videoData.crop,
        videoData.customAudioPath,
        videoData.fontName,
        videoData.translationEdition,
        videoData.transliterationEdition,
        progressCallback,
        finalTimings,
        videoData.subtitlePosition,
        videoData.showMetadata,
        videoData.audioSource,
        videoData.autoSync
      );
    } else if (type === 'full') {
      result = await generateFullVideo(
        videoData.surahNumber,
        videoData.removeFilesAfterCreation,
        videoData.color,
        videoData.useCustomBackground,
        videoData.videoNumber,
        videoData.edition,
        videoData.size,
        videoData.crop,
        videoData.customAudioPath,
        videoData.fontName,
        videoData.translationEdition,
        videoData.transliterationEdition,
        progressCallback,
        finalTimings,
        videoData.subtitlePosition,
        videoData.showMetadata,
        videoData.audioSource,
        videoData.autoSync
      );
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
    console.log(`Job ${job.id} completed. Output: ${result.vidPath}`);
    return result;
  } catch (error) {
    console.error(`Job ${job.id} CRITICAL FAILURE:`, error);
    throw new Error(error.message || "Unknown error occurred during video processing.");
  }
}, {
  connection,
  concurrency: 1,
  lockDuration: 600000 // 10 minutes lock to prevent stalls
});

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} marked as completed.`);
});

worker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job.id} marked as failed: ${err.message}`);
});

console.log('Video processing worker started.');
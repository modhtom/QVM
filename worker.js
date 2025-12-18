import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generatePartialVideo, generateFullVideo } from './video.js';

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
        videoData.userVerseTimings,
        videoData.subtitlePosition,
        videoData.showMetadata
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
        videoData.userVerseTimings,
        videoData.subtitlePosition,
        videoData.showMetadata
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
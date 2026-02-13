import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generatePartialVideo, generateFullVideo } from './video.js';
import { runAutoSync } from './utility/autoSync.js';

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
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
        const aiTimings = await runAutoSync(
          videoData.customAudioPath,
          videoData.surahNumber,
          videoData.startVerse,
          videoData.endVerse
        );
        finalTimings = aiTimings;
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
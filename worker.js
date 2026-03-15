import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generatePartialVideo, generateFullVideo } from './video.js';
import { runAutoSync } from './utility/autoSync.js';
import { initDB, addVideo } from './utility/db.js';
import { logger } from './utility/logger.js';
import { recordJobSuccess, recordJobFailure, recordError } from './utility/metrics.js';
import { sendWebhookNotification } from './utility/webhooks.js';

const redisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times % 10 === 0) {
      console.warn('[Redis Worker] Warning: Unable to connect to Redis. BullMQ requires Redis to function. Please ensure local Redis is running on port 6379.');
    }
    return Math.min(times * 1000, 10000); // Backoff up to 10 seconds between retries
  }
};

const connection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { ...redisOptions, tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined })
  : new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ...redisOptions
  });

connection.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') return; // Suppress infinite console spam
  console.error('[Redis Worker Error]', err);
});
console.log('Worker connecting to Redis...');

const worker = new Worker('video-queue', async (job) => {
  logger.info(`Processing job ${job.id}: ${job.data.type}`);
  const startTime = Date.now();
  const { type, videoData, userId } = job.data;

  try {
    const progressCallback = (progress) => {
      job.updateProgress(progress);
      if (progress.percent % 10 === 0 || progress.step.includes('Starting') || progress.step.includes('Complete')) {
        logger.info(`Job ${job.id}: ${progress.step} (${Math.round(progress.percent)}%)`);
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
        videoData.autoSync,
        userId
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
        videoData.autoSync,
        userId
      );
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }

    if (userId && result.vidPath) {
      try {
        const filename = result.vidPath.split('/').pop();
        await addVideo(userId, result.vidPath, filename);
        logger.info(`[Worker] Video record saved for user ${userId}: ${result.vidPath}`);
      } catch (dbErr) {
        logger.error(`[Worker] Failed to save video record: ${dbErr.message}`);
      }
    }

    const durationMs = Date.now() - startTime;
    recordJobSuccess(durationMs);
    logger.info(`Job ${job.id} completed in ${durationMs}ms. Output: ${result.vidPath}`);
    sendWebhookNotification('JOB_COMPLETED', { jobId: job.id, durationMs, type });
    return result;
  } catch (error) {
    recordJobFailure();
    recordError();
    logger.error(`Job ${job.id} CRITICAL FAILURE: ${error.message}\nStack: ${error.stack}`);
    sendWebhookNotification('JOB_FAILED', { jobId: job.id, error: error.message, type });
    throw new Error(error.message || "Unknown error occurred during video processing.");
  }
}, {
  connection,
  concurrency: 1,
  lockDuration: 600000 // 10 minutes lock to prevent stalls
});

worker.on('completed', (job) => {
  logger.info(`[Worker] Job ${job.id} marked as completed.`);
});

worker.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job.id} marked as failed: ${err.message}`);
});

initDB().then(() => {
  logger.info('Video processing worker started.');
}).catch(err => {
  logger.error(`[DB] Worker failed to initialize database: ${err.message}`);
  process.exit(1);
});
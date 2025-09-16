import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generatePartialVideo, generateFullVideo } from './video.js';

//NOTE: Ensure your Redis server is running. For local dev, 'docker run -p 6379:6379 -d redis' is recommended.
const connection = new IORedis({
  maxRetriesPerRequest: null
});

console.log('Worker connecting to Redis...');

const worker = new Worker('video-queue', async (job) => {
  console.log(`Processing job ${job.id}:`, job.data.type);
  const { type, videoData } = job.data;

  try {
    let result;
    const progressCallback = (progress) => {
      job.updateProgress(progress);
      console.log(`Job ${job.id} progress: ${progress.percent}% - ${progress.step}`);
    };

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
        videoData.userVerseTimings
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
        videoData.userVerseTimings
      );
    } else {
      throw new Error('Unknown job type');
    }

    console.log(`Job ${job.id} completed successfully. Video at: ${result.vidPath}`);
    return result;

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
}, { connection });

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} has completed.`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} has failed with ${err.message}`);
});

console.log('Video processing worker started.');
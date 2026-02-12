import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

export const PATHS = {
    ROOT: rootDir,
    DATA: path.join(rootDir, 'Data').replace(/\\/g, '/'),
    AUDIO: path.join(rootDir, 'Data', 'audio').replace(/\\/g, '/'),
    CUSTOM_AUDIO: path.join(rootDir, 'Data', 'audio', 'custom').replace(/\\/g, '/'),
    TEXT: path.join(rootDir, 'Data', 'text').replace(/\\/g, '/'),
    SUBTITLES: path.join(rootDir, 'Data', 'subtitles').replace(/\\/g, '/'),
    BACKGROUNDS: path.join(rootDir, 'Data', 'Background_Video', 'uploads').replace(/\\/g, '/'),
    OUTPUT: path.join(rootDir, 'Output_Video').replace(/\\/g, '/'),
    TEMP: path.join(rootDir, 'Data', 'temp').replace(/\\/g, '/'),
    TEMP_IMAGES: path.join(rootDir, 'Data', 'temp_images').replace(/\\/g, '/'),
    FONT: path.join(rootDir, 'Data', 'Font').replace(/\\/g, '/')
};

Object.values(PATHS).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

export const S3_CONFIG = {
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL
};

export const VIDEO_DEFAULTS = {
    FONT_POSITION: '1920,1080',
    API_TIMEOUT: 10000,
    DEFAULT_COLOR: '#ffffff',
    DEFAULT_CROP: 'vertical',
    DEFAULT_FONT: 'TaseesRegular',
    AUDIO_CHECK_INTERVAL_MS: 500,
    AUDIO_CHECK_MAX_ATTEMPTS: 60,
    CLEANUP_DELAY_MS: 500,
};

export const ALLOWED_FONT_CHARS = /^[a-zA-Z0-9\s\-_]+$/;
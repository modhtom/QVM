import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import youtubedl from "youtube-dl-exec";
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { getSurahDataRange } from "./data.js";

dotenv.config();

const surahContexts = {
    '1': ['sunrise pathway', 'ray of light', 'open book'],
    '12': ['deep well', 'stars night', 'full moon', 'wheat field'],
    '18': ['cave entrance', 'ancient ship', 'garden wall'],
    '19': ['date palm tree', 'flowing stream', 'desert oasis'],
    '20': ['wooden staff', 'fire flame', 'mountain morning'],
    '24': ['hanging lamp', 'olive oil', 'light beam', 'glass reflection'],
    '27': ['hoopoe bird', 'ant macro', 'glass floor'],
    '55': ['coral reef', 'pearls', 'pomegranate', 'palm trees'],
    '91': ['bright sun', 'desert day'],
    '92': ['night city', 'dark blue sky'],
    '93': ['sunrise', 'morning sun', 'pathway'],
    '94': ['mountain peak', 'clouds clearing', 'light'],
    '95': ['fig fruit', 'olive branch', 'mountain sinai'],
    '96': ['pen writing', 'ink', 'book'],
    '97': ['starry night', 'mosque dawn', 'peaceful sky'],
    '99': ['cracked earth', 'rubble', 'seismic line'],
    '100': ['galloping horse', 'sparks fire', 'dust cloud'],
    '101': ['moths', 'scattered wool', 'scales balance'],
    '102': ['graveyard', 'gold coins pile'],
    '103': ['hourglass', 'sunset', 'time lapse'],
    '104': ['fire column', 'vault', 'coins'],
    '105': ['elephant', 'flock of birds', 'stones'],
    '106': ['winter snow', 'summer sun', 'caravan'],
    '107': ['empty plate', 'helping hand'],
    '108': ['river flow', 'fountain abundance'],
    '109': ['crowd abstract', 'hand palm'],
    '110': ['victory flag', 'crowd entering gate'],
    '111': ['fire flame', 'rope knot', 'palm fiber'],
    '112': ['one finger silhouette', 'light abstract'],
    '113': ['dawn blue', 'knot rope'],
    '114': ['starry night', 'shield fortress']
};

const visualThesaurus = {
    'mercy': ['gentle rain', 'morning dew', 'blooming flower'],
    'wrath': ['storm clouds', 'lightning', 'volcanic rock', 'rough ocean'],
    'paradise': ['lush garden', 'waterfall', 'flowing river', 'peacock'],
    'hell': ['burning coals', 'lava', 'dark cave', 'smoke abstract'],
    'sky': ['blue sky', 'golden sunset', 'nebula', 'clouds'],
    'earth': ['mountain peak', 'desert dunes', 'green valley'],
    'water': ['ocean waves', 'clear stream', 'rain'],

    'guidance': ['lighthouse', 'pathway in woods', 'lantern', 'compass'],
    'darkness': ['deep ocean', 'night forest', 'shadows'],
    'light': ['sun rays', 'candle flame', 'lamp', 'bright window'],
    'knowledge': ['old book', 'ink pen', 'library', 'scroll'],
    'patience': ['stone cairn', 'ancient tree', 'roots', 'still lake'],
    'time': ['hourglass', 'sunset', 'changing seasons'],

    'prophet': ['desert caravan', 'shepherd staff', 'cave light', 'moon'],
    'prayer': ['mosque arch', 'prayer rug pattern', 'minaret silhouette'],
    'quran': ['open book', 'arabic calligraphy', 'rehal'],
    'charity': ['grain wheat', 'flowing water', 'open hand silhouette'],
    'angel': ['white feather', 'bright light', 'rays'],

    'wine': ['crystal goblet', 'red grape juice', 'vineyard', 'flowing stream'],
    'drink': ['clear water', 'milk glass', 'honey jar'],
    'women': ['jewelry', 'pearls', 'silk fabric', 'flowers'],
    'spouse': ['two rings', 'flowers', 'sunset silhouette'],
    'breast': ['pomegranate', 'hills'],
    'skin': ['texture', 'parchment']
};

export async function getBackgroundPath(newBackground, videoNumber, len, crop, verseInfo) {
    if (!len || isNaN(len)) len = Math.ceil(len) || 0;

    if (newBackground) {
        if (typeof videoNumber === 'string' && fs.existsSync(videoNumber)) {
            console.log(`Using local uploaded file: ${videoNumber}`);
            const fileExtension = path.extname(videoNumber).toLowerCase();
            if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
                return await createBackgroundFromImage(videoNumber, len, crop);
            } else {
                return await createBackgroundVideo(videoNumber, len, crop);
            }
        }

        if (typeof videoNumber === 'string' && videoNumber.startsWith('unsplash:')) {
            const query = videoNumber.split(':')[1];
            console.log(`Manual Unsplash Request: ${query}`);
            const imageUrls = await searchImagesOnUnsplash([query], 8, crop, { isManual: true });
            if (imageUrls.length > 0) {
                return await processFoundImages(imageUrls, len, crop);
            } else {
                throw new Error("No Unsplash images found for query: " + query);
            }
        }

        if (typeof videoNumber === 'string' && (videoNumber.endsWith('.jpg') || videoNumber.endsWith('.png') || videoNumber.endsWith('.jpeg'))) {
            return await createBackgroundFromImage(videoNumber, len, crop);
        }
        else {
            const url = videoNumber;
            try {
                const downloadedPath = await createBackgroundFromYoutube(url, len, crop);
                return await createBackgroundVideo(downloadedPath, len, crop);
            } catch (error) {
                console.error("Error downloading video:", error.message);
                throw new Error("Failed to download and process custom background video.");
            }
        }
    } else {
        return await createAiBackground(verseInfo, len, crop);
    }
}

async function createAiBackground(verseInfo, len, crop) {
    if (!process.env.UNSPLASH_ACCESS_KEY) {
        throw new Error("UNSPLASH_ACCESS_KEY is not set. Cannot create AI background.");
    }

    console.log(`Analyzing context for Surah ${verseInfo.surahNumber}...`);

    const { combinedTranslation } = await getSurahDataRange(
        verseInfo.surahNumber,
        verseInfo.startVerse,
        verseInfo.endVerse,
        null, "quran-simple",
        "en.sahih",
        null, true
    );

    const baseKeywords = extractKeywords(combinedTranslation, verseInfo.surahNumber);

    if (verseInfo && verseInfo.surahName) {
        const simpleName = verseInfo.surahName.replace(/^(Al-|Ar-|As-|An-|At-|Az-)/, '');
        baseKeywords.push(simpleName + " nature");
    }

    console.log(`Extracted keywords: ${baseKeywords.join(', ')}`);

    const approxPerImageSec = 15;
    const desiredCount = Math.min(12, Math.max(3, Math.ceil(len / approxPerImageSec)));

    const imageUrls = await searchImagesOnUnsplash(baseKeywords, desiredCount, crop, verseInfo);

    if (!imageUrls || imageUrls.length === 0) {
        console.log("No relevant images found, falling back to default video.");
        const defaultVideo = path.resolve("Data/Background_Video/CarDrive.mp4");
        if (fs.existsSync(defaultVideo)) return await createBackgroundVideo(defaultVideo, len, crop);
        throw new Error("No background images found and default video is missing.");
    }

    return await processFoundImages(imageUrls, len, crop);
}

function extractKeywords(text, surahNumber, count = 6) {
    const candidates = {};

    if (surahNumber && surahContexts[surahNumber]) {
        surahContexts[surahNumber].forEach(k => candidates[k] = 50);
    }

    if (text) {
        const stopWords = new Set([
            'a', 'an', 'the', 'in', 'on', 'of', 'and', 'or', 'is', 'are', 'to', 'for', 'from',
            'who', 'what', 'he', 'she', 'it', 'they', 'we', 'i', 'you', 'allah', 'god', 'lord',
            'indeed', 'verily', 'those', 'have', 'has', 'will', 'with', 'not', 'be', 'that',
            'surah', 'ayah', 'verse', 'said', 'say'
        ]);

        const forbiddenWords = new Set([
            'wine', 'alcohol', 'breast', 'maiden', 'woman', 'women', 'sex', 'naked',
            'nude', 'girl', 'boy', 'child', 'children', 'kid', 'family'
        ]);

        const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
        const words = cleanText.split(/\s+/);

        words.forEach(word => {
            if (word.length < 3 || stopWords.has(word)) return;

            if (visualThesaurus[word]) {
                visualThesaurus[word].forEach(synonym => {
                    candidates[synonym] = (candidates[synonym] || 0) + 10;
                });
                return;
            }

            if (!forbiddenWords.has(word)) {
                candidates[word] = (candidates[word] || 0) + 1;
            }
        });
    }

    return Object.keys(candidates)
        .sort((a, b) => candidates[b] - candidates[a])
        .slice(0, count);
}

async function searchImagesOnUnsplash(keywords, desiredCount = 6, crop = 'landscape', verseInfo = {}) {
    const blacklist = [
        'woman', 'women', 'girl', 'lady', 'female', 'bikini', 'model', 'face', 'portrait',
        'man', 'men', 'boy', 'male', 'people', 'person', 'human', 'body', 'skin',
        'family', 'families', 'child', 'children', 'kid', 'kids', 'baby', 'toddler', 'infant',
        'parent', 'mother', 'father', 'sister', 'brother', 'grandparent', 'sibling', 'siblings',
        'son', 'daughter', 'wife', 'husband', 'uncle', 'aunt',
        'couple', 'kiss', 'hug', 'embrace', 'embracing', 'romance', 'love', 'dating', 'wedding', 'bride', 'groom',
        'bed', 'sleeping', 'asleep', 'bedroom', 'huddle', 'blanket', 'pillow',
        'cross', 'church', 'temple', 'idol', 'statue', 'gods', 'jesus', 'christ', 'buddha',
        'priest', 'nun', 'rabbi', 'hindu', 'shrine',
        'alcohol', 'beer', 'wine', 'bar', 'pub', 'club', 'nightclub', 'party', 'dance',
        'nude', 'naked', 'sexy', 'underwear', 'lingerie', 'swimsuit',
        'gambling', 'casino', 'poker', 'cards',
        'pork', 'pig', 'ham', 'bacon', 'dog', 'puppy',
        'drug', 'smoke', 'weed', 'cannabis', 'cigarette',
        'concert', 'festival', 'crowd', 'audience'
    ].map(s => s.toLowerCase());

    if (!process.env.UNSPLASH_ACCESS_KEY) throw new Error("UNSPLASH_ACCESS_KEY is not set.");

    const orientation = crop === 'vertical' ? 'portrait' : 'landscape';

    let orderedQueries = [];

    if (verseInfo && verseInfo.isManual) {
        orderedQueries = keywords;
        console.log(`Search strategy: Manual query "${keywords[0]}"`);
    } else {
        const safeFallbacks = ['nature landscape', 'clouds sky', 'abstract texture', 'islamic pattern'];
        orderedQueries = [...new Set([...keywords, ...safeFallbacks])];
        console.log(`Search strategy: AI Auto query with ${orderedQueries.length} variants`);
    }

    const collected = [];
    const debugCandidates = [];

    try {
        for (const q of orderedQueries) {
            if (collected.length >= desiredCount) break;

            const isSpecific = verseInfo && verseInfo.isManual ? true : false;
            let resp;
            try {
                resp = await axios.get('https://api.unsplash.com/search/photos', {
                    params: {
                        query: q,
                        per_page: isSpecific ? 30 : 15,
                        orientation,
                        content_filter: 'high',
                        order_by: 'relevant'
                    },
                    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
                    timeout: 10000
                });
            } catch (err) {
                if (err.response && (err.response.status === 403 || err.response.status === 429)) {
                    console.warn(`Unsplash Limit Hit (${err.response.status}). Using Fallbacks.`);
                    break;
                }
                continue;
            }

            const results = (resp.data && resp.data.results) || [];
            for (const r of results) {
                const meta = {
                    id: r.id,
                    query: q,
                    alt_description: r.alt_description || null,
                    description: r.description || null,
                    tags: Array.isArray(r.tags) ? r.tags.map(t => (t && t.title) ? t.title : t) : [],
                    user: r.user ? r.user.name : null,
                    urls: r.urls || {}
                };

                const rejected = isForbiddenImage(r, blacklist);
                debugCandidates.push({ meta, rejected });

                if (rejected) continue;

                const url = r.urls?.regular || r.urls?.small;
                if (!url) continue;

                if (collected.some(c => c.id === r.id)) continue;

                collected.push({ url, id: r.id });
                if (collected.length >= desiredCount) break;
            }
        }

        try {
            const dbgPath = path.resolve('Data/temp_images/unsplash_debug.json');
            writeDebugJson(dbgPath, {
                timestamp: Date.now(),
                isManual: verseInfo?.isManual,
                queries: orderedQueries,
                debugCandidates
            });
        } catch (e) { }

        return [...new Set(collected.map(c => c.url))].slice(0, desiredCount);

    } catch (error) {
        console.error("Error searching Unsplash:", error.message);
        return [];
    }
}

function isForbiddenImage(unsplashResult, blacklist) {
    const textCandidates = [];
    if (unsplashResult.alt_description) textCandidates.push(unsplashResult.alt_description);
    if (unsplashResult.description) textCandidates.push(unsplashResult.description);
    if (Array.isArray(unsplashResult.tags)) {
        unsplashResult.tags.forEach(t => {
            if (typeof t === 'string') textCandidates.push(t);
            else if (t.title) textCandidates.push(t.title);
        });
    }

    const hay = textCandidates.join(' ').toLowerCase();

    for (const bad of blacklist) {
        const regex = new RegExp(`\\b${bad}\\b`, 'i');
        if (regex.test(hay)) return true;
    }
    return false;
}

function writeDebugJson(filePath, obj) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to write debug json:', e.message);
    }
}

async function processFoundImages(imageUrls, len, crop) {
    const tempImageDir = path.resolve("Data/temp_images");
    if (!fs.existsSync(tempImageDir)) fs.mkdirSync(tempImageDir, { recursive: true });

    if (imageUrls.length === 1) {
        const singlePath = path.join(tempImageDir, `single_img_${Date.now()}.jpg`);
        const writer = fs.createWriteStream(singlePath);
        const response = await axios({ url: imageUrls[0], method: 'GET', responseType: 'stream', timeout: 20000 });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const slideshowPath = await createImageSlideshow([singlePath], len, crop);

        try { if (fs.existsSync(singlePath)) fs.unlinkSync(singlePath); } catch (e) { }
        return slideshowPath;
    }

    const downloadedImagePaths = await downloadImages(imageUrls, tempImageDir);
    shuffleArray(downloadedImagePaths);
    const slideshowPath = await createImageSlideshow(downloadedImagePaths, len, crop);

    downloadedImagePaths.forEach(imgPath => {
        try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch (e) { }
    });

    return slideshowPath;
}

async function createBackgroundFromImage(imagePath, len, crop) {
    const outputPath = `Data/Background_Video/processed_image_${Date.now()}.mp4`;
    const resolution = crop === 'vertical' ? '1080:1920' : '1920:1080';
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(imagePath)
            .inputOptions(['-loop 1'])
            .videoFilters([`scale=${resolution}:force_original_aspect_ratio=increase,crop=${resolution}`])
            .noAudio()
            .videoCodec("libx264")
            .outputOptions(['-pix_fmt yuv420p', `-t ${Math.max(1, Math.ceil(len || 1))}`])
            .on("end", () => resolve(outputPath))
            .on("error", (err) => reject(new Error("FFmpeg image process failed: " + err.message)))
            .save(outputPath);
    });
}

async function createBackgroundFromYoutube(url, length, crop) {
    const tempPath = `Data/Background_Video/youtube_temp_${Date.now()}.mp4`;
    await youtubedl(url, { output: tempPath, format: 'best[ext=mp4]/mp4' });
    const finalPath = await createBackgroundVideo(tempPath, length, crop);
    try { fs.unlinkSync(tempPath); } catch (e) { }
    return finalPath;
}

function createBackgroundVideo(videoPath, len, crop) {
    const outputPath = `Data/Background_Video/processed_${Date.now()}.mp4`;
    const resolution = crop === 'vertical' ? '1080:1920' : '1920:1080';
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .duration(Math.max(1, Math.ceil(len || 1)))
            .videoFilters([`scale=${resolution}:force_original_aspect_ratio=increase`, `crop=${resolution}`])
            .noAudio()
            .videoCodec("libx264")
            .outputOptions(['-pix_fmt yuv420p'])
            .on("end", () => resolve(outputPath))
            .on("error", (err) => reject(new Error(`FFmpeg video process failed: ${err.message}`)))
            .save(outputPath);
    });
}

async function createImageSlideshow(imagePaths, len, crop) {
    const outputPath = path.join("Data/Background_Video", `ai_slideshow_${Date.now()}.mp4`);
    const resolution = crop === 'vertical' ? '1080:1920' : '1920:1080';
    const fps = 25;
    const targetDurationSeconds = Math.max(1, Math.ceil(len || 1));

    if (!imagePaths || imagePaths.length === 0) throw new Error("Zero images for slideshow.");

    if (imagePaths.length === 1) {
        return new Promise((resolve, reject) => {
            const frames = Math.max(1, Math.round(targetDurationSeconds * fps));
            ffmpeg(imagePaths[0])
                .inputOptions(['-loop 1'])
                .videoFilters([
                    `scale=${resolution}:force_original_aspect_ratio=increase,crop=${resolution}`,
                    `setsar=1`
                ])
                .outputOptions([`-t ${targetDurationSeconds}`, `-r ${fps}`, `-pix_fmt yuv420p`, '-preset veryfast'])
                .on('end', () => resolve(outputPath))
                .on('error', (err, stdout, stderr) => reject(new Error("FFmpeg slideshow failed: " + stderr)))
                .save(outputPath);
        });
    }

    const fadeDur = 1.5;
    const n = imagePaths.length;
    const D = (targetDurationSeconds + (n - 1) * fadeDur) / n;

    const command = ffmpeg();
    imagePaths.forEach(p => {
        command.input(p).inputOptions(['-loop 1', `-t ${D.toFixed(3)}`]);
    });

    const filterComplex = [];

    imagePaths.forEach((_, i) => {
        const streamId = `[${i}:v]`;
        const outputId = `[v${i}]`;
        const frames = Math.ceil(D * fps);
        filterComplex.push(
            `${streamId}scale=${resolution}:force_original_aspect_ratio=increase,crop=${resolution},setsar=1,format=yuv420p,fps=${fps}${outputId}`
        );
    });

    let prevNode = '[v0]';
    for (let i = 1; i < n; i++) {
        const outNode = i === n - 1 ? '[out]' : `[f${i}]`;
        const offset = i * (D - fadeDur);
        filterComplex.push(
            `${prevNode}[v${i}]xfade=transition=fade:duration=${fadeDur}:offset=${offset.toFixed(3)}${outNode}`
        );
        prevNode = outNode;
    }

    return new Promise((resolve, reject) => {
        command
            .complexFilter(filterComplex)
            .outputOptions(['-map [out]', `-r ${fps}`, '-pix_fmt yuv420p', '-preset veryfast', `-t ${targetDurationSeconds}`, '-y'])
            .on('end', () => resolve(outputPath))
            .on('error', (err, stdout, stderr) => reject(new Error("Slideshow transition failed: " + stderr)))
            .save(outputPath);
    });
}

async function downloadImages(urls, dir) {
    const downloadPromises = urls.map(async (url, index) => {
        const imagePath = path.join(dir, `image_${index}.jpg`);
        const writer = fs.createWriteStream(imagePath);
        const response = await axios({ url, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(imagePath));
            writer.on('error', reject);
        });
    });
    return await Promise.all(downloadPromises);
}

function uniqueUrls(arr) {
    return Array.from(new Set(arr));
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
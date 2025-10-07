import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import youtubedl from "youtube-dl-exec";
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { getSurahDataRange } from "./data.js";

dotenv.config();

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

        if (typeof videoNumber === 'string' && videoNumber.startsWith('pexels:')) {
            const query = videoNumber.split(':')[1];
            return await downloadVideoFromPexels(query, len, crop);
        }
        if (typeof videoNumber === 'string' && (videoNumber.endsWith('.jpg') || videoNumber.endsWith('.png') || videoNumber.endsWith('.jpeg'))) {
            return await createBackgroundFromImage(videoNumber, len, crop);
        } else {
            const url = videoNumber;
            const start = 0;
            try {
                const downloadedPath = await createBackgroundFromYoutube(url, start, len, crop);
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
        .on("error", (err) => reject(new Error("Failed to create background video from image: " + err.message)))
        .save(outputPath);
    });
}

async function downloadVideoFromPexels(query, length, crop) {
    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
    if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is not set.");
    try {
        const searchResponse = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1`, {
            headers: { Authorization: PEXELS_API_KEY }
        });
        const video = searchResponse.data.videos[0];
        if (!video) throw new Error('No videos found on Pexels');
        
        const videoFile = video.video_files.find(f => f.quality === 'hd') || video.video_files[0];
        const tempPath = `Data/Background_Video/pexels_temp_${Date.now()}.mp4`;
        const writer = fs.createWriteStream(tempPath);
        
        const downloadResponse = await axios({ url: videoFile.link, method: 'GET', responseType: 'stream' });
        downloadResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const finalPath = await createBackgroundVideo(tempPath, length, crop);
        fs.unlinkSync(tempPath);
        return finalPath;
    } catch (error) {
        console.error('Pexels Error:', error.message);
        throw new Error('Failed to download from Pexels');
    }
}

async function createBackgroundFromYoutube(url, length, crop) {
    const tempPath = `Data/Background_Video/youtube_temp_${Date.now()}.mp4`;
    await youtubedl(url, {
        output: tempPath,
        format: 'best[ext=mp4]/mp4'
    });
    const finalPath = await createBackgroundVideo(tempPath, length, crop);
    try { fs.unlinkSync(tempPath); } catch(e){}
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
        .on("error", (err) => reject(new Error(`FFmpeg failed to process background video: ${err.message}`)))
        .save(outputPath);
    });
}

async function createAiBackground(verseInfo, len, crop) {
    if (!process.env.UNSPLASH_ACCESS_KEY) {
        throw new Error("UNSPLASH_ACCESS_KEY is not set in environment variables. Cannot create AI background.");
    }

    const { combinedTranslation } = await getSurahDataRange(
        verseInfo.surahNumber,
        verseInfo.startVerse,
        verseInfo.endVerse,
        null, "quran-simple",
        verseInfo.translationEdition || 'en.sahih',
        null, true
    );

    const baseKeywords = extractKeywords(combinedTranslation);
    if (verseInfo && verseInfo.surahName) baseKeywords.unshift(verseInfo.surahName);
    console.log(`Extracted keywords for background: ${baseKeywords.join(', ')}`);

    const approxPerImageSec = 6;
    const desiredCount = Math.min(12, Math.max(3, Math.ceil(len / approxPerImageSec)));

    const imageUrls = await searchImagesOnUnsplash(baseKeywords, desiredCount, crop, verseInfo);

    if (!imageUrls || imageUrls.length === 0) {
        console.log("No relevant images found, falling back to default video.");
        return await createBackgroundVideo(path.resolve("Data/Background_Video/CarDrive.mp4"), len, crop);
    }

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
        if (fs.existsSync(singlePath)) fs.unlinkSync(singlePath);
        return slideshowPath;
    }

    const downloadedImagePaths = await downloadImages(imageUrls, tempImageDir);

    const slideshowPath = await createImageSlideshow(downloadedImagePaths, len, crop);

    downloadedImagePaths.forEach(imgPath => { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); });
    return slideshowPath;
}

function getContextualKeywords(text, baseKeywords) {
    const lowerText = text.toLowerCase();
    const allKeywords = new Set(baseKeywords);
    
    if (lowerText.includes('dream') || lowerText.includes('vision') || lowerText.includes('see') || lowerText.includes('saw')) {
        allKeywords.add('dream');
        allKeywords.add('stars');
        allKeywords.add('night');
        allKeywords.add('sky');
        allKeywords.add('mystical');
    }
    
    if (lowerText.includes('father') || lowerText.includes('parent') || lowerText.includes('son')) {
        allKeywords.add('family');
        allKeywords.add('generations');
        allKeywords.add('heritage');
    }
    
    if (lowerText.includes('brother') || lowerText.includes('sibling')) {
        allKeywords.add('family');
        allKeywords.add('unity');
        allKeywords.add('relationship');
    }
    
    if (lowerText.includes('prophet') || lowerText.includes('messenger')) {
        allKeywords.add('guidance');
        allKeywords.add('light');
        allKeywords.add('wisdom');
    }
    
    if (lowerText.includes('book') || lowerText.includes('scripture') || lowerText.includes('quran')) {
        allKeywords.add('knowledge');
        allKeywords.add('wisdom');
        allKeywords.add('learning');
    }
    
    if (lowerText.includes('mercy') || lowerText.includes('compassion') || lowerText.includes('forgive')) {
        allKeywords.add('compassion');
        allKeywords.add('peace');
        allKeywords.add('serenity');
    }
    
    if (lowerText.includes('power') || lowerText.includes('strength') || lowerText.includes('might')) {
        allKeywords.add('power');
        allKeywords.add('majesty');
        allKeywords.add('strength');
    }
    
    if (lowerText.includes('create') || lowerText.includes('made') || lowerText.includes('maker')) {
        allKeywords.add('creation');
        allKeywords.add('universe');
        allKeywords.add('cosmos');
    }
    
    if (lowerText.includes('heaven') || lowerText.includes('paradise') || lowerText.includes('garden')) {
        allKeywords.add('paradise');
        allKeywords.add('bliss');
        allKeywords.add('eternity');
    }
    
    if (lowerText.includes('hell') || lowerText.includes('fire') || lowerText.includes('punish')) {
        allKeywords.add('warning');
        allKeywords.add('justice');
        allKeywords.add('consequences');
    }
    
    if (lowerText.includes('joseph') || lowerText.includes('yusuf')) {
        allKeywords.add('dream');
        allKeywords.add('prophecy');
        allKeywords.add('vision');
        allKeywords.add('stars');
        allKeywords.add('moon');
        allKeywords.add('sun');
        allKeywords.add('family');
        allKeywords.add('betrayal');
        allKeywords.add('egypt');
        allKeywords.add('prison');
        allKeywords.add('interpretation');
        allKeywords.add('righteous');
        allKeywords.add('patience');
    }
    
    if (lowerText.includes('moses') || lowerText.includes('musa')) {
        allKeywords.add('mountain');
        allKeywords.add('burning bush');
        allKeywords.add('miracles');
        allKeywords.add('pharaoh');
        allKeywords.add('red sea');
        allKeywords.add('commandments');
    }
    
    if (lowerText.includes('abraham') || lowerText.includes('ibrahim')) {
        allKeywords.add('faith');
        allKeywords.add('sacrifice');
        allKeywords.add('kaaba');
        allKeywords.add('monotheism');
    }
    
    if (lowerText.includes('noah') || lowerText.includes('nuh')) {
        allKeywords.add('flood');
        allKeywords.add('ark');
        allKeywords.add('rain');
        allKeywords.add('salvation');
    }
    
    allKeywords.add('nature');
    allKeywords.add('creation');
    allKeywords.add('universe');
    
    return Array.from(allKeywords);
}

function extractKeywords(text, count = 5) {
    if (!text) return ['nature', 'spiritual'];
    
    const stopWords = new Set(['a', 'an', 'the', 'in', 'on', 'of', 'and', 'or', 'is', 'are', 'to', 'for', 'from', 'who', 'what', 'when', 'where', 'why', 'how', 'he', 'she', 'it', 'they', 'we', 'i', 'you', 'allah', 'god', 'indeed', 'verily', 'those', 'have', 'has', 'will', 'with', 'not', 'be', 'that', 'his', 'him', 'their', 'them', 'said', 'say', 'says']);
    const wordCounts = {};
    text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).forEach(word => {
        if (word && !stopWords.has(word) && word.length > 3) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
    });
    
    const sortedKeywords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]);
    const contextualKeywords = getContextualKeywords(text, sortedKeywords.slice(0, 3));
    
    return contextualKeywords.slice(0, count);
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
    if (unsplashResult.user && unsplashResult.user.name) textCandidates.push(unsplashResult.user.name);
    const hay = textCandidates.join(' ').toLowerCase();
    for (const bad of blacklist) {
        if (hay.includes(bad)) return true;
    }
    return false;
}

async function searchImagesOnUnsplash(keywords, desiredCount = 6, crop = 'landscape', verseInfo = {}) {
    const blacklist = [
        'woman', 'women', 'man', 'men', 'people', 'person', 'portrait', 'face',
        'cross', 'church', 'temple', 'statue', 'idol', 'crucifix', 'christ',
        'priest', 'nun', 'wedding', 'model', 'fashion', 'party', 'selfie',
        'alcohol', 'beer', 'wine', 'nude', 'bikini', 'swimsuit', 'dance',
        'club', 'nightclub', 'gambling', 'pork'
    ].map(s => s.toLowerCase());

    if (!process.env.UNSPLASH_ACCESS_KEY) throw new Error("UNSPLASH_ACCESS_KEY is not set.");

    const orientation = crop === 'vertical' ? 'portrait' : 'landscape';
    const surahThemes = {
        '1': ['divine guidance', 'path', 'light', 'mercy', 'master of day of judgment'],
        '2': ['creation of man', 'adam', 'cattle', 'nature', 'green', 'water', 'guidance', 'light'],
        '3': ['mary', 'jesus', 'miracles', 'family of imran', 'righteousness'],
        '4': ['justice', 'fairness', 'women', 'orphans', 'social justice'],
        '5': ['table spread', 'food', 'sustenance', 'covenant', 'promise'],
        '6': ['cattle', 'livestock', 'nature signs', 'creation', 'animals'],
        '7': ['adam', 'eden', 'satan', 'repentance', 'forgiveness'],
        '8': ['battle', 'victory', 'spoils of war', 'justice', 'strategy'],
        '9': ['repentance', 'immunity', 'covenant', 'warning'],
        '10': ['jonah', 'whale', 'sea', 'repentance', 'mercy'],
        '11': ['hud', 'aad', 'thamud', 'ancient civilizations', 'punishment'],
        '12': ['joseph', 'dream', 'stars', 'moon', 'sun', 'egypt', 'prison', 'interpretation', 'family', 'betrayal', 'reunion', 'forgiveness', 'prophecy', 'vision'],
        '13': ['thunder', 'lightning', 'rain', 'nature signs', 'storms'],
        '14': ['abraham', 'kaaba', 'monotheism', 'prayer', 'sacrifice'],
        '15': ['stones', 'lot', 'sodom', 'destruction', 'warning'],
        '16': ['bee', 'honey', 'animals', 'insects', 'nature blessings'],
        '17': ['night journey', 'jerusalem', 'ascension', 'miracles', 'israel'],
        '18': ['cave', 'sleepers', 'dhul qarnayn', 'alexander', 'barrier'],
        '19': ['mary', 'jesus', 'zachariah', 'john', 'miraculous birth'],
        '20': ['moses', 'burning bush', 'miracles', 'pharaoh', 'red sea'],
        '21': ['prophets', 'abraham', 'job', 'jonah', 'zachariah'],
        '24': ['light', 'lamp', 'niche', 'illumination', 'guidance'],
        '26': ['poets', 'moses', 'abraham', 'noah', 'hud'],
        '27': ['solomon', 'ant', 'sheba', 'hoopoe', 'kingdom'],
        '29': ['spider', 'web', 'fragile', 'abraham', 'lot'],
        '30': ['romans', 'byzantine', 'victory', 'signs', 'creation'],
        '31': ['luqman', 'wisdom', 'advice', 'knowledge', 'learning'],
        '36': ['ya seen', 'heart of quran', 'resurrection', 'day of judgment'],
        '44': ['smoke', 'famine', 'warning', 'egypt', 'pharaoh'],
        '45': ['kneeling', 'submission', 'creation', 'signs'],
        '46': ['sand dunes', 'aad', 'hud', 'ancient people'],
        '50': ['qaf', 'resurrection', 'death', 'afterlife'],
        '54': ['moon', 'splitting', 'miracles', 'prophecy'],
        '55': ['mercy', 'creation', 'heaven', 'hell', 'paradise', 'gardens'],
        '67': ['dominion', 'kingdom', 'sovereignty', 'creation'],
        '71': ['noah', 'ark', 'flood', 'salvation'],
        '76': ['man', 'time', 'patience', 'reward'],
        '78': ['tidings', 'news', 'resurrection', 'great event'],
        '79': ['soul-snatchers', 'angels', 'resurrection'],
        '80': ['frowned', 'blind man', 'equality', 'justice'],
        '81': ['sun', 'folded', 'stars', 'collapsed', 'end times'],
        '82': ['split', 'sky', 'stars', 'scattered'],
        '84': ['split', 'sky', 'heavens', 'torn'],
        '86': ['night', 'visitor', 'star', 'piercing'],
        '89': ['dawn', 'morning', 'light', 'daybreak'],
        '91': ['sun', 'brightness', 'day', 'light'],
        '92': ['night', 'cover', 'day', 'illuminate'],
        '93': ['morning', 'brightness', 'day', 'light'],
        '94': ['comfort', 'ease', 'relief', 'expansion'],
        '95': ['fig', 'olive', 'mount sinai', 'mecca'],
        '96': ['read', 'knowledge', 'pen', 'writing'],
        '97': ['power', 'night', 'decree', 'destiny'],
        '99': ['earthquake', 'quake', 'weights', 'balance'],
        '101': ['calamity', 'striking', 'disaster', 'scales'],
        '102': ['competition', 'distraction', 'worldly life'],
        '103': ['time', 'ages', 'man in loss'],
        '105': ['elephant', 'army', 'birds', 'abyssinia'],
        '106': ['quraysh', 'winter', 'summer', 'caravan'],
        '107': ['charity', 'prayer', 'neglect', 'hypocrisy'],
        '108': ['river', 'abundance', 'fountain', 'kauthar'],
        '110': ['help', 'victory', 'people', 'entering islam'],
        '111': ['fire', 'flame', 'abu lahab', 'opposition'],
        '112': ['oneness', 'unity', 'eternal', 'absolute'],
        '113': ['daybreak', 'dawn', 'protection', 'evil'],
        '114': ['mankind', 'protection', 'refuge', 'whisperer']
    };
    const baseKeywords = Array.isArray(keywords) && keywords.length
        ? keywords.filter(k => k && k.length > 2).slice(0, 3)
        : ['nature'];
    
    const surahSpecific = verseInfo && verseInfo.surahNumber && surahThemes[verseInfo.surahNumber.toString()]
        ? surahThemes[verseInfo.surahNumber.toString()]
        : null;

    const queries = [];

    // First priority: Surah-specific themes with Islamic context
    // if (surahSpecific && surahSpecific.length > 0) {
    //     surahSpecific.forEach(theme => {
    //         queries.push(`${theme} islamic spiritual`);
    //         queries.push(`${theme} meaningful`);
    //         queries.push(`${theme} symbolic`);
    //         queries.push(theme);
    //     });
    // }
    
    // Second priority: Contextual keywords with Islamic/spiritual context
    // baseKeywords.forEach(k => {
    //     if (k.length > 3) { // Only use meaningful keywords
    //         queries.push(`${k} islamic spiritual`);
    //         queries.push(`${k} meaningful symbolic`);
    //         queries.push(`${k} quran`);
    //         queries.push(k);
    //     }
    // });

    // Third priority: General Islamic and spiritual imagery
    queries.push('islamic spiritual landscape');
    queries.push('quranic inspiration nature');
    queries.push('islamic art calligraphy');
    queries.push('mosque architecture interior');
    queries.push('arabic calligraphy art');
    queries.push('islamic geometric patterns');

    // Fourth priority: Nature and creation themes (common in Quran)
    queries.push('creation universe cosmic');
    queries.push('nature landscape spiritual');
    queries.push('sky stars night peaceful');
    queries.push('water ocean sea reflection');
    queries.push('mountain landscape majestic');
    queries.push('desert landscape serene');
    queries.push('garden paradise peaceful');
    queries.push('sunset sunrise golden hour');

    if (queries.length === 0) {
        queries.push('islamic spiritual nature');
    }

    const uniqueQueries = [...new Set(queries)];

    const collected = [];
    const debugCandidates = [];

    try {
        for (const q of uniqueQueries) {
            if (collected.length >= desiredCount) break;
            const per_page = Math.min(30, desiredCount * 4);
            let resp;
            try {
                resp = await axios.get('https://api.unsplash.com/search/photos', {
                    params: {
                        query: q,
                        per_page,
                        orientation,
                        content_filter: 'high'
                    },
                    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
                    timeout: 20000
                });
            } catch (err) {
                console.error(`Unsplash request failed for query "${q}":`, err.message);
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
                
                const url = r.urls?.regular || r.urls?.full || r.urls?.small;
                if (!url) continue;
                
                collected.push({ url, id: r.id, meta });
                if (collected.length >= desiredCount) break;
            }
        }

        try {
            const dbgPath = path.resolve('Data/temp_images/unsplash_debug.json');
            writeDebugJson(dbgPath, {
                timestamp: Date.now(),
                surahNumber: verseInfo?.surahNumber,
                extractedKeywords: baseKeywords,
                surahTheme: surahSpecific,
                queries: uniqueQueries,
                debugCandidates
            });
            console.log('Wrote Unsplash debug JSON to', dbgPath);
        } catch (e) {
            // ignore
        }

        const urls = uniqueUrls(collected.map(c => c.url)).slice(0, desiredCount);
        
        if (urls.length === 0) {
            console.log('No relevant images found; attempting Pexels fallback for halal-safe content...');
            try {
                const pexelsResults = [];
                const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
                if (PEXELS_API_KEY) {
                    const pexelsQueries = surahSpecific && surahSpecific.length > 0
                        ? surahSpecific.concat(['spiritual nature', 'peaceful meditation', 'islamic landscape'])
                        : baseKeywords.concat(['spiritual nature', 'peaceful meditation', 'islamic landscape']);

                    for (const q of pexelsQueries.slice(0, 4)) {
                        const presp = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=5`, {
                            headers: { Authorization: PEXELS_API_KEY },
                            timeout: 20000
                        }).catch(() => null);
                        
                        if (presp && presp.data && Array.isArray(presp.data.videos)) {
                            presp.data.videos.forEach(p => {
                                if (p && p.video_files && p.video_files.length > 0) {
                                    const videoFile = p.video_files.find(f => f.quality === 'hd') || p.video_files[0];
                                    if (videoFile && videoFile.link) {
                                        pexelsResults.push(videoFile.link);
                                    }
                                }
                            });
                        }
                    }
                }
                if (pexelsResults.length > 0) {
                    console.log(`Found ${pexelsResults.length} relevant videos from Pexels`);
                    return uniqueUrls(pexelsResults).slice(0, desiredCount);
                }
            } catch (e) {
                console.error('Pexels fallback failed:', e.message);
            }
            
            console.log('Falling back to default video');
            return [];
        }

        return urls;
    } catch (error) {
        console.error("Error searching Unsplash:", error.message);
        return [];
    }
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

async function createImageSlideshow(imagePaths, len, crop) {
    const outputPath = path.join("Data/Background_Video", `ai_slideshow_${Date.now()}.mp4`);
    const resolution = crop === 'vertical' ? '1080:1920' : '1920:1080';
    const fps = 25;
    const targetDurationSeconds = Math.max(1, Math.ceil(len || 1));

    if (!imagePaths || imagePaths.length === 0) {
        throw new Error("Cannot create slideshow with zero images.");
    }
    
    if (imagePaths.length === 1) {
        return new Promise((resolve, reject) => {
            const frames = Math.max(1, Math.round(targetDurationSeconds * fps));
            ffmpeg(imagePaths[0])
                .inputOptions(['-loop 1'])
                .videoFilters([
                    `scale=${resolution}:force_original_aspect_ratio=increase,crop=${resolution}`,
                    `zoompan=z='min(zoom+0.0005,1.1)':d=${frames}:s=${resolution}`,
                    `setsar=1`
                ])
                .outputOptions([
                    `-t ${targetDurationSeconds}`, `-r ${fps}`, `-pix_fmt yuv420p`, '-preset veryfast'
                ])
                .on('end', () => resolve(outputPath))
                .on('error', (err, stdout, stderr) => reject(new Error("FFmpeg failed to create Ken Burns video: " + stderr)))
                .save(outputPath);
        });
    }

    const durationPerImage = targetDurationSeconds / imagePaths.length;
    const command = ffmpeg();
    imagePaths.forEach(p => {
        command.input(p).inputOptions(['-loop 1', `-t ${durationPerImage}`]);
    });
    
    const filterComplex = [];
    const scaledStreams = [];
    
    imagePaths.forEach((_, i) => {
        const streamId = `[${i}:v]`;
        const outputId = `[v${i}]`;
        filterComplex.push(
            `${streamId}scale=${resolution}:force_original_aspect_ratio=increase,crop=${resolution},setsar=1,format=yuv420p${outputId}`
        );
        scaledStreams.push(outputId);
    });

    if (scaledStreams.length > 1) {
        let concatStr = scaledStreams.join('');
        filterComplex.push(`${concatStr}concat=n=${scaledStreams.length}:v=1:a=0[out]`);
    } else {
        filterComplex.push(`${scaledStreams[0]}[out]`);
    }
    
    return new Promise((resolve, reject) => {
        command
            .complexFilter(filterComplex)
            .outputOptions([
                '-map [out]',
                `-r ${fps}`,
                '-pix_fmt yuv420p',
                '-preset veryfast',
                `-t ${targetDurationSeconds}`,
                '-y'
            ])
            .on('end', () => resolve(outputPath))
            .on('error', (err, stdout, stderr) => {
                reject(new Error("Slideshow creation failed: " + stderr));
            })
            .save(outputPath);
    });
}

function uniqueUrls(arr) {
    return Array.from(new Set(arr));
}

function writeDebugJson(filePath, obj) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to write debug json:', e.message);
    }
}
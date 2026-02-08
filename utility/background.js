import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import youtubedl from "youtube-dl-exec";
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { getSurahDataRange } from "./data.js";

dotenv.config();

const visualThesaurus = {
    'mercy': ['rain', 'soft rain', 'water drop', 'flowering', 'calm water'],
    'wrath': ['storm', 'thunder', 'volcano', 'dark ocean', 'cracked earth'],
    'punishment': ['ruins', 'desert storm', 'barren land', 'fire', 'smoke'],
    'paradise': ['lush garden', 'river', 'waterfall', 'peacock', 'greenery', 'spring'],
    'hell': ['fire', 'lava', 'dark cave', 'heat', 'burning'],
    'creation': ['galaxy', 'nebula', 'stars', 'DNA', 'microscope nature'],
    'sky': ['clouds', 'blue sky', 'sunset', 'sunrise', 'horizon'],
    
    'guidance': ['lighthouse', 'pathway', 'ray of light', 'lantern', 'moonlight'],
    'darkness': ['deep ocean', 'night forest', 'cave', 'shadows'],
    'knowledge': ['book pages', 'ink', 'pen', 'library', 'candle'],
    'patience': ['mountain', 'stone', 'desert', 'roots', 'ancient tree'],
    'peace': ['lake reflection', 'misty forest', 'dove', 'white clouds'],
    'time': ['hourglass', 'sand', 'sunset', 'seasons'],
    'life': ['sprout', 'sapling', 'bloom', 'baby hand', 'sunrise'],
    'death': ['autumn leaves', 'sunset', 'withered flower', 'winter snow'],
    
    'prophet': ['desert caravan', 'cave light', 'staff', 'moon'],
    'prayer': ['mosque arch', 'prayer rug', 'hands sky', 'silhouette'],
    'quran': ['open book', 'arabic calligraphy', 'rehal'],
    'charity': ['hands giving', 'grain', 'water pouring']
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
            const imageUrls = await searchImagesOnUnsplash([query], 8, crop);
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

    return await processFoundImages(imageUrls, len, crop);
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
        
        try { if (fs.existsSync(singlePath)) fs.unlinkSync(singlePath); } catch(e){}
        return slideshowPath;
    }

    const downloadedImagePaths = await downloadImages(imageUrls, tempImageDir);
    const slideshowPath = await createImageSlideshow(downloadedImagePaths, len, crop);

    downloadedImagePaths.forEach(imgPath => {
        try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch(e){}
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
        .on("error", (err) => reject(new Error("Failed to create background video from image: " + err.message)))
        .save(outputPath);
    });
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

function extractKeywords(text, count = 5) {
    if (!text) return ['nature', 'spiritual'];
    
    const stopWords = new Set([
        'a', 'an', 'the', 'in', 'on', 'of', 'and', 'or', 'is', 'are', 'to', 'for', 'from',
        'who', 'what', 'when', 'where', 'why', 'how', 'he', 'she', 'it', 'they', 'we', 'i',
        'you', 'allah', 'god', 'indeed', 'verily', 'those', 'have', 'has', 'will', 'with',
        'not', 'be', 'that', 'his', 'him', 'their', 'them', 'said', 'say', 'says', 'upon',
        'unto', 'then', 'thus', 'does', 'did', 'can', 'could', 'shall', 'should', 'about'
    ]);

    const wordCounts = {};
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    cleanText.split(/\s+/).forEach(word => {
        if (word && !stopWords.has(word) && word.length > 3) {
            const score = visualThesaurus[word] ? 3 : 1;
            wordCounts[word] = (wordCounts[word] || 0) + score;
        }
    });
    
    const sortedKeywords = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]);
    
    return sortedKeywords.slice(0, count);
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
        'club', 'nightclub', 'gambling', 'pork', 'dog', 'pig'
    ].map(s => s.toLowerCase());

    if (!process.env.UNSPLASH_ACCESS_KEY) throw new Error("UNSPLASH_ACCESS_KEY is not set.");

    const orientation = crop === 'vertical' ? 'portrait' : 'landscape';
    
    const surahThemes = {
        '1': ['pathway', 'sunrise', 'open book', 'ray of light', 'sky clouds'],
        '2': ['night sky', 'moon', 'cattle', 'desert', 'clouds', 'water stream', 'dawn'],
        '3': ['mountain peak', 'sanctuary', 'mihrab', 'forest', 'gold coins'],
        '4': ['scales of justice', 'shield', 'hands shaking', 'home interior', 'protection'],
        '5': ['table setting', 'bread', 'grapes', 'clear water', 'hands giving'],
        '6': ['starry night', 'livestock', 'grain field', 'planet', 'galaxy'],
        '7': ['mountain top', 'tree roots', 'garden', 'misty forest', 'cliff'],
        '8': ['rain storm', 'dust swirling', 'horse silhouette', 'armor'],
        '9': ['ancient wall', 'gate', 'shield', 'covenant', 'scroll'],
        '10': ['deep ocean', 'stormy sea', 'clouds moving', 'underwater'],
        '11': ['desert ruins', 'sandstorm', 'ancient city', 'waves'],
        '12': ['full moon', 'stars night', 'deep well', 'wheat field', 'egypt desert', 'wolf silhouette'],
        '13': ['lightning strike', 'thunderstorm', 'rain on glass', 'river flow', 'roots'],
        '14': ['mountain rock', 'dead tree', 'green tree', 'sunlight'],
        '15': ['rock texture', 'starry sky', 'mountains', 'wind blowing'],
        '16': ['honeycomb', 'bee on flower', 'milk', 'lush valley', 'grapes'],
        '17': ['night city', 'moonlight', 'masjid arch', 'horizon'],
        '18': ['cave entrance', 'ancient ship', 'garden wall', 'sunrise over ocean', 'gold'],
        '19': ['date palm tree', 'desert oasis', 'flowing stream', 'baby crib'],
        '20': ['fire flame', 'wooden staff', 'river nile', 'snake skin texture', 'mountain morning'],
        '21': ['cosmos', 'planets', 'fire cooling', 'fish in water', 'bones'],
        '22': ['hajj crowd abstract', 'desert vast', 'sacrifice', 'old house'],
        '23': ['clay texture', 'rain falling', 'ship wood', 'fetus abstract'],
        '24': ['hanging lamp', 'glass reflection', 'olive oil', 'light beam', 'mirage'],
        '25': ['clouds shadow', 'rain drops', 'stars', 'two seas'],
        '26': ['egypt pyramids', 'red sea', 'staff', 'poet pen'],
        '27': ['ant macro', 'hoopoe bird', 'glass floor', 'throne silhouette'],
        '28': ['burning bush', 'tower', 'river bank', 'key ancient'],
        '29': ['spider web', 'dew drop', 'fragile thread', 'dust'],
        '30': ['roman ruins', 'wind blowing', 'rain clouds', 'wedding ring'],
        '31': ['sage herb', 'ocean waves', 'tree bark', 'ink pot'],
        '32': ['earth soil', 'stars', 'prostration silhouette', 'water drop'],
        '33': ['trench', 'desert wind', 'shield', 'sunset'],
        '34': ['iron texture', 'dam water', 'bird flock', 'mountains'],
        '35': ['bird wings', 'clouds fast', 'fresh water', 'salt water'],
        '36': ['moon phases', 'ship at sea', 'sun orbit', 'dead land greening'],
        '37': ['stars alignment', 'fruit tree', 'gold jewelry', 'fish'],
        '38': ['horse', 'fountain', 'wind', 'throne'],
        '39': ['groups of people abstract', 'harvest', 'winter spring', 'layers of darkness'],
        '40': ['throne abstract', 'fire', 'chains', 'stars'],
        '41': ['desert dunes', 'sky smoke', 'earth crack', 'fruits'],
        '42': ['rain pouring', 'ship sails', 'hands praying', 'scale'],
        '43': ['gold ornaments', 'silver', 'gate', 'luxury interior'],
        '44': ['smoke swirling', 'haze', 'foggy forest', 'molten metal'],
        '45': ['sea waves', 'animals grazing', 'rain', 'book'],
        '46': ['sand dunes', 'wind storm', 'ruins', 'parents'],
        '47': ['river water', 'honey', 'milk', 'sword'],
        '48': ['tree silhouette', 'gate opening', 'crowd abstract'],
        '49': ['rooms', 'calm conversation', 'brothers'],
        '50': ['tall palm trees', 'rain', 'earth fissure', 'quran'],
        '51': ['wind blowing sand', 'rain clouds', 'sky night'],
        '52': ['mountain sinai', 'scroll', 'sea swelling', 'stars setting'],
        '53': ['falling star', 'nebula', 'lote tree', 'horizon'],
        '54': ['moon surface', 'river', 'storm', 'wood plank'],
        '55': ['coral reef', 'pearls', 'pomegranate', 'palm tree', 'two oceans meeting'],
        '56': ['emerald', 'goblet', 'thorny tree', 'fire wood'],
        '57': ['iron ore', 'light tunnel', 'rust', 'rain on plants'],
        '58': ['whisper abstract', 'shadows', 'writing'],
        '59': ['fortress wall', 'palm trees', 'sunset'],
        '60': ['handshake', 'chain', 'light'],
        '61': ['row of soldiers abstract', 'bricks', 'merchandise'],
        '62': ['donkey', 'books', 'market', 'friday prayer'],
        '63': ['wood logs', 'finger shhh', 'wall'],
        '64': ['loss gain graph', 'family', 'wealth'],
        '65': ['divorce abstract', 'plant sprouting', 'calendar'],
        '66': ['honey', 'lock', 'river stone'],
        '67': ['starry sky', 'birds flying', 'water spring', 'blue sky'],
        '68': ['fountain pen', 'ink', 'garden burnt', 'fish'],
        '69': ['ruined city', 'hollow tree', 'sky tearing'],
        '70': ['stairway', 'sky molten copper', 'wool'],
        '71': ['noah ark', 'heavy rain', 'moon light', 'sun lamp'],
        '72': ['shooting star', 'mosque silhouette', 'water abundance'],
        '73': ['night blanket', 'chanting abstract', 'shaking earth'],
        '74': ['wrapped cloak', 'trumpet', 'moon'],
        '75': ['solar eclipse', 'bones', 'finger tip', 'sun moon'],
        '76': ['silver cup', 'ginger', 'spring water', 'chains'],
        '77': ['winds', 'mountains crumbling', 'sparks'],
        '78': ['mountain stake', 'night sleep', 'garden lush', 'rain'],
        '79': ['running horses', 'desert vast', 'tree'],
        '80': ['garden produce', 'olives', 'dates', 'grapes'],
        '81': ['sun dark', 'stars falling', 'mountains moving', 'ocean boiling'],
        '82': ['sky cracking', 'stars scattering', 'sea mixing'],
        '83': ['scales', 'sealed wine', 'musk', 'book'],
        '84': ['twilight', 'night', 'moon full'],
        '85': ['constellations', 'fire trench', 'tablet'],
        '86': ['night star', 'rain returning', 'plant emerging'],
        '87': ['green pasture', 'withered grass', 'morning'],
        '88': ['boiling spring', 'cushions', 'carpets', 'camel'],
        '89': ['dawn light', 'ten nights', 'column ruins', 'river valley'],
        '90': ['city mecca', 'steep path', 'eye'],
        '91': ['bright sun', 'moon following', 'daylight', 'night cover'],
        '92': ['night dark', 'day bright', 'fire'],
        '93': ['morning sun', 'orphan', 'path'],
        '94': ['chest breathing', 'mountain load', 'ease'],
        '95': ['fig fruit', 'olive branch', 'mountain sinai'],
        '96': ['clot blood macro', 'pen writing', 'forehead'],
        '97': ['peaceful night', 'mosque dawn', 'light rays'],
        '98': ['scrolls', 'gold river', 'fire'],
        '99': ['earth crack', 'rubble', 'shaking camera'],
        '100': ['galloping horse', 'spark', 'dust'],
        '101': ['moths', 'colored wool', 'scales'],
        '102': ['graveyard', 'gold coins', 'jewels'],
        '103': ['sunset', 'hourglass', 'clock'],
        '104': ['safe vault', 'coins', 'fire column'],
        '105': ['elephant', 'flock birds', 'stones'],
        '106': ['caravan', 'winter snow', 'summer sun', 'food'],
        '107': ['empty plate', 'prayer rug', 'helping hand'],
        '108': ['river flow', 'fountain', 'camel sacrifice'],
        '109': ['crowd abstract', 'worship'],
        '110': ['crowd entering gate', 'victory flag', 'forgiveness'],
        '111': ['rope fiber', 'fire flame', 'wood'],
        '112': ['one finger', 'light abstract', 'solid rock'],
        '113': ['daybreak', 'knot', 'night dark'],
        '114': ['king crown', 'heart silhouette', 'whisper abstract']
    };

    const surahSpecific = verseInfo && verseInfo.surahNumber && surahThemes[verseInfo.surahNumber.toString()]
        ? surahThemes[verseInfo.surahNumber.toString()]
        : null;

    const priority1 = surahSpecific ? [...surahSpecific] : [];

    const priority2 = [];
    const baseKeywords = Array.isArray(keywords) && keywords.length
        ? keywords.filter(k => k && k.length > 2)
        : [];

    baseKeywords.forEach(k => {
        if (visualThesaurus[k]) {
            visualThesaurus[k].forEach(synonym => priority2.push(synonym));
        }
        else {
            priority2.push(k);
            priority2.push(`${k} texture`);
            priority2.push(`${k} detail`);
            priority2.push(`${k} cinematic`);
        }
    });

    const priority3 = [
        'islamic architecture detail',
        'islamic geometry pattern',
        'moroccan tile texture',
        'arabesque art',
        'abstract texture',
        'cinematic lighting'
    ];

    const orderedQueries = [...new Set([...priority1, ...priority2, ...priority3])];

    const collected = [];
    const debugCandidates = [];

    try {
        for (const q of orderedQueries) {
            if (collected.length >= desiredCount) break;

            const isSpecific = priority1.includes(q) || priority2.includes(q);
            const per_page = isSpecific ? 20 : 10;

            let resp;
            try {
                resp = await axios.get('https://api.unsplash.com/search/photos', {
                    params: {
                        query: q,
                        per_page,
                        orientation,
                        content_filter: 'high',
                        order_by: isSpecific ? 'relevant' : 'popular'
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
                
                if (collected.some(c => c.id === r.id)) continue;
                
                try {
                    const urlObj = new URL(url);
                    urlObj.searchParams.set('fm', 'webp');
                    collected.push({ url: urlObj.toString(), id: r.id, meta });
                } catch (e) {
                    collected.push({ url: url, id: r.id, meta });
                }

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
                queries: orderedQueries,
                debugCandidates
            });
        } catch (e) {}

        const urls = uniqueUrls(collected.map(c => c.url)).slice(0, desiredCount);
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
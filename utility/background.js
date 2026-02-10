import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import youtubedl from "youtube-dl-exec";
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { getSurahDataRange } from "./data.js";

dotenv.config();

const visualThesaurus = {
    'mercy': ['gentle rain', 'morning dew', 'ray of light', 'blooming flower', 'calm water'],
    'wrath': ['storm clouds', 'lightning', 'volcanic rock', 'rough ocean', 'cracked earth'],
    'punishment': ['ancient ruins', 'sandstorm', 'barren wasteland', 'smoke', 'ash'],
    'paradise': ['lush garden', 'waterfall', 'flowing river', 'peacock feather', 'green forest', 'orchard'],
    'hell': ['burning coals', 'lava', 'dark cave', 'intense fire', 'smoke abstract'],
    'sky': ['blue sky', 'golden sunset', 'starry night', 'horizon', 'nebula', 'clouds'],
    'heaven': ['blue sky', 'golden sunset', 'starry night', 'horizon', 'nebula', 'clouds'],
    'heavens': ['blue sky', 'golden sunset', 'starry night', 'horizon', 'nebula', 'clouds'],
    'earth': ['mountain peak', 'desert dunes', 'green valley', 'pebbles', 'soil texture'],
    'water': ['ocean waves', 'clear stream', 'water drop', 'river flow', 'rain'],
    'fire': ['flame close-up', 'orange glow', 'burning embers', 'heat waves', 'warm light'],
    'rain': ['water drops', 'storm clouds', 'rainfall', 'wet leaves', 'puddles'],
    'cloud': ['white clouds', 'storm clouds', 'sky formations', 'cumulus', 'wispy clouds'],
    'clouds': ['white clouds', 'storm clouds', 'sky formations', 'cumulus', 'wispy clouds'],
    
    'guidance': ['lighthouse', 'pathway in woods', 'lantern', 'moon in dark sky', 'compass'],
    'darkness': ['deep ocean', 'night forest', 'shadows', 'black texture', 'cave'],
    'light': ['sun rays', 'candle flame', 'lamp', 'bright window', 'glow'],
    'knowledge': ['old book', 'ink pen', 'library', 'scroll', 'parchment'],
    'patience': ['stone cairn', 'ancient tree', 'roots', 'still lake', 'mountain'],
    'peace': ['mirror lake', 'white dove', 'misty morning', 'zen stones', 'soft clouds'],
    'time': ['hourglass', 'sunset', 'changing seasons', 'stars time lapse'],
    'night': ['starry sky', 'moon', 'darkness', 'twilight', 'dusk'],
    'day': ['sunrise', 'bright sky', 'sunlight', 'dawn', 'daylight'],
    'sun': ['golden sun', 'sunrise', 'sunset', 'solar', 'bright light'],
    'moon': ['crescent moon', 'full moon', 'lunar', 'moonlight', 'night sky'],
    'star': ['starry night', 'constellation', 'milky way', 'nebula', 'cosmic'],
    'stars': ['starry night', 'constellation', 'milky way', 'nebula', 'cosmic'],
    
    'prophet': ['desert caravan', 'shepherd staff', 'cave light', 'moon', 'palm trees'],
    'prayer': ['mosque arch', 'prayer rug pattern', 'minaret silhouette', 'islamic geometry', 'beads'],
    'quran': ['open book', 'arabic calligraphy', 'rehal', 'golden binding'],
    'charity': ['grain wheat', 'flowing water', 'open hand silhouette', 'gold coins'],
    'worship': ['mosque dome', 'silhouette kneeling', 'sunrise', 'stars'],
    'angel': ['white feather', 'bright light', 'rays', 'soft glow'],
    'angels': ['white feather', 'bright light', 'rays', 'soft glow'],
    'jinn': ['smoke swirling', 'shadows', 'fire flame'],
    'throne': ['gold texture', 'luxury fabric', 'crown', 'palace hall'],
    
    'mountain': ['mountain peak', 'rocky summit', 'alpine landscape', 'cliff', 'stone'],
    'mountains': ['mountain range', 'peaks', 'alpine landscape', 'rocky cliffs'],
    'sea': ['ocean waves', 'blue water', 'seascape', 'shoreline', 'maritime'],
    'ocean': ['ocean waves', 'deep blue', 'seascape', 'maritime', 'water expanse'],
    'river': ['flowing river', 'stream', 'water current', 'riverside', 'fresh water'],
    'tree': ['forest tree', 'tree trunk', 'branches', 'leaves', 'woodland'],
    'trees': ['forest', 'woodland', 'tree canopy', 'branches', 'nature'],
    'garden': ['lush garden', 'green plants', 'flowers', 'botanical', 'paradise garden'],
    'fruit': ['fresh fruit', 'orchard', 'harvest', 'pomegranate', 'dates'],
    'fruits': ['fresh fruits', 'orchard', 'harvest', 'variety', 'abundance'],
    
    'wine': ['crystal goblet', 'red grape juice', 'vineyard', 'flowing stream'],
    'drink': ['clear water', 'milk glass', 'honey jar', 'fountain'],
    'spouse': ['two rings', 'flowers', 'peaceful home', 'sunset silhouette'],
    'companion': ['two rings', 'flowers', 'peaceful home', 'sunset silhouette'],
    'companions': ['garden', 'peaceful gathering', 'assembly'],
    
    'death': ['autumn leaves', 'sunset', 'fading light', 'withered grass'],
    'life': ['spring flowers', 'sunrise', 'green shoots', 'flowing water'],
    'resurrection': ['seed sprouting', 'sunrise', 'new growth', 'dawn'],
    'judgment': ['scales', 'balance', 'justice', 'weighing'],
    'creation': ['galaxy', 'cosmos', 'nature', 'earth formation', 'universe'],
    'truth': ['clear water', 'crystal', 'light beam', 'transparency'],
    'falsehood': ['mirage', 'fog', 'smoke', 'illusion'],
    'believer': ['sturdy tree', 'strong roots', 'lighthouse', 'mountain'],
    'believers': ['forest', 'community', 'gathering of trees'],
    'disbelief': ['dead tree', 'barren land', 'darkness', 'ash'],
    
    'gold': ['gold texture', 'golden light', 'precious metal', 'yellow shimmer'],
    'silver': ['silver metal', 'white shimmer', 'metallic', 'moonlight'],
    'iron': ['iron ore', 'metal texture', 'rust', 'strong material'],
    'silk': ['fabric texture', 'luxury cloth', 'smooth material', 'fine textile'],
    'pearl': ['white pearl', 'oyster shell', 'gem', 'precious stone'],
    'pearls': ['white pearls', 'gems', 'precious stones', 'treasure'],
    
    'cattle': ['livestock silhouette', 'grazing animals', 'pastoral scene'],
    'livestock': ['grazing animals', 'pastoral scene', 'farm animals silhouette'],
    'camel': ['camel silhouette', 'desert transport', 'caravan'],
    'horse': ['horse silhouette', 'galloping', 'noble steed'],
    'sheep': ['sheep silhouette', 'flock', 'wool'],
    'bird': ['bird silhouette', 'flying bird', 'feathers', 'wings'],
    'birds': ['flock of birds', 'flying birds', 'migration', 'sky'],
    'bee': ['bee on flower', 'honeycomb', 'pollination'],
    'ant': ['ant macro', 'insect', 'colony'],
    'fish': ['fish underwater', 'marine life', 'ocean creature'],
    
    'book': ['ancient book', 'manuscript', 'pages', 'scripture'],
    'pen': ['writing pen', 'ink', 'calligraphy', 'inscription'],
    'wisdom': ['owl silhouette', 'old tree', 'ancient scroll', 'sage'],
    'sign': ['signpost', 'marker', 'indication', 'symbol'],
    'signs': ['natural wonders', 'cosmic phenomena', 'patterns in nature'],
    
    'perish': ['withered leaves', 'decay', 'erosion', 'ruins'],
    'destroy': ['ruins', 'rubble', 'demolished', 'broken'],
    'burn': ['orange glow', 'heat', 'embers', 'warmth'],
    'hands': ['open palm silhouette', 'gesture', 'reaching'],
    'carry': ['burden', 'weight', 'load'],
    'neck': ['rope texture', 'chain', 'fiber'],
    'wife': ['flowers', 'garden', 'peaceful home'],
    'wealth': ['gold coins', 'treasure', 'abundance'],
    'poor': ['empty bowl', 'minimal', 'simple'],
    'rich': ['luxury', 'opulence', 'gold']
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

    const baseKeywords = extractKeywords(combinedTranslation, 10);
    if (verseInfo && verseInfo.surahName) {
        const simpleName = verseInfo.surahName.replace('Al-', '').replace('Ar-', '').replace('As-', '');
        baseKeywords.unshift(simpleName);
    }
    console.log(`Extracted keywords for background: ${baseKeywords.join(', ')}`);

    const approxPerImageSec = 6;
    const desiredCount = Math.min(12, Math.max(3, Math.ceil(len / approxPerImageSec)));

    const imageUrls = await searchImagesOnUnsplash(baseKeywords, desiredCount, crop, verseInfo);

    if (!imageUrls || imageUrls.length === 0) {
        console.log("No relevant images found, falling back to default video.");
        const defaultVideo = path.resolve("Data/Background_Video/CarDrive.mp4");
        if(fs.existsSync(defaultVideo)) return await createBackgroundVideo(defaultVideo, len, crop);
        throw new Error("No background images found and default video is missing.");
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

function extractKeywords(text, count = 10) {
    if (!text) return ['nature', 'spiritual'];
    
    const stopWords = new Set([
        'a', 'an', 'the', 'in', 'on', 'of', 'and', 'or', 'is', 'are', 'to', 'for', 'from',
        'who', 'what', 'when', 'where', 'why', 'how', 'he', 'she', 'it', 'they', 'we', 'i',
        'you', 'allah', 'god', 'lord', 'indeed', 'verily', 'those', 'have', 'has', 'will', 'with',
        'not', 'be', 'that', 'his', 'him', 'their', 'them', 'said', 'say', 'says', 'upon',
        'unto', 'then', 'thus', 'does', 'did', 'can', 'could', 'shall', 'should', 'about',
        'surah', 'ayah', 'verse', 'chapter', 'part', 'juz', 'which', 'whom', 'there', 'here',
        'been', 'but', 'by', 'as', 'at', 'into', 'like', 'through', 'after', 'over', 'between',
        'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among', 'also',
        'such', 'these', 'this', 'than', 'so', 'any', 'some', 'may', 'might', 'must', 'even',
        'only', 'other', 'same', 'was', 'were', 'being', 'do', 'doing', 'make', 'made', 'every',
        'all', 'both', 'each', 'few', 'more', 'most', 'own', 'same', 'such', 'no', 'nor',
        'too', 'very', 'just', 'dont', 'now', 'well', 'back', 'down', 'up', 'off'
    ]);

    const thesaurusMatches = [];
    const otherWords = {};
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    const words = cleanText.split(/\s+/);
    
    words.forEach(word => {
        if (!word || stopWords.has(word) || word.length < 4) return;
        
        if (visualThesaurus[word]) {
            thesaurusMatches.push(word);
            return;
        }
        
        let found = false;
        for (const key of Object.keys(visualThesaurus)) {
            if (word.includes(key) || key.includes(word)) {
                if (word.length >= key.length - 1 && word.length <= key.length + 2) {
                    thesaurusMatches.push(key);
                    found = true;
                    break;
                }
            }
        }
        
        if (!found) {
            otherWords[word] = (otherWords[word] || 0) + 1;
        }
    });
    
    const thesaurusFreq = {};
    thesaurusMatches.forEach(word => {
        thesaurusFreq[word] = (thesaurusFreq[word] || 0) + 1;
    });
    
    const sortedThesaurus = Object.keys(thesaurusFreq)
        .sort((a, b) => thesaurusFreq[b] - thesaurusFreq[a]);
    
    const sortedOther = Object.keys(otherWords)
        .sort((a, b) => otherWords[b] - otherWords[a])
        .slice(0, 5);

    const combined = [...sortedThesaurus, ...sortedOther];
    
    console.log(`Thesaurus matches found: ${sortedThesaurus.join(', ')}`);
    if (sortedOther.length > 0) {
        console.log(`Other keywords found: ${sortedOther.join(', ')}`);
    }
    
    return combined.slice(0, count);
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

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
async function rateLimitedRequest(requestFn) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastRequestTime = Date.now();
    return await requestFn();
}

async function searchImagesOnUnsplash(keywords, desiredCount = 6, crop = 'landscape', verseInfo = {}) {
    const blacklist = [
        'woman', 'women', 'girl', 'girls', 'lady', 'ladies', 'female', 'females', 'bikini', 'model', 'models',
        'fashion', 'face', 'faces', 'portrait', 'portraits', 'selfie', 'selfies',
        'man', 'men', 'boy', 'boys', 'male', 'males', 'guy', 'guys', 'gentleman',
        'people', 'person', 'persons', 'human', 'humans', 'body', 'bodies', 'skin', 'legs', 'hair',
        'family', 'families', 'child', 'children', 'kid', 'kids', 'baby', 'babies', 'toddler', 'toddlers',
        'parent', 'parents', 'mother', 'father', 'sister', 'brother', 'daughter', 'son',
        'couple', 'couples', 'kiss', 'kissing', 'hug', 'hugging', 'romance', 'romantic', 'love', 'dating',
        'wedding', 'weddings', 'bride', 'groom', 'marriage',
        'crowd', 'crowds', 'audience', 'group', 'gathering', 'party',
        
        'cross', 'crosses', 'crucifix', 'crucifixes', 'jesus', 'christ', 'christian', 'christianity',
        'church', 'churches', 'cathedral', 'cathedrals', 'chapel', 'chapels', 'priest', 'priests', 'nun', 'nuns',
        'buddha', 'buddhist', 'buddhism', 'monk', 'monks', 'temple', 'temples', 'shrine', 'shrines',
        'idol', 'idols', 'statue', 'statues', 'gods', 'goddess', 'hindu', 'hinduism',
        'christmas', 'easter', 'halloween', 'valentine',
        
        'alcohol', 'alcoholic', 'wine', 'wines', 'beer', 'beers', 'cocktail', 'cocktails', 'bar', 'bars',
        'pub', 'pubs', 'club', 'clubs', 'nightclub', 'nightclubs', 'party', 'parties', 'dance', 'dancing',
        'drug', 'drugs', 'cannabis', 'marijuana', 'weed', 'smoke', 'smoking', 'cigarette', 'cigarettes',
        'cigar', 'cigars', 'vape', 'vaping',
        'gamble', 'gambling', 'casino', 'casinos', 'poker', 'card', 'cards', 'dice', 'bet', 'betting',
        'pork', 'pig', 'pigs', 'ham', 'bacon', 'dog', 'dogs', 'puppy', 'puppies',
        
        'graffiti', 'tattoo', 'tattoos', 'piercing', 'piercings', 'makeup', 'concert', 'concerts',
        'festival', 'festivals', 'music', 'musician', 'musicians', 'guitar', 'guitars',
        'sexy', 'sensual', 'erotic', 'nude', 'naked', 'underwear', 'lingerie',
        'beach', 'beaches', 'pool', 'pools', 'swim', 'swimming', 'swimsuit', 'swimwear',
        
        'athlete', 'athletes', 'sport', 'sports', 'player', 'players', 'team', 'teams',
        'yoga', 'fitness', 'gym', 'exercise', 'workout', 'dancer', 'dancers',
        'hijab', 'headscarf', 'veil', 'covered'
    ].map(s => s.toLowerCase());

    if (!process.env.UNSPLASH_ACCESS_KEY) throw new Error("UNSPLASH_ACCESS_KEY is not set.");

    const orientation = crop === 'vertical' ? 'portrait' : 'landscape';
    
    const surahThemes = {
        '1': ['golden pathway', 'morning sunrise', 'light beam nature', 'sky clouds golden'],
        '2': ['night sky stars', 'crescent moon', 'desert landscape', 'water stream nature'],
        '3': ['mountain peak landscape', 'forest green', 'gold texture abstract'],
        '4': ['balance scales abstract', 'shield metal', 'home interior minimal'],
        '5': ['bread loaf', 'grape vineyard', 'clear water stream', 'hands abstract'],
        '6': ['starry night sky', 'grain field wheat', 'planet space', 'galaxy cosmos'],
        '7': ['mountain summit', 'tree roots texture', 'lush garden nature', 'misty forest'],
        '8': ['rain storm nature', 'dust particle', 'armor metal texture'],
        '9': ['ancient wall stone', 'gate entrance', 'metal shield', 'scroll paper'],
        '10': ['deep ocean water', 'stormy sea waves', 'clouds time-lapse'],
        '11': ['desert ruins ancient', 'sandstorm nature', 'ocean waves powerful'],
        '12': ['full moon night', 'starry sky', 'well water', 'wheat field golden', 'egypt desert'],
        '111': ['orange glow abstract', 'heat waves', 'embers glowing', 'rope fiber texture', 'wood burning'],
        '13': ['lightning strike nature', 'thunderstorm clouds', 'rain glass', 'river flowing', 'tree roots'],
        '14': ['mountain rock formation', 'dead tree texture', 'green tree forest', 'sunlight rays'],
        '15': ['rock texture close-up', 'starry sky milky way', 'mountains landscape', 'wind sand'],
        '16': ['honeycomb pattern', 'bee flower macro', 'milk glass', 'valley green', 'grapes vineyard'],
        '17': ['moonlight night', 'mosque architecture', 'horizon sunset'],
        '18': ['cave entrance dark', 'ancient ship wood', 'garden wall stone', 'sunrise ocean'],
        '19': ['date palm tree', 'desert oasis water', 'flowing stream nature'],
        '20': ['fire flame orange', 'wooden staff texture', 'river nile water', 'snake skin pattern', 'mountain morning'],
        '21': ['cosmos space', 'planets solar system', 'fish underwater', 'bones texture'],
        '22': ['desert vast landscape', 'old house ruins'],
        '23': ['clay texture close-up', 'rain falling nature', 'ship wood texture'],
        '24': ['hanging lamp light', 'glass reflection abstract', 'olive oil', 'light beam nature'],
        '25': ['clouds shadow nature', 'rain drops water', 'stars night', 'ocean meeting'],
        '26': ['egypt pyramids desert', 'red sea water', 'staff wood', 'pen ink'],
        '27': ['ant macro insect', 'hoopoe bird', 'glass floor reflection', 'throne abstract'],
        '28': ['burning bush fire', 'tower architecture', 'river bank nature', 'key ancient metal'],
        '29': ['spider web dew', 'water drop macro', 'thread texture', 'dust particle'],
        '30': ['roman ruins ancient', 'wind blowing sand', 'rain clouds nature', 'ring gold'],
        '31': ['ocean waves powerful', 'tree bark texture', 'ink pot old'],
        '32': ['earth soil texture', 'stars milky way', 'water drop macro'],
        '33': ['desert wind sand', 'shield metal', 'sunset golden'],
        '34': ['iron texture metal', 'dam water', 'bird flock flying', 'mountains landscape'],
        '35': ['bird wings flying', 'clouds fast moving', 'fresh water clear', 'salt water ocean'],
        '36': ['moon phases', 'ship sea sailing', 'sun orbit space', 'land greening nature'],
        '37': ['stars alignment space', 'fruit tree orchard', 'gold jewelry texture', 'fish underwater'],
        '38': ['horse silhouette', 'fountain water', 'wind nature', 'throne gold'],
        '39': ['harvest field', 'seasons changing', 'darkness layers'],
        '40': ['throne abstract gold', 'fire burning', 'chain metal', 'stars cosmos'],
        '41': ['desert dunes sand', 'sky abstract', 'earth crack texture', 'fruits fresh'],
        '42': ['rain pouring nature', 'ship sails ocean', 'scale balance'],
        '43': ['gold ornaments texture', 'silver metal', 'gate entrance', 'luxury fabric'],
        '44': ['smoke swirling abstract', 'haze foggy', 'forest foggy', 'molten metal'],
        '45': ['sea waves ocean', 'rain nature', 'book old'],
        '46': ['sand dunes desert', 'wind storm nature', 'ruins ancient'],
        '47': ['river water flowing', 'honey jar', 'milk glass', 'sword metal'],
        '48': ['tree silhouette sunset', 'gate opening light'],
        '49': ['interior room minimal', 'calm nature'],
        '50': ['tall palm trees', 'rain nature', 'earth fissure crack'],
        '51': ['wind blowing sand desert', 'rain clouds storm', 'sky night stars'],
        '52': ['mountain sinai landscape', 'scroll paper old', 'sea swelling waves', 'stars setting'],
        '53': ['falling star meteor', 'nebula space', 'tree nature', 'horizon sunset'],
        '54': ['moon surface craters', 'river water', 'storm nature', 'wood plank texture'],
        '55': ['coral reef underwater', 'pearls gems', 'pomegranate fruit', 'palm tree nature', 'two oceans'],
        '56': ['emerald gem green', 'goblet crystal', 'thorny tree', 'fire wood burning'],
        '57': ['iron ore metal', 'light tunnel abstract', 'rust texture', 'rain plants'],
        '58': ['whisper abstract', 'shadows dark', 'writing ink'],
        '59': ['fortress wall stone', 'palm trees nature', 'sunset golden'],
        '60': ['chain metal texture', 'light abstract'],
        '61': ['bricks texture', 'merchandise market'],
        '62': ['books old library', 'market bazaar'],
        '63': ['wood logs texture', 'wall stone'],
        '64': ['graph abstract', 'wealth gold'],
        '65': ['plant sprouting green', 'calendar time'],
        '66': ['honey jar golden', 'lock metal', 'river stone texture'],
        '67': ['starry sky milky way', 'birds flying silhouette', 'water spring nature', 'blue sky clouds'],
        '68': ['fountain pen ink', 'ink bottle', 'garden nature', 'fish underwater'],
        '69': ['ruined city ancient', 'hollow tree', 'sky dramatic'],
        '70': ['stairway stone', 'sky copper', 'wool texture'],
        '71': ['noah ark wood', 'heavy rain nature', 'moon light night', 'sun lamp'],
        '72': ['shooting star meteor', 'mosque silhouette', 'water abundance'],
        '73': ['night sky stars', 'mountains night', 'fabric texture heavy', 'lantern light'],
        '74': ['cloak fabric', 'trumpet instrument', 'moon night'],
        '75': ['solar eclipse space', 'bones texture', 'finger abstract', 'sun moon'],
        '76': ['silver cup metal', 'ginger root', 'spring water nature', 'chains metal'],
        '77': ['winds nature', 'mountains landscape', 'sparks fire'],
        '78': ['mountain landscape', 'garden lush green', 'rain nature'],
        '79': ['desert vast landscape', 'tree nature'],
        '80': ['garden produce', 'olives fruit', 'dates fruit', 'grapes vineyard'],
        '81': ['sun dark eclipse', 'stars falling space', 'mountains landscape', 'ocean water'],
        '82': ['sky dramatic clouds', 'stars space', 'sea ocean'],
        '83': ['scales balance', 'wine sealed', 'musk fragrance', 'book old'],
        '84': ['twilight sky', 'night dark', 'moon full'],
        '85': ['constellations stars', 'fire trench', 'tablet stone'],
        '86': ['night star sky', 'rain nature', 'plant emerging green'],
        '87': ['green pasture field', 'withered grass', 'morning sunrise'],
        '88': ['spring water boiling', 'cushions fabric', 'carpets texture', 'camel desert'],
        '89': ['dawn light sunrise', 'column ruins', 'river valley nature'],
        '90': ['city landscape', 'steep path mountain'],
        '91': ['bright sun sky', 'moon night', 'daylight', 'night cover dark'],
        '92': ['night dark sky', 'day bright sun', 'fire burning'],
        '93': ['morning sun sunrise', 'path nature'],
        '94': ['mountain landscape', 'ease nature'],
        '95': ['fig fruit', 'olive branch', 'mountain sinai'],
        '96': ['pen writing', 'ink calligraphy'],
        '97': ['peaceful night', 'light rays abstract'],
        '98': ['scrolls paper', 'river golden', 'fire burning'],
        '99': ['earth crack texture', 'rubble stones'],
        '100': ['horse galloping', 'spark fire', 'dust particles'],
        '101': ['moths insects', 'colored wool texture', 'scales balance'],
        '102': ['graveyard stones', 'gold coins', 'jewels gems'],
        '103': ['sunset golden', 'hourglass time', 'clock abstract'],
        '104': ['vault safe', 'coins gold', 'fire column'],
        '105': ['elephant', 'flock birds flying', 'stones texture'],
        '106': ['caravan desert', 'winter snow', 'summer sun', 'food texture'],
        '107': ['empty plate', 'prayer rug pattern'],
        '108': ['river flowing water', 'fountain water', 'camel desert'],
        '109': ['worship abstract'],
        '110': ['gate entrance', 'victory abstract'],
        '112': ['light abstract bright', 'solid rock texture'],
        '113': ['daybreak sunrise', 'knot rope', 'night dark'],
        '114': ['fortress stone', 'shield metal', 'starry night']
    };

    const surahSpecific = verseInfo && verseInfo.surahNumber && surahThemes[verseInfo.surahNumber.toString()]
        ? surahThemes[verseInfo.surahNumber.toString()]
        : [];

    const priority1 = surahSpecific ? [...surahSpecific] : [];

    const priority2 = [];
    const baseKeywords = Array.isArray(keywords) && keywords.length
        ? keywords.filter(k => k && k.length > 2)
        : [];

    baseKeywords.forEach(k => {
        if (visualThesaurus[k]) {
            visualThesaurus[k].forEach(synonym => priority2.push(synonym));
        }
    });

    const priority3 = [
        'islamic architecture pattern',
        'natural landscape scenery',
        'mountains landscape',
        'ocean waves nature',
        'desert landscape sand',
        'stars galaxy space',
        'flowing water nature',
        'sunrise golden light',
        'abstract texture'
    ];

    const orderedQueries = [...new Set([...priority1, ...priority2, ...priority3])];

    const collected = [];
    const debugCandidates = [];
    
    const exclusionTerms = [
        'people', 'person', 'human', 'man', 'woman', 'face', 'model',
        'portrait', 'selfie', 'family', 'crowd', 'group'
    ];
    const exclusionString = exclusionTerms.map(t => `-${t}`).join(' ');

    console.log(`Search strategy: ${priority1.length} surah-specific + ${priority2.length} keyword-based + ${priority3.length} fallback queries`);
    console.log(`Will attempt ${Math.min(orderedQueries.length, desiredCount * 3)} queries (stopping at ${desiredCount} images)`);

    try {
        const maxQueriesToAttempt = Math.min(orderedQueries.length, desiredCount * 3);
        
        for (let i = 0; i < maxQueriesToAttempt && collected.length < desiredCount; i++) {
            const q = orderedQueries[i];
            
            const isSpecific = priority1.includes(q);
            const per_page = 30;

            let resp;
            try {
                resp = await rateLimitedRequest(async () => {
                    return await axios.get('https://api.unsplash.com/search/photos', {
                        params: {
                            query: `${q} ${exclusionString}`,
                            per_page,
                            orientation,
                            content_filter: 'high',
                            order_by: isSpecific ? 'relevant' : 'latest'
                        },
                        headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
                        timeout: 15000
                    });
                });
            } catch (err) {
                if (err.response && err.response.status === 403) {
                    console.error(`Rate limit hit for query "${q}". Waiting 3 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    continue;
                }
                console.error(`Unsplash request failed for query "${q}":`, err.message);
                continue;
            }
            
            const results = (resp.data && resp.data.results) || [];
            console.log(`Query "${q}" returned ${results.length} results`);
            
            for (const r of results) {
                const rejected = isForbiddenImage(r, blacklist);
                
                const meta = {
                    id: r.id,
                    query: q,
                    alt_description: r.alt_description || null,
                    description: r.description || null,
                    tags: Array.isArray(r.tags) ? r.tags.map(t => (t && t.title) ? t.title : t) : [],
                    user: r.user ? r.user.name : null
                };
                
                debugCandidates.push({ meta, rejected });
                
                if (rejected) {
                    console.log(`Rejected: ${r.alt_description || r.description || 'no description'}`);
                    continue;
                }
                
                const url = r.urls?.regular || r.urls?.full || r.urls?.small;
                if (!url) continue;
                
                if (collected.some(c => c.id === r.id)) continue;
                
                try {
                    const urlObj = new URL(url);
                    urlObj.searchParams.set('fm', 'webp');
                    urlObj.searchParams.set('q', '85');
                    collected.push({ url: urlObj.toString(), id: r.id, meta });
                } catch (e) {
                    collected.push({ url: url, id: r.id, meta });
                }
                
                console.log(`Accepted image ${collected.length}/${desiredCount} from "${q}": ${r.alt_description || 'no description'}`);
                
                if (collected.length >= desiredCount) break;
            }
            
            if (results.length > 0 && collected.length > 0) {
                console.log(`Progress: ${collected.length}/${desiredCount} images collected`);
            }
        }

        try {
            const dbgPath = path.resolve('Data/temp_images/unsplash_debug.json');
            const tempImageDir = path.resolve("Data/temp_images");
            if (!fs.existsSync(tempImageDir)) fs.mkdirSync(tempImageDir, { recursive: true });
            
            writeDebugJson(dbgPath, {
                timestamp: new Date().toISOString(),
                surahNumber: verseInfo?.surahNumber,
                extractedKeywords: baseKeywords,
                surahSpecificQueries: priority1,
                thesaurusQueries: priority2,
                fallbackQueries: priority3,
                totalCandidates: debugCandidates.length,
                rejectedCount: debugCandidates.filter(c => c.rejected).length,
                acceptedCount: collected.length,
                debugCandidates: debugCandidates
            });
            console.log(`Debug info saved to: ${dbgPath}`);
        } catch (e) {
            console.error('Failed to write debug info:', e.message);
        }

        const urls = uniqueUrls(collected.map(c => c.url)).slice(0, desiredCount);
        console.log(`Final result: ${urls.length} images selected for background`);
        return urls;

    } catch (error) {
        console.error("Error searching Unsplash:", error.message);
        return [];
    }
}

async function downloadImages(urls, dir) {
    const downloadPromises = urls.map(async (url, index) => {
        const imagePath = path.join(dir, `image_${index}.webp`);
        const writer = fs.createWriteStream(imagePath);
        const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 20000 });
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
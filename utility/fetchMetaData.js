import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const OUTPUT_FILE = path.join(rootDir, 'Data', 'metadata.json');

async function fetchMetaData() {
    console.log("Starting Metadata Fetch...");
    const metadata = {
        reciters: [],
        translations: [],
        timestamp: Date.now()
    };

    try {
        console.log("fetching reciters from mp3quran.net...");
        const reciterResp = await axios.get('https://mp3quran.net/api/v3/reciters?language=ar');
        
        if (reciterResp.data && reciterResp.data.reciters) {
            metadata.reciters = reciterResp.data.reciters.map(r => ({
                id: r.id,
                name: r.name,
                letter: r.letter,
                moshafs: r.moshaf.map(m => ({
                    id: m.id,
                    name: m.name,
                    server: m.server,
                    surah_list: m.surah_list,
                    surah_total: m.surah_total
                }))
            }));
            console.log(`Loaded ${metadata.reciters.length} reciters.`);
        }

        console.log("fetching translations from Al-Quran Cloud...");
        const transResp = await axios.get('http://api.alquran.cloud/v1/edition?format=text&type=translation');
        
        if (transResp.data && transResp.data.data) {
            metadata.translations = transResp.data.data.map(t => ({
                identifier: t.identifier,
                name: t.name,
                englishName: t.englishName,
                language: t.language,
                direction: t.direction
            }));
            console.log(`Loaded ${metadata.translations.length} translations.`);
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(metadata, null, 2));
        console.log(`Metadata saved to: ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("Error fetching metadata:", error.message);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    fetchMetaData();
}

export { fetchMetaData };
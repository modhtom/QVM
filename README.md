# Quran Video Maker (QVM)

Quran Video Maker is a full-stack web application that enables users to create professional videos of Quranic verses with customizable backgrounds, text styling, and audio synchronization. The system integrates multiple APIs and FFmpeg processing to generate videos in both horizontal and vertical formats.

## Key Features

1. **Multi-Source Backgrounds**:

   - Pexels API integration (search by keywords)
   - YouTube video URLs
   - Custom image URLs
   - Default background library

2. **Audio Handling**:

   - Built-in recitation library
   - Custom audio uploads (MP3/WAV)
   - Verse synchronization interface
   - Precision timing control

3. **Video Generation**:

   - Full Surah videos
   - Custom verse ranges
   - Horizontal (16:9) and vertical (9:16) formats
   - Real-time progress tracking

4. **Text Customization**:

   - Font size control (1-72px)
   - Color picker for Arabic text
   - Verse-by-verse timing adjustments
   - ASS subtitle formatting

5. **Video Management**:
   - Gallery browsing
   - Download functionality
   - Social media sharing
   - Automatic cleanup system

## System Requirements

### Software

- Node.js v16+
- FFmpeg v5+
- FontConfig (for Arabic text rendering)
- Docker

## Installation

### Local Setup

1. Install prerequisites:

```bash
sudo apt-get install ffmpeg fontconfig
```

2. Clone repository:

```bash
git clone https://github.com/modhtom/QVM.git
cd quran-video-maker
```

3. Install dependencies:

```bash
npm install
```

4. Configure environment:

```bash
echo "PEXELS_API_KEY=your_key_here" >> .env
```

5. Install Arabic font:

```bash
wget https://example.com/Tasees_Regular.ttf
sudo cp Tasees_Regular.ttf /usr/share/fonts/
fc-cache -fv
```

6. Start server:

```bash
node index.js
```

### Docker Setup

```bash
docker build -t qvm .
docker run -p 3001:3001 -e PEXELS_API_KEY=your_key_here qvm
```

## API Integrations

1. **Al-Quran Cloud API**:

   - Verse text retrieval
   - Surah metadata
   - Recitation audio

2. **Pexels API**:

   - Background video search
   - HD video downloads
   - Keyword-based queries

3. **YouTube DL**:
   - Video downloading
   - Format conversion
   - Segment cropping

## Processing Workflow

1. **Input Handling**:

   - Receive video parameters (surah, verses, styling)
   - Validate input ranges
   - Fetch Quranic text

2. **Media Processing**:

   ```mermaid
   graph LR
   A[Audio Input] --> B(Audio Processing)
   C[Background] --> D(Video Processing)
   B --> E(Subtitle Sync)
   D --> E
   E --> F(FFmpeg Rendering)
   F --> G[Output Video]
   ```

3. **Output Generation**:
   - MP4 container format
   - H.264 video codec
   - AAC audio codec
   - ASS subtitle embedding

### Background Types

```javascript
// Background selection logic
if (pexelsQuery) {
  videoData = `pexels:${pexelsQuery}`;
} else if (imageUrl) {
  videoData = imageUrl;
} else if (youtubeUrl) {
  videoData = youtubeUrl;
} else {
  videoData = 1; // Default background
}
```

## Synchronization System

The tap-to-sync interface provides frame-accurate verse timing:

1. Audio player with playback controls
2. Real-time verse display
3. Progress tracking
4. Timing reset functionality
5. JSON timing export:

```json
"userVerseTimings": [
  {"start": 0.5, "end": 4.2},
  {"start": 4.3, "end": 8.1}
]
```

## Maintenance Features

1. **Automatic Cleanup**:

   - Temporary file removal
   - 24-hour video retention policy
   - Custom audio deletion after processing

2. **Error Handling**:

   - API failure fallbacks
   - Video generation monitoring
   - Filesystem validation

3. **Progress Tracking**:
   - Server-Sent Events (SSE)
   - 5-stage progress reporting:
     - Audio/text fetch (0-30%)
     - Background processing (30-40%)
     - Subtitle generation (40-50%)
     - Video rendering (50-90%)
     - Cleanup (90-100%)

## Requirements

### Core Dependencies

```txt
express
fluent-ffmpeg
axios
node-cache
music-metadata
youtube-dl-exec
cors
multer
fontconfig
```

### Optional Dependencies

```txt
docker@20.10+ (for containerization)
pexels-api-wrapper (for background search)
```

## API Documentation

### Request Example

```json
{
  "surahNumber": 36,
  "startVerse": 1,
  "endVerse": 12,
  "color": "#FF5733",
  "useCustomBackground": true,
  "videoNumber": "1",
  "edition": "ar.husary",
  "size": 24,
  "crop": "horizontal"
}
```

## Guidelines for Contributions

- Ensure that your changes are well-documented, especially for any new features or APIs.
- Write unit tests for new code to maintain functionality.
- Follow the existing coding style and conventions in the project.
- If your feature requires additional setup or dependencies, include them in the documentation.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgements

- [Fluent-FFMPEG](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) for video generation.
- [Al-Quran Cloud API](http://alquran.cloud/) for Quranic data.
- [Pexels](https://www.pexels.com/) for providing high-quality video content through their API.

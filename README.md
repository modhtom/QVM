# Quran Video Maker (QVM)

[![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg?style=for-the-badge)](./TO-DOs.md)
[![Open Source Love](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-lightgrey.svg?style=for-the-badge)](https://github.com/modhtom/QVM)
[![To-Do Tracker](https://img.shields.io/badge/Development%20Tasks-View%20TO--DOs-orange.svg?style=for-the-badge)](./TO-DOs.md)
[![Documentation](https://img.shields.io/readthedocs/java)](https://github.com/modhtom/QVM/blob/main/Documentation.md)

Quran Video Maker is a full-stack web application that enables users to create professional videos of Quranic verses with customizable backgrounds, multi-language text, selectable fonts, and precise audio synchronization. The system integrates multiple APIs and FFmpeg processing to generate videos in both horizontal and vertical formats.

## Key Features

### 1\. Multi-Source Backgrounds

- **AI-Generated Default:** When no background is selected, the application analyzes the meaning of the selected verses and automatically creates a beautiful video slideshow from relevant, high-quality images sourced from Unsplash.
- **Unsplash API:** Search for high-quality videos by keywords.
- **YouTube:** Use any YouTube video as a background OR upload your own.
- **Custom Images:** Provide a URL to any image OR upload your own.

---

### 2\. Audio Handling

- **Built-in Library:** Choose from a wide range of famous Quran reciters.
- **Custom Audio Uploads:** Upload your own recitation in MP3 or WAV format.
- **Enhanced Verse Synchronization:** A tap-to-sync interface featuring a **visual audio waveform** for high-precision timing of custom recitations.

---

### 3\. Video Generation

- **Full Surah & Custom Ranges:** Create videos for an entire Surah or a specific range of verses.
- **Format Control:** Generate videos in both horizontal (16:9) and vertical (9:16) formats suitable for any platform.
- **Automatic Verse Splitting:** Long verses are automatically broken into smaller, sequential chunks for improved readability.
- **Real-time Progress:** Track the video creation process live from the browser.
- **Automatic "Bismillah"** Automatically add "Bismillah" to the beginning of videos under the correct conditions.

---

### 4\. Text & Translation

- **Multi-Language Support:** Display verse translations (e.g., English, Spanish) and transliterations alongside the original Arabic text.
- **Typography:** Choose from high-quality Arabic fonts (e.g., Tasees, DTHULUTH).
- **Custom Positioning:** Users can now choose to display subtitles at the **Bottom** or the **Middle** of the screen.
- **Metadata Overlay:** Option to display the Surah Name and Reciter Name as an elegant overlay at the top of the video.
- **Styling:** Full control over font size (1-72px) and color.

---

### 5\. Video Management

- **Gallery:** Browse, preview, and manage all your created videos.
- **Download & Share:** Easily download videos or share them on social media.
- **Automatic Cleanup:** An automated system removes old video files to save space.

---

### 6\. Robust Job Processing

- **Background Job Queue:** Video generation requests are handled by a robust job queue powered by **BullMQ** and **Redis**. This prevents server overload from concurrent requests and ensures stable, one-by-one processing of resource-intensive tasks.
- **Real-time Job Progress:** The frontend receives live updates on the job's progress directly from the queue.

---

### 7\. AI & Manual Synchronization
- **AI Auto-Sync (New):** Uses **Groq API (Whisper Large v3)** to automatically listen to your custom audio recitation and synchronize it with the Quranic text word-for-word in seconds. No manual timing required!
- **Tap-to-Sync:** A fallback manual interface featuring a visual audio waveform for precise, human-controlled timing.

---

### 8\. Cloud-Native & Stateless
- **Cloud Storage:** Fully integrated with **Cloudflare R2** (S3-compatible). User uploads (audio/images) and generated videos are stored securely in the cloud.
- **Stateless Architecture:** The application does not rely on local disk storage for persistence, making it ready for containerized deployment (Docker/Kubernetes) on any platform.

---

## System Requirements

- Node.js v16+
- FFmpeg v5+
- FontConfig (Arabic fonts must be installed on the host system (e.g., `Tasees Regular`)).
- Redis v6+
- Docker
- Cloudflare R2 Bucket

## Installation

### Docker Setup (Recommended)

The easiest and most reliable way to run this project is with Docker Compose. It orchestrates the web server, background worker, and Redis database automatically.

1. **Install Docker and Docker Compose:** Ensure you have both installed on your system.

2. **Configure Environment:** Create a `.env` file in the root directory. You **must** provide your Unsplash Key, GROQ, and R2 Storage credentials:

   ```env
   UNSPLASH_ACCESS_KEY=your_key_here
   UNSPLASH_Secret_KEY=your_key_here
   R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=your_access_key_id
   R2_SECRET_ACCESS_KEY=your_secret_access_key
   R2_BUCKET_NAME=qvm-videos
   R2_PUBLIC_URL=https://pub-<id>.r2.dev
   GROQ_API_KEY=your_key_here
   ```

3. **Run the application:** Open a terminal in the project's root directory and run a single command:

   ```bash
   docker compose up --build
   ```

This command will:

- Build the Docker image for the application.

- Start the QVM container (running both the web server and the worker).

- Start a Redis container.

- Connect them on a shared network.

Your application will be available at `http://localhost:3001`. To stop the services, press `CTRL+C` in the same terminal.

### Local Setup (For Advanced Users)

1.  **Install Prerequisites:**

    ```bash
    # On Debian/Ubuntu
    sudo apt-get install ffmpeg fontconfig
    ```

2.  **Clone Repository:**

    ```bash
    git clone https://github.com/modhtom/QVM.git
    cd QVM
    ```

3.  **Install Dependencies:**

    ```bash
    npm install
    ```

4.  **Configure Environment:** Create a `.env` file in the root directory and add your UNSPLASH ACCESS KEY.

    ```bash
    UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
    ```

5.  **Install Fonts:**

    - Create a directory named `fonts` in the root of the project.
    - Download the required Arabic fonts (e.g., Tasees, Amiri).
    - Place the font files (`.ttf`) inside the new `fonts` directory.

6.  **Start Redis:** The easiest method is with Docker.

    ```bash
    docker run --name qvm-redis -p 6379:6379 -d redis
    ```

7.  **Start Server & Worker:**

- Open a terminal window and run:

    ```bash
    npm run start
    ```

- Or you can open two separate terminal windows.

    In the first terminal, start the main web server:

    ```bash
    node index.js
    ```

    In the second terminal, start the video processing worker:

    ```bash
    node worker.js
    ```

---

## Synchronization System

The tap-to-sync interface provides frame-accurate verse timing for custom audio files.

1.  **Visual Audio Waveform:** Makes it easy to identify pauses and time verses accurately.
2.  **Real-time Verse Display:** Shows the current verse to be synchronized.
3.  **Playback Controls:** Play, pause, and seek through the audio.
4.  **Timing Export:** The generated timings are automatically used to create the final video.
    ```json
    "userVerseTimings": [
      {"start": 0.5, "end": 4.2},
      {"start": 4.3, "end": 8.1}
    ]
    ```

## API Documentation

### Request Example

The following is an example of the JSON data sent to the server to generate a video.

```json
{
  "surahNumber": 2,
  "startVerse": 255,
  "endVerse": 255,
  "edition": "ar.alafasy",
  "color": "#FFFF00",
  "size": 28,
  "fontName": "Amiri",
  "translationEdition": "en.sahih",
  "transliterationEdition": "en.sahih",
  "useCustomBackground": true,
  "videoNumber": "unsplash:space",
  "crop": "horizontal",
  "removeFiles":"y",
  "customAudioPath":"/AUDIO/NAME.mp3"
}
```

## API Integrations

### 1\. Quran APIs

##### Al-Quran Cloud API
- **Verse Text Retrieval**: Fetches Arabic text, translations, and transliterations.
- **Surah Metadata**: Gathers information about each surah, such as the number of verses.
- **Recitation Audio**: Provides access to a wide library of recitation audio files.

##### MP3Quran API
- **Verse Text Retrieval**: Fetches Arabic text, translations, and transliterations.
- **Recitation Audio**: Provides access to a wide library of recitation audio files.

---

### 2\. Unsplash API

- **Background Video Search**: Finds high-quality stock videos based on keyword queries.
- **HD Video Downloads**: Downloads video files for use as backgrounds.

---

### 3\. YouTube DL

- **Video Downloading**: Downloads videos from YouTube URLs to be used as backgrounds.
- **Format Conversion**: Handles various video formats and standardizes them for processing.

---

## Processing Workflow

1.  **Job Creation**: The Express server receives video parameters, creates a job with this data, and adds it to the **video-queue** in Redis. It immediately responds to the user with a `jobId`.
2.  **Background Processing**: The `worker.js` process, running independently, picks up the job from the queue. It fetches the required data from APIs, processes media, and generates the video using FFmpeg.
3.  **Progress Tracking**: As the worker processes the job, it sends progress updates back to the queue. The frontend client can poll an endpoint using the `jobId` to get these real-time updates.
4.  **Completion**: Once the video is rendered, the worker marks the job as complete. The user can then view and download the final video.

    ```mermaid
    graph TD
        subgraph Client ["Client Side"]
            UI[User Interface]
            Poll[Polling Service]
        end

        subgraph Server ["Web Server (Express)"]
            API[API Endpoints]
            Upload[Multer Upload]
        end

        subgraph Cloud ["Cloud Infrastructure"]
            R2[(Cloudflare R2 Storage)]
            Redis[(Redis Queue)]
        end

        subgraph WorkerNode ["Worker Service"]
            Worker[Job Processor]
            AutoSync[AI Auto-Sync]
            FFmpeg[Video Rendering]
        end

        subgraph External ["External APIs"]
            Groq[Groq AI - Whisper]
            QuranAPI[Al-Quran Cloud]
            Unsplash[Unsplash API]
        end

        UI -->|1. Upload Audio/Bg| Upload
        Upload -->|2. Stream to Cloud| R2
        Upload -->|3. Add Job - ref keys| Redis
        
        Redis -->|4. Trigger| Worker
        Worker -->|5. Download Assets| R2
        
        Worker -->|6. Fetch Text| QuranAPI
        Worker -->|7. Fetch Images| Unsplash
        
        Worker -->|8. Transcribe Audio| AutoSync
        AutoSync <-->|9. Get Timestamps| Groq
        
        Worker -->|10. Render Video| FFmpeg
        FFmpeg -->|11. Upload Result| R2
        
        Worker -->|12. Update Status| Redis
        Poll <-->|13. Check Status| API
        UI -->|14. Stream/Download| R2
    ```

---

## Maintenance Features

- **Automatic Cleanup**: Temporary files are removed after each video is created. Final videos are kept for 24 hours before being automatically deleted to conserve server space.
- **Error Handling**: The system includes fallbacks for API failures and validates file system operations to ensure stability.
- **Progress Tracking**: Video generation progress is streamed to the client using **Server-Sent Events (SSE)**, providing a real-time status update through the following stages:
  1.  Fetching Audio & Text (0-30%)
  2.  Preparing Background (30-40%)
  3.  Generating Subtitles (40-50%)
  4.  Rendering Video (50-90%)
  5.  Cleaning Up (90-100%)

---

## Requirements

## Core Dependencies

```text
express
fluent-ffmpeg
axios
node-cache
music-metadata
youtube-dl-exec
cors
multer
bullmq
ioredis
```

### Front-End Libraries

- **Wavesurfer.js**: Used for rendering the visual audio waveform in the synchronization interface.

---

## Guidelines for Contributions

- Ensure that your changes are well-documented, especially for any new features or APIs.
- Write unit tests for new code to maintain functionality.
- Follow the existing coding style and conventions in the project.
- If your feature requires additional setup or dependencies, include them in the documentation.

---

## Developer Roadmap & To-Do List

If you're looking to contribute or understand current development priorities, check the **[`TO-DOs.md`](./TO-DOs.md)** file.
It outlines:

- **Critical Bugs & Fixes**: Known issues that need immediate attention.
- **Refactoring Goals**: Areas of the backend and frontend that require cleanup or modularization.
- **Performance Improvements**: FFmpeg optimization, caching, and cloud storage migration.
- **Planned Features**: Account systems, live previews, font uploads, and enhanced text rendering.
- **Hosting & Deployment**: Migration roadmap from local file storage to scalable cloud infrastructure.

> **Tip for New Contributors:** Start with medium-priority items in `TO-DOs.md` (e.g., refactoring or frontend cleanup) to familiarize yourself with the codebase before tackling core bugs or backend logic.

---

## License

This project is licensed under **CUSTOM License**. See the `LICENSE` file for details.

---

## Acknowledgements

- [Fluent-FFMPEG](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) for its powerful video manipulation library.
- [Al-Quran Cloud API](http://alquran.cloud/) for providing comprehensive Quranic data.
- [MP3Quran API](https://www.mp3quran.net/ar/api) for providing comprehensive Quranic data.
- [Unsplash](https://www.Unsplash.com/) for its library of high-quality video content.
- [BullMQ](https://bullmq.io/) for its robust and efficient job queue system.

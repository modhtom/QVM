# Quran Video Maker (QVM)

Quran Video Maker is a full-stack web application that enables users to create professional videos of Quranic verses with customizable backgrounds, multi-language text, selectable fonts, and precise audio synchronization. The system integrates multiple APIs and FFmpeg processing to generate videos in both horizontal and vertical formats.

## Key Features

### 1\. Multi-Source Backgrounds

- **AI-Generated Default:** When no background is selected, the application analyzes the meaning of the selected verses and automatically creates a beautiful video slideshow from relevant, high-quality images sourced from Unsplash.
  > NOTE:Surah themes and verse context are commented out for now will be fully added soon
- **Pexels API:** Search for high-quality videos by keywords.
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
- **Advanced Text Styling:** Choose from multiple Arabic fonts, control font size (1-72px), and select any color using a color picker.
- **Verse-by-Verse Timing:** Manually adjust the timing for each verse or verse segment.

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

## System Requirements

- Node.js v16+
- FFmpeg v5+
- FontConfig (for Arabic text rendering on the server)
- Redis v6+
- Docker (Recommended for Redis)

## Installation

### Local Setup

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

4.  **Configure Environment:** Create a `.env` file in the root directory and add your Pexels API key and UNSPLASH ACCESS KEY.

    ```bash
    PEXELS_API_KEY=your_pexels_key_here
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

7.  **Start Server & Worker:** Open two separate terminal windows.

    In the first terminal, start the main web server:

    ```bash
    node index.js
    ```

    In the second terminal, start the video processing worker:

    ```bash
    node worker.js
    ```

---

### Docker Setup

```bash
docker build -t qvm .
docker run -p 3001:3001 -v $(pwd)/Output_Video:/app/Output_Video -e PEXELS_API_KEY=your_key_here qvm
```

_Note: The Docker setup will need to be updated to run the server and worker processes concurrently._

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
  "useCustomBackground": true,
  "videoNumber": "pexels:space",
  "crop": "horizontal"
}
```

## API Integrations

### 1\. Al-Quran Cloud API

- **Verse Text Retrieval**: Fetches Arabic text, translations, and transliterations.
- **Surah Metadata**: Gathers information about each surah, such as the number of verses.
- **Recitation Audio**: Provides access to a wide library of recitation audio files.

---

### 2\. Pexels API

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
        A[User Request] --> B{Express Server};
        B --> |1. Add Job| C[Redis Queue];
        C --> |2. Pick up Job| D[Worker Process];
        D --> |3. Process Video| E[FFmpeg Rendering];
        E --> |4. Mark as Complete| C;
        F[User's Browser] <-->|Poll for Status| B;
        F -->|On Complete| G[Download Video];
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

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---

## Acknowledgements

- [Fluent-FFMPEG](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) for its powerful video manipulation library.
- [Al-Quran Cloud API](http://alquran.cloud/) for providing comprehensive Quranic data.
- [Pexels](https://www.pexels.com/) for its library of high-quality video content.
- [BullMQ](https://bullmq.io/) for its robust and efficient job queue system.

# Quran Video Maker (QVM)

Quran Video Maker is a full-stack web application that enables users to create professional videos of Quranic verses with customizable backgrounds, multi-language text, selectable fonts, and precise audio synchronization. The system integrates multiple APIs and FFmpeg processing to generate videos in both horizontal and vertical formats.

## Key Features

### 1\. Multi-Source Backgrounds

- **Pexels API:** Search for high-quality videos by keywords.
- **YouTube:** Use any YouTube video as a background.
- **Custom Images:** Provide a URL to any image.
- **Default Library:** Use the built-in background video.

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

## System Requirements

- Node.js v16+
- FFmpeg v5+
- FontConfig (for Arabic text rendering on the server)
- Docker (Optional)

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

4.  **Configure Environment:** Create a `.env` file in the root directory and add your Pexels API key.

    ```bash
    echo "PEXELS_API_KEY=your_key_here" >> .env
    ```

5.  **Install Fonts:**

    - Create a directory named `fonts` in the root of the project.
    - Download the required Arabic fonts (e.g., Tasees, Amiri).
    - Place the font files (`.ttf`) inside the new `fonts` directory.

6.  **Start Server:**

    ```bash
    node index.js
    ```

---

### Docker Setup

```bash
docker build -t qvm .
docker run -p 3001:3001 -v $(pwd)/Output_Video:/app/Output_Video -e PEXELS_API_KEY=your_key_here qvm
```

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

1.  **Input Handling**: The system receives video parameters from the user, including the surah, verse range, and all styling options. It fetches the required Quranic text and audio data from the Al-Quran Cloud API.

2.  **Media Processing**: The background is prepared (downloaded from Pexels/YouTube or loaded from the library), and the subtitle file is generated with precise timings.

    ```mermaid
    graph LR
       A[Audio Input] --> B(Audio Processing);
       C[Background Source] --> D(Video Processing);
       B --> E(Subtitle & Timing Generation);
       D --> E;
       E --> F(FFmpeg Rendering);
       F --> G[Output Video];
    ```

3.  **Output Generation**: **FFmpeg** renders the final video by combining the processed background, the recitation audio, and the styled subtitles. The output is a standard **MP4** file (`H.264`/`AAC`).

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

### Core Dependencies

```text
express
fluent-ffmpeg
axios
node-cache
music-metadata
youtube-dl-exec
cors
multer
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

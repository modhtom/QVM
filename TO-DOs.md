## To-Do List

### Urgent: Bugs & Critical Fixes

1.  **Resolve File Path and Storage Issues**: The application relies heavily on the local filesystem. This will fail on modern hosting platforms with ephemeral storage and doesn't scale.

### High Priority: Performance & Refactoring

1.  **Refactor Backend Code**: Consolidate redundant logic in `video.js`, break down monolithic functions, and centralize configuration.
2.  **Refactor Frontend Code**: Reduce code duplication between `fullVideo.js` and `partialVideo.js`, and manage application state more effectively instead of using global variables.
3.  **Optimize FFmpeg Commands**: Fine-tune FFmpeg settings for a better balance of speed and quality, and make hardware acceleration more robust.
4.  **Implement Caching for API Calls**: Cache responses from the Al-Quran Cloud API (for text/metadata) and Unsplash/Pexels to reduce latency and avoid rate-limiting.

### Medium Priority: New Features

1.  **Implement User Accounts**: Create a system for users to register, log in, and manage their own private video galleries.
2.  **Add a Static Preview Feature**: Generate a single image preview of a verse with the selected styling _before_ starting the time-consuming video render.
3.  **Enhance Text and Subtitle Customization**: Allow users to customize subtitle position, add outlines/shadows, and support more fonts.
4.  **Improve AI Background Generation**: Refine the keyword extraction and add more diverse and context-aware image sources.

### Low Priority: Future Enhancements

1.  **Introduce Intro/Outro Templates**: Allow users to add a custom "Bismillah" intro or a concluding slide.
2.  **Expand Translation and Reciter Library**: Integrate more language and reciter options.

---

## Bugs and Errors

### 1. Frontend Logic

- **Incorrect Custom Audio Handling**: In `fullVideo.js` and `partialVideo.js`, the logic incorrectly tries to find and submit form elements (like Pexels URL) even when a custom audio file is provided and a separate flow is intended. This leads to incorrect data being sent to the backend.
- **Event Listener on Non-Existent Element**: In `main.js`, an event listener is attached to `document.getElementById('fontName')`, but this ID doesn't exist in the HTML. The correct IDs are `fontNameFull`, `fontNamePart`, etc. This is dead code.
- **Duplicate CSS & HTML**: `main.css` and `index.html` contain many duplicated style blocks and elements, increasing file size and making maintenance difficult.

### 2. Backend Logic

- **Unsafe File Paths**: In `video.js`, the `subPath` variable is used directly in an FFmpeg `videoFilter` command. While special characters are escaped, this is risky. A malformed `fontName` could potentially break the command.
- **Race Condition on File Deletion**: In `video.js`, `deleteVidData` is called immediately after the FFmpeg process resolves its promise. However, the file stream might not be fully closed by the OS, which could cause the deletion to fail intermittently.
- **Failing Unsplash Search**: In `background.js`, the Unsplash search queries are commented out, meaning the AI background feature will always fall back to the generic `islamic spiritual landscape` query instead of using verse-specific keywords.

---

## Performance Optimization

- **Optimize FFmpeg**: The current hardware acceleration check is basic.use a small library like `ffmpeg-hardware-acceleration-helper` to reliably detect the best available encoder (`vaapi`, `nvenc`, `videotoolbox`) and apply the correct pixel formats (`pix_fmt`) automatically.
- **Stream, Don't Write**: The process of creating the final recitation audio involves saving multiple small `.mp3` files to disk and then merging them with FFmpeg.Do this entirely in memory by streaming the downloaded audio buffers directly to FFmpeg's `stdin`, avoiding slow disk I/O.
- **Cache API Responses**: In `data.js`, cache audio files, which is excellent. should apply the same logic for text, translation, and Surah metadata API calls using `node-cache` to reduce external network requests.
- **Use WebP for Images**: When generating AI backgrounds from Unsplash, download images as `.webp` instead of `.jpg`. They are smaller and will download faster, shortening the image fetching step.

---

## Code Refactoring

The code is functional but could be more maintainable.

- **Consolidate Video Generation Logic**: `generateFullVideo` and `generatePartialVideo` in `video.js` share about 90% of their code. They can be merged into a single `generateVideo` function that accepts a `params` object, with a small pre-processing step to calculate the `endVerse` for the "full Surah" case.
- **Create a Config File**: Move hardcoded values like `MAX_CHARS_PER_LINE`, API endpoints, and default font settings into a separate `config.js` file.
- **Abstract Frontend Handlers**: The `handleFullVideoSubmit` and `handlePartialVideoSubmit` functions are nearly identical. Create a single `handleVideoSubmit(formType)` function that reads values based on the `formType` (`'full'` or `'partial'`) to eliminate code duplication.
- **Use a Central State Manager on Frontend**: Instead of using global variables like `window.tempVideoFormData`, consider a simple state management object to hold form data and application state. This makes data flow predictable and easier to debug.

---

## New Features

- **Live Preview**: Before starting a job, generate and display a single static image (`ffmpeg -i background.mp4 -vf "subtitles=sub.ass" -vframes 1 preview.jpg`) to show the user exactly how the text style and color will look on their chosen background.
- **Font Upload**: Allow users to upload their own `.ttf` or `.otf` font files for maximum customization.
- **Voiceover Mode**: Add an option to generate a video with only translation text displayed, synchronized with an English (or other language) narration audio track.

---

## User Accounts

Implementing user accounts will make the gallery feature much more useful.

1.  **Backend Setup**:
    - Choose a database. For simplicity and a generous free tier, **MongoDB Atlas** or **Supabase** (PostgreSQL) are great options.
    - Add user routes (`/register`, `/login`). Use `bcrypt` to hash passwords and `jsonwebtoken` (JWT) to manage sessions.
    - Modify the video generation logic to associate each video file with a `userId`. The `/api/videos` endpoint should only return videos belonging to the authenticated user.
2.  **Frontend Setup**:
    - Create simple Register and Login pages/modals.
    - On successful login, store the received JWT in `localStorage`.
    - Attach the JWT as an `Authorization: Bearer <token>` header to all authenticated API requests (like generating videos or fetching the gallery).
    - Add a "Logout" button that clears the token from `localStorage`.

---

## Hosting and Deployment

The biggest challenge for hosting is the reliance on a local filesystem for temporary files and video output.

### Step 1: Switch to Cloud Storage

**must** replace local file storage with a cloud provider. **Cloudflare R2** is an excellent choice because it's S3-compatible and has **zero egress fees**, making it the cheapest option for serving video files.

- **Refactor Code**: Use the `aws-sdk` (for S3-compatible services) to upload generated videos to your R2 bucket instead of writing to `./Output_Video`.
- **Serve Videos**: Change the `/videos/:video` endpoint to redirect to the public URL of the video file in your R2 bucket.

### Step 2: Choose a Hosting Platform

> still searching

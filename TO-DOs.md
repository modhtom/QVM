## To-Do List

### High Priority:

1. Fix unsplash image picker to make all background videos/images HALAL 100%.

### Medium Priority: New Features

1.  **Add a Static Preview Feature**: Generate a single image preview of a verse with the selected styling _before_ starting the time-consuming video render.
2.  **Enhance Text and Subtitle Customization**: Support more fonts and Allow users to upload their own font.
3.  **Voiceover Mode**: Add an option to generate a video with only translation text displayed.

---

## New Features

- **Live Preview**: Before starting a job, generate and display a single static image (`ffmpeg -i background.mp4 -vf "subtitles=sub.ass" -vframes 1 preview.jpg`) to show the user exactly how the text style and color will look on their chosen background.
- **Font Upload**: Allow users to upload their own `.ttf` or `.otf` font files for maximum customization.
- **Voiceover Mode**: Add an option to generate a video with only translation text displayed, synchronized with an English (or other language) narration audio track.

---

## Hosting and Deployment

The biggest challenge for hosting is the reliance on a local filesystem for temporary files and video output.

### Choose a Hosting Platform

> still searching

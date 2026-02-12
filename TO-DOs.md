## To-Do List

### Urgent:

1.  **Implement User Accounts**: Create a system for users to register, log in, and manage their own private video galleries.

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

### Choose a Hosting Platform

> still searching

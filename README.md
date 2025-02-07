# Quran Video Generator

The Quran Video Generator is a versatile web application designed to help users create personalized videos of Quranic verses. For instance, an educator might use the app to produce a visually appealing video of Surah Al-Fatiha with a custom background and recitation, enhancing learning for their students. Users can generate videos for specific verses or entire chapters, customizing them with unique backgrounds, text colors, and various recitation options.

## Features

- **Generate Partial Videos**: Select specific verses to generate a video.
- **Generate Full Surah Videos**: Generate videos for entire chapters.
- **Customization**: Choose text color, background (Video/Image/Pexels search), and Quranic recitation edition.
- **Pexels Integration**: Search and use high-quality background videos using descriptive keywords related to verses or custom queries.
- **Live Progress Updates**: Real-time updates on video generation progress.
- **Video Management**: List and access generated videos.

## Prerequisites

- Node.js and npm installed on your system.
- FFMPEG installed and available in the system PATH.
- Pexels API key (free) - [Get it here](https://www.pexels.com/api/)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/quran-video-generator.git
   cd quran-video-generator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Install the **DecoType Thuluth II** font on your system to apply it to the subtitle in the final video.

4. Get Pexels API Key:
   - Visit [Pexels API Portal](https://www.pexels.com/api/)
   - Create a free account
   - Create a new application to get your API key
   - Open `background.js` and set your API key for the `PEXELS_API_KEY` variable.

## Using Docker

This project comes with a pre-configured `Dockerfile`, which allows you to run the application in a containerized environment. Follow the steps below to use Docker:

1. **Build the Docker image**:

   ```bash
   docker compose up --build
   ```

   This will build the Docker image and set up the application inside a container.

2. **Run the application in a container**:

   After building the image, you can run the application using:

   ```bash
   docker compose up
   ```

   This will start the application and expose it on port `3001`. You can access it at:

   ```plaintext
   http://localhost:3001
   ```

   Docker handles all dependencies and environment configurations, so you do not need to worry about local setup.

## Running the Application

1. Start the server:

   ```bash
   node index.js
   ```

2. Access the application in your browser at:
   ```plaintext
   http://localhost:3001
   ```

## API Endpoints

### 1. **GET** `/`

Serves the main application interface.

### 2. **GET** `/videos`

Returns a list of available videos in the `Output_Video` directory.

### 3. **POST** `/generate-partial-video`

Generates a video for a specific range of verses.

#### Request Body

```json
{
  "surahNumber": 1,
  "startVerse": 1,
  "endVerse": 7,
  "removeFilesAfterCreation": false,
  "color": "#ffffff",
  "useCustomBackground": true,
  "videoNumber": 1,
  "edition": "ar.alafasy"
}
```

### 4. **POST** `/generate-full-video`

Generates a video for the full Surah.

#### Request Body

```json
{
  "surahNumber": 1,
  "removeFilesAfterCreation": false,
  "color": "#ffffff",
  "useCustomBackground": true,
  "videoNumber": 1,
  "edition": "ar.alafasy"
}
```

### 5. **GET** `/progress`

Streams live progress updates of video generation. This feature does not require additional setup, as it is fully integrated into the application's backend.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add new feature"
   ```
4. Push to your branch:
   ```bash
   git push origin feature-name
   ```
5. Submit a pull request.

### Guidelines for Contributions

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

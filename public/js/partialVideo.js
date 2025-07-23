export async function handlePartialVideoSubmit(e) {
  e.preventDefault();

  let formData = {};
  let customAudioFile = null;
  let userVerseTimings = null;

  // Check if this call is coming from the Tap-to-Sync flow
  if (e.detail && e.detail.customAudioFile) {
    formData = {
      surahNumber: e.detail.surahNumber,
      startVerse: e.detail.startVerse,
      endVerse: e.detail.endVerse,
      edition: e.detail.edition,
      color: e.detail.color,
      size: e.detail.size,
      useCustomBackground: e.detail.useCustomBackground,
      videoNumber: e.detail.videoNumber,
      crop: e.detail.crop,
    };
    customAudioFile = e.detail.customAudioFile;
    userVerseTimings = e.detail.userVerseTimings;
  } else {
    const isVertical = document.getElementById("verticalVideoPart")?.checked;
    const crop = isVertical ? "horizontal":"vertical";

    const surahNumber = document.getElementById("surahNumber").value;
    const startVerse = parseInt(document.getElementById("startVerse").value);
    const endVerse = parseInt(document.getElementById("endVerse").value);
    const edition = document.getElementById("edition").value;
    const color = document.getElementById("fontColorPart").value;
    const size = document.getElementById("fontSizePart").value;

    let videoData = 1;
    const pexelsQuery = document.getElementById("pexelsVideoPart")?.value;
    const imageUrl = document.getElementById("imageLinkPart")?.value;
    const youtubeUrl = document.getElementById("youtubeLinkPart")?.value;

    if (pexelsQuery) {
      videoData = `pexels:${pexelsQuery}`;
    } else if (imageUrl) {
      videoData = imageUrl;
    } else if (youtubeUrl) {
      videoData = youtubeUrl;
    }

    formData = {
      surahNumber,
      startVerse,
      endVerse,
      edition,
      color,
      useCustomBackground: videoData !== 1,
      removeFilesAfterCreation: true,
      videoNumber: videoData,
      size,
      crop
    };
  }

  try {
    let audioPath = null;
    if (customAudioFile) {
      // Upload audio file if it's custom
      const audioFormData = new FormData();
      audioFormData.append('audio', customAudioFile);
      
      const uploadResponse = await fetch('/upload-audio', {
        method: 'POST',
        body: audioFormData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload audio');
      }
      const uploadData = await uploadResponse.json();
      audioPath = uploadData.audioPath;
    }

    const requestBody = {
      ...formData,
      customAudioPath: audioPath,
      userVerseTimings: userVerseTimings // Pass user-provided timings
    };
    console.log("Request body:", requestBody);
    const response = await fetch("/generate-partial-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      const videoElement = document.getElementById("previewVideo");
      videoElement.src = `/videos/${data.vidPath}`;
      videoElement.setAttribute('data-filename', data.vidPath);
      if (window.showPage) {
        window.showPage("videoPreview");
      } else {
        console.error("showPage function not found");
      }
    } else {
      throw new Error("Failed to generate video");
      throw new Error("Failed to generate video");
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
    alert(`Error: ${error.message}`);
  }
}

export async function handleFullVideoSubmit(e) {
  e.preventDefault();

  let formData = {};
  let customAudioFile = null;
  let userVerseTimings = null;

  // Check if this call is coming from the Tap-to-Sync flow
  if (e.detail && e.detail.customAudioFile) {
    formData = {
      surahNumber: e.detail.surahNumber,
      edition: e.detail.edition,
      color: e.detail.color,
      size: e.detail.size,
      useCustomBackground: e.detail.useCustomBackground,
      videoNumber: e.detail.videoNumber,
      crop: e.detail.crop,
      // Add start/end verse if they were part of the tempVideoFormData
      startVerse: e.detail.startVerse, 
      endVerse: e.detail.endVerse 
    };
    customAudioFile = e.detail.customAudioFile;
    userVerseTimings = e.detail.userVerseTimings;
  } else {
    // Original form submission for built-in audio
    const isVertical = document.getElementById("verticalVideoFull")?.checked;
    const crop = isVertical ? "horizontal" : "vertical";

    const surahNumber = document.getElementById("fullSurahNumber").value;
    const edition = document.getElementById("fullEdition").value;
    const color = document.getElementById("fontColor").value;
    const size = document.getElementById("fontSize").value;

    let videoData = 1;
    const pexelsQuery = document.getElementById("pexelsVideo")?.value;
    const imageUrl = document.getElementById("imageLink")?.value;
    const youtubeUrl = document.getElementById("youtubeLink")?.value;

    if (pexelsQuery) {
      videoData = `pexels:${pexelsQuery}`;
    } else if (imageUrl) {
      videoData = imageUrl;
    } else if (youtubeUrl) {
      videoData = youtubeUrl;
    }

    formData = {
      surahNumber,
      edition,
      color,
      useCustomBackground: videoData !== 1,
      removeFilesAfterCreation: true,
      videoNumber: videoData,
      size,
      crop,
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

    const response = await fetch("/generate-full-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      const videoElement = document.getElementById("previewVideo");
      videoElement.src = `/videos/${data.vidPath}`;
      videoElement.setAttribute('data-filename', data.vidPath);
      window.showPage("videoPreview");
    } else {
      throw new Error("Failed to generate video");
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

export async function handlePartialVideoSubmit(e) {
  e.preventDefault();

  let requestBody = {};
  const customAudioFile = e.detail?.customAudioFile;
  const isCustomFlow = !!customAudioFile;
  const formPrefix = isCustomFlow ? "PartCustom" : "Part";
  const subtitlePosition = document.getElementById(`subtitlePosition${formPrefix}`)?.value || 'bottom';
  const showMetadata = document.getElementById(`showMetadata${formPrefix}`)?.checked || false;

  if (customAudioFile) {
    requestBody = { ...e.detail };
    requestBody.subtitlePosition = subtitlePosition;
    requestBody.showMetadata = showMetadata;
    const audioFormData = new FormData();
    audioFormData.append('audio', customAudioFile);
    try {
      const uploadResponse = await fetch('/upload-audio', { method: 'POST', body: audioFormData });
      if (!uploadResponse.ok) throw new Error('Failed to upload audio');
      const uploadData = await uploadResponse.json();
      requestBody.customAudioPath = uploadData.audioPath;
    } catch (error) {
      return alert(`Error: ${error.message}`);
    }
  } else {
    const backgroundUploadInput = document.getElementById("backgroundUploadPart");
    let uploadedBackgroundPath = null;
    if (backgroundUploadInput?.files[0]) {
      const backgroundFile = backgroundUploadInput.files[0];
      const backgroundFormData = new FormData();
      backgroundFormData.append('backgroundFile', backgroundFile);
      try {
        const uploadResponse = await fetch('/upload-background', { method: 'POST', body: backgroundFormData });
        if (!uploadResponse.ok) throw new Error('Background upload failed');
        const uploadData = await uploadResponse.json();
        uploadedBackgroundPath = uploadData.backgroundPath;
      } catch (error) {
        return alert(`Error uploading background: ${error.message}`);
      }
    }
    
    const isVertical = document.getElementById("verticalVideoPart")?.checked;
    const pexelsQuery = document.getElementById("pexelsVideoPart")?.value;
    const imageUrl = document.getElementById("imageLinkPart")?.value;
    const youtubeUrl = document.getElementById("youtubeLinkPart")?.value;

    let videoData = 1, useCustomBg = false;
    if (uploadedBackgroundPath) {
      videoData = uploadedBackgroundPath; useCustomBg = true;
    } else if (pexelsQuery) {
      videoData = `unsplash:${pexelsQuery}`; useCustomBg = true;
    } else if (imageUrl) {
      videoData = imageUrl; useCustomBg = true;
    } else if (youtubeUrl) {
      videoData = youtubeUrl; useCustomBg = true;
    }

    requestBody = {
      surahNumber: document.getElementById("surahNumber").value,
      startVerse: parseInt(document.getElementById("startVerse").value),
      endVerse: parseInt(document.getElementById("endVerse").value),
      edition: document.getElementById("edition").value,
      color: document.getElementById("fontColorPart").value,
      size: document.getElementById("fontSizePart").value,
      fontName: document.getElementById("fontNamePart").value,
      translationEdition: document.getElementById("translationEditionPart").value,
      crop: isVertical ? "vertical" : "horizontal",
      useCustomBackground: useCustomBg,
      videoNumber: videoData,
      removeFilesAfterCreation: true,
      subtitlePosition,
      showMetadata
    };
  }

  try {
    console.log("Submitting job with data:", requestBody);
    const response = await fetch("/generate-partial-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 202) {
      const data = await response.json();
      alert("بدأ إنتاج الفيديو! سيتم إعلامك عند اكتماله.");
      window.pollJobStatus(data.jobId);
      window.showPage('mainMenu');
    } else {
      const errorText = await response.text();
      throw new Error(`Failed to queue video generation: ${errorText}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}
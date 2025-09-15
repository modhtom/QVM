export async function handleFullVideoSubmit(e) {
  e.preventDefault();

  let requestBody = {};
  const customAudioFile = e.detail?.customAudioFile;
  const isCustomFlow = !!customAudioFile;

  if (isCustomFlow) {
    requestBody = { ...e.detail };
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
    const formPrefix = isCustomFlow ? "FullCustom" : "";
    const backgroundUploadInput = document.getElementById(`backgroundUpload${formPrefix}`);
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
    
    const isVertical = document.getElementById(`verticalVideo${formPrefix}`)?.checked;
    const pexelsQuery = document.getElementById(`pexelsVideo${formPrefix}`)?.value;
    const imageUrl = document.getElementById(`imageLink${formPrefix}`)?.value;
    const youtubeUrl = document.getElementById(`youtubeLink${formPrefix}`)?.value;

    let videoData = 1, useCustomBg = false;
    if (uploadedBackgroundPath) {
      videoData = uploadedBackgroundPath; useCustomBg = true;
    } else if (pexelsQuery) {
      videoData = `pexels:${pexelsQuery}`; useCustomBg = true;
    } else if (imageUrl) {
      videoData = imageUrl; useCustomBg = true;
    } else if (youtubeUrl) {
      videoData = youtubeUrl; useCustomBg = true;
    }

    requestBody = {
      surahNumber: document.getElementById(`fullSurahNumber${formPrefix}`).value,
      edition: document.getElementById(`fullEdition${formPrefix}`)?.value,
      color: document.getElementById(`fontColor${formPrefix}`).value,
      size: document.getElementById(`fontSize${formPrefix}`).value,
      fontName: document.getElementById(`fontName${formPrefix}`).value,
      translationEdition: document.getElementById(`translationEdition${formPrefix}`).value,
      crop: isVertical ? "vertical" : "horizontal",
      useCustomBackground: useCustomBg,
      videoNumber: videoData,
      removeFilesAfterCreation: true,
    };
  }

  try {
    console.log("Submitting job with data:", requestBody);
    const response = await fetch("/generate-full-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 202) {
      const data = await response.json();
      alert("Video generation has started! You will be notified when it's complete.");
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
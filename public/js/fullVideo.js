export async function handleFullVideoSubmit(e) {
  e.preventDefault();
  console.log("handleFullVideoSubmit triggered.");

  const isCustomFlow = (e.detail && e.detail.customAudioFile);
  const backgroundUploadInput = document.getElementById(isCustomFlow ? "backgroundUploadFullCustom" : "backgroundUploadFull");
  const customAudioFile = isCustomFlow ? e.detail.customAudioFile : null;
  let userVerseTimings = isCustomFlow ? e.detail.userVerseTimings : null;
  let uploadedBackgroundPath = null;


  if (backgroundUploadInput && backgroundUploadInput.files[0]) {
    const backgroundFile = backgroundUploadInput.files[0];
    const backgroundFormData = new FormData();
    backgroundFormData.append('backgroundFile', backgroundFile);

    try {
      console.log("Uploading background for full video...");
      const uploadResponse = await fetch('/upload-background', {
        method: 'POST',
        body: backgroundFormData
      });

      if (!uploadResponse.ok) throw new Error('Background upload failed');
      const uploadData = await uploadResponse.json();
      uploadedBackgroundPath = uploadData.backgroundPath;
      console.log("Background uploaded to:", uploadedBackgroundPath);

    } catch (error) {
      alert(`Error uploading background: ${error.message}`);
      return;
    }
  }

  let formData;
  if (isCustomFlow) {
    console.log("Custom audio flow detected.");
    formData = { ...e.detail };
    if (uploadedBackgroundPath) {
      formData.videoNumber = uploadedBackgroundPath;
      formData.useCustomBackground = true;
    }
  } else {
    console.log("Standard form flow detected.");
    const isVertical = document.getElementById("verticalVideoFull")?.checked;
    
    formData = {
      surahNumber: document.getElementById("fullSurahNumber").value,
      edition: document.getElementById("fullEdition").value,
      color: document.getElementById("fontColor").value,
      size: document.getElementById("fontSize").value,
      fontName: document.getElementById("fontNameFull").value,
      translationEdition: document.getElementById("translationEditionFull").value,
      crop: isVertical ? "vertical" : "horizontal",
      useCustomBackground: false,
      videoNumber: 1,
      removeFilesAfterCreation: true,
    };

    const pexelsQuery = document.getElementById("pexelsVideo")?.value;
    const imageUrl = document.getElementById("imageLink")?.value;
    const youtubeUrl = document.getElementById("youtubeLink")?.value;

    if (uploadedBackgroundPath) {
      console.log("OVERRIDING DEFAULTS: Using uploaded background.");
      formData.useCustomBackground = true;
      formData.videoNumber = uploadedBackgroundPath;
    } else if (pexelsQuery) {
      console.log("OVERRIDING DEFAULTS: Using Pexels background.");
      formData.useCustomBackground = true;
      formData.videoNumber = `pexels:${pexelsQuery}`;
    } else if (imageUrl) {
      console.log("OVERRIDING DEFAULTS: Using Image URL background.");
      formData.useCustomBackground = true;
      formData.videoNumber = imageUrl;
    } else if (youtubeUrl) {
      console.log("OVERRIDING DEFAULTS: Using YouTube background.");
      formData.useCustomBackground = true;
      formData.videoNumber = youtubeUrl;
    }
  }

  try {
    let audioPath = null;
    if (customAudioFile) {
      const audioFormData = new FormData();
      audioFormData.append('audio', customAudioFile);
      const uploadResponse = await fetch('/upload-audio', { method: 'POST', body: audioFormData });
      if (!uploadResponse.ok) throw new Error('Failed to upload audio');
      const uploadData = await uploadResponse.json();
      audioPath = uploadData.audioPath;
    }

    const requestBody = { ...formData, customAudioPath: audioPath, userVerseTimings };
    console.log("Sending FINAL request to server with body:", requestBody);

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
      const errorText = await response.text();
      throw new Error(`Failed to generate video: ${errorText}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}
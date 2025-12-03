export async function handleFullVideoSubmit(e) {
  e.preventDefault();

  let requestBody = {};
  const customAudioFile = e.detail?.customAudioFile;
  const isCustomFlow = !!customAudioFile;
  const ids = isCustomFlow ? {
    color: "fontColorFullCustom",
    size: "fontSizeFullCustom",
    font: "fontNameFullCustom",
    trans: "translationEditionFullCustom",
    pos: "subtitlePositionFullCustom",
    meta: "showMetadataFullCustom",
    bgUpload: "backgroundUploadFullCustom",
    vertical: "verticalVideoFullCustom",
    pexels: "pexelsVideoFullCustom",
    img: "imageLinkFullCustom",
    yt: "youtubeLinkFullCustom",
    surah: "fullSurahNumberCustom",
    edition: "fullEditionFullCustom"
  } : {
    color: "fontColor",
    size: "fontSize",
    font: "fontNameFull",
    trans: "translationEditionFull",
    pos: "subtitlePositionFull",
    meta: "showMetadataFull",
    bgUpload: "backgroundUploadFull",
    vertical: "verticalVideoFull",
    pexels: "pexelsVideo",
    img: "imageLink",
    yt: "youtubeLink",
    surah: "fullSurahNumber",
    edition: "fullEdition"
  };

  const subtitlePosition = document.getElementById(ids.pos)?.value || 'bottom';
  const showMetadata = document.getElementById(ids.meta)?.checked || false;

  if (isCustomFlow) {
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
    const backgroundUploadInput = document.getElementById(ids.bgUpload);
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
    
    const isVertical = document.getElementById(ids.vertical)?.checked;
    const pexelsQuery = document.getElementById(ids.pexels)?.value;
    const imageUrl = document.getElementById(ids.img)?.value;
    const youtubeUrl = document.getElementById(ids.yt)?.value;

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
      surahNumber: document.getElementById(ids.surah).value,
      edition: document.getElementById(ids.edition)?.value,
      color: document.getElementById(ids.color).value,
      size: document.getElementById(ids.size).value,
      fontName: document.getElementById(ids.font).value,
      translationEdition: document.getElementById(ids.trans).value,
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
    const response = await fetch("/generate-full-video", {
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
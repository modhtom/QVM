export async function handleFullVideoSubmit(e) {
  e.preventDefault();

  let requestBody = {};
  const customAudioFile = e.detail?.customAudioFile;
  const isCustomFlow = !!customAudioFile;
  const getVal = (id) => document.getElementById(id)?.value;
  const getChk = (id) => document.getElementById(id)?.checked;

  if (isCustomFlow) {
    requestBody = { ...e.detail };
    requestBody.audioSource = 'custom';
    const audioFormData = new FormData();
    audioFormData.append('audio', customAudioFile);
    try {
      const uploadResponse = await fetch('/upload-audio', { method: 'POST', body: audioFormData });
      if (!uploadResponse.ok) throw new Error('Failed to upload audio');
      const uploadData = await uploadResponse.json();
      
      if (!uploadData.audioPath) {
        const debugStr = JSON.stringify(uploadData);
        alert(`Upload Error: Server returned success but no audioPath. Response: ${debugStr}`);
        throw new Error('Server returned no audio path');
      }
      requestBody.customAudioPath = uploadData.audioPath;
    } catch (error) {
      return alert(`Error: ${error.message}`);
    }
  } else {
    requestBody.audioSource = 'api';
    requestBody.surahNumber = getVal("fullSurahNumber");
    requestBody.edition = getVal("fullEdition");
  }

  const bgUploadId = isCustomFlow ? "backgroundUploadFullCustom" : "backgroundUploadFull";
  const pexelsId   = isCustomFlow ? "pexelsVideoFullCustom" : "pexelsVideo";
  const imgId      = isCustomFlow ? "imageLinkFullCustom" : "imageLink";
  const ytId       = isCustomFlow ? "youtubeLinkFullCustom" : "youtubeLink";

  const backgroundUploadInput = document.getElementById(bgUploadId);
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

  const pexelsQuery = getVal(pexelsId);
  const imageUrl = getVal(imgId);
  const youtubeUrl = getVal(ytId);

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

  const colorId = isCustomFlow ? "fontColorFullCustom" : "fontColor";
  const sizeId  = isCustomFlow ? "fontSizeFullCustom" : "fontSize";
  const fontId  = isCustomFlow ? "fontNameFullCustom" : "fontNameFull";
  const transId = isCustomFlow ? "translationEditionFullCustom" : "translationEditionFull";
  const vertId  = isCustomFlow ? "verticalVideoFullCustom" : "verticalVideoFull";
  const posId   = isCustomFlow ? "subtitlePositionFullCustom" : "subtitlePositionFull";
  const metaId  = isCustomFlow ? "showMetadataFullCustom" : "showMetadataFull";

  Object.assign(requestBody, {
    color: getVal(colorId) || "#ffffff",
    size: getVal(sizeId) || 30,
    fontName: getVal(fontId) || "TaseesRegular",
    translationEdition: getVal(transId),
    crop: getChk(vertId) ? "vertical" : "horizontal",
    subtitlePosition: getVal(posId) || "bottom",
    showMetadata: getChk(metaId) || false,
    useCustomBackground: useCustomBg,
    videoNumber: videoData,
    removeFilesAfterCreation: true,
    surahNumber: requestBody.surahNumber || getVal(isCustomFlow ? "fullSurahNumberCustom" : "fullSurahNumber"),
  });

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
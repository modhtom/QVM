export async function handlePartialVideoSubmit(e) {
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
      console.log("Uploading audio...");
      const uploadResponse = await fetch('/upload-audio', { method: 'POST', body: audioFormData });
      
      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Server Error (${uploadResponse.status}): ${errText}`);
      }
      
      const uploadData = await uploadResponse.json();
      console.log("Upload Success:", uploadData);

      if (!uploadData || !uploadData.audioPath) {
        alert("Debug Error: Server response was: " + JSON.stringify(uploadData));
        throw new Error('Server returned success but no audioPath');
      }
      requestBody.customAudioPath = uploadData.audioPath;
      
    } catch (error) {
      console.error("Audio upload failed:", error);
      return alert(`Upload Failed: ${error.message}`);
    }
  } else {
    requestBody.audioSource = 'api';
    requestBody.surahNumber = getVal("surahNumber");
    requestBody.startVerse = parseInt(getVal("startVerse"));
    requestBody.endVerse = parseInt(getVal("endVerse"));
    requestBody.edition = getVal("edition");
  }

  const suffix = isCustomFlow ? "PartCustom" : "Part";
  const bgUploadId = `backgroundUpload${suffix}`;
  const pexelsId   = `pexelsVideo${suffix}`;
  const imgId      = `imageLink${suffix}`;
  const ytId       = `youtubeLink${suffix}`;

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

  const colorId = `fontColor${suffix}`;
  const sizeId  = `fontSize${suffix}`;
  const fontId  = `fontName${suffix}`;
  const transId = `translationEdition${suffix}`;
  const vertId  = `verticalVideo${suffix}`;
  const posId   = `subtitlePosition${suffix}`;
  const metaId  = `showMetadata${suffix}`;

  Object.assign(requestBody, {
    color: getVal(colorId),
    size: getVal(sizeId),
    fontName: getVal(fontId),
    translationEdition: getVal(transId),
    crop: getChk(vertId) ? "vertical" : "horizontal",
    subtitlePosition: getVal(posId),
    showMetadata: getChk(metaId),
    useCustomBackground: useCustomBg,
    videoNumber: videoData,
    removeFilesAfterCreation: true,
    surahNumber: requestBody.surahNumber || getVal(isCustomFlow ? "surahNumberCustom" : "surahNumber"),
    startVerse: requestBody.startVerse || parseInt(getVal(isCustomFlow ? "startVerseCustom" : "startVerse")),
    endVerse: requestBody.endVerse || parseInt(getVal(isCustomFlow ? "endVerseCustom" : "endVerse")),
  });

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
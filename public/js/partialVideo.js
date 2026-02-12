import {
  uploadAudioFile,
  uploadBackgroundFile,
  resolveBackgroundData,
  collectFormOptions,
  submitVideoJob,
} from './videoFormHelpers.js';

export async function handlePartialVideoSubmit(e) {
  e.preventDefault();

  let requestBody = {};
  const customAudioFile = e.detail?.customAudioFile;
  const isCustomFlow = !!customAudioFile;
  const getVal = (id) => document.getElementById(id)?.value;

  if (isCustomFlow) {
    requestBody = { ...e.detail };
    requestBody.audioSource = 'custom';
    try {
      requestBody.customAudioPath = await uploadAudioFile(customAudioFile);
    } catch (error) {
      console.error('Audio upload failed:', error);
      return alert(`Upload Failed: ${error.message}`);
    }
  } else {
    requestBody.audioSource = 'api';
    requestBody.surahNumber = getVal('surahNumber');
    requestBody.startVerse = parseInt(getVal('startVerse'));
    requestBody.endVerse = parseInt(getVal('endVerse'));
    requestBody.edition = getVal('edition');
  }

  const suffix = isCustomFlow ? "PartCustom" : "Part";
  const bgUploadId = `backgroundUpload${suffix}`;
  let uploadedBackgroundPath = null;
  try {
    uploadedBackgroundPath = await uploadBackgroundFile(document.getElementById(bgUploadId));
  } catch (error) {
    return alert(`Error uploading background: ${error.message}`);
  }
  const { videoData, useCustomBg } = resolveBackgroundData(suffix, uploadedBackgroundPath);

  const options = collectFormOptions(suffix);

  Object.assign(requestBody, options, {
    useCustomBackground: useCustomBg,
    videoNumber: videoData,
    removeFilesAfterCreation: true,
    surahNumber: requestBody.surahNumber || getVal(isCustomFlow ? "surahNumberCustom" : "surahNumber"),
    startVerse: requestBody.startVerse || parseInt(getVal(isCustomFlow ? "startVerseCustom" : "startVerse")),
    endVerse: requestBody.endVerse || parseInt(getVal(isCustomFlow ? "endVerseCustom" : "endVerse")),
  });

  try {
    await submitVideoJob('/generate-partial-video', requestBody);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}
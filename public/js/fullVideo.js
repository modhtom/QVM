import {
  uploadAudioFile,
  uploadBackgroundFile,
  resolveBackgroundData,
  collectFormOptions,
  submitVideoJob,
} from './videoFormHelpers.js';
import { showImagePicker, needsImagePicker } from './imagePicker.js';

export async function handleFullVideoSubmit(e) {
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
      return alert(`Error: ${error.message}`);
    }
  } else {
    requestBody.audioSource = 'api';
    requestBody.surahNumber = getVal("fullSurahNumber");
    requestBody.edition = getVal("fullEdition");
  }

  const bgSuffix = isCustomFlow ? "FullCustom" : "Full";
  const bgUploadId = `backgroundUpload${bgSuffix}`;
  let uploadedBackgroundPath = null;
  try {
    uploadedBackgroundPath = await uploadBackgroundFile(document.getElementById(bgUploadId));
  } catch (error) {
    return alert(`Error uploading background: ${error.message}`);
  }
  const { videoData, useCustomBg } = resolveBackgroundData(bgSuffix, uploadedBackgroundPath);

  //const optionSuffix = isCustomFlow ? 'FullCustom' : '';
  const options = isCustomFlow
    ? collectFormOptions('FullCustom')
    : {
      color: getVal('fontColor') || '#ffffff',
      size: getVal('fontSize') || 30,
      fontName: getVal('fontNameFull') || 'TaseesRegular',
      translationEdition: getVal('translationEditionFull'),
      crop: document.getElementById('verticalVideoFull')?.checked ? 'vertical' : 'horizontal',
      subtitlePosition: getVal('subtitlePositionFull') || 'bottom',
      showMetadata: document.getElementById('showMetadataFull')?.checked || false,
    };

  Object.assign(requestBody, options, {
    useCustomBackground: useCustomBg,
    videoNumber: videoData,
    removeFilesAfterCreation: true,
    surahNumber: requestBody.surahNumber || getVal(isCustomFlow ? "fullSurahNumberCustom" : "fullSurahNumber"),
  });

  let query = null;
  if (typeof requestBody.videoNumber === 'string' && requestBody.videoNumber.startsWith('unsplash:')) {
    query = requestBody.videoNumber.split(':')[1];
  }

  if (needsImagePicker(useCustomBg, requestBody.videoNumber)) {
    const selectedUrls = await showImagePicker({
      surahNumber: requestBody.surahNumber,
      startVerse: 1,
      endVerse: 10,
      crop: requestBody.crop === 'vertical' ? 'vertical' : 'horizontal',
      query: query
    });

    if (!selectedUrls) {
      return;
    }

    requestBody.selectedImageUrls = selectedUrls;
  }

  try {
    await submitVideoJob('/generate-full-video', requestBody);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}
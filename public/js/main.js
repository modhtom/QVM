import { handlePartialVideoSubmit } from "./partialVideo.js";
import { handleFullVideoSubmit } from "./fullVideo.js";
import { loadVideos } from "./videos.js";
import { surahs } from "./data/surahs.js";
import { initAuthUI, updateAuthState, isLoggedIn } from "./auth.js";

let waveSurfer;
window.tempVideoFormData = {};
const VideoState = {
  _data: null,
  set(data) {
    this._data = { ...data };
    console.log('State Updated:', this._data);
  },
  get() {
    if (!this._data) {
      console.warn('State accessed but data is empty');
      return null;
    }
    return { ...this._data };
  },
  clear() {
    this._data = null;
    console.log('State Cleared');
  }
};
const selects = {
  fullMushaf: null,
  fullReciter: null,
  fullSurah: null,
  partMushaf: null,
  partReciter: null,
  partSurah: null,
  customFullSurah: null,
  customPartSurah: null
};

async function pollJobStatus(jobId) {
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) progressContainer.style.display = 'block';

  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(`/job-status/${jobId}`);
      if (!response.ok) {
        throw new Error('Could not get job status');
      }
      const job = await response.json();
      updateProgressBar({
        step: job.progress?.step || job.state,
        percent: job.progress?.percent || (job.state === 'completed' ? 100 : 0)
      });

      if (job.state === 'completed') {
        clearInterval(intervalId);
        console.log('Job completed:', job.result);
        const videoElement = document.getElementById("previewVideo");
        videoElement.src = `/videos/${job.result.vidPath}`;
        videoElement.setAttribute('data-filename', job.result.vidPath);
        window.showPage("videoPreview");
        setTimeout(() => {
          if (progressContainer) progressContainer.style.display = 'none';
        }, 2000);
      } else if (job.state === 'failed') {
        clearInterval(intervalId);
        alert(`Video generation failed: ${job.failedReason}`);
        console.error('Job failed:', job.failedReason);
        if (progressContainer) progressContainer.style.display = 'none';
      }
    } catch (error) {
      clearInterval(intervalId);
      console.error('Error polling job status:', error);
      alert('Error checking video progress. Please check the gallery later.');
      if (progressContainer) progressContainer.style.display = 'none';
    }
  }, 2000);
}
window.pollJobStatus = pollJobStatus;


async function getVerseText(surahNumber, startVerse, endVerse) {
  try {
    if(startVerse < 1 || endVerse < startVerse) {
      alert('Please enter a valid verse range. Start verse must be at least 1 and end verse must be greater than or equal to start verse.');
      throw new Error('Invalid verse range');
    }
    const response = await fetch(`/api/surah-verses-text?surahNumber=${surahNumber}&startVerse=${startVerse}&endVerse=${endVerse}`);
    if (!response.ok) {
      throw new Error('Failed to fetch verse text');
    }
    const data = await response.json();
    return data.verses;
  } catch (error) {
    console.error("Error fetching verse text:", error);
    return [];
  }
}

let allReciters = [];
let groupedData = {};
async function populateSelects() {
  try {
    const response = await fetch('/api/metadata');
    if (!response.ok) throw new Error("Metadata not found");
    const data = await response.json();

    allReciters = data.reciters;
    groupedData = {};
    allReciters.forEach(reciter => {
      reciter.moshafs.forEach(moshaf => {
        if (!groupedData[moshaf.name]) {
          groupedData[moshaf.name] = [];
        }
        groupedData[moshaf.name].push({
          reciterId: reciter.id,
          reciterName: reciter.name,
          server: moshaf.server,
          surahList: moshaf.surah_list
        });
      });
    });

    const mushafNames = Object.keys(groupedData).sort();
    const mushafOptions = mushafNames.map(name => ({ value: name, text: name }));
    const transOptions = data.translations.map(t => ({
      value: t.identifier,
      text: `${t.language.toUpperCase()} - ${t.name} (${t.englishName})`
    }));
    transOptions.unshift({ value: "", text: "بدون ترجمة" });

    ['translationEditionFull', 'translationEditionPart', 'translationEditionFullCustom', 'translationEditionPartCustom'].forEach(id => {
      if (document.getElementById(id)) {
        new TomSelect(`#${id}`, {
          options: transOptions,
          valueField: 'value',
          labelField: 'text',
          searchField: ['text'],
          placeholder: 'اختر الترجمة...',
        });
      }
    });

    const surahOptions = surahs.map(s => ({ value: s.number, text: `${s.number}. ${s.name}` }));
    const createSelect = (id, options, placeholder) => {
      if (!document.getElementById(id)) return null;
      return new TomSelect(`#${id}`, {
        options: options,
        valueField: 'value',
        labelField: 'text',
        searchField: ['text'],
        placeholder: placeholder,
        maxOptions: 250
      });
    };

    selects.customFullSurah = createSelect('fullSurahNumberCustom', surahOptions, 'اختر السورة...');
    selects.customPartSurah = createSelect('surahNumberCustom', surahOptions, 'اختر السورة...');

    selects.fullMushaf = createSelect('fullMushaf', mushafOptions, 'اختر الرواية...');
    selects.partMushaf = createSelect('partMushaf', mushafOptions, 'اختر الرواية...');

    selects.fullReciter = createSelect('fullEdition', [], 'اختر القارئ...');
    selects.partReciter = createSelect('edition', [], 'اختر القارئ...');

    selects.fullSurah = createSelect('fullSurahNumber', [], 'اختر السورة...');
    selects.partSurah = createSelect('surahNumber', [], 'اختر السورة...');

    const handleMushafChange = (mushafName, reciterSelect, surahSelect) => {
      if (!mushafName) return;
      const reciters = groupedData[mushafName];

      reciterSelect.clear();
      reciterSelect.clearOptions();
      surahSelect.clear();
      surahSelect.clearOptions();

      const options = reciters.map(r => ({
        value: r.server,
        text: r.reciterName,
        surahList: r.surahList
      }));

      reciterSelect.addOption(options);
    };

    const handleReciterChange = (serverUrl, reciterSelect, surahSelect) => {
      if (!serverUrl) return;

      const selectedOption = reciterSelect.options[serverUrl];
      if (!selectedOption) return;

      const availableSurahs = selectedOption.surahList.split(',');

      surahSelect.clear();
      surahSelect.clearOptions();

      const filteredSurahs = surahs
        .filter(s => availableSurahs.includes(String(s.number)))
        .map(s => ({ value: s.number, text: `${s.number}. ${s.name}` }));

      surahSelect.addOption(filteredSurahs);
    };

    selects.fullMushaf.on('change', (val) => handleMushafChange(val, selects.fullReciter, selects.fullSurah));
    selects.fullReciter.on('change', (val) => handleReciterChange(val, selects.fullReciter, selects.fullSurah));

    selects.partMushaf.on('change', (val) => handleMushafChange(val, selects.partReciter, selects.partSurah));
    selects.partReciter.on('change', (val) => handleReciterChange(val, selects.partReciter, selects.partSurah));

  } catch (error) {
    console.error("Failed to load metadata:", error);
  }
}

function setupVerticalVideoToggles() {
  const handleToggle = (checkboxId, fontSizeId, labelId) => {
    const checkbox = document.getElementById(checkboxId);
    const fontSizeInput = document.getElementById(fontSizeId);
    const fontLabel = document.getElementById(labelId);

    if (checkbox && fontSizeInput) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          fontSizeInput.value = 5;
          if (fontLabel) fontLabel.textContent = '5px';
        } else {
          fontSizeInput.value = 10;
          if (fontLabel) fontLabel.textContent = '10px';
        }
        if (document.getElementById('fontColorPart')) updateStaticPreview();
      });
    }
  };

  handleToggle('verticalVideoFull', 'fontSize', 'fontSizeValue');
  handleToggle('verticalVideoPart', 'fontSizePart', 'fontSizeValuePart');
  handleToggle('verticalVideoFullCustom', 'fontSizeFullCustom', 'fontSizeValueFullCustom');
  handleToggle('verticalVideoPartCustom', 'fontSizePartCustom', 'fontSizeValuePartCustom');
}

function addProgressBar() {
  const existing = document.getElementById('progress-container');
  if (existing) existing.remove();
  const progressContainer = document.createElement('div');
  progressContainer.id = 'progress-container';
  progressContainer.style.display = 'none';
  progressContainer.style.position = 'fixed';
  progressContainer.style.top = '20px';
  progressContainer.style.right = '20px';
  progressContainer.style.zIndex = '1000';
  progressContainer.style.background = 'rgba(255,255,255,0.9)';
  progressContainer.style.padding = '15px';
  progressContainer.style.borderRadius = '10px';
  progressContainer.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';

  progressContainer.innerHTML = `
    <div class="progress-wrapper">
      <h4>انتاج الفديو</h4>
      <div class="progress-bar" style="width:300px;height:20px;background:#eee;border-radius:10px;overflow:hidden">
        <div class="progress-fill" style="height:100%;background:var(--accent-color);width:0%"></div>
      <h4>انتاج الفديو</h4>
      <div class="progress-bar" style="width:300px;height:20px;background:#eee;border-radius:10px;overflow:hidden">
        <div class="progress-fill" style="height:100%;background:var(--accent-color);width:0%"></div>
      </div>
      <div class="progress-text" style="margin-top:10px">Starting...</div>
      <div class="progress-text" style="margin-top:10px">Starting...</div>
    </div>
  `;
  document.body.appendChild(progressContainer);
}

function updateProgressBar(progress) {
  const progressContainer = document.getElementById('progress-container');
  if (!progressContainer) {
    console.error("Progress container not found!");
    return;
  }

  const progressFill = progressContainer.querySelector('.progress-fill');
  const progressText = progressContainer.querySelector('.progress-text');
  if (!progressFill || !progressText) {
    console.error("Progress elements missing!");
    return;
  }

  const resetProgress = () => {
    progressFill.style.width = '0%';
    progressText.textContent = 'Starting... (0%)';
    progressContainer.style.display = 'none';
  };

  progressContainer.style.display = 'block';
  progressFill.style.width = `${progress.percent}%`;
  progressText.textContent = `${progress.step} (${Math.round(progress.percent)}%)`;

  if (progress.percent >= 100 || progress.error) {
    setTimeout(() => {
      resetProgress();
    }, 2000);
  }
}

function connectToProgressUpdates() {
  if (window.evtSource) {
    window.evtSource.close();
  }

  window.evtSource = new EventSource('/progress');

  window.evtSource.onmessage = function (event) {
    try {
      const progress = JSON.parse(event.data);
      updateProgressBar(progress);
    } catch (error) {
      console.error("Error parsing progress:", error);
    }
  };

  window.evtSource.onerror = function (error) {
    console.error("EventSource error:", error);
    window.evtSource.close();
  };

  return window.evtSource;
}

let currentVersesText = [];
let verseTimings = [];
let currentVerseIndex = 0;
let audioPlayer;
let customAudioFile = null;
let currentSurahNumber = 0;
let currentStartVerse = 0;
let currentEndVerse = 0;
let currentEdition = "quran-simple";

async function initTapToSync(audioFile, surahNum, startV, endV, edition) {
  customAudioFile = audioFile;
  currentSurahNumber = surahNum;
  currentStartVerse = startV;
  currentEndVerse = endV;
  currentEdition = edition;

  audioPlayer = document.getElementById('syncAudioPlayer');
  if (!audioPlayer) {
    console.error("Fatal Error: Audio player element '#syncAudioPlayer' not found.");
    alert("An error occurred. Could not find the audio player on the page.");
    return;
  }

  if (waveSurfer) {
    waveSurfer.destroy();
  }

  waveSurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: 'gold',
    progressColor: 'purple',
    barWidth: 3,
    barRadius: 3,
    height: 128,
    media: audioPlayer, // Link WaveSurfer directly to the audio element
  });

  const audioUrl = URL.createObjectURL(customAudioFile);
  waveSurfer.load(audioUrl);
  audioPlayer.src = audioUrl;

  const fetchedVerses = await getVerseText(surahNum, startV, endV);
  if (fetchedVerses.length === 0) {
    alert("Failed to load verse texts for synchronization. Please try again.");
    showPage(window.previousPage);
    return;
  }

  currentVersesText = fetchedVerses;
  currentVerseIndex = 0;
  verseTimings = [];
  document.getElementById('syncStatus').textContent = `Verse 1 of ${currentVersesText.length}`;
  document.getElementById('syncProgressBar').style.width = '0%';
  document.getElementById('markVerseBtn').disabled = false;
  document.getElementById('finishSyncBtn').style.display = 'none';

  displayCurrentVerse();
  window.showPage('tapToSyncPage');
}

async function updateStaticPreview() {
  const previewContainer = document.getElementById('static-preview-container');
  const previewImage = document.getElementById('static-preview-image');
  previewImage.style.opacity = '0.5'; // Indicate loading

  const payload = {
    surahNumber: document.getElementById("surahNumber").value,
    startVerse: document.getElementById("startVerse").value || 1,
    color: document.getElementById("fontColorPart").value,
    fontName: document.getElementById("fontName").value,
    size: document.getElementById("fontSizePart").value,
    background: document.getElementById("pexelsVideoPart")?.value || document.getElementById("imageLinkPart")?.value,
    translationEdition: document.getElementById("translationEdition").value
  };

  try {
    const response = await fetch('/generate-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to generate preview');

    const data = await response.json();
    previewImage.src = data.previewPath + `?t=${new Date().getTime()}`;
    previewImage.style.opacity = '1';
  } catch (error) {
    console.error("Preview Error:", error);
    previewImage.style.opacity = '1';
  }
}

function displayCurrentVerse() {
  if (currentVerseIndex < currentVersesText.length) {
    document.getElementById('currentVerseDisplay').textContent = currentVersesText[currentVerseIndex];
  } else {
    document.getElementById('currentVerseDisplay').textContent = 'انتهت المزامنة!';
    document.getElementById('markVerseBtn').disabled = true;
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    document.getElementById('finishSyncBtn').style.display = 'block';
  }
}

function markVerse() {
  if (currentVerseIndex >= currentVersesText.length) {
    return;
  }

  const currentTime = audioPlayer.currentTime;

  if (verseTimings.length > 0 && currentVerseIndex > 0) {
    verseTimings[currentVerseIndex - 1].end = currentTime;
  }

  verseTimings.push({ start: currentTime, end: null });

  currentVerseIndex++;
  displayCurrentVerse();

  const progressPercent = (currentVerseIndex / currentVersesText.length) * 100;
  document.getElementById('syncProgressBar').style.width = `${progressPercent}%`;
  document.getElementById('syncStatus').textContent = `الآية ${currentVerseIndex} من ${currentVersesText.length}`;

  if (currentVerseIndex === currentVersesText.length) {
    verseTimings[verseTimings.length - 1].end = audioPlayer.duration;

    document.getElementById('markVerseBtn').disabled = true;
    document.getElementById('finishSyncBtn').style.display = 'block';

    document.getElementById('syncProgressBar').style.width = '100%';
    document.getElementById('syncStatus').textContent = 'اكتملت المزامنة!';
  }
}

function resetSync() {
  currentVerseIndex = 0;
  verseTimings = [];
  audioPlayer.currentTime = 0;
  audioPlayer.pause();
  document.getElementById('markVerseBtn').disabled = false;
  document.getElementById('syncStatus').textContent = `الآية 1 من ${currentVersesText.length}`;
  document.getElementById('syncProgressBar').style.width = '0%';
  document.getElementById('finishSyncBtn').style.display = 'none';
  displayCurrentVerse();
}

async function finishSyncAndGenerateVideo() {
  if (verseTimings.length > 0 && verseTimings[verseTimings.length - 1].end === null) {
    verseTimings[verseTimings.length - 1].end = audioPlayer.duration;
  }

  const { isFullSurah, surahNumber, startVerse, endVerse, edition, color, size, useCustomBackground, videoNumber, crop } = window.tempVideoFormData;

  if (isFullSurah) {
    handleFullVideoSubmit({
      preventDefault: () => { },
      detail: {
        customAudioFile: customAudioFile,
        userVerseTimings: verseTimings,
        surahNumber: surahNumber,
        edition: edition,
        color: color,
        size: size,
        useCustomBackground: useCustomBackground,
        videoNumber: videoNumber,
        crop: crop,
        userVerseTimings: verseTimings
      }
    });
  } else {
    handlePartialVideoSubmit({
      preventDefault: () => { },
      detail: {
        customAudioFile: customAudioFile,
        userVerseTimings: verseTimings,
        surahNumber: surahNumber,
        startVerse: startVerse,
        endVerse: endVerse,
        edition: edition,
        color: color,
        size: size,
        useCustomBackground: useCustomBackground,
        videoNumber: videoNumber,
        crop: crop,
        userVerseTimings: verseTimings
      }
    });
  }
}

window.addEventListener('beforeunload', () => {
  if (window.evtSource) {
    window.evtSource.close();
  }
});


document.addEventListener('DOMContentLoaded', () => {
  const fullFormBtn = document.querySelector('#fullForm .create-btn');
  const partFormBtn = document.querySelector('#partForm .create-btn');
  const fullCustomFormBtn = document.querySelector('#fullFormCustom .create-btn');
  const partCustomFormBtn = document.querySelector('#partFormCustom .create-btn');
  const autoSyncPartBtn = document.getElementById('autoSyncBtnPart');
  const autoSyncFullBtn = document.getElementById('autoSyncBtnFull');

  if (autoSyncPartBtn) {
    autoSyncPartBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const customAudio = document.getElementById("customAudioPart").files[0];
      if (!customAudio) return alert("يرجى رفع ملف صوتي أولاً");

      VideoState.set({
        customAudioFile: customAudio,
        isFullSurah: false,
        autoSync: true,
        surahNumber: document.getElementById("surahNumberCustom").value,
        startVerse: parseInt(document.getElementById("startVerseCustom").value),
        endVerse: parseInt(document.getElementById("endVerseCustom").value),
        edition: "quran-simple",
        color: document.getElementById("fontColorPartCustom").value,
        size: document.getElementById("fontSizePartCustom").value,
        fontName: document.getElementById("fontNamePartCustom").value,
        subtitlePosition: document.getElementById("subtitlePositionPartCustom")?.value,
        showMetadata: document.getElementById("showMetadataPartCustom")?.checked,
        crop: document.getElementById("verticalVideoPartCustom")?.checked ? "vertical" : "horizontal",
        useCustomBackground: false,
        videoNumber: 1
      });

      const formData = VideoState.get();
      const event = {
        preventDefault: () => { },
        detail: formData
      };
      handlePartialVideoSubmit(event);
    });
  }

  if (autoSyncFullBtn) {
    autoSyncFullBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const customAudio = document.getElementById("customAudioFull").files[0];
      if (!customAudio) return alert("يرجى رفع ملف صوتي أولاً");

      const surahNum = document.getElementById("fullSurahNumberCustom").value;
      let endVerse;
      try {
        const res = await fetch(`http://api.alquran.cloud/v1/surah/${surahNum}`);
        const data = await res.json();
        endVerse = data.data.numberOfAyahs;
      } catch (err) {
        console.warn("Could not fetch surah length, defaulting to 1");
        endVerse = 1;
      }

      VideoState.set({
        customAudioFile: customAudio,
        isFullSurah: true,
        autoSync: true,
        surahNumber: surahNum,
        startVerse: 1,
        endVerse: endVerse,
        edition: "quran-simple",
        color: document.getElementById("fontColorFullCustom").value,
        size: document.getElementById("fontSizeFullCustom").value,
        fontName: document.getElementById("fontNameFullCustom").value,
        subtitlePosition: document.getElementById("subtitlePositionFullCustom")?.value || 'bottom',
        showMetadata: document.getElementById("showMetadataFullCustom")?.checked,
        crop: document.getElementById("verticalVideoFullCustom")?.checked ? "vertical" : "horizontal",
        useCustomBackground: (document.getElementById("pexelsVideoFullCustom")?.value || document.getElementById("imageLinkFullCustom")?.value || document.getElementById("youtubeLinkFullCustom")?.value) !== '',
        videoNumber: (document.getElementById("pexelsVideoFullCustom")?.value ? `unsplash:${document.getElementById("pexelsVideoFullCustom").value}` : (document.getElementById("imageLinkFullCustom")?.value || document.getElementById("youtubeLinkFullCustom")?.value)),
      });

      const formData = VideoState.get();
      handleFullVideoSubmit({
        preventDefault: () => { },
        detail: formData
      });
    });
  }

  if (fullCustomFormBtn) {
    fullCustomFormBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const customAudio = document.getElementById("customAudioFull").files[0];
      if (!customAudio) {
        alert("Please upload an audio file.");
        return;
      }

      window.tempVideoFormData = {
        isFullSurah: true,
        surahNumber: document.getElementById("fullSurahNumberCustom").value,
        edition: "quran-simple",
        color: document.getElementById("fontColorFullCustom").value,
        size: document.getElementById("fontSizeFullCustom").value,
        useCustomBackground: (document.getElementById("pexelsVideoFullCustom")?.value || document.getElementById("imageLinkFullCustom")?.value || document.getElementById("youtubeLinkFullCustom")?.value) !== '',
        videoNumber: (document.getElementById("pexelsVideoFullCustom")?.value ? `pexels:${document.getElementById("pexelsVideoFullCustom").value}` : (document.getElementById("imageLinkFullCustom")?.value || document.getElementById("youtubeLinkFullCustom")?.value)),
        crop: document.getElementById("verticalVideoFullCustom")?.checked ? "horizontal" : "vertical",
        subtitlePosition: document.getElementById("subtitlePositionFullCustom")?.value || 'bottom',
        showMetadata: document.getElementById("showMetadataFullCustom")?.checked || false
      };

      const surahNum = window.tempVideoFormData.surahNumber;
      let endVerse;
      try {
        const response = await fetch(`http://api.alquran.cloud/v1/surah/${surahNum}`);
        const data = await response.json();
        endVerse = data.data.numberOfAyahs;
      } catch (error) {
        console.error("Error fetching surah end verse:", error);
        alert("Failed to get surah information. Please try again.");
        return;
      }
      window.tempVideoFormData.startVerse = 1;
      window.tempVideoFormData.endVerse = endVerse;

      initTapToSync(customAudio, window.tempVideoFormData.surahNumber, 1, endVerse, window.tempVideoFormData.edition);
    });
  }

  if (partCustomFormBtn) {
    partCustomFormBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const customAudio = document.getElementById("customAudioPart").files[0];
      if (!customAudio) {
        alert("Please upload an audio file.");
        return;
      }

      window.tempVideoFormData = {
        isFullSurah: false,
        surahNumber: document.getElementById("surahNumberCustom").value,
        startVerse: parseInt(document.getElementById("startVerseCustom").value),
        endVerse: parseInt(document.getElementById("endVerseCustom").value),
        edition: "quran-simple",
        color: document.getElementById("fontColorPartCustom").value,
        size: document.getElementById("fontSizePartCustom").value,
        useCustomBackground: (document.getElementById("pexelsVideoPartCustom")?.value || document.getElementById("imageLinkPartCustom")?.value || document.getElementById("youtubeLinkPartCustom")?.value) !== '',
        videoNumber: (document.getElementById("pexelsVideoPartCustom")?.value ? `pexels:${document.getElementById("pexelsVideoPartCustom").value}` : (document.getElementById("imageLinkPartCustom")?.value || document.getElementById("youtubeLinkPartCustom")?.value)),
        crop: document.getElementById("verticalVideoPartCustom")?.checked ? "horizontal" : "vertical",
        subtitlePosition: document.getElementById("subtitlePositionPartCustom")?.value || 'bottom',
        showMetadata: document.getElementById("showMetadataPartCustom")?.checked || false
      };

      initTapToSync(customAudio, window.tempVideoFormData.surahNumber, window.tempVideoFormData.startVerse, window.tempVideoFormData.endVerse, window.tempVideoFormData.edition);
    });
  }
  if (fullFormBtn) {
    fullFormBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log("FULL (Built-in Audio)");
      handleFullVideoSubmit(e);
    });
  }

  if (partFormBtn) {
    partFormBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log("PART (Built-in Audio)");
      handlePartialVideoSubmit(e);
    });
  }

  document.getElementById('fontSizeFullCustom')?.addEventListener('input', e => {
    document.getElementById('fontSizeValueFullCustom').textContent = e.target.value + 'px';
  });

  document.getElementById('fontSizePartCustom')?.addEventListener('input', e => {
    document.getElementById('fontSizeValuePartCustom').textContent = e.target.value + 'px';
  });

  document.getElementById('markVerseBtn')?.addEventListener('click', markVerse);
  document.getElementById('resetSyncBtn')?.addEventListener('click', resetSync);
  document.getElementById('finishSyncBtn')?.addEventListener('click', finishSyncAndGenerateVideo);

  document.getElementById('fontName')?.addEventListener('change', updateStaticPreview);
  document.getElementById('fontColorPart')?.addEventListener('input', updateStaticPreview);
  document.getElementById('fontSizePart')?.addEventListener('input', updateStaticPreview);
  document.getElementById('pexelsVideoPart')?.addEventListener('blur', updateStaticPreview); // blur = when user clicks away

  document.getElementById('playPauseBtn')?.addEventListener('click', () => {
    if (waveSurfer) {
      waveSurfer.playPause();
    }
  });

  document.getElementById('stopBtn')?.addEventListener('click', () => {
    if (waveSurfer) {
      waveSurfer.stop(); // Stops and rewinds to the beginning
    }
  });

  initAuthUI();
  updateAuthState();
  addProgressBar();
  connectToProgressUpdates();
  populateSelects();
  setupVerticalVideoToggles();
  if (isLoggedIn()) {
    loadVideos();
  }
});
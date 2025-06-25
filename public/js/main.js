import { handlePartialVideoSubmit } from "./partialVideo.js";
import { handleFullVideoSubmit } from "./fullVideo.js";
import { loadVideos } from "./videos.js";
import { surahs } from "./data/surahs.js";
import { editions } from "./data/editions.js";

window.tempVideoFormData = {};

async function getVerseText(surahNumber, startVerse, endVerse) {
  try {
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

function populateSelects() {
  const surahSelects = document.querySelectorAll(
    "#surahNumber, #fullSurahNumber, #surahNumberCustom, #fullSurahNumberCustom"
  );
  surahSelects.forEach(select => {
    select.innerHTML = surahs.map(surah =>
      `<option value="${surah.number}">${surah.name} (${surah.number})</option>`
    ).join('');
  });

  const editionSelects = document.querySelectorAll("#edition, #fullEdition");
  editionSelects.forEach(select => {
    select.innerHTML = editions.map(edition =>
      `<option value="${edition.identifier}">${edition.name}</option>`
    ).join('');
  });
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
      <h4>Generating Video</h4>
      <div class="progress-bar" style="width:300px;height:20px;background:#eee;border-radius:10px;overflow:hidden">
        <div class="progress-fill" style="height:100%;background:var(--accent-color);width:0%"></div>
      </div>
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
  audioPlayer.src = URL.createObjectURL(customAudioFile);
  audioPlayer.load();

  const fetchedVerses = await getVerseText(surahNum, startV, endV);
  if (fetchedVerses.length === 0) {
    alert("فشل في تحميل نصوص الآيات للمزامنة. يرجى المحاولة مرة أخرى.");
    showPage(window.previousPage); 
    return;
  }
  currentVersesText = fetchedVerses;
  currentVerseIndex = 0;
  verseTimings = [];
  document.getElementById('syncStatus').textContent = `الآية 1 من ${currentVersesText.length}`;
  document.getElementById('syncProgressBar').style.width = '0%';
  document.getElementById('finishSyncBtn').style.display = 'none';
  displayCurrentVerse();
  window.showPage('tapToSyncPage', window.previousPage); 
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
        preventDefault: () => {}, 
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
        preventDefault: () => {}, 
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
          crop: document.getElementById("verticalVideoFullCustom")?.checked ? "horizontal" : "vertical"
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
          crop: document.getElementById("verticalVideoPartCustom")?.checked ? "horizontal" : "vertical"
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


  addProgressBar();
  connectToProgressUpdates();
  populateSelects();
  loadVideos();
});
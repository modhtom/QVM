import { handlePartialVideoSubmit } from "./partialVideo.js";
import { handleFullVideoSubmit } from "./fullVideo.js";
import { loadVideos } from "./videos.js";
import { surahs } from "./data/surahs.js";
import { editions } from "./data/editions.js";

function populateSelects() {
  // Surah dropdowns
  const surahSelects = document.querySelectorAll("#surahNumber, #fullSurahNumber");
  surahSelects.forEach(select => {
    select.innerHTML = surahs.map(surah =>
      `<option value="${surah.number}">${surah.name} (${surah.number})</option>`
    ).join('');
  });

  // Reciter dropdowns
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

window.addEventListener('beforeunload', () => {
  if (window.evtSource) {
    window.evtSource.close();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const fullFormBtn = document.querySelector('#fullForm .create-btn');
  const partFormBtn = document.querySelector('#partForm .create-btn');
  console.log("NOTHING")

  if (fullFormBtn) {
    fullFormBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log("FULL")
      handleFullVideoSubmit(e);
    });
  }

  if (partFormBtn) {
    partFormBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log("PART")
      handlePartialVideoSubmit(e);
    });
  }


  addProgressBar();
  connectToProgressUpdates();
  populateSelects();
  loadVideos();
});
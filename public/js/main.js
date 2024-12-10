import { handlePartialVideoSubmit } from "./partialVideo.js";
import { handleFullVideoSubmit } from "./fullVideo.js";
import { loadVideos } from "./videos.js";
import { surahs } from "./data/surahs.js";
import { editions } from "./data/editions.js";


// Populate select dropdowns
function populateSelects() {
  const surahSelects = document.querySelectorAll(
    "#surahNumber, #fullSurahNumber",
  );
  const editionSelects = document.querySelectorAll("#edition, #fullEdition");

  // Populate Surah selects
  const surahOptions = surahs
    .map((surah) => `<option value="${surah.number}">${surah.name}</option>`)
    .join("");

  surahSelects.forEach((select) => {
    select.innerHTML = `<option value="">Select a Surah</option>${surahOptions}`;
  });

  // Populate Edition selects
  const editionOptions = editions
    .map(
      (edition) =>
        `<option value="${edition.identifier}">${edition.name}</option>`,
    )
    .join("");

  editionSelects.forEach((select) => {
    select.innerHTML = `<option value="">Select an Edition</option>${editionOptions}`;
  });
}

// Tab switching functionality
const tabs = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const backgroundCheckbox = document.getElementById("back");
const urlPlace = document.getElementById("urlPlace");

document.getElementById("endVerse").addEventListener("change", ()=>{
  
if(document.getElementById("startVerse").value>document.getElementById("endVerse").value){
  alert("end verse must be greater than or equal to " + document.getElementById("startVerse").value);
}

}
);

backgroundCheckbox.addEventListener("change", () => {
  if (backgroundCheckbox.checked) {
    urlPlace.innerHTML = `
      <label for="url">
        رابط يوتيوب لخلفية الفيديو (إذا اخترت خلفية مخصصة):
      </label>
      <textarea rows="5" cols="50" id="url" required></textarea>
    `;
  } else {
    urlPlace.innerHTML = ""; 
  }
});
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}-form`).classList.add("active");
  });
});
// Form submissions
document
  .getElementById("partial-video-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'block';
    await handlePartialVideoSubmit(e);
  });

// document.getElementById("full-video-form").addEventListener("submit", async (e) => {
//   e.preventDefault();
//   const progressContainer = document.getElementById('progress-container');
//   progressContainer.style.display = 'block';
//   await handleFullVideoSubmit(e);
// });

// Add progress bar HTML elements
function addProgressBar() {
  const progressContainer = document.createElement('div');
  progressContainer.id = 'progress-container';
  progressContainer.style.display = 'none';
  progressContainer.innerHTML = `
    <div class="progress-wrapper">
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div class="progress-text">Starting...</div>
    </div>
  `;
  document.body.appendChild(progressContainer);
}

// Update progress bar
function updateProgressBar(progress) {
  const progressContainer = document.getElementById('progress-container');
  const progressFill = progressContainer.querySelector('.progress-fill');
  const progressText = progressContainer.querySelector('.progress-text');
  
  progressContainer.style.display = 'block';
  progressFill.style.width = `${progress.percent}%`;
  progressText.textContent = `${progress.step} (${Math.round(progress.percent)}%)`;
  
  if (progress.percent === 100) {
    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 2000);
  }
}

// Connect to SSE endpoint
function connectToProgressUpdates() {
  const evtSource = new EventSource('/progress');
  
  evtSource.onmessage = function(event) {
    const progress = JSON.parse(event.data);
    updateProgressBar(progress);
  };
  
  evtSource.onerror = function() {
    evtSource.close();
  };
  
  return evtSource;
}

// Initialize progress bar and SSE connection
addProgressBar();
const progressEventSource = connectToProgressUpdates();

// Initialize
populateSelects();
loadVideos();


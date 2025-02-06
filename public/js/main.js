import { handlePartialVideoSubmit } from "./partialVideo.js";
import { handleFullVideoSubmit } from "./fullVideo.js";
import { loadVideos } from "./videos.js";
import { surahs } from "./data/surahs.js";
import { editions } from "./data/editions.js";

const tabs = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const backgroundCheckbox = document.getElementById("back");
const urlPlace = document.getElementById("urlPlace");
const imagePlace = document.getElementById("image");
const pexels = document.getElementById("pexels");

const backgroundCheckboxff = document.getElementById("backff");
const urlPlaceff = document.getElementById("urlPlaceff");
const imagePlaceff = document.getElementById("imageff");
const pexelsff = document.getElementById("pexelsff");

// Add event listener for partial video form submission
document.getElementById("partial-video-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const progressContainer = document.getElementById("progress-container");
  progressContainer.style.display = "block";
  
  await handlePartialVideoSubmit(e);

  // Reset after submission
  resetForm("partial-video-form");
});

// Add event listener for full video form submission
document.getElementById("full-video-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const progressContainer = document.getElementById("progress-container");
  progressContainer.style.display = "block";

  await handleFullVideoSubmit(e);

  // Reset after submission
  resetForm("full-video-form");
});

// Function to reset the form and hide progress bar
function resetForm(formId) {
  const form = document.getElementById(formId);
  form.reset();

  urlPlace.innerHTML = ""; 
  color.innerHTML = "";
  imagePlace.innerHTML="";
  document.getElementById('pexelsQuery').value = '';

  document.getElementById('pexelsQueryff').value = '';
  urlPlaceff.innerHTML = ""; 
  colorff.innerHTML = "";
  imagePlaceff.innerHTML="";

  const progressContainer = document.getElementById("progress-container");
  const progressFill = progressContainer.querySelector(".progress-fill");
  const progressText = progressContainer.querySelector(".progress-text");

  progressFill.style.width = "0%";
  progressText.textContent = "Starting... (0%)";
  progressContainer.style.display = "none";
}

function populateSelects() {
  const surahSelects = document.querySelectorAll(
    "#surahNumber, #fullSurahNumber",
  );
  const editionSelects = document.querySelectorAll("#edition, #fullEdition");

  const surahOptions = surahs
    .map((surah) => `<option value="${surah.number}">${surah.name}</option>`)
    .join("");

  surahSelects.forEach((select) => {
    select.innerHTML = `<option value="">Select a Surah</option>${surahOptions}`;
  });

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

document.getElementById("endVerse").addEventListener("change", ()=>{
  if(document.getElementById("startVerse").value > document.getElementById("endVerse").value){
    alert("end verse must be greater than or equal to " + document.getElementById("startVerse").value);
  }
});

backgroundCheckbox.addEventListener("change", () => {
  if (backgroundCheckbox.checked) {
    urlPlace.innerHTML = `
      <label for="url">
        رابط يوتيوب لخلفية الفيديو  :
      </label>
      <textarea rows="5" cols="50" id="url"  ></textarea>
    `;
    color.innerHTML = `
              <div class="form-group">
                <label for="color">لون النص:</label>
                <input type="color" id="color" value="#ffffff" />
              </div>`;
    imagePlace.innerHTML=`
    أو يمكنك أستخدام صورة
        <label for="imageUrl">رابط الصورة:</label>
        <input type="text" rows="5" cols="5" id="imageUrl" placeholder=" " />
    `;
    pexels.innerHTML += `
      أو يمكنك البحث في Pexels
      <label for="pexelsQuery">كلمات البحث:</label>
      <input type="text" id="pexelsQuery" placeholder="مثال: nature" />
    `;
  } else {
    urlPlace.innerHTML = ""; 
    color.innerHTML = "";
    imagePlace.innerHTML="";
  }
});

backgroundCheckboxff.addEventListener("change", () => {
  if (backgroundCheckboxff.checked) {
    urlPlaceff.innerHTML = `
      <label for="url">
        رابط يوتيوب لخلفية الفيديو  :
      </label>
      <textarea rows="5" cols="50" id="urlff"  ></textarea>
    `;
    colorff.innerHTML = `
              <div class="form-group">
                <label for="color">لون النص:</label>
                <input type="color" id="colorff" value="#ffffff" />
              </div>`;
    imagePlaceff.innerHTML=`
        أو يمكنك أستخدام صورة
        <label for="imageUrl">رابط الصورة:</label>
        <input type="text" rows="5" cols="5" id="imageUrlff" placeholder=" " />
    `;
    pexelsff.innerHTML += `
    أو يمكنك البحث في Pexels
    <label for="pexelsQueryff">كلمات البحث:</label>
    <input type="text" id="pexelsQueryff" placeholder="مثال: nature" />
  `;
  } else {
    urlPlaceff.innerHTML = ""; 
    colorff.innerHTML = "";
    imagePlaceff.innerHTML="";
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

function updateProgressBar(progress) {
  const progressContainer = document.getElementById('progress-container');
  const progressFill = progressContainer.querySelector('.progress-fill');
  const progressText = progressContainer.querySelector('.progress-text');

  const resetProgress = () => {
    progressFill.style.width = '0%';
    progressText.textContent = 'Starting... (0%)';
    progressContainer.style.display = 'none';
  };

  progressContainer.style.display = 'block';
  progressFill.style.width = `${progress.percent}%`;
  progressText.textContent = `${progress.step} (${Math.round(progress.percent)}%)`;

  if (progress.percent >= 100 || progress.error ) {
    setTimeout(() => {
      resetProgress();
    }, 2000);
  }
}

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

addProgressBar();
const progressEventSource = connectToProgressUpdates();

populateSelects();
loadVideos();
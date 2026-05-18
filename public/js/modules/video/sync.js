import { getVerseText } from '../api/api.js';
import { handleFullVideoSubmit } from '../../fullVideo.js';
import { handlePartialVideoSubmit } from '../../partialVideo.js';

let currentVersesText = [];
let verseTimings = [];
let currentVerseIndex = 0;
let audioPlayer;
let customAudioFile = null;
let currentSurahNumber = 0;
let currentStartVerse = 0;
let currentEndVerse = 0;
let currentEdition = "quran-simple";
let waveSurfer;

export async function initTapToSync(audioFile, surahNum, startV, endV, edition) {
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

  if (window.waveSurfer) {
    window.waveSurfer.destroy();
  }

  window.waveSurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: 'gold',
    progressColor: 'purple',
    barWidth: 3,
    barRadius: 3,
    height: 128,
    media: audioPlayer,
  });
  waveSurfer = window.waveSurfer;

  const audioUrl = URL.createObjectURL(customAudioFile);
  waveSurfer.load(audioUrl);
  audioPlayer.src = audioUrl;

  const fetchedVerses = await getVerseText(surahNum, startV, endV);
  if (fetchedVerses.length === 0) {
    alert("Failed to load verse texts for synchronization. Please try again.");
    window.goBack();
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

export function displayCurrentVerse() {
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

export function markVerse() {
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

  const display = document.getElementById('currentVerseDisplay');
  if (display) {
    display.style.transform = 'scale(1.05)';
    display.style.color = 'var(--primary-color)';
    display.style.transition = 'all 0.2s ease';
    setTimeout(() => {
      display.style.transform = 'scale(1)';
      display.style.color = '';
    }, 200);
  }

  const instructionOverlay = document.getElementById('syncInstructionOverlay');
  if (instructionOverlay) {
    instructionOverlay.style.display = 'none';
  }

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

export function resetSync() {
  currentVerseIndex = 0;
  verseTimings = [];
  audioPlayer.currentTime = 0;
  audioPlayer.pause();
  document.getElementById('markVerseBtn').disabled = false;
  document.getElementById('syncStatus').textContent = `الآية 1 من ${currentVersesText.length}`;
  document.getElementById('syncProgressBar').style.width = '0%';
  document.getElementById('finishSyncBtn').style.display = 'none';

  const instructionOverlay = document.getElementById('syncInstructionOverlay');
  if (instructionOverlay) {
    instructionOverlay.style.display = 'block';
  }

  displayCurrentVerse();
}

export async function finishSyncAndGenerateVideo() {
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

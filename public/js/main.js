import { handlePartialVideoSubmit } from "./partialVideo.js";
import { handleFullVideoSubmit } from "./fullVideo.js";
import { loadVideos } from "./videos.js";
import { initAuthUI, updateAuthState, isLoggedIn } from "./auth.js";
import { handlePickerShuffle, handlePickerConfirm, handlePickerCancel, handlePickerSelectAll } from "./imagePicker.js";
import { VideoState } from "./modules/core/state.js";
import { addProgressBar, connectToProgressUpdates } from "./modules/ui/progress.js";
import { populateSelects, setupVerticalVideoToggles } from "./modules/ui/forms.js";
import { initTapToSync, markVerse, resetSync, finishSyncAndGenerateVideo } from "./modules/video/sync.js";
import { updateStaticPreview } from "./modules/video/preview.js";

window.updateStaticPreview = updateStaticPreview;
window.loadVideos = loadVideos;

export function initMain() {
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
        videoNumber: 1,
        resolution: document.getElementById("resolutionPartCustom")?.value || '720p'
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
        const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}`);
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
        resolution: document.getElementById("resolutionFullCustom")?.value || '720p'
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
        videoNumber: (document.getElementById("pexelsVideoFullCustom")?.value ? `unsplash:${document.getElementById("pexelsVideoFullCustom").value}` : (document.getElementById("imageLinkFullCustom")?.value || document.getElementById("youtubeLinkFullCustom")?.value)),
        crop: document.getElementById("verticalVideoFullCustom")?.checked ? "horizontal" : "vertical",
        subtitlePosition: document.getElementById("subtitlePositionFullCustom")?.value || 'bottom',
        showMetadata: document.getElementById("showMetadataFullCustom")?.checked || false,
        resolution: document.getElementById("resolutionFullCustom")?.value || '720p'
      };

      const surahNum = window.tempVideoFormData.surahNumber;
      let endVerse;
      try {
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}`);
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
        videoNumber: (document.getElementById("pexelsVideoPartCustom")?.value ? `unsplash:${document.getElementById("pexelsVideoPartCustom").value}` : (document.getElementById("imageLinkPartCustom")?.value || document.getElementById("youtubeLinkPartCustom")?.value)),
        crop: document.getElementById("verticalVideoPartCustom")?.checked ? "horizontal" : "vertical",
        subtitlePosition: document.getElementById("subtitlePositionPartCustom")?.value || 'bottom',
        showMetadata: document.getElementById("showMetadataPartCustom")?.checked || false,
        resolution: document.getElementById("resolutionPartCustom")?.value || '720p'
      };

      initTapToSync(customAudio, window.tempVideoFormData.surahNumber, window.tempVideoFormData.startVerse, window.tempVideoFormData.endVerse, window.tempVideoFormData.edition);
    });
  }
  if (fullFormBtn) {
    fullFormBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleFullVideoSubmit(e);
    });
  }

  if (partFormBtn) {
    partFormBtn.addEventListener('click', (e) => {
      e.preventDefault();
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
  document.getElementById('pexelsVideoPart')?.addEventListener('blur', updateStaticPreview);

  if (!window._globalListenersInitialized) {
    document.getElementById('playPauseBtn')?.addEventListener('click', () => {
      if (window.waveSurfer) {
        window.waveSurfer.playPause();
      }
    });

    document.getElementById('stopBtn')?.addEventListener('click', () => {
      if (window.waveSurfer) {
        window.waveSurfer.stop();
      }
    });

    document.getElementById('imagePickerShuffle')?.addEventListener('click', handlePickerShuffle);
    document.getElementById('imagePickerConfirm')?.addEventListener('click', handlePickerConfirm);
    document.getElementById('imagePickerCancel')?.addEventListener('click', handlePickerCancel);
    document.getElementById('imagePickerCancelBtn')?.addEventListener('click', handlePickerCancel);
    document.getElementById('imagePickerSelectAll')?.addEventListener('click', handlePickerSelectAll);
    document.querySelectorAll('.picker-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.picker-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        window.setPickerFilter?.(e.target.dataset.filter);
      });
    });
  }

  document.getElementById('feedbackForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('feedbackType').value;
    const content = document.getElementById('feedbackContent').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeaders?.()
        },
        body: JSON.stringify({ type, content })
      });

      if (!response.ok) throw new Error('فشل إرسال الرسالة');

      window.showToast?.('تم إرسال رأيك بنجاح، شكراً لك!');
      e.target.reset();
      window.goBack?.();
    } catch (error) {
      console.error('Feedback error:', error);
      window.showToast?.('حدث خطأ أثناء الإرسال، يرجى المحاولة لاحقاً');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال';
    }
  });

  initAuthUI();
  updateAuthState();
  addProgressBar();
  connectToProgressUpdates();

  if (isLoggedIn()) {
    loadVideos();
  }
  window._globalListenersInitialized = true;
  populateSelects();
  setupVerticalVideoToggles();
}
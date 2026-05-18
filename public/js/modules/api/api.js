import { updateProgressBar } from '../ui/progress.js';

export async function pollJobStatus(jobId) {
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) progressContainer.style.display = 'block';

  let errorCount = 0;
  const maxErrors = 5;

  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(`/job-status/${jobId}`);
      if (!response.ok) {
        throw new Error('Could not get job status (status: ' + response.status + ')');
      }
      const job = await response.json();
      errorCount = 0;

      updateProgressBar({
        step: job.progress?.step || job.state,
        percent: job.progress?.percent || (job.state === 'completed' ? 100 : 0)
      });

      if (job.state === 'completed') {
        if (!job.result) {
          console.warn('Job marked as completed but result is missing. Retrying next poll...');
          return;
        }
        clearInterval(intervalId);
        console.log('Job completed:', job.result);
        sessionStorage.setItem('latestVidPath', job.result.vidPath);
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
      console.error('Error polling job status:', error);
      errorCount++;
      if (errorCount >= maxErrors) {
        clearInterval(intervalId);
        alert('Error checking video progress. Please check the gallery later.');
        if (progressContainer) progressContainer.style.display = 'none';
      }
    }
  }, 2000);
}

window.pollJobStatus = pollJobStatus;

export async function getVerseText(surahNumber, startVerse, endVerse) {
  try {
    if (startVerse < 1 || endVerse < startVerse) {
      alert('الرجاء إدخال نطاق ايات صحيح. يجب أن يكون اية البداية 1 على الأقل، ويجب أن يكون اية النهاية أكبر من أو يساوي اية البداية..');
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
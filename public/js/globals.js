window.previousPage = '';
window.currentShareUrl = '';

const pageToRoute = {
  'mainMenu': '/',
  'authPage': '/auth',
  'fullOptions': '/full-options',
  'partOptions': '/part-options',
  'fullForm': '/full-form',
  'partForm': '/part-form',
  'fullFormCustom': '/full-custom',
  'partFormCustom': '/part-custom',
  'tapToSyncPage': '/sync',
  'videoPreview': '/preview',
  'gallery': '/gallery',
  'feedbackPage': '/feedback'
};

const routeToPage = Object.fromEntries(Object.entries(pageToRoute).map(([k, v]) => [v, k]));

window.showPage = function (pageId, from = '') {
  const currentHash = window.location.hash.slice(1) || '/';
  const currentPage = routeToPage[currentHash] || 'mainMenu';
  window.previousPage = from || currentPage;
  
  const targetPath = pageToRoute[pageId] || '/';
  window.location.hash = targetPath;
};

window.goBack = () => window.showPage(window.previousPage || 'mainMenu');
window.downloadVideoByUrl = function (url, fileName) {
  window.showToast('جار التحميل...');
  const downloadUrl = url.includes('?') ? url + '&download=true' : url + '?download=true';
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName || 'quran_video.mp4';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 300);
};

window.downloadCurrentVideo = function() {
  const videoElement = document.getElementById('previewVideo');
  if(!videoElement)
    return;

  const vidPath = videoElement.getAttribute('data-filename');
  if (!vidPath)
    return alert('لا يمكن العثور على اسم الملف');

  const fileName = vidPath.split('/').pop();
  window.downloadVideoByUrl(`/videos/${vidPath}`, fileName);
};

window.openShareModal = function(videoUrl) {
  window.currentShareUrl = videoUrl;
  const nativeBtn = document.getElementById('shareNative');
  if (navigator.share && nativeBtn)
    nativeBtn.style.display = 'flex';

  const modal = document.getElementById('shareModal');
  if(modal)
    modal.style.display = 'flex';
};

window.closeShareModal = function() {
  const modal = document.getElementById('shareModal');
  if(modal)
    modal.style.display = 'none';

  window.currentShareUrl = '';
};

document.addEventListener('click', (e) => {
  if (e.target.id === 'shareModal')
    window.closeShareModal();
});

window.shareTo = function(platform) {
  const url = encodeURIComponent(window.currentShareUrl);
  const text = encodeURIComponent('شاهد هذا الفيديو للقرآن الكريم');
  let shareUrl = '';

  switch (platform) {
    case 'whatsapp':
      shareUrl = `https://wa.me/?text=${text}%20${url}`;
      break;
    case 'telegram':
      shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
      break;
    case 'twitter':
      shareUrl = `https://x.com/intent/tweet?url=${url}&text=${text}`;
      break;
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      break;
    case 'copy':
      navigator.clipboard.writeText(window.currentShareUrl).then(() => {
        window.showToast('تم نسخ الرابط ✓');
      }).catch(() => {
        const input = document.createElement('input');
        input.value = window.currentShareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        window.showToast('تم نسخ الرابط ✓');
      });
      window.closeShareModal();
      return;
    case 'native':
      navigator.share({
        title: 'Quran Video - QVM',
        text: 'شاهد هذا الفيديو للقرآن الكريم',
        url: window.currentShareUrl
      }).catch(console.error);
      window.closeShareModal();
      return;
  }

  if (shareUrl) window.open(shareUrl, '_blank', 'noopener,noreferrer');
  window.closeShareModal();
};

window.shareCurrentVideo = function() {
  const videoElement = document.getElementById('previewVideo');
  if(!videoElement)
    return;

  const vidPath = videoElement.getAttribute('data-filename');
  if (!vidPath)
    return alert('لا يوجد فيديو متاح للمشاركة');

  const videoUrl = `${window.location.origin}/videos/${vidPath}`;
  window.openShareModal(videoUrl);
};

window.showToast = function(message, duration = 2500) {
  const toast = document.getElementById('toastNotification');
  if(!toast)
    return;

  toast.textContent = message;
  toast.style.display = 'block';
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.style.display = 'none'; }, 300);
  }, duration);
};

export function initGlobals() {
  const fontSize = document.getElementById('fontSize');
  if(fontSize) {
    fontSize.addEventListener('input', e => {
      const label = document.getElementById('fontSizeValue');
      if(label)
        label.textContent = e.target.value + 'px';
    });
  }
  
  const fontSizePart = document.getElementById('fontSizePart');
  if(fontSizePart) {
    fontSizePart.addEventListener('input', e => {
      const label = document.getElementById('fontSizeValuePart');
      if(label)
        label.textContent = e.target.value + 'px';
    });
  }
}
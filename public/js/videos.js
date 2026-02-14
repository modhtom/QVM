import { getAuthHeaders } from './auth.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function createVideoCard(video, galleryGrid) {
  const safeVideo = escapeHtml(video);
  const safeCardId = `card-${video.replace(/[^\w-]/g, '')}`;
  const displayName = video.replace(/_/g, ' ').substring(0, 30) + '...';

  const card = document.createElement('div');
  card.className = 'gallery-item';
  card.id = safeCardId;

  const preview = document.createElement('div');
  preview.className = 'gallery-preview';
  const videoEl = document.createElement('video');
  videoEl.controls = true;
  videoEl.preload = 'metadata';
  const source = document.createElement('source');
  source.src = `/videos/${encodeURIComponent(video)}`;
  source.type = 'video/mp4';
  videoEl.appendChild(source);
  preview.appendChild(videoEl);

  const content = document.createElement('div');
  content.className = 'gallery-content';

  const title = document.createElement('div');
  title.className = 'gallery-title';
  title.title = video;
  title.textContent = displayName;

  const actions = document.createElement('div');
  actions.className = 'gallery-actions';

  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'btn-mini download-btn';
  downloadBtn.title = 'تحميل';
  downloadBtn.innerHTML = '<i class="fas fa-download">تحميل</i>';
  downloadBtn.addEventListener('click', () => {
    window.location.href = `/videos/${encodeURIComponent(video)}?download=true`;
  });

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-mini share-btn';
  shareBtn.title = 'مشاركة';
  shareBtn.innerHTML = '<i class="fas fa-share-alt">مشاركة</i>';
  shareBtn.addEventListener('click', () => shareVideo(video));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-mini delete-btn';
  deleteBtn.title = 'حذف';
  deleteBtn.style.color = '#ff4444';
  deleteBtn.style.borderColor = '#ff4444';
  deleteBtn.innerHTML = '<i class="fas fa-trash-alt">حذف</i>';
  deleteBtn.addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من حذف هذا الفيديو؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        const res = await fetch(`/api/videos/${encodeURIComponent(video)}`, { method: 'DELETE', headers: getAuthHeaders() });
        if (res.ok) {
          card.style.opacity = '0';
          setTimeout(() => card.remove(), 300);
          if (document.querySelectorAll('.gallery-item').length <= 1) {
            galleryGrid.innerHTML = '<div class="empty-state"><i class="fas fa-film"></i><p>لا توجد مقاطع فيديو حتى الآن قم باعادة تحميل الصفحة ان كنت تعتقد ان هنالك فديوهات</p></div>';
          }
        } else {
          alert('حدث خطأ أثناء الحذف');
        }
      } catch (e) {
        console.error(e);
        alert('فشل الاتصال بالخادم');
      }
    }
  });

  actions.appendChild(downloadBtn);
  actions.appendChild(shareBtn);
  actions.appendChild(deleteBtn);
  content.appendChild(title);
  content.appendChild(actions);
  card.appendChild(preview);
  card.appendChild(content);

  return card;
}

export async function loadVideos() {
  const galleryGrid = document.getElementById('gallery-grid');

  try {
    const response = await fetch('/api/videos', { headers: getAuthHeaders() });
    const data = await response.json();
    if (!data.videos || data.videos.length === 0) {
      galleryGrid.innerHTML = '<div class="empty-state"><i class="fas fa-film"></i><p>لا توجد مقاطع فيديو حتى الآن قم باعادة تحميل الصفحة ان كنت تعتقد ان هنالك فديوهات</p></div>';
      return;
    }

    const sortedVideos = data.videos.sort().reverse();
    galleryGrid.innerHTML = '';
    sortedVideos.forEach(video => {
      galleryGrid.appendChild(createVideoCard(video, galleryGrid));
    });

  } catch (error) {
    console.error(error);
    galleryGrid.innerHTML = '<p style="color:red">حدث خطأ أثناء تحميل المعرض</p>';
  }
}

export function shareVideo(videoName) {
  const videoUrl = `${window.location.origin}/videos/${encodeURIComponent(videoName)}`;
  if (navigator.share) {
    navigator.share({
      title: 'Quran Video',
      text: 'شاهد هذا الفيديو للقرآن الكريم',
      url: videoUrl
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(videoUrl);
    alert('تم نسخ رابط الفيديو إلى الحافظة');
  }
}
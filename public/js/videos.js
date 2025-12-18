export async function loadVideos() {
  const galleryGrid = document.getElementById('gallery-grid');
  
  try {
    const response = await fetch('/api/videos');
    const data = await response.json();
    if (!data.videos || data.videos.length === 0) {
      galleryGrid.innerHTML = '<div class="empty-state"><i class="fas fa-film"></i><p>لا توجد مقاطع فيديو حتى الآن</p></div>';
      return;
    }

    const sortedVideos = data.videos.sort().reverse();
    galleryGrid.innerHTML = sortedVideos.map(video => `
      <div class="gallery-item" id="card-${video.replace(/[^\w-]/g, '')}">
        <div class="gallery-preview">
          <video controls preload="metadata">
            <source src="/videos/${video}" type="video/mp4">
          </video>
        </div>
        <div class="gallery-content">
          <div class="gallery-title" title="${video}">${video.replace(/_/g, ' ').substring(0, 30)}...</div>
          <div class="gallery-actions">
            <button class="btn-mini download-btn" data-video="${video}" title="تحميل">
              <i class="fas fa-download">تحميل</i>
            </button>
            <button class="btn-mini share-btn" data-video="${video}" title="مشاركة">
              <i class="fas fa-share-alt">مشاركة</i>
            </button>
            <button class="btn-mini delete-btn" data-video="${video}" title="حذف" style="color: #ff4444; border-color: #ff4444;">
              <i class="fas fa-trash-alt">حذف</i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const videoName = btn.dataset.video;
        window.location.href = `/videos/${videoName}?download=true`;
      });
    });

    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const videoName = btn.dataset.video;
        shareVideo(videoName);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const videoName = btn.dataset.video;
        if (confirm('هل أنت متأكد من حذف هذا الفيديو؟ لا يمكن التراجع عن هذا الإجراء.')) {
          try {
            const res = await fetch(`/api/videos/${videoName}`, { method: 'DELETE' });
            if (res.ok) {
              const cardId = `card-${videoName.replace(/[^\w-]/g, '')}`;
              const card = document.getElementById(cardId);
              if (card) {
                card.style.opacity = '0';
                setTimeout(() => card.remove(), 300);
                if (document.querySelectorAll('.gallery-item').length <= 1) {
                  galleryGrid.innerHTML = '<div class="empty-state"><i class="fas fa-film"></i><p>لا توجد مقاطع فيديو حتى الآن</p></div>';
                }
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
    });

  } catch (error) {
    console.error(error);
    galleryGrid.innerHTML = '<p style="color:red">حدث خطأ أثناء تحميل المعرض</p>';
  }
}

export function shareVideo(videoName) {
  const videoUrl = `${window.location.origin}/videos/${videoName}`;
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
export async function loadVideos() {
  const galleryGrid = document.getElementById('gallery-grid');
  
  try {
    const response = await fetch('/api/videos');
    const data = await response.json();

    if (!data.videos || data.videos.length === 0) {
      galleryGrid.innerHTML = '<p>لا توجد مقاطع فيديو متاحة</p>';
      return;
    }

    galleryGrid.innerHTML = data.videos.map(video => `
      <div class="gallery-item">
        <div class="gallery-preview">
          <video controls>
            <source src="/videos/${video}" type="video/mp4">
          </video>
        </div>
        <div class="gallery-content">
          <div class="gallery-title">${video.replace(/_/g, ' ').replace('.mp4', '')}</div>
          <div class="gallery-actions">
            <button class="btn-mini download-btn" data-video="${video}">
              <i class="fas fa-download"></i> تحميل
            </button>
            <button class="btn-mini share-btn" data-video="${video}">
              <i class="fas fa-share-alt"></i> مشاركة
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Download functionality
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const videoName = btn.dataset.video;
        window.location.href = `/videos/${videoName}?download=true`;
      });
    });

    // Share functionality
    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const videoName = btn.dataset.video;
        shareVideo(videoName);
      });
    });

  } catch (error) {
    galleryGrid.innerHTML = '<p>حدث خطأ أثناء تحميل مقاطع الفيديو</p>';
  }
}

// Update shareVideo function
export function shareVideo(videoName) {
  const videoUrl = `${window.location.origin}/videos/${videoName}`;
  
  if (navigator.share) {
    navigator.share({
      title: 'Quran Video',
      text: 'شاهد هذا الفيديو للقرآن الكريم',
      url: videoUrl
    }).catch(console.error);
  } else {
    alert(`رابط الفيديو: ${videoUrl}`);
  }
}
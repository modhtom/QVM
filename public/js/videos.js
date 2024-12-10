export async function loadVideos() {
    const videosContainer = document.getElementById('videos-list');
    
    try {
        const response = await fetch('/videos');
        const data = await response.json();
        
        videosContainer.innerHTML = data.videos.map(video => `
            <div class="video-card">
                <video controls>
                    <source src="/videos/${video}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <p class="video-title">${video}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading videos:', error);
        videosContainer.innerHTML = '<p>Error loading videos</p>';
    }
}
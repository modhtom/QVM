export async function handlePartialVideoSubmit(e) {
  e.preventDefault();

  // Use correct vertical video checkbox ID
  const isVertical = document.getElementById("verticalVideoPart")?.checked;
  const crop = isVertical ? "horizontal":"vertical";

  const surahNumber = document.getElementById("surahNumber").value;

  // Get verse values
  const startVerse = parseInt(document.getElementById("startVerse").value);
  const endVerse = parseInt(document.getElementById("endVerse").value);

  const edition = document.getElementById("edition").value;

  // Use correct color and size IDs
  const color = document.getElementById("fontColorPart").value;
  const size = document.getElementById("fontSizePart").value;

  let videoData = 1;

  // Use correct background input IDs
  const pexelsQuery = document.getElementById("pexelsVideoPart")?.value;
  const imageUrl = document.getElementById("imageLinkPart")?.value;
  const youtubeUrl = document.getElementById("youtubeLinkPart")?.value;

  if (pexelsQuery) {
    videoData = `pexels:${pexelsQuery}`;
  } else if (imageUrl) {
    videoData = imageUrl;
  } else if (youtubeUrl) {
    videoData = youtubeUrl;
  }

  const formData = {
    surahNumber,
    startVerse,
    endVerse,
    edition,
    color,
    useCustomBackground: videoData !== 1,
    removeFilesAfterCreation: true,
    videoNumber: videoData,
    size,
    crop
  };

  try {
    const response = await fetch("/generate-partial-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      const data = await response.json();
      const videoElement = document.getElementById("previewVideo");
      videoElement.src = `/videos/${data.vidPath}`;
      videoElement.setAttribute('data-filename', data.vidPath);
      // Make showPage accessible
      if (window.showPage) {
        window.showPage("videoPreview");
      } else {
        console.error("showPage function not found");
      }
    } else {
      throw new Error("Failed to generate video");
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}
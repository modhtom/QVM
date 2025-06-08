export async function handleFullVideoSubmit(e) {
  e.preventDefault();

  // Use correct vertical video checkbox ID
  const isVertical = document.getElementById("verticalVideoFull")?.checked;
  const crop = isVertical ? "horizontal":"vertical";

  const surahNumber = document.getElementById("fullSurahNumber").value;
  const edition = document.getElementById("fullEdition").value;

  // Use correct color and size IDs
  const color = document.getElementById("fontColor").value;
  const size = document.getElementById("fontSize").value;

  let videoData = 1;

  // Use correct background input IDs
  const pexelsQuery = document.getElementById("pexelsVideo")?.value;
  const imageUrl = document.getElementById("imageLink")?.value;
  const youtubeUrl = document.getElementById("youtubeLink")?.value;

  if (pexelsQuery) {
    videoData = `pexels:${pexelsQuery}`;
  } else if (imageUrl) {
    videoData = imageUrl;
  } else if (youtubeUrl) {
    videoData = youtubeUrl;
  }

  const formData = {
    surahNumber,
    edition,
    color,
    useCustomBackground: videoData !== 1,
    removeFilesAfterCreation: true,
    videoNumber: videoData,
    size,
    crop
  };

  try {
    const response = await fetch("/generate-full-video", {
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
      throw new Error("Failed to generate full video");
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}
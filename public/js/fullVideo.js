import { loadVideos } from "./videos.js";
export async function handleFullVideoSubmit(e) {
  e.preventDefault();
  let videoData;
  if (document.getElementById("backff").checked) {
    const imageUrl = document.getElementById("imageUrlff").value;
    const pexelsQuery = document.getElementById("pexelsQueryff").value;
    if (pexelsQuery) {
      videoData = `pexels:${pexelsQuery}`;
    } else if (imageUrl) {
      videoData = imageUrl;
    } else {
      videoData = document.getElementById("urlff").value;
    }
  } else {
    videoData = 1;
  }
  const CustomBackground = document.getElementById("backff").checked;
  const formData = {
    surahNumber: parseInt(document.getElementById("fullSurahNumber").value),
    edition: document.getElementById("fullEdition").value,
    color: document.getElementById("colorff").value,
    useCustomBackground:CustomBackground,
    removeFilesAfterCreation: true,
    videoNumber: videoData,
    size: document.getElementById("size").value,
  };

  try {
    const response = await fetch("/generate-full-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok) {
      loadVideos();
      alert("Video Created.")
    } else {
      throw new Error(data.message || "Failed to generate full video");
    }
  } catch (error) {
    alert(`Error: something went wrong, please try again.`);
  }
}

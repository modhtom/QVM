import { loadVideos } from "./videos.js";
export async function handlePartialVideoSubmit(e) {
  e.preventDefault();
  let crop = "vertical";
  if (document.getElementById("crop").checked)
    crop = "horizontal";
  let videoData;
  if (document.getElementById("back").checked) {
    const imageUrl = document.getElementById("imageUrl").value;
    const pexelsQuery = document.getElementById("pexelsQuery").value;
    if (pexelsQuery) {
      videoData = `pexels:${pexelsQuery}`;
    }
    else if (imageUrl) {
      videoData = imageUrl;
    } else {
      videoData = document.getElementById("url").value;
    }
  } else {
    videoData = 1;
  }

  const formData = {
    surahNumber: parseInt(document.getElementById("surahNumber").value),
    startVerse: parseInt(document.getElementById("startVerse").value),
    endVerse: parseInt(document.getElementById("endVerse").value),
    edition: document.getElementById("edition").value,
    color: document.getElementById("color").value,
    useCustomBackground: document.getElementById("back").checked,
    removeFilesAfterCreation: true,
    videoNumber: videoData,
    size: document.getElementById("size").value,
    crop,
  };

  try {
    const response = await fetch("/generate-partial-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Video generated successfully!");
      loadVideos(); 
    } else {
      throw new Error(data.message || "Failed to generate video");
    }
  } catch (error) {
    alert(`Error: something went wrong, please try again.`);
  }
}
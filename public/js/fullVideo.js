import { loadVideos } from "./videos.js";
export async function handleFullVideoSubmit(e) {
  e.preventDefault();
  let videoData;
  if (document.getElementById("back").checked)
    videoData = document.getElementById("url").value;
  else 
    videoData = 1;
  const formData = {
    surahNumber: parseInt(document.getElementById("fullSurahNumber").value),
    edition: document.getElementById("fullEdition").value,
    color: document.getElementById("fullColor").value,
    useCustomBackground:document.getElementById("back").checked,
    removeFilesAfterCreation: true,
    videoNumber: videoData,
  };

  try {
    alert("Started creating video");
    const response = await fetch("/generate-full-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Full video generated successfully!");
      loadVideos();
    } else {
      throw new Error(data.message || "Failed to generate full video");
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

export async function updateStaticPreview() {
  const previewImage = document.getElementById('static-preview-image');
  if (!previewImage) return;
  
  previewImage.style.opacity = '0.5';

  const payload = {
    surahNumber: document.getElementById("surahNumber").value,
    startVerse: document.getElementById("startVerse").value || 1,
    color: document.getElementById("fontColorPart").value,
    fontName: document.getElementById("fontNamePart")?.value || 'Tasees Regular',
    size: document.getElementById("fontSizePart").value,
    background: document.getElementById("pexelsVideoPart")?.value || document.getElementById("imageLinkPart")?.value,
    translationEdition: document.getElementById("translationEditionPart")?.value || ''
  };

  try {
    const response = await fetch('/generate-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to generate preview');

    const data = await response.json();
    previewImage.src = data.previewPath + `?t=${new Date().getTime()}`;
    previewImage.style.opacity = '1';
  } catch (error) {
    console.error("Preview Error:", error);
    previewImage.style.opacity = '1';
  }
}

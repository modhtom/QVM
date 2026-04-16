import { getAuthHeaders } from './auth.js';

let pickerResolve = null;
let currentImages = [];
let selectedIds = new Set();
let pickerParams = {};
let shufflePage = 1;

export function showImagePicker({ surahNumber, startVerse, endVerse, crop, query }) {
  pickerParams = { surahNumber, startVerse, endVerse, crop, query };
  selectedIds.clear();
  currentImages = [];
  shufflePage = 1;

  const overlay = document.getElementById('imagePickerOverlay');
  const grid = document.getElementById('imagePickerGrid');
  const confirmBtn = document.getElementById('imagePickerConfirm');
  const countBadge = document.getElementById('imagePickerCount');

  grid.innerHTML = '';
  overlay.style.display = 'flex';
  confirmBtn.disabled = true;
  countBadge.textContent = '0';

  grid.innerHTML = `
    <div class="image-picker-loading">
      <div class="image-picker-spinner"></div>
      <p>جاري البحث عن صور مناسبة...</p>
    </div>
  `;

  fetchAndRender();

  return new Promise((resolve) => {
    pickerResolve = resolve;
  });
}

async function fetchAndRender() {
  const grid = document.getElementById('imagePickerGrid');

  try {
    const params = new URLSearchParams({
      crop: pickerParams.crop || 'horizontal'
    });

    if (pickerParams.query) {
      params.set('query', pickerParams.query);
    } else {
      params.set('surahNumber', pickerParams.surahNumber);
      params.set('startVerse', pickerParams.startVerse || 1);
      params.set('endVerse', pickerParams.endVerse || pickerParams.startVerse || 1);
    }

    const response = await fetch(`/api/suggest-backgrounds?${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    currentImages = data.images || [];

    if (currentImages.length === 0) {
      grid.innerHTML = `
        <div class="image-picker-loading">
          <p>لم يتم العثور على صور. حاول مرة أخرى.</p>
        </div>
      `;
      return;
    }

    selectedIds = new Set(currentImages.map(img => img.id));
    renderGrid();
    updateControls();

  } catch (error) {
    console.error('Image picker fetch error:', error);
    grid.innerHTML = `
      <div class="image-picker-loading">
        <p style="color: #ff6b6b;">خطأ في جلب الصور: ${error.message}</p>
      </div>
    `;
  }
}

function renderGrid() {
  const grid = document.getElementById('imagePickerGrid');
  grid.innerHTML = '';

  currentImages.forEach((img) => {
    const item = document.createElement('div');
    item.className = `image-picker-item ${selectedIds.has(img.id) ? 'selected' : 'deselected'}`;
    item.dataset.id = img.id;

    item.innerHTML = `
      <img src="${img.thumb}" alt="${img.alt || ''}" loading="lazy" />
      <div class="image-picker-check">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="image-picker-deselect-icon">
        <i class="fas fa-times-circle"></i>
      </div>
    `;

    item.addEventListener('click', () => toggleImage(img.id));
    grid.appendChild(item);
  });
}

function toggleImage(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }

  const item = document.querySelector(`.image-picker-item[data-id="${id}"]`);
  if (item) {
    item.classList.toggle('selected', selectedIds.has(id));
    item.classList.toggle('deselected', !selectedIds.has(id));
  }

  updateControls();
}

function updateControls() {
  const confirmBtn = document.getElementById('imagePickerConfirm');
  const countBadge = document.getElementById('imagePickerCount');
  const count = selectedIds.size;

  countBadge.textContent = count;

  if (count < 3) {
    confirmBtn.disabled = true;
    confirmBtn.title = 'اختر 3 صور على الأقل';
  } else {
    confirmBtn.disabled = false;
    confirmBtn.title = '';
  }
}

export async function handlePickerShuffle() {
  const keptImages = currentImages.filter(img => selectedIds.has(img.id));
  const slotsToFill = Math.max(1, 15 - keptImages.length);

  if (slotsToFill === 0) {
    return;
  }

  const grid = document.getElementById('imagePickerGrid');
  grid.innerHTML = '';
  keptImages.forEach(img => {
    const item = document.createElement('div');
    item.className = 'image-picker-item selected';
    item.dataset.id = img.id;
    item.innerHTML = `
      <img src="${img.thumb}" alt="${img.alt || ''}" loading="lazy" />
      <div class="image-picker-check">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="image-picker-deselect-icon">
        <i class="fas fa-times-circle"></i>
      </div>
    `;
    item.addEventListener('click', () => toggleImage(img.id));
    grid.appendChild(item);
  });

  const loadingEl = document.createElement('div');
  loadingEl.className = 'image-picker-loading';
  loadingEl.innerHTML = `
    <div class="image-picker-spinner"></div>
    <p>جاري البحث عن صور جديدة...</p>
  `;
  grid.appendChild(loadingEl);

  try {
    const keptIds = keptImages.map(img => img.id);
    const params = new URLSearchParams({
      crop: pickerParams.crop || 'horizontal',
      page: shufflePage
    });
    if (pickerParams.query) {
      params.set('query', pickerParams.query);
    } else {
      params.set('surahNumber', pickerParams.surahNumber);
      params.set('startVerse', pickerParams.startVerse || 1);
      params.set('endVerse', pickerParams.endVerse || pickerParams.startVerse || 1);
    }
    if (keptIds.length > 0) {
      params.set('excludeIds', keptIds.join(','));
    }

    const response = await fetch(`/api/suggest-backgrounds?${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    const fetchedImages = data.images || [];
    const keptIdSet = new Set(keptIds);
    const newImages = fetchedImages.filter(img => !keptIdSet.has(img.id));
    const replacements = newImages.slice(0, slotsToFill);

    currentImages = [...keptImages, ...replacements];
    replacements.forEach(img => selectedIds.add(img.id));

    renderGrid();
    updateControls();

    shufflePage++;
  } catch (error) {
    console.error('Shuffle fetch error:', error);
    loadingEl.remove();
  }
}

export function handlePickerConfirm() {
  const selectedUrls = currentImages
    .filter(img => selectedIds.has(img.id))
    .map(img => img.url);

  closeImagePicker();

  if (pickerResolve) {
    pickerResolve(selectedUrls);
    pickerResolve = null;
  }
}

export function handlePickerCancel() {
  closeImagePicker();

  if (pickerResolve) {
    pickerResolve(null);
    pickerResolve = null;
  }
}

export function handlePickerSelectAll() {
  const allSelected = selectedIds.size === currentImages.length;

  if (allSelected) {
    selectedIds.clear();
  } else {
    selectedIds = new Set(currentImages.map(img => img.id));
  }

  renderGrid();
  updateControls();
}

function closeImagePicker() {
  const overlay = document.getElementById('imagePickerOverlay');
  overlay.style.display = 'none';
}

export function needsImagePicker(useCustomBg, videoNumber) {
  // We need picker if it's AI selection (!useCustomBg)
  // OR if it's a manual Unsplash keyword (videoNumber starts with 'unsplash:')
  return !useCustomBg || (typeof videoNumber === 'string' && videoNumber.startsWith('unsplash:'));
}

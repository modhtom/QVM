import { surahs } from '../../data/surahs.js';

export const selects = {
  fullMushaf: null,
  fullReciter: null,
  fullSurah: null,
  partMushaf: null,
  partReciter: null,
  partSurah: null,
  customFullSurah: null,
  customPartSurah: null
};

let allReciters = [];
let groupedData = {};

export async function populateSelects() {
  try {
    const response = await fetch('/api/metadata');
    if (!response.ok) throw new Error("Metadata not found");
    const data = await response.json();

    allReciters = data.reciters;
    groupedData = {};
    allReciters.forEach(reciter => {
      reciter.moshafs.forEach(moshaf => {
        if (!groupedData[moshaf.name]) {
          groupedData[moshaf.name] = [];
        }
        groupedData[moshaf.name].push({
          reciterId: reciter.id,
          reciterName: reciter.name,
          server: moshaf.server,
          surahList: moshaf.surah_list
        });
      });
    });

    const mushafNames = Object.keys(groupedData).sort();
    const mushafOptions = mushafNames.map(name => ({ value: name, text: name }));
    const transOptions = data.translations.map(t => ({
      value: t.identifier,
      text: `${t.language.toUpperCase()} - ${t.name} (${t.englishName})`
    }));
    transOptions.unshift({ value: "", text: "بدون ترجمة" });

    ['translationEditionFull', 'translationEditionPart', 'translationEditionFullCustom', 'translationEditionPartCustom'].forEach(id => {
      if (document.getElementById(id)) {
        new TomSelect(`#${id}`, {
          options: transOptions,
          valueField: 'value',
          labelField: 'text',
          searchField: ['text'],
          placeholder: 'اختر الترجمة...',
        });
      }
    });

    const surahOptions = surahs.map(s => ({ value: s.number, text: `${s.number}. ${s.name}` }));
    const createSelect = (id, options, placeholder) => {
      if (!document.getElementById(id)) return null;
      return new TomSelect(`#${id}`, {
        options: options,
        valueField: 'value',
        labelField: 'text',
        searchField: ['text'],
        placeholder: placeholder,
        maxOptions: 250
      });
    };

    selects.customFullSurah = createSelect('fullSurahNumberCustom', surahOptions, 'اختر السورة...');
    selects.customPartSurah = createSelect('surahNumberCustom', surahOptions, 'اختر السورة...');

    selects.fullMushaf = createSelect('fullMushaf', mushafOptions, 'اختر الرواية...');
    selects.partMushaf = createSelect('partMushaf', mushafOptions, 'اختر الرواية...');

    selects.fullReciter = createSelect('fullEdition', [], 'اختر القارئ...');
    selects.partReciter = createSelect('edition', [], 'اختر القارئ...');

    selects.fullSurah = createSelect('fullSurahNumber', [], 'اختر السورة...');
    selects.partSurah = createSelect('surahNumber', [], 'اختر السورة...');

    const handleMushafChange = (mushafName, reciterSelect, surahSelect) => {
      if (!mushafName) return;
      const reciters = groupedData[mushafName];

      reciterSelect.clear();
      reciterSelect.clearOptions();
      surahSelect.clear();
      surahSelect.clearOptions();

      const options = reciters.map(r => ({
        value: r.server,
        text: r.reciterName,
        surahList: r.surahList
      }));

      reciterSelect.addOption(options);
    };

    const handleReciterChange = (serverUrl, reciterSelect, surahSelect) => {
      if (!serverUrl) return;

      const selectedOption = reciterSelect.options[serverUrl];
      if (!selectedOption) return;

      const availableSurahs = selectedOption.surahList.split(',');

      surahSelect.clear();
      surahSelect.clearOptions();

      const filteredSurahs = surahs
        .filter(s => availableSurahs.includes(String(s.number)))
        .map(s => ({ value: s.number, text: `${s.number}. ${s.name}` }));

      surahSelect.addOption(filteredSurahs);
    };

    if (selects.fullMushaf) {
        selects.fullMushaf.on('change', (val) => handleMushafChange(val, selects.fullReciter, selects.fullSurah));
    }
    if (selects.fullReciter) {
        selects.fullReciter.on('change', (val) => handleReciterChange(val, selects.fullReciter, selects.fullSurah));
    }

    if (selects.partMushaf) {
        selects.partMushaf.on('change', (val) => handleMushafChange(val, selects.partReciter, selects.partSurah));
    }
    if (selects.partReciter) {
        selects.partReciter.on('change', (val) => handleReciterChange(val, selects.partReciter, selects.partSurah));
    }

  } catch (error) {
    console.error("Failed to load metadata:", error);
  }
}

export function setupVerticalVideoToggles() {
  const handleToggle = (checkboxId, fontSizeId, labelId) => {
    const checkbox = document.getElementById(checkboxId);
    const fontSizeInput = document.getElementById(fontSizeId);
    const fontLabel = document.getElementById(labelId);

    if (checkbox && fontSizeInput) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          fontSizeInput.value = 5;
          if (fontLabel)
            fontLabel.textContent = '5px';
        } else {
          fontSizeInput.value = 10;
          if (fontLabel)
            fontLabel.textContent = '10px';
        }
        if (window.updateStaticPreview)
          window.updateStaticPreview();
      });
    }
  };

  handleToggle('verticalVideoFull', 'fontSize', 'fontSizeValue');
  handleToggle('verticalVideoPart', 'fontSizePart', 'fontSizeValuePart');
  handleToggle('verticalVideoFullCustom', 'fontSizeFullCustom', 'fontSizeValueFullCustom');
  handleToggle('verticalVideoPartCustom', 'fontSizePartCustom', 'fontSizeValuePartCustom');
}

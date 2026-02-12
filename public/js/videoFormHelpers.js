const getVal = (id) => document.getElementById(id)?.value;
const getChk = (id) => document.getElementById(id)?.checked;

export async function uploadAudioFile(audioFile) {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const response = await fetch('/upload-audio', { method: 'POST', body: formData });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data?.audioPath) {
        throw new Error(`Server returned success but no audioPath. Response: ${JSON.stringify(data)}`);
    }
    return data.audioPath;
}

export async function uploadBackgroundFile(inputElement) {
    if (!inputElement?.files[0]) return null;

    const formData = new FormData();
    formData.append('backgroundFile', inputElement.files[0]);

    const response = await fetch('/upload-background', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Background upload failed');

    const data = await response.json();
    return data.backgroundPath;
}

export function resolveBackgroundData(suffix, uploadedBackgroundPath) {
    const pexelsQuery = getVal(`pexelsVideo${suffix}`);
    const imageUrl = getVal(`imageLink${suffix}`);
    const youtubeUrl = getVal(`youtubeLink${suffix}`);

    if (uploadedBackgroundPath) {
        return { videoData: uploadedBackgroundPath, useCustomBg: true };
    } else if (pexelsQuery) {
        return { videoData: `unsplash:${pexelsQuery}`, useCustomBg: true };
    } else if (imageUrl) {
        return { videoData: imageUrl, useCustomBg: true };
    } else if (youtubeUrl) {
        return { videoData: youtubeUrl, useCustomBg: true };
    }
    return { videoData: 1, useCustomBg: false };
}

export function collectFormOptions(suffix) {
    return {
        color: getVal(`fontColor${suffix}`) || '#ffffff',
        size: getVal(`fontSize${suffix}`) || 30,
        fontName: getVal(`fontName${suffix}`) || 'TaseesRegular',
        translationEdition: getVal(`translationEdition${suffix}`),
        crop: getChk(`verticalVideo${suffix}`) ? 'vertical' : 'horizontal',
        subtitlePosition: getVal(`subtitlePosition${suffix}`) || 'bottom',
        showMetadata: getChk(`showMetadata${suffix}`) || false,
    };
}

export async function submitVideoJob(endpoint, requestBody) {
    console.log('Submitting job with data:', requestBody);
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (response.status === 202) {
        const data = await response.json();
        alert('بدأ إنتاج الفيديو! سيتم إعلامك عند اكتماله.');
        window.pollJobStatus(data.jobId);
        window.showPage('mainMenu');
    } else {
        const errorText = await response.text();
        throw new Error(`Failed to queue video generation: ${errorText}`);
    }
}

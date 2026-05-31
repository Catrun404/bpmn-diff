import {switchMode, ui} from './app.js';

async function handleFileUpload(side, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        // Mocking IJ interaction: send it as base64
        const bytes = new TextEncoder().encode(content);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        window.setManualSelection(side, base64, file.name);
    };
    reader.readAsText(file);
}

if (ui.fileLeft) ui.fileLeft.addEventListener('change', (e) => handleFileUpload('left', e.target.files[0]));
if (ui.fileRight) ui.fileRight.addEventListener('change', (e) => handleFileUpload('right', e.target.files[0]));

switchMode('manual');


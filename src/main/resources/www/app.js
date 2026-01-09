import BpmnViewer from "https://esm.sh/bpmn-js@18.6.2/lib/NavigatedViewer";
import BpmnModdle from "https://esm.sh/bpmn-moddle@9.0.2";
import {diff as bpmnDiff} from "https://esm.sh/bpmn-js-differ@3.0.2";

const ui = {
    modeManualBtn: document.getElementById('mode-manual'),
    modeGitBtn: document.getElementById('mode-git'),
    manualControls: document.getElementById('manual-controls'),
    gitControls: document.getElementById('git-controls'),

    oldFileInput: document.getElementById('old-file'),
    newFileInput: document.getElementById('new-file'),

    gitFileInput: document.getElementById('git-file'),
    gitBranchOldInput: document.getElementById('git-branch-old'),
    gitBranchNewInput: document.getElementById('git-branch-new'),

    runBtn: document.getElementById('run-diff'),
    clearBtn: document.getElementById('clear'),
    changesList: document.getElementById('changes-list'),
    noDiagramAlert: document.getElementById('no-diagram-alert'),
    diffItemsContainer: document.getElementById('diff-items-container'),
    showDiffCheckbox: document.getElementById('show-diff'),
    diffToggleGroup: document.getElementById('diff-toggle-group'),

    canvasLeft: '#canvas-left',
    canvasRight: '#canvas-right'
};

const state = {
    mode: 'git', // 'git' | 'manual'
    oldXml: null,
    newXml: null,
    currentDiff: null,
    isDiffing: false,

    get isReady() {
        return this.mode === 'git'
            ? !!ui.gitFileInput.value
            : (!!this.oldXml && !!this.newXml);
    }
};

const viewers = {
    left: new BpmnViewer({container: ui.canvasLeft}),
    right: new BpmnViewer({container: ui.canvasRight}),
    moddle: new BpmnModdle()
};

function updateUIState() {
    ui.runBtn.disabled = !state.isReady;
    ui.clearBtn.disabled = state.mode === 'git' ? false : !(state.oldXml || state.newXml);
}

async function switchMode(newMode) {
    state.mode = newMode;
    const isGit = newMode === 'git';

    ui.modeGitBtn.classList.toggle('active', isGit);
    ui.modeManualBtn.classList.toggle('active', !isGit);
    ui.gitControls.style.display = isGit ? 'flex' : 'none';
    ui.manualControls.style.display = isGit ? 'none' : 'flex';

    if (isGit) {
        await loadGitInfo();
    } else {
        updateUIState();
    }
}

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  id="Definitions_1" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="EmptyProcess_0" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="EmptyProcess_0">
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

async function triggerDiff() {
    if (state.isReady) {
        ui.runBtn.click();
    }
}

function displayErrorMessage(err) {
    ui.noDiagramAlert.innerHTML = `
            <div style="color: red; font-weight: bold;">Failed to load Git information.</div>
            <div style="font-size: 12px; margin-top: 10px;">Error: ${err.message}</div>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px;">Retry</button>
        `;
}

async function loadGitInfo(retryCount = 0) {
    console.log(`Loading Git info (attempt ${retryCount + 1})...`);
    try {
        const [branchesResponse, settingsResponse] = await Promise.all([
            fetch('/api/branches'),
            fetch('/api/settings')
        ]);

        if (!branchesResponse.ok) throw new Error(`Failed to fetch branches: ${branchesResponse.status}`);
        if (!settingsResponse.ok) throw new Error(`Failed to fetch settings: ${settingsResponse.status}`);

        const [branches, settings] = await Promise.all([
            branchesResponse.json(),
            settingsResponse.json()
        ]);

        console.log('Git info loaded:', {branchesCount: branches ? branches.length : 0, settings});

        if (branches.error) {
            if ((branches.error.includes('No git repository found') || branches.error.includes('initializing')) && retryCount < 5) {
                console.warn(`${branches.error}, retrying in 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return loadGitInfo(retryCount + 1);
            }
            throw new Error(branches.error);
        }

        const branchNames = branches.map(b => b.name);
        const currentBranch = branches.find(b => b.current)?.name;

        ui.gitBranchOldInput.innerHTML = branchNames.map(b => `<option value="${b}">${b}</option>`).join('');
        ui.gitBranchNewInput.innerHTML = branchNames.map(b => `<option value="${b}">${b}</option>`).join('');

        const defaultOld = settings.defaultOldBranch || 'dev';
        if (branchNames.includes(defaultOld)) {
            ui.gitBranchOldInput.value = defaultOld;
        } else if (branchNames.includes('master')) {
            ui.gitBranchOldInput.value = 'master';
        } else if (branchNames.includes('main')) {
            ui.gitBranchOldInput.value = 'main';
        }

        if (currentBranch) {
            ui.gitBranchNewInput.value = currentBranch;
        }

        await updateFileList();

    } catch (err) {
        console.error('Failed to load git info:', err);
        displayErrorMessage(err);
    }
}

async function updateFileList() {
    const oldRef = ui.gitBranchOldInput.value;
    const newRef = ui.gitBranchNewInput.value;
    console.log(`Updating file list for ${oldRef} vs ${newRef}...`);
    if (!oldRef || !newRef) {
        console.warn('Cannot update file list: missing branches');
        return;
    }

    const response = await fetch(`/api/files?oldRef=${oldRef}&newRef=${newRef}`);
    if (!response.ok) {
        console.error('Failed to fetch files:', response.status);
        throw new Error(`Failed to fetch files: ${response.status}`);
    }

    const files = await response.json();
    const previousValue = ui.gitFileInput.value;
    ui.gitFileInput.innerHTML = files.map(f => `<option value="${f}">${f}</option>`).join('');

    if (files.includes(previousValue)) {
        ui.gitFileInput.value = previousValue;
    }

    updateUIState();
    await triggerDiff();
}

function syncViewers() {
    const canvasLeft = viewers.left.get('canvas');
    const canvasRight = viewers.right.get('canvas');

    let isSyncing = false;

    function sync(source, target) {
        if (isSyncing) return;
        isSyncing = true;
        const viewbox = source.viewbox();
        target.viewbox(viewbox);
        isSyncing = false;
    }

    viewers.left.on('canvas.viewbox.changed', () => sync(canvasLeft, canvasRight));
    viewers.right.on('canvas.viewbox.changed', () => sync(canvasRight, canvasLeft));

    function handleElementClick(event) {
        const element = event.element;
        if (!element) return;

        const li = ui.changesList.querySelector(`li[data-id="${element.id}"]`);
        if (li) {
            ui.changesList.querySelectorAll('li').forEach(el => el.classList.remove('selected'));

            li.classList.add('selected');
            li.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
    }

    viewers.left.on('element.click', handleElementClick);
    viewers.right.on('element.click', handleElementClick);
}

syncViewers();

ui.modeManualBtn.addEventListener('click', async () => await switchMode('manual'));
ui.modeGitBtn.addEventListener('click', async () => await switchMode('git'));

ui.oldFileInput.addEventListener('change', async (e) => {
    state.oldXml = await readFileAsText(e.target.files?.[0]);
    updateUIState();
    await triggerDiff();
});

ui.newFileInput.addEventListener('change', async (e) => {
    state.newXml = await readFileAsText(e.target.files?.[0]);
    updateUIState();
    await triggerDiff();
});

ui.gitFileInput.addEventListener('change', async () => {
    updateUIState();
    await triggerDiff();
});

ui.gitBranchOldInput.addEventListener('change', updateFileList);
ui.gitBranchNewInput.addEventListener('change', updateFileList);

ui.clearBtn.addEventListener('click', () => {
    if (state.mode === 'manual') {
        ui.oldFileInput.value = '';
        ui.newFileInput.value = '';
        state.oldXml = null;
        state.newXml = null;
    }
    state.currentDiff = null;
    ui.changesList.innerHTML = '';
    updateUIState();
    ui.noDiagramAlert.style.display = 'block';
    ui.diffItemsContainer.style.display = 'none';
    ui.diffToggleGroup.style.display = 'none';
    viewers.left.clear();
    viewers.right.clear();
});

ui.showDiffCheckbox.addEventListener('change', () => {
    if (state.currentDiff) {
        renderDiff(state.currentDiff, ui.showDiffCheckbox.checked);
    }
});

ui.runBtn.addEventListener('click', async () => {
    if (state.isDiffing) return;

    if (state.mode === 'git') {
        const file = ui.gitFileInput.value;
        const oldRef = ui.gitBranchOldInput.value;
        const newRef = ui.gitBranchNewInput.value;

        if (!file || !oldRef || !newRef) {
            console.warn('Missing git parameters:', {file, oldRef, newRef});
            return;
        }

        state.isDiffing = true;
        ui.runBtn.classList.add('loading');
        try {
            console.log(`Fetching content for ${file} (${oldRef} vs ${newRef})...`);
            [state.oldXml, state.newXml] = await Promise.all([
                fetch(`/api/content?ref=${oldRef}&path=${file}`).then(r => {
                    if (!r.ok) throw new Error(`Failed to fetch old content: ${r.status}`);
                    return r.text();
                }).then(text => text.trim() === '' ? EMPTY_BPMN : text),
                fetch(`/api/content?ref=${newRef}&path=${file}`).then(r => {
                    if (!r.ok) throw new Error(`Failed to fetch new content: ${r.status}`);
                    return r.text();
                }).then(text => text.trim() === '' ? EMPTY_BPMN : text)
            ]);
        } catch (err) {
            console.error(err);
            alert('Failed to fetch file content from Git: ' + err.message);
            state.isDiffing = false;
            ui.runBtn.classList.remove('loading');
            return;
        }
    } else {
        if (!state.oldXml || !state.newXml) return;
        state.isDiffing = true;
        ui.runBtn.classList.add('loading');
    }

    try {
        console.log('Calculating diff...');
        ui.changesList.innerHTML = '';
        const [oldDefs, newDefs] = await Promise.all([
            viewers.moddle.fromXML(state.oldXml).then(r => r.rootElement),
            viewers.moddle.fromXML(state.newXml).then(r => r.rootElement),
        ]);

        state.currentDiff = bpmnDiff(oldDefs, newDefs) || {};
        console.log('Diff calculated:', state.currentDiff);

        ui.noDiagramAlert.style.display = 'none';
        ui.diffItemsContainer.style.display = 'flex';
        ui.diffToggleGroup.style.display = 'block';

        console.log('Importing XML into viewers...');
        await Promise.all([
            viewers.left.importXML(state.oldXml),
            viewers.right.importXML(state.newXml)
        ]);

        viewers.left.get('canvas').zoom('fit-viewport');
        viewers.right.get('canvas').zoom('fit-viewport');

        renderDiff(state.currentDiff, ui.showDiffCheckbox.checked);
    } catch (err) {
        console.error('Error during diff/render:', err);
        alert('Failed to diff or render BPMN. See console for details.');
    } finally {
        state.isDiffing = false;
        ui.runBtn.classList.remove('loading');
    }
});

function renderDiff(diff, show) {
    const registryLeft = viewers.left.get('elementRegistry');
    const registryRight = viewers.right.get('elementRegistry');
    const canvasLeft = viewers.left.get('canvas');
    const canvasRight = viewers.right.get('canvas');

    ui.changesList.innerHTML = '';

    [canvasLeft, canvasRight].forEach(canvas => {
        const registry = canvas === canvasLeft ? registryLeft : registryRight;
        registry.getAll().forEach(el => {
            canvas.removeMarker(el.id, 'diff-added');
            canvas.removeMarker(el.id, 'diff-removed');
            canvas.removeMarker(el.id, 'diff-changed');
            canvas.removeMarker(el.id, 'diff-layout-changed');
        });
    });

    const items = [];

    for (const id in diff._added) {
        items.push({id, action: 'added', element: diff._added[id]});
    }

    for (const id in diff._removed) {
        items.push({id, action: 'removed', element: diff._removed[id]});
    }

    for (const id in diff._changed) {
        items.push({id, action: 'changed', element: diff._changed[id]});
    }

    for (const id in diff._layoutChanged) {
        if (!diff._changed[id]) {
            items.push({id, action: 'layoutChanged', element: diff._layoutChanged[id]});
        }
    }

    items.forEach(item => {
        const {id, action, element} = item;
        const targetElement = element.model || element;
        const businessObject = targetElement.businessObject || targetElement;
        const rawType = businessObject.$type || 'Element';
        const type = rawType.replace(/^bpmn:/, '');
        const name = businessObject.name || '';

        const isProcess = type === 'Process';
        const skipMarkers = isProcess && (action === 'added' || action === 'removed');

        let markerClass;
        if (action === 'added') markerClass = 'diff-added';
        else if (action === 'removed') markerClass = 'diff-removed';
        else if (action === 'layoutChanged') markerClass = 'diff-layout-changed';
        else markerClass = 'diff-changed';

        if (show && !skipMarkers) {
            if (registryLeft.get(id)) {
                canvasLeft.addMarker(id, markerClass);
            }
            if (registryRight.get(id)) {
                canvasRight.addMarker(id, markerClass);
            }
        }

        const li = document.createElement('li');
        li.className = action;
        li.dataset.id = id;

        const labelText = name ? `${name} (id=${id})` : `id=${id}`;

        let details = '';
        if (action === 'changed' && element.attrs) {
            details = Object.entries(element.attrs)
                .map(([key, val]) => `${key}: ${val.oldValue} -> ${val.newValue}`)
                .join('\n');
        }

        if (details) {
            li.title = details;
        }

        li.innerHTML = `
            <span class="diff-type">${action}</span>
            <span class="diff-label">${type}: ${labelText}</span>
            ${details ? `<span class="diff-details">${details.replace(/\n/g, '<br/>')}</span>` : ''}
        `;
        li.addEventListener('click', () => {
            const elLeft = registryLeft.get(id);
            const elRight = registryRight.get(id);
            if (elLeft) canvasLeft.scrollToElement(elLeft);
            if (elRight) canvasRight.scrollToElement(elRight);

            ui.changesList.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
        });
        ui.changesList.appendChild(li);
    });
}

async function readFileAsText(file) {
    if (!file) return null;
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(fr.error);
        fr.readAsText(file);
    });
}

const dropZone = document.body;

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length >= 2) {
        state.oldXml = await readFileAsText(files[0]);
        state.newXml = await readFileAsText(files[1]);
        updateUIState();
        await triggerDiff();
    } else if (files.length === 1) {
        const targetCanvas = e.target.closest('.canvas');
        if (targetCanvas && targetCanvas.id === 'canvas-left') {
            state.oldXml = await readFileAsText(files[0]);
        } else if (targetCanvas && targetCanvas.id === 'canvas-right') {
            state.newXml = await readFileAsText(files[0]);
        } else {
            if (!state.oldXml) {
                state.oldXml = await readFileAsText(files[0]);
            } else {
                state.newXml = await readFileAsText(files[0]);
            }
        }
        updateUIState();
        await triggerDiff();
    }
});


window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
});

window.addEventListener('DOMContentLoaded', async () => {
    console.log('App starting...');
    if (state.mode === 'git') {
        await loadGitInfo();
    } else {
        updateUIState();
    }
});
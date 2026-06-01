import {computeBpmnDiff, createBpmnModdle, createBpmnViewer, EMPTY_BPMN, renderBpmnDiff} from "./bpmn-diff.js";
import {computeDmnDiff, createDmnModdle, createDmnViewer, EMPTY_DMN, refreshDmnViewHighlight, renderDmnDiff} from "./dmn-diff.js";
import {detectDocType, getService} from "./utils.js";


const ui = {
    changesList: document.getElementById('changes-list'),
    noDiagramAlert: document.getElementById('no-diagram-alert'),
    diffItemsContainer: document.getElementById('diff-items-container'),

    canvasLeft: '#canvas-left',
    canvasRight: '#canvas-right'
};

const state = {
    mode: 'branch', // 'branch' | 'commit' | 'manual'
    leftXml: null,
    rightXml: null,
    currentDiff: null,
    isDiffing: false,
    docType: 'bpmn', // 'bpmn' | 'dmn'

    gitFile: null,
    gitLeftRef: null,
    gitRightRef: null,

    manualLeftFileName: null,
    manualRightFileName: null,
    showDiff: true,

    get isReady() {
        return this.mode !== 'manual'
            ? !!this.gitFile && !!this.gitLeftRef && !!this.gitRightRef
            : (!!this.leftXml && !!this.rightXml);
    }
};

const viewers = {
    left: null,
    right: null,
    moddle: null,
    type: null,
    syncAttached: false
};

function ensureViewers(type) {
    if (viewers.type === type && viewers.left) return;

    if (viewers.left) {
        try {
            viewers.left.destroy();
        } catch (e) {
        }
    }
    if (viewers.right) {
        try {
            viewers.right.destroy();
        } catch (e) {
        }
    }

    viewers.type = type;
    viewers.syncAttached = false;

    if (type === 'dmn') {
        viewers.left = createDmnViewer(ui.canvasLeft);
        viewers.right = createDmnViewer(ui.canvasRight);
        viewers.moddle = createDmnModdle();
    } else {
        viewers.left = createBpmnViewer(ui.canvasLeft);
        viewers.right = createBpmnViewer(ui.canvasRight);
        viewers.moddle = createBpmnModdle();
    }

    attachSyncHandlers();
}

ensureViewers('bpmn');

async function switchMode(newMode) {
    state.mode = newMode;
    const isGit = newMode !== 'manual';

    if (window.setSelectedFile) {
        window.setSelectedFile(isGit ? (state.gitFile || '') : '');
    }

    updateTabTitle();
}

window.switchModeFromIJ = switchMode;

window.setGitSelection = (leftRef, rightRef, file) => {
    state.gitLeftRef = leftRef;
    state.gitRightRef = rightRef;
    state.gitFile = file;

    if (window.setSelectedFile) {
        window.setSelectedFile(file || '');
    }
    triggerDiff();
};

window.setManualSelection = (side, base64Content, fileName) => {
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const content = new TextDecoder('utf-8').decode(bytes);

    if (side === 'left') {
        state.leftXml = content;
        state.manualLeftFileName = fileName;
    } else {
        state.rightXml = content;
        state.manualRightFileName = fileName;
    }
    triggerDiff();
};

window.setShowDiff = (show) => {
    state.showDiff = show;
    if (state.currentDiff) {
        renderDiff(state.currentDiff, state.showDiff);
    }
};

window.initFromIJ = (mode, leftBranch, rightBranch, file, showDiff) => {
    state.mode = mode;
    state.gitLeftRef = leftBranch;
    state.gitRightRef = rightBranch;
    state.gitFile = file;
    state.showDiff = showDiff !== undefined ? showDiff : true;

    const isGit = mode !== 'manual';

    if (window.setSelectedFile) {
        window.setSelectedFile(isGit ? (file || '') : '');
    }

    if (state.isReady) {
        triggerDiff();
    }
};


async function triggerDiff() {
    updateTabTitle();
    if (state.isReady) {
        await doDiff();
    }
}

function updateTabTitle() {
    let title = 'BPMN-Diff';
    if (state.mode !== 'manual') {
        const file = state.gitFile;
        if (file) {
            const fileName = file.split('/').pop();
            title = `BPMN-Diff: ${fileName}`;
        }
    } else {
        const leftFile = state.manualLeftFileName;
        const rightFile = state.manualRightFileName;
        if (leftFile && rightFile) {
            title = `BPMN-Diff: ${leftFile} vs ${rightFile}`;
        } else if (rightFile) {
            title = `BPMN-Diff: ${rightFile}`;
        } else if (leftFile) {
            title = `BPMN-Diff: ${leftFile}`;
        }
    }
    if (window.setTabTitle) {
        window.setTabTitle(title);
    }
}

function attachSyncHandlers() {
    if (!viewers.left || !viewers.right || viewers.syncAttached) return;

    let canvasLeft = getService(viewers.left, 'canvas', viewers.type);
    let canvasRight = getService(viewers.right, 'canvas', viewers.type);

    let isSyncing = false;

    function sync(source, target) {
        if (isSyncing || !source || !target) return;
        isSyncing = true;
        try {
            const viewbox = source.viewbox();
            target.viewbox(viewbox);
        } catch (e) {
        }
        isSyncing = false;
    }

    const onLeftViewboxChanged = () => {
        canvasLeft = getService(viewers.left, 'canvas', viewers.type) || canvasLeft;
        canvasRight = getService(viewers.right, 'canvas', viewers.type) || canvasRight;
        sync(canvasLeft, canvasRight);
    };

    const onRightViewboxChanged = () => {
        canvasLeft = getService(viewers.left, 'canvas', viewers.type) || canvasLeft;
        canvasRight = getService(viewers.right, 'canvas', viewers.type) || canvasRight;
        sync(canvasRight, canvasLeft);
    };

    try {
        viewers.left.on('canvas.viewbox.changed', onLeftViewboxChanged);
    } catch (e) {
    }
    try {
        viewers.right.on('canvas.viewbox.changed', onRightViewboxChanged);
    } catch (e) {
    }

    if (viewers.type === 'dmn') {
        viewers.right.on('views.changed', (event) => {
            if (isSyncing) return;
            isSyncing = true;
            try {
                const viewToOpen = viewers.left.getViews().find(v => v.id === event.activeView.id);
                if (viewToOpen) viewers.left.open(viewToOpen);
            } catch (e) {
            }
            isSyncing = false;

            refreshDmnViewHighlight(event.activeView, viewers, state);
        });
    }

    function handleElementClick(event) {
        const element = event.element;
        if (!element) return;

        const li = ui.changesList.querySelector(`li[data-id="${element.id}"]`);
        if (li) {
            ui.changesList.querySelectorAll('li')
                .forEach(el => el.classList.remove('selected'));

            li.classList.add('selected');
            li.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
    }

    viewers.left.on('element.click', handleElementClick);
    viewers.right.on('element.click', handleElementClick);
    viewers.syncAttached = true;
}

async function doDiff() {
    if (state.isDiffing) return;

    if (state.mode !== 'manual') {
        const file = state.gitFile;
        const leftRef = state.gitLeftRef;
        const rightRef = state.gitRightRef;

        if (!file || !leftRef || !rightRef) return;

        state.isDiffing = true;
        try {
            [state.leftXml, state.rightXml] = await Promise.all([
                fetch(`/api/content?ref=${leftRef}&path=${file}`).then(r => {
                    if (!r.ok) throw new Error(`Failed to fetch left content: ${r.status}`);
                    return r.text();
                }).then(text => {
                    const t = text.trim();
                    return t === '' ? (file.endsWith('.dmn') ? EMPTY_DMN : EMPTY_BPMN) : text;
                }),
                fetch(`/api/content?ref=${rightRef}&path=${file}`).then(r => {
                    if (!r.ok) throw new Error(`Failed to fetch right content: ${r.status}`);
                    return r.text();
                }).then(text => {
                    const t = text.trim();
                    return t === '' ? (file.endsWith('.dmn') ? EMPTY_DMN : EMPTY_BPMN) : text;
                })
            ]);
        } catch (err) {
            state.isDiffing = false;
            return;
        }
    } else {
        if (!state.leftXml || !state.rightXml) return;
        state.isDiffing = true;
    }

    try {
        const filePath = state.mode !== 'manual' ? (state.gitFile || '') : '';
        const detectedType = detectDocType(state.rightXml || state.leftXml || '', filePath);
        state.docType = detectedType;

        ensureViewers(detectedType);

        if (detectedType === 'bpmn') {
            state.currentDiff = await computeBpmnDiff(viewers.moddle, state.leftXml, state.rightXml);
        } else {
            state.currentDiff = await computeDmnDiff(viewers.moddle, state.leftXml, state.rightXml);
        }

        ui.noDiagramAlert.style.display = 'none';
        ui.diffItemsContainer.style.display = 'flex';

        await Promise.all([
            viewers.left.importXML(state.leftXml),
            viewers.right.importXML(state.rightXml)
        ]);

        const leftCanvas = getService(viewers.left, 'canvas', viewers.type);
        const rightCanvas = getService(viewers.right, 'canvas', viewers.type);
        try {
            leftCanvas && leftCanvas.zoom('fit-viewport');
        } catch (e) {
        }
        try {
            rightCanvas && rightCanvas.zoom('fit-viewport');
        } catch (e) {
        }

        renderDiff(viewers, ui, state);
    } catch (err) {
        ui.noDiagramAlert.style.display = 'block';
        ui.noDiagramAlert.innerHTML = `Error: ${err.message}`;
        ui.diffItemsContainer.style.display = 'none';
    } finally {
        state.isDiffing = false;
    }
}

function renderDiff(viewers, ui, state) {
    if (state.docType === 'dmn') {
        renderDmnDiff(viewers, ui, state);
    } else {
        renderBpmnDiff(viewers, ui, state);
    }
}

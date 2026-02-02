import BpmnViewer from "https://esm.sh/bpmn-js@18.10.1/lib/NavigatedViewer";
import BpmnModdle from "https://esm.sh/bpmn-moddle@9.0.4";
import {diff as bpmnDiff} from "https://esm.sh/bpmn-js-differ@3.1.0";

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

const ui = {
    changesList: document.getElementById('changes-list'),
    noDiagramAlert: document.getElementById('no-diagram-alert'),
    diffItemsContainer: document.getElementById('diff-items-container'),

    canvasLeft: '#canvas-left',
    canvasRight: '#canvas-right'
};

const state = {
    mode: 'git', // 'git' | 'manual'
    leftXml: null,
    rightXml: null,
    currentDiff: null,
    isDiffing: false,

    gitFile: null,
    gitLeftBranch: null,
    gitRightBranch: null,

    manualLeftFileName: null,
    manualRightFileName: null,
    showDiff: true,

    get isReady() {
        return this.mode === 'git'
            ? !!this.gitFile && !!this.gitLeftBranch && !!this.gitRightBranch
            : (!!this.leftXml && !!this.rightXml);
    }
};

const viewers = {
    left: new BpmnViewer({container: ui.canvasLeft}),
    right: new BpmnViewer({container: ui.canvasRight}),
    moddle: new BpmnModdle()
};

async function switchMode(newMode) {
    state.mode = newMode;
    const isGit = newMode === 'git';

    if (window.setSelectedFile) {
        window.setSelectedFile(isGit ? (state.gitFile || '') : '');
    }

    updateTabTitle();
}

window.switchModeFromIJ = switchMode;

window.setGitSelection = (leftBranch, rightBranch, file) => {
    console.log('Git selection updated from IJ:', {leftBranch, rightBranch, file});
    state.gitLeftBranch = leftBranch;
    state.gitRightBranch = rightBranch;
    state.gitFile = file;

    if (window.setSelectedFile) {
        window.setSelectedFile(file || '');
    }
    triggerDiff();
};

window.setManualSelection = (side, base64Content, fileName) => {
    console.log(`Manual selection updated from IJ: ${side} = ${fileName}`);
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
    console.log('Show diff updated from IJ:', show);
    state.showDiff = show;
    if (state.currentDiff) {
        renderDiff(state.currentDiff, state.showDiff);
    }
};

window.initFromIJ = (mode, leftBranch, rightBranch, file, showDiff) => {
    console.log('Initializing from IJ:', {mode, leftBranch, rightBranch, file, showDiff});
    state.mode = mode;
    state.gitLeftBranch = leftBranch;
    state.gitRightBranch = rightBranch;
    state.gitFile = file;
    state.showDiff = showDiff !== undefined ? showDiff : true;

    const isGit = mode === 'git';

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
    if (state.mode === 'git') {
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
            ui.changesList.querySelectorAll('li')
                .forEach(el => el.classList.remove('selected'));

            li.classList.add('selected');
            li.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
    }

    viewers.left.on('element.click', handleElementClick);
    viewers.right.on('element.click', handleElementClick);
}

syncViewers();

async function doDiff() {
    if (state.isDiffing) return;

    if (state.mode === 'git') {
        const file = state.gitFile;
        const leftRef = state.gitLeftBranch;
        const rightRef = state.gitRightBranch;

        if (!file || !leftRef || !rightRef) {
            console.warn('Missing git parameters:', {file, leftRef, rightRef});
            return;
        }

        state.isDiffing = true;
        try {
            console.log(`Fetching content for ${file} (${leftRef} vs ${rightRef})...`);
            [state.leftXml, state.rightXml] = await Promise.all([
                fetch(`/api/content?ref=${leftRef}&path=${file}`).then(r => {
                    if (!r.ok) throw new Error(`Failed to fetch left content: ${r.status}`);
                    return r.text();
                }).then(text => text.trim() === '' ? EMPTY_BPMN : text),
                fetch(`/api/content?ref=${rightRef}&path=${file}`).then(r => {
                    if (!r.ok) throw new Error(`Failed to fetch right content: ${r.status}`);
                    return r.text();
                }).then(text => text.trim() === '' ? EMPTY_BPMN : text)
            ]);
        } catch (err) {
            console.error(err);
            alert('Failed to fetch file content from Git: ' + err.message);
            state.isDiffing = false;
            return;
        }
    } else {
        if (!state.leftXml || !state.rightXml) return;
        state.isDiffing = true;
    }

    try {
        console.log('Calculating diff...');
        ui.changesList.innerHTML = '';
        const [leftDefs, rightDefs] = await Promise.all([
            viewers.moddle.fromXML(state.leftXml).then(r => r.rootElement),
            viewers.moddle.fromXML(state.rightXml).then(r => r.rootElement),
        ]);

        state.currentDiff = bpmnDiff(leftDefs, rightDefs) || {};
        console.log('Diff calculated:', state.currentDiff);

        ui.noDiagramAlert.style.display = 'none';
        ui.diffItemsContainer.style.display = 'flex';

        console.log('Importing XML into viewers...');
        await Promise.all([
            viewers.left.importXML(state.leftXml),
            viewers.right.importXML(state.rightXml)
        ]);

        viewers.left.get('canvas').zoom('fit-viewport');
        viewers.right.get('canvas').zoom('fit-viewport');

        renderDiff(state.currentDiff, state.showDiff);
    } catch (err) {
        console.error('Error during diff/render:', err);
        alert('Failed to diff or render BPMN. See console for details.');
    } finally {
        state.isDiffing = false;
    }
}

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
        let markerClass;
        if (action === 'added') markerClass = 'diff-added';
        else if (action === 'removed') markerClass = 'diff-removed';
        else if (action === 'layoutChanged') markerClass = 'diff-layout-changed';
        else markerClass = 'diff-changed';

        if (show && !isProcess) {
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

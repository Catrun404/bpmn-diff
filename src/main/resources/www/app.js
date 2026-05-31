import BpmnViewer from "https://esm.sh/bpmn-js@18.14.0/lib/NavigatedViewer";
import {BpmnModdle} from "https://esm.sh/bpmn-moddle@10.0.0";
import {diff as bpmnDiff} from "https://esm.sh/bpmn-js-differ@3.2.0";

import DmnViewer from "https://esm.sh/dmn-js@17.8.0/lib/NavigatedViewer";
import {DmnModdle} from "https://esm.sh/dmn-moddle@12.0.1";
import {dmnDiff} from "./dmn-diff.js";

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

const EMPTY_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC/"
             id="Definitions_1"
             name="Definitions_1"
             namespace="http://camunda.org/schema/1.0/dmn">
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;

export const ui = {
    changesList: document.getElementById('changes-list'),
    noDiagramAlert: document.getElementById('no-diagram-alert'),
    diffItemsContainer: document.getElementById('diff-items-container'),

    canvasLeft: '#canvas-left',
    canvasRight: '#canvas-right',

    fileLeft: document.getElementById('file-left'),
    fileRight: document.getElementById('file-right')
};

const state = {
    mode: 'branch', // 'branch' | 'commit' | 'manual'
    leftXml: null,
    rightXml: null,
    currentDiff: null,
    isDiffing: false,

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
    },

    get diagramType() {
        const file = this.mode === 'manual' ? (this.manualLeftFileName || this.manualRightFileName) : this.gitFile;
        if (file && file.toLowerCase().endsWith('.dmn')) return 'dmn';
        return 'bpmn';
    }
};

let viewers = {
    type: null,
    left: null,
    right: null,
    moddle: null
};

function ensureViewers(type) {
    if (viewers.type === type) return;

    if (viewers.left) viewers.left.destroy();
    if (viewers.right) viewers.right.destroy();

    const containerLeft = document.querySelector(ui.canvasLeft);
    const containerRight = document.querySelector(ui.canvasRight);
    containerLeft.innerHTML = '';
    containerRight.innerHTML = '';

    if (type === 'dmn') {
        viewers.left = new DmnViewer({container: ui.canvasLeft});
        viewers.right = new DmnViewer({container: ui.canvasRight});
        viewers.moddle = new DmnModdle();
    } else {
        viewers.left = new BpmnViewer({container: ui.canvasLeft});
        viewers.right = new BpmnViewer({container: ui.canvasRight});
        viewers.moddle = new BpmnModdle();
    }
    viewers.type = type;
    syncViewers();
}

export async function switchMode(newMode) {
    state.mode = newMode;
    const isGit = newMode !== 'manual';

    if (window.setSelectedFile) {
        window.setSelectedFile(isGit ? (state.gitFile || '') : '');
    }

    updateTabTitle();
}

window.switchModeFromIJ = switchMode;

window.setGitSelection = (leftRef, rightRef, file) => {
    console.log('Git selection updated from IJ:', {leftRef, rightRef, file});
    state.gitLeftRef = leftRef;
    state.gitRightRef = rightRef;
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

function syncViewers() {
    if (!viewers.left || !viewers.right) return;

    try {
        const canvasLeft = viewers.left.get('canvas');
        const canvasRight = viewers.right.get('canvas');

        let isSyncing = false;

        function sync(source, target) {
            if (isSyncing) return;
            isSyncing = true;
            try {
                const viewbox = source.viewbox();
                target.viewbox(viewbox);
            } catch (e) {}
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
    } catch (e) {}
}

async function doDiff() {
    if (state.isDiffing) return;

    const type = state.diagramType;
    ensureViewers(type);
    const emptyXml = type === 'dmn' ? EMPTY_DMN : EMPTY_BPMN;
    const diffFn = type === 'dmn' ? dmnDiff : bpmnDiff;

    if (state.mode !== 'manual') {
        const file = state.gitFile;
        const leftRef = state.gitLeftRef;
        const rightRef = state.gitRightRef;

        if (!file || !leftRef || !rightRef) return;

        state.isDiffing = true;
        try {
            [state.leftXml, state.rightXml] = await Promise.all([
                fetch(`/api/content?ref=${leftRef}&path=${file}`).then(r => r.text()).then(t => t.trim() === '' ? emptyXml : t),
                fetch(`/api/content?ref=${rightRef}&path=${file}`).then(r => r.text()).then(t => t.trim() === '' ? emptyXml : t)
            ]);
        } catch (err) {
            console.error(err);
            state.isDiffing = false;
            return;
        }
    } else {
        if (!state.leftXml || !state.rightXml) return;
        state.isDiffing = true;
    }

    try {
        const [leftDefs, rightDefs] = await Promise.all([
            viewers.moddle.fromXML(state.leftXml).then(r => r.rootElement),
            viewers.moddle.fromXML(state.rightXml).then(r => r.rootElement),
        ]);

        state.currentDiff = diffFn(leftDefs, rightDefs) || {};

        ui.noDiagramAlert.style.display = 'none';
        ui.diffItemsContainer.style.display = 'flex';

        await Promise.all([
            viewers.left.importXML(state.leftXml),
            viewers.right.importXML(state.rightXml)
        ]);

        try {
            viewers.left.get('canvas').zoom('fit-viewport');
            viewers.right.get('canvas').zoom('fit-viewport');
        } catch (e) {}

        renderDiff(state.currentDiff, state.showDiff);
    } catch (err) {
        console.error(err);
    } finally {
        state.isDiffing = false;
    }
}

function renderDiff(diff, show) {
    let registryLeft, registryRight, canvasLeft, canvasRight;
    try {
        registryLeft = viewers.left.get('elementRegistry');
        registryRight = viewers.right.get('elementRegistry');
        canvasLeft = viewers.left.get('canvas');
        canvasRight = viewers.right.get('canvas');
    } catch (e) {
        ui.changesList.innerHTML = '<li>Diff highlighting only supported in diagram view.</li>';
        return;
    }

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

    const added = diff._added || diff.added || {};
    const removed = diff._removed || diff.removed || {};
    const changed = diff._changed || diff.changed || {};
    const layoutChanged = diff._layoutChanged || diff.layoutChanged || {};

    function addChange(id, type, action, element) {
        const businessObject = element.businessObject || element.model || element;
        const label = businessObject.name || id;
        const li = document.createElement('li');
        li.dataset.id = id;
        li.className = action;
        li.innerHTML = `
            <span class="diff-type">${action}</span>
            <span class="diff-label">${type}: ${label}</span>
        `;
        li.onclick = () => {
            ui.changesList.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
            try {
                const elLeft = registryLeft.get(id);
                const elRight = registryRight.get(id);
                if (elLeft) canvasLeft.scrollToElement(elLeft);
                if (elRight) canvasRight.scrollToElement(elRight);
            } catch (e) {}
        };
        ui.changesList.appendChild(li);

        if (show) {
            const marker = `diff-${action === 'layoutChanged' ? 'layout-changed' : action}`;
            if (registryLeft.get(id)) canvasLeft.addMarker(id, marker);
            if (registryRight.get(id)) canvasRight.addMarker(id, marker);
        }
    }

    Object.keys(removed).forEach(id => addChange(id, (removed[id].$type || '').replace(/.*:/, ''), 'removed', removed[id]));
    Object.keys(added).forEach(id => addChange(id, (added[id].$type || '').replace(/.*:/, ''), 'added', added[id]));
    Object.keys(layoutChanged).forEach(id => {
        if (!changed[id]) addChange(id, (layoutChanged[id].after?.$type || '').replace(/.*:/, ''), 'layoutChanged', layoutChanged[id].after || layoutChanged[id]);
    });
    Object.keys(changed).forEach(id => addChange(id, (changed[id].model?.$type || '').replace(/.*:/, ''), 'changed', changed[id].model || changed[id]));

    if (ui.changesList.innerHTML === '') {
        ui.changesList.innerHTML = '<li>No changes detected</li>';
    }
}

syncViewers();

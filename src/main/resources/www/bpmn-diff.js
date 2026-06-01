import BpmnViewer from "https://esm.sh/bpmn-js@18.14.0/lib/NavigatedViewer";
import {BpmnModdle} from "https://esm.sh/bpmn-moddle@10.0.0";
import {diff as bpmnDiff} from "https://esm.sh/bpmn-js-differ@3.2.0";

export const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
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

export function createBpmnViewer(container) {
    return new BpmnViewer({ container });
}

export function createBpmnModdle() {
    return new BpmnModdle();
}

export async function computeBpmnDiff(moddle, leftXml, rightXml) {
    const [leftDefs, rightDefs] = await Promise.all([
        moddle.fromXML(leftXml).then(r => r.rootElement),
        moddle.fromXML(rightXml).then(r => r.rootElement),
    ]);
    return bpmnDiff(leftDefs, rightDefs) || {};
}

export function renderBpmnDiff(viewers, ui, state) {
    const registryLeft = viewers.left.get('elementRegistry');
    const registryRight = viewers.right.get('elementRegistry');
    const canvasLeft = viewers.left.get('canvas');
    const canvasRight = viewers.right.get('canvas');

    const show = state.showDiff;
    const diff = state.currentDiff;

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
        if (!diff._changed[id] && !diff._added[id]) {
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

import DmnViewer from "https://esm.sh/dmn-js@17.8.0/lib/NavigatedViewer";
import {DmnModdle} from "https://esm.sh/dmn-moddle@12.0.1";
import DmnDiffer from "./dmn-js-differ/index.js";
import {getService} from "./utils.js";

export const EMPTY_DMN = `<?xml version="1.0" encoding="UTF-8"?>
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

export function createDmnViewer(container) {
    return new DmnViewer({ container });
}

export function createDmnModdle() {
    return new DmnModdle();
}

export async function computeDmnDiff(moddle, leftXml, rightXml) {
    const [leftResult, rightResult] = await Promise.all([
        moddle.fromXML(leftXml),
        moddle.fromXML(rightXml),
    ]);
    const dmnDiffer = new DmnDiffer();
    return await dmnDiffer.compute(leftResult.rootElement, rightResult.rootElement) || {};
}


export function renderDmnDiff(viewers, ui, state) {
    const registryLeft = getService(viewers.left, 'elementRegistry', 'dmn');
    const registryRight = getService(viewers.right, 'elementRegistry', 'dmn');
    const canvasLeft = getService(viewers.left, 'canvas', 'dmn');
    const canvasRight = getService(viewers.right, 'canvas', 'dmn');

    const show = state.showDiff;
    const diff = state.currentDiff;

    ui.changesList.innerHTML = '';

    [canvasLeft, canvasRight].forEach(canvas => {
        if (!canvas) return;
        const registry = canvas === canvasLeft ? registryLeft : registryRight;
        if (!registry) return;
        registry.getAll().forEach(el => {
            canvas.removeMarker(el.id, 'diff-added');
            canvas.removeMarker(el.id, 'diff-removed');
            canvas.removeMarker(el.id, 'diff-changed');
        });
    });

    const items = [];
    Object.entries(diff || {}).forEach(([id, change]) => {
        const action = change.changeType === 'modified' ? 'changed' : change.changeType;
        items.push({id, action, change});
    });

    if (show) {
        items.forEach(({id, action}) => {
            const className = getDiffClass(action);
            if (registryLeft && registryLeft.get(id)) canvasLeft.addMarker(id, className);
            if (registryRight && registryRight.get(id)) canvasRight.addMarker(id, className);
        });
    }

    items.forEach(({id, action}) => {
        if (!action) {
            return;
        }
        let type = 'Element';
        let name = '';
        const el = (registryRight && registryRight.get(id)) || (registryLeft && registryLeft.get(id));
        if (el) {
            const bo = (el.businessObject || el);
            const rawType = bo.$type || '';
            type = rawType.replace(/^dmn:/, '') || type;
            name = bo.name || name;
        }
        const li = document.createElement('li');
        li.className = action;
        li.dataset.id = id;
        const labelText = name ? `${name} (id=${id})` : `id=${id}`;
        li.innerHTML = `
            <span class="diff-type">${action}</span>
            <span class="diff-label">${type}: ${labelText}</span>
        `;
        li.addEventListener('click', () => {
            const elLeft = registryLeft && registryLeft.get(id);
            const elRight = registryRight && registryRight.get(id);
            if (elLeft) canvasLeft.scrollToElement(elLeft);
            if (elRight) canvasRight.scrollToElement(elRight);
            ui.changesList.querySelectorAll('li').forEach(elm => elm.classList.remove('selected'));
            li.classList.add('selected');
        });
        ui.changesList.appendChild(li);
    });

    refreshDmnViewHighlight(null, viewers, state);
}

export function getDiffClass(type) {
    return ({
        added: 'diff-added',
        removed: 'diff-removed',
        modified: 'diff-changed'
    }[type] || 'diff-changed');
}

export function refreshDmnViewHighlight(activeView, viewers, state) {
    if (viewers.type !== 'dmn') return;
    if (!activeView) activeView = viewers.right.getActiveView && viewers.right.getActiveView();
    if (!activeView) return;

    const diff = state.currentDiff;
    const show = state.showDiff;

    const oldCanvasRoot = document.getElementById('canvas-left');
    const newCanvasRoot = document.getElementById('canvas-right');

    [newCanvasRoot, oldCanvasRoot].forEach(root => {
        if (!root) return;
        root.querySelectorAll('tr, td, th').forEach(el => {
            el.classList.remove('diff-added', 'diff-removed', 'diff-changed');
        });
    });

    if (activeView.type === 'decisionTable') {
        if (!show) return;
        const elementId = activeView.id;
        const changes = diff?.[elementId]?.changes;

        if (changes) {
            const getElement = (root, elementId) =>
                root?.querySelector(`[data-element-id="${elementId}"], [data-col-id="${elementId}"]`);

            const highlightElement = (root, elementId, className, includeRuleRow = false) => {
                const element = getElement(root, elementId);
                if (!element) return;

                element.classList.add(className);

                if (includeRuleRow && element.classList.contains('rule-index')) {
                    element.closest('tr')?.classList.add(className);
                }
            };

            const apply = (change, type) => {
                const id = change.location?.id;
                if (!id) return;

                const className = getDiffClass(type);
                if (type === 'removed') {
                    highlightElement(oldCanvasRoot, id, className, true);
                    return;
                }
                if (type === 'added') {
                    highlightElement(newCanvasRoot, id, className, true);
                    return;
                }
                highlightElement(newCanvasRoot, id, className);
                highlightElement(oldCanvasRoot, id, className);
            };

            changes.added?.forEach(c => apply(c, 'added'));
            changes.modified?.forEach(c => apply(c, 'modified'));
            changes.removed?.forEach(c => apply(c, 'removed'));
        }
    } else if (activeView.type === 'drd') {
        const canvasLeft = getService(viewers.left, 'canvas', 'dmn');
        const canvasRight = getService(viewers.right, 'canvas', 'dmn');
        const registryLeft = getService(viewers.left, 'elementRegistry', 'dmn');
        const registryRight = getService(viewers.right, 'elementRegistry', 'dmn');

        if (show && canvasLeft && canvasRight) {
            Object.entries(diff || {}).forEach(([id, change]) => {
                const className = getDiffClass(change.changeType);
                if (registryLeft && registryLeft.get(id)) canvasLeft.addMarker(id, className);
                if (registryRight && registryRight.get(id)) canvasRight.addMarker(id, className);
            });
        }
    }
}

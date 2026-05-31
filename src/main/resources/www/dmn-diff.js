export function dmnDiff(left, right) {
    function getAllElements(element, elements = {}) {
        if (!element || typeof element !== 'object' || (element.id && elements[element.id])) return elements;
        if (element.id) elements[element.id] = element;
        for (const key in element) {
            if (key.startsWith('$') || key === 'id') continue;
            const value = element[key];
            if (Array.isArray(value)) {
                value.forEach(item => getAllElements(item, elements));
            } else {
                getAllElements(value, elements);
            }
        }
        return elements;
    }

    function isEqual(a, b) {
        const keysA = Object.keys(a).filter(k => !k.startsWith('$') && typeof a[k] !== 'object');
        for (const key of keysA) {
            if (a[key] !== b[key]) return false;
        }
        // Special case for DMN DI
        if (a.$type?.includes('DMNShape')) {
            const bA = a.bounds;
            const bB = b.bounds;
            if (bA && bB) {
                if (bA.x !== bB.x || bA.y !== bB.y || bA.width !== bB.width || bA.height !== bB.height) return false;
            } else if (bA || bB) return false;
        }
        if (a.$type?.includes('DMNEdge')) {
            const wA = a.waypoint || [];
            const wB = b.waypoint || [];
            if (wA.length !== wB.length) return false;
            for (let i = 0; i < wA.length; i++) {
                if (wA[i].x !== wB[i].x || wA[i].y !== wB[i].y) return false;
            }
        }
        return true;
    }

    const leftElements = getAllElements(left);
    const rightElements = getAllElements(right);

    const added = {};
    const removed = {};
    const changed = {};

    for (const id in rightElements) {
        const leftEl = leftElements[id];
        const rightEl = rightElements[id];
        if (!leftEl) {
            added[id] = rightEl;
        } else if (!isEqual(leftEl, rightEl)) {
            changed[id] = { model: rightEl };
        }
    }
    for (const id in leftElements) {
        if (!rightElements[id]) {
            removed[id] = leftElements[id];
        }
    }
    return { added, removed, changed };
}

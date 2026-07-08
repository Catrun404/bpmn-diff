export function getService(viewer, name, viewersType) {
    try {
        if (viewersType === 'dmn') {
            const av = viewer.getActiveViewer && viewer.getActiveViewer();
            return av && av.get ? av.get(name) : null;
        }
        return viewer.get ? viewer.get(name) : null;
    } catch (e) {
        return null;
    }
}

export function detectDocType(xml, filePath) {
    if (filePath && filePath.toLowerCase().endsWith('.dmn')) return 'dmn';
    const x = (xml || '').toLowerCase();
    if (x.includes('xmlns="https://www.omg.org/spec/dmn') || x.includes('<dmn:')) return 'dmn';
    return 'bpmn';
}

export function syncScroll(elements) {
    let source = null;
    const handlers = [];

    elements.forEach((el) => {
        const handler = () => {
            if (source && source !== el) return;
            source = el;
            elements.forEach((other) => {
                if (other === el) return;
                other.scrollTop = el.scrollTop;
                other.scrollLeft = el.scrollLeft;
            });
            requestAnimationFrame(() => {
                source = null;
            });
        };
        el.addEventListener('scroll', handler, {passive: true});
        handlers.push([el, handler]);
    });

    return () => handlers.forEach(([el, handler]) => el.removeEventListener('scroll', handler));
}

export function setupDragScroll(containerSelector) {
    const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;

    if (!container) return;

    let isDown = false;
    let lastX;
    let lastY;
    let scrollTarget;

    container.addEventListener('mousedown', (e) => {
        if (!container.classList.contains('can-grab')) return;
        if (e.button !== 0 && e.button !== 1) return;

        scrollTarget = container.querySelector('.tjs-table-container') ||
            container.querySelector('.tjs-container') ||
            container;

        isDown = true;
        container.classList.add('grabbing');
        lastX = e.clientX;
        lastY = e.clientY;
    });

    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.classList.remove('grabbing');
    });

    container.addEventListener('mouseup', () => {
        isDown = false;
        container.classList.remove('grabbing');
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;

        scrollTarget.scrollLeft -= deltaX;
        scrollTarget.scrollTop -= deltaY;

        lastX = e.clientX;
        lastY = e.clientY;
    });
}

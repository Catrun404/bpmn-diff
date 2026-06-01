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

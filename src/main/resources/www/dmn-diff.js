import DmnDiffer from "./dmn-js-differ/index.js";

export function dmnDiff(oldDefinitions, newDefinitions) {
  const dmnDiffer = new DmnDiffer();
  return dmnDiffer.compute(oldDefinitions, newDefinitions);
}

export const syncViews = (oldViewer, newViewer) => {
  newViewer.on("views.changed", function (event) {
    const viewToOpen = oldViewer.getViews().find(function (view) {
      return view.id === event.activeView.id;
    });
    if (viewToOpen) {
      oldViewer.open(viewToOpen);
    }
  });
};

export const highlightChanges = (oldViewer, newViewer, diff) => {
  const activeView = newViewer.getActiveView();
  if (!activeView) return;

  if (activeView.type === "drd") {
    const activeNewViewer = newViewer.getActiveViewer();
    const activeOldViewer = oldViewer.getActiveViewer();
    if (!activeNewViewer || !activeOldViewer) return;

    const canvasNewViewer = activeNewViewer.get("canvas");
    const canvasOldViewer = activeOldViewer.get("canvas");

    Object.entries(diff).forEach(([elementId, change]) => {
      const type = change.changeType;
      const markerType = type === "modified" ? "changed" : type;

      if (type === "added" || type === "modified") {
        canvasNewViewer.addMarker(elementId, `diff-${markerType}`);
      }
      if (type === "removed" || type === "modified") {
        canvasOldViewer.addMarker(elementId, `diff-${markerType}`);
      }
    });
  } else if (activeView.type === "decisionTable") {
    const elementId = activeView.id;
    const changes = diff?.[elementId]?.changes;

    if (changes) {
      const newCanvas = newViewer._container;
      const oldCanvas = oldViewer._container;

      const getElement = (root, id) => {
        if (!root) return null;
        if (typeof root === 'string') root = document.querySelector(root);
        let element = root.querySelector(`td[data-element-id="${id}"]`);
        if (!element) {
          element = root.querySelector(`th[data-col-id="${id}"]`);
        }
        return element;
      };

      const addColoring = (change, type) => {
        const { location } = change;
        const { id } = location;

        let color;
        if (type === "added") {
          color = "#d4f7e1";
        } else if (type === "modified") {
          color = "#fef5d1";
        } else if (type === "removed") {
          color = "#fce4e2";
        }

        if (type === "added" || type === "modified") {
          const element = getElement(newCanvas, id);
          if (element) {
            element.style.backgroundColor = color;
          }
        }
        if (type === "removed" || type === "modified") {
          const element = getElement(oldCanvas, id);
          if (element) {
            element.style.backgroundColor = color;
          }
        }
      };

      const { added, modified, removed } = changes;
      added?.forEach((change) => addColoring(change, "added"));
      modified?.forEach((change) => addColoring(change, "modified"));
      removed?.forEach((change) => addColoring(change, "removed"));
    }
  }
};
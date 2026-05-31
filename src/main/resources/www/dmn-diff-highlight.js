import DmnDiffer from "dmn-js-differ";
import DmnViewer from "https://esm.sh/dmn-js@17.8.0/lib/NavigatedViewer";

document.addEventListener("DOMContentLoaded", async function () {
  const { oldVersionIndex, newVersionIndex } = extractVersionsFromPath();
  const newXml = window[`dishDecisionV${newVersionIndex}`];
  const oldXml = window[`dishDecisionV${oldVersionIndex}`];

  const dmnDiffer = new DmnDiffer();

  const diff = await dmnDiffer.compute(oldXml, newXml);

  const viewerNew = initViewer("#canvas-new");
  const viewerOld = initViewer("#canvas-old");

  importDMN(viewerNew, newXml);
  importDMN(viewerOld, oldXml);

  syncViews(viewerOld, viewerNew);
  highlightChangesInDrdView(viewerOld, viewerNew, diff);
  highlightChangesInDecisionTableView(viewerOld, viewerNew, diff);
});

const initViewer = (container) => {
  return new DmnViewer({ container });
};

const importDMN = async (viewer, xml) => {
  try {
    await viewer.importXML(xml);
  } catch (err) {
    console.log("Error in importing xml", err);
  }
};

/**
 * When switching the view in the new viewer, simulataneously switch the view in the old viewer.
 * Currently this works only one way, i.e. synchronization happens only on switching views in the new viewer
 *
 * TODO: find a clever way to do this also the other way around; extending the current approach results in endless loop
 *
 */
const syncViews = (oldViewer, newViewer) => {
  newViewer.on("views.changed", function (event) {
    const viewToOpen = oldViewer.getViews().find(function (view) {
      return view.id === event.activeView.id;
    });
    oldViewer.open(viewToOpen);
  });
};

const highlightChangesInDrdView = (oldViewer, newViewer, diff) => {
  newViewer.on("views.changed", ({ activeView }) => {
    if (activeView?.type === "drd") {
      const addOverlay = (elementId, type) => {
        const canvasNewViewer = newViewer.getActiveViewer().get("canvas");
        const canvasOldViewer = oldViewer.getActiveViewer().get("canvas");

        if (type === "added" || type === "modified") {
          canvasNewViewer.addMarker(elementId, `diff-${type}`);
        }
        if (type === "removed" || type === "modified") {
          canvasOldViewer.addMarker(elementId, `diff-${type}`);
        }
      };

      Object.entries(diff).forEach(([elementId, change]) => {
        const type = change.changeType;
        addOverlay(elementId, type);
      });
    }
  });
};

const highlightChangesInDecisionTableView = (oldViewer, newViewer, diff) => {
  newViewer.on("views.changed", ({ activeView }) => {
    if (activeView?.type === "decisionTable") {
      const elementId = activeView.id;
      const changes = diff?.[elementId]?.changes;

      if (changes) {
        const addColoring = (change, type) => {
          const { location } = change;
          const { id, path } = location;

          let color;
          if (type === "added") {
            color = "#47c28b";
          } else if (type === "modified") {
            color = "#ffc667";
          } else if (type === "removed") {
            color = "#ff6347";
          }

          const newCanvas = document.getElementById("canvas-new");
          const oldCanvas = document.getElementById("canvas-old");

          const getElement = (root) => {
            let element = root.querySelector(`td[data-element-id="${id}"]`);
            if (!element) {
              element = root.querySelector(`th[data-col-id="${id}"]`);
            }
            return element;
          };

          if (type === "added" || type === "modified") {
            const element = getElement(newCanvas);
            if (element) {
              element.style.backgroundColor = color;
            }
          }
          if (type === "removed" || type === "modified") {
            const element = getElement(oldCanvas);
            if (element) {
              element.style.backgroundColor = color;
            }
          }
        };

        const { added, modified, removed } = changes;

        added?.forEach((change) => {
          addColoring(change, "added");
        });
        modified?.forEach((change) => {
          addColoring(change, "modified");
        });
        removed?.forEach((change) => {
          addColoring(change, "removed");
        });
      }
    }
  });
};
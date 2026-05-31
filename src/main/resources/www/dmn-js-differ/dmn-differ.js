import { DiffPatcher } from "diffpatch";

import classifyChanges from "./modules/classify-changes";
import groupChanges from "./modules/group-changes";

class DmnDiffer {
  constructor() {
    this.diffpatcher = new DiffPatcher({
      objectHash: (obj) => obj.id || JSON.stringify(obj),
    });
  }

  /**
   * Compute the differences between two parsed (using dmn-moddle) DMN XML strings.
   * @param {Object} oldDefinitions - The old DMN definitions object from dmn-moddle.
   * @param {Object} newDefinitions - The new DMN definitions object from dmn-moddle.
   * @returns {Object} - An object with DRD element IDs as keys and values containing the type of changes and a list of changes.
   */
  compute(oldDefinitions, newDefinitions) {
    this._removeDi(oldDefinitions);
    this._removeDi(newDefinitions);

    const delta = this.diffpatcher.diff(oldDefinitions, newDefinitions);

    const classified = classifyChanges(delta, oldDefinitions, newDefinitions);
    const grouped = groupChanges(classified, oldDefinitions, newDefinitions);

    return grouped;
  }

  _removeDi(definitions) {
    if ("dmnDI" in definitions) {
      delete definitions["dmnDI"];
    }
  }
}

export default DmnDiffer;

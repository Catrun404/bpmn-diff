export default function classifyChanges(delta, oldDefinitions, newDefinitions) {
  const changes = {
    added: [],
    removed: [],
    modified: [],
  };

  const getValue = (obj) => (Array.isArray(obj) ? obj[0] : obj);

  const extractId = (obj, path) => {
    let current = obj;
    let id;
    for (const key of path) {
      current = current[key];
      if (getValue(current)?.id) {
        id = getValue(current).id;
      }
    }
    return id || null;
  };

  const traverse = (delta, path = []) => {
    if (Array.isArray(delta)) {
      let changeType;
      if (delta.length === 1) {
        changeType = "added";
      } else if (delta.length === 3 && delta[1] === 0 && delta[2] === 0) {
        changeType = "removed";
      } else if (delta.length === 2) {
        changeType = "modified";
      }

      const [oldValue] = delta;
      const location = {
        path: path.join("."),
        id: extractId(
          changeType === "removed" ? oldDefinitions : newDefinitions,
          path
        ),
      };

      if (changeType === "added") {
        changes.added.push({ location, value: getValue(oldValue) });
      } else if (changeType === "removed") {
        changes.removed.push({ location, value: getValue(oldValue) });
      } else if (changeType === "modified") {
        changes.modified.push({ location, oldValue, newValue: delta[1] });
      }
    } else if (typeof delta === "object" && delta !== null) {
      for (const key in delta) {
        if (key === "_t") continue;
        traverse(
          delta[key],
          path.concat(key.startsWith("_") ? key.substring(1) : key)
        );
      }
    }
  };

  traverse(delta);
  return changes;
}

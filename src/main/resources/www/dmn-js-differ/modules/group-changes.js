export default function groupChanges(diff, oldDefinitions, newDefinitions) {
  return _groupChanges(diff, oldDefinitions, newDefinitions);
}

const _groupChanges = (diff, oldDefinitions, newDefinitions) => {
  const grouped = {};

  Object.entries(diff).forEach(([changeType, changeList]) => {
    changeList.forEach((change) => {
      const { location } = change;
      const { path } = location;

      if (_isRootLevelChange(path)) {
        const drdId = newDefinitions.id;
        _ensureNestedProperty(grouped, drdId, "changes", changeType).push(
          change
        );
      } else {
        const drdElementType = _getDrdElementType(path);
        const drdElementPath = _extractPathUntilTarget(path, drdElementType);
        const drdElementId = _getDrdElementId(
          changeType === "removed" ? oldDefinitions : newDefinitions,
          drdElementPath
        );

        if (!drdElementId) {
          return;
        }

        // Set changeType
        _setDrdElementChangeType(
          grouped,
          oldDefinitions,
          newDefinitions,
          drdElementPath,
          drdElementId
        );
        // Set changes
        _ensureNestedProperty(
          grouped,
          drdElementId,
          "changes",
          changeType
        ).push(change);
      }
    });
  });

  return grouped;
};

const _getDrdElementType = (path) => {
  const DRD_ELEMENTS = new Set(["informationRequirement", "drgElement"]);

  for (let element of DRD_ELEMENTS) {
    if (path.includes(element)) {
      return element;
    }
  }
};

const _extractPathUntilTarget = (path, target) => {
  const regex = new RegExp(`(^|[\\w\\.]+\\.)(${target}(?:\\.\\d+)?)`);
  const match = path.match(regex);
  return match ? match[0].trim() : null;
};

const _getValueFromPath = (definitions, path) => {
  const keys = path?.split(".");
  return keys?.reduce((acc, key) => {
    const index = Number(key);
    return acc ? (isNaN(index) ? acc[key] : acc[index]) : undefined;
  }, definitions);
};

const _getDrdElement = (definitions, path) => {
  const drdElement = _getValueFromPath(definitions, path);
  if (Array.isArray(drdElement)) {
    return drdElement[0];
  }
  return drdElement;
};

const _getDrdElementId = (definitions, path) => {
  return _getDrdElement(definitions, path)?.id;
};

const _setDrdElementChangeType = (
  grouped,
  oldDefinitions,
  newDefinitions,
  drdElementPath,
  drdElementId
) => {
  const isChangeTypeNotAlreadySet = !grouped?.drdElementId?.changeType;
  if (isChangeTypeNotAlreadySet) {
    let drdElementChangeType;

    const isPresentInOld =
      _getDrdElement(oldDefinitions, drdElementPath) &&
      _getDrdElementId(oldDefinitions, drdElementPath) === drdElementId;
    const isPresentInNew =
      _getDrdElement(newDefinitions, drdElementPath) &&
      _getDrdElementId(newDefinitions, drdElementPath) === drdElementId;

    if (isPresentInOld && isPresentInNew) {
      drdElementChangeType = "modified";
    } else if (!isPresentInOld && isPresentInNew) {
      drdElementChangeType = "added";
    } else if (isPresentInOld && !isPresentInNew) {
      drdElementChangeType = "removed";
    }

    if (!grouped[drdElementId]) {
      grouped[drdElementId] = {};
    }
    grouped[drdElementId].changeType = drdElementChangeType;
  }
};

const _ensureNestedProperty = (obj, ...keys) => {
  const array = keys.reduce((current, key, index) => {
    if (!current[key]) {
      current[key] = index === keys.length - 1 ? [] : {};
    }
    return current[key];
  }, obj);

  return array;
};

const _isRootLevelChange = (path) => {
  return path.split(".").length === 1;
};

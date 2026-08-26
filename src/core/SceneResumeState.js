const STORAGE_KEY = "xuanqiong-wendao-scene-resume-v1";
const CURRENT_VERSION = 1;

function getDefaultStorage() {
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function normalizeStableId(value, fallback = "") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[a-z0-9:_-]{1,80}$/i.test(normalized) ? normalized : fallback;
}

function normalizeSaveSlot(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * 记录当前标签页正在浏览的门派页面，供 F5 刷新后恢复。
 * 这里只记录页面位置，不写入角色存档，也不保存正在进行中的小游戏事务。
 */
export function rememberSectRoute({ sectId, featureId = "", saveSlot = null } = {}, storage = getDefaultStorage()) {
  if (!storage?.setItem) return false;
  const normalizedSectId = normalizeStableId(sectId);
  if (!normalizedSectId) return false;
  const route = {
    version: CURRENT_VERSION,
    kind: "sect",
    sectId: normalizedSectId,
    featureId: normalizeStableId(featureId),
    saveSlot: normalizeSaveSlot(saveSlot),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(route));
    return true;
  } catch {
    return false;
  }
}

/** 读取当前标签页的门派恢复位置；无效、损坏或属于其他角色档位时返回 null。 */
export function getSectResumeRoute(saveSlot = null, storage = getDefaultStorage()) {
  if (!storage?.getItem) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const route = JSON.parse(raw);
    const normalizedSlot = normalizeSaveSlot(saveSlot);
    if (
      route?.version !== CURRENT_VERSION ||
      route?.kind !== "sect" ||
      normalizeSaveSlot(route.saveSlot) !== normalizedSlot
    ) return null;
    const sectId = normalizeStableId(route.sectId);
    if (!sectId) return null;
    return {
      sectId,
      featureId: normalizeStableId(route.featureId),
    };
  } catch {
    return null;
  }
}

/** 离开门派回到大地图后清除恢复位置。 */
export function clearSceneResumeRoute(storage = getDefaultStorage()) {
  if (!storage?.removeItem) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}


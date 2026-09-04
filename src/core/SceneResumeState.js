import { SceneKeys } from "./SceneKeys.js";

const STORAGE_KEY = "xuanqiong-wendao-scene-resume-v1";
const CURRENT_VERSION = 1;
const RESUMABLE_SCENES = new Set([
  SceneKeys.COVER,
  SceneKeys.SLOT_SELECT,
  SceneKeys.CREATE,
  SceneKeys.VILLAGE,
  SceneKeys.MONSTER_CAVE,
  SceneKeys.RESULT,
]);

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

function normalizeCreationSlot(value) {
  return Number.isInteger(value) && value >= 0 && value < 5 ? value : null;
}

function normalizeBattleReturnScene(value) {
  return value === SceneKeys.MONSTER_CAVE ? SceneKeys.MONSTER_CAVE : SceneKeys.VILLAGE;
}

function readStoredRoute(storage) {
  if (!storage?.getItem) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 记录封面、角色档案、创建角色、大地图及章节结算等稳定场景。
 * interfaceId 只保存可重建的 UI 页签，不保存弹窗事务、表单输入或即时结算数据。
 */
export function rememberSceneRoute({
  sceneKey,
  saveSlot = null,
  interfaceId = "",
  slotIndex = null,
  newCharacter = false,
} = {}, storage = getDefaultStorage()) {
  if (!storage?.setItem || !RESUMABLE_SCENES.has(sceneKey)) return false;
  const normalizedSaveSlot = normalizeSaveSlot(saveSlot);
  if ([SceneKeys.VILLAGE, SceneKeys.MONSTER_CAVE, SceneKeys.RESULT].includes(sceneKey) && normalizedSaveSlot === null) return false;
  const route = {
    version: CURRENT_VERSION,
    kind: "scene",
    sceneKey,
    saveSlot: normalizedSaveSlot,
    interfaceId: normalizeStableId(interfaceId),
    slotIndex: normalizeCreationSlot(slotIndex),
    newCharacter: Boolean(newCharacter),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(route));
    return true;
  } catch {
    return false;
  }
}

/** 读取普通场景恢复位置；传入档位时会拒绝其他角色留下的界面。 */
export function getSceneResumeRoute(saveSlot = undefined, storage = getDefaultStorage()) {
  const route = readStoredRoute(storage);
  if (
    route?.version !== CURRENT_VERSION ||
    route?.kind !== "scene" ||
    !RESUMABLE_SCENES.has(route.sceneKey)
  ) return null;
  const normalizedSlot = normalizeSaveSlot(route.saveSlot);
  if (saveSlot !== undefined && normalizedSlot !== normalizeSaveSlot(saveSlot)) return null;
  return {
    sceneKey: route.sceneKey,
    saveSlot: normalizedSlot,
    interfaceId: normalizeStableId(route.interfaceId),
    slotIndex: normalizeCreationSlot(route.slotIndex),
    newCharacter: Boolean(route.newCharacter),
  };
}

/**
 * 记录当前标签页正在浏览的门派页面，供 F5 刷新后恢复。
 * 这里只记录页面位置，不写入角色存档，也不保存正在进行中的小游戏事务。
 */
export function rememberSectRoute({ sectId, featureId = "", interfaceId = "", saveSlot = null } = {}, storage = getDefaultStorage()) {
  if (!storage?.setItem) return false;
  const normalizedSectId = normalizeStableId(sectId);
  if (!normalizedSectId) return false;
  const route = {
    version: CURRENT_VERSION,
    kind: "sect",
    sectId: normalizedSectId,
    featureId: normalizeStableId(featureId),
    interfaceId: normalizeStableId(interfaceId),
    saveSlot: normalizeSaveSlot(saveSlot),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(route));
    return true;
  } catch {
    return false;
  }
}

/**
 * 记录当前标签页正在进行的战斗来源。
 * 这里只保存可稳定重建战斗的编号，不保存整只怪物、图片或即时血量，避免会话记录膨胀。
 */
export function rememberBattleRoute({
  saveSlot = null,
  testBattle = false,
  adventureBattle = "",
  mapId = "",
  mapMonsterId = "",
  monsterTemplateId = "",
  returnSceneKey = SceneKeys.VILLAGE,
  dungeonId = "",
  dungeonRunNumber = 0,
  dungeonSpawnId = "",
} = {}, storage = getDefaultStorage()) {
  if (!storage?.setItem) return false;
  const route = {
    version: CURRENT_VERSION,
    kind: "battle",
    saveSlot: normalizeSaveSlot(saveSlot),
    testBattle: Boolean(testBattle),
    adventureBattle: normalizeStableId(adventureBattle),
    mapId: normalizeStableId(mapId),
    mapMonsterId: normalizeStableId(mapMonsterId),
    monsterTemplateId: normalizeStableId(monsterTemplateId),
    returnSceneKey: normalizeBattleReturnScene(returnSceneKey),
    dungeonId: normalizeStableId(dungeonId),
    dungeonRunNumber: Math.max(0, Math.floor(Number(dungeonRunNumber) || 0)),
    dungeonSpawnId: normalizeStableId(dungeonSpawnId),
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
    const route = readStoredRoute(storage);
    if (!route) return null;
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
      interfaceId: normalizeStableId(route.interfaceId),
    };
  } catch {
    return null;
  }
}

/** 读取当前标签页的战斗来源；刷新后会从该场战斗开头安全重建。 */
export function getBattleResumeRoute(saveSlot = null, storage = getDefaultStorage()) {
  if (!storage?.getItem) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const route = JSON.parse(raw);
    const normalizedSlot = normalizeSaveSlot(saveSlot);
    if (
      route?.version !== CURRENT_VERSION ||
      route?.kind !== "battle" ||
      normalizeSaveSlot(route.saveSlot) !== normalizedSlot
    ) return null;
    return {
      resumeBattle: true,
      testBattle: Boolean(route.testBattle),
      adventureBattle: normalizeStableId(route.adventureBattle),
      mapId: normalizeStableId(route.mapId),
      mapMonsterId: normalizeStableId(route.mapMonsterId),
      monsterTemplateId: normalizeStableId(route.monsterTemplateId),
      returnSceneKey: normalizeBattleReturnScene(route.returnSceneKey),
      dungeonId: normalizeStableId(route.dungeonId),
      dungeonRunNumber: Math.max(0, Math.floor(Number(route.dungeonRunNumber) || 0)),
      dungeonSpawnId: normalizeStableId(route.dungeonSpawnId),
    };
  } catch {
    return null;
  }
}

/** 离开可恢复页面或结束战斗后清除恢复位置。 */
export function clearSceneResumeRoute(storage = getDefaultStorage()) {
  if (!storage?.removeItem) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}


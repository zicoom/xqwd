import {
  createDefaultSaveData,
  createSaveContainer,
  createSaveData,
  migrateSaveContainer,
  migrateSaveData,
} from "./save/SaveMigrations.js";

/**
 * 游戏状态仓库。
 *
 * 对零基础同学的说明：这里像一个“角色档案盒”。场景切换时，角色名字、属性等
 * 数据不会丢失，因为它们统一保存在这里，而不是放在某个场景里。
 */
const initialSaveData = createDefaultSaveData();

export const gameState = {
  // 当前正在游玩的档案位（0 到 4）。所有自动存档都会写回这个位置。
  activeSaveSlot: null,
  player: initialSaveData.player,
  chapter: initialSaveData.chapter,
  world: initialSaveData.world,
};

// 浏览器本地存档名称。它只保存在当前浏览器、当前电脑中，不会上传网络。
const LEGACY_SAVE_KEY = "xuanqiong-wendao-first-chapter-save-v1";
const SAVE_SLOTS_KEY = "xuanqiong-wendao-save-slots";
const LEGACY_SAVE_SLOTS_KEY = "xuanqiong-wendao-save-slots-v1";
// 记录最近一次实际游玩的档案位，刷新页面时用它自动回到对应角色的地图进度。
const LAST_PLAYED_SLOT_KEY = "xuanqiong-wendao-last-played-slot-v1";
export const MAX_SAVE_SLOTS = 5;
let saveWriteBlockReason = null;

/** 判断一份数据是否是可读取的角色存档。 */
function isValidSaveData(saveData) {
  return migrateSaveData(saveData).ok;
}

function replaceObject(target, source) {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, source);
}

/**
 * 读取五个档案位。旧版本只有一个角色存档时，会自动迁移到第一个档案位。
 */
export function getSaveSlots() {
  try {
    for (const storageKey of [SAVE_SLOTS_KEY, LEGACY_SAVE_SLOTS_KEY]) {
      const rawSlots = localStorage.getItem(storageKey);
      if (!rawSlots) continue;
      const migrated = migrateSaveContainer(JSON.parse(rawSlots), MAX_SAVE_SLOTS);
      if (!migrated.ok) throw new Error(migrated.error);
      saveWriteBlockReason = null;
      if (storageKey !== SAVE_SLOTS_KEY || migrated.migrated) {
        localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(migrated.data));
      }
      return migrated.data.slots;
    }

    // 兼容之前已经创建过角色的玩家：把旧单存档放到第一个格子中。
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    const legacySave = legacyRaw ? JSON.parse(legacyRaw) : null;
    const slots = Array.from({ length: MAX_SAVE_SLOTS }, () => null);
    const migratedLegacy = migrateSaveData(legacySave);
    if (migratedLegacy.ok) {
      slots[0] = migratedLegacy.data;
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(createSaveContainer(slots, MAX_SAVE_SLOTS)));
    }
    saveWriteBlockReason = null;
    return slots;
  } catch (error) {
    saveWriteBlockReason = error instanceof Error ? error.message : String(error);
    console.warn("角色档案读取失败：", error);
    return Array.from({ length: MAX_SAVE_SLOTS }, () => null);
  }
}

/** 将完整档案位数组写入浏览器。 */
function writeSaveSlots(slots) {
  if (saveWriteBlockReason) throw new Error(`存档写入已保护性阻止：${saveWriteBlockReason}`);
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(createSaveContainer(slots, MAX_SAVE_SLOTS)));
}

/** 供设置页或诊断工具查询；被阻止时绝不能覆盖浏览器中的原始存档。 */
export function getSaveStorageStatus() {
  return { writable: !saveWriteBlockReason, reason: saveWriteBlockReason };
}

/** 五行名称固定放在这里，后续加风、雷、冰、魔、神时只需扩充这份常量。 */
export const FIVE_ELEMENTS = ["金", "木", "水", "火", "土"];

/**
 * 根据当前加点找出最高属性。
 * 如果出现并列，返回第一个并列属性；创建界面会让玩家手动确认初始技能属性。
 */
export function getHighestElement() {
  return FIVE_ELEMENTS.reduce((best, element) =>
    gameState.player.roots[element] > gameState.player.roots[best] ? element : best,
  FIVE_ELEMENTS[0]);
}

/**
 * 保存第一章原型进度。
 * localStorage 相当于浏览器自带的小型储物柜：刷新网页后内容仍然存在。
 * 当前版本固定支持 5 个档案位。
 */
export function saveFirstChapterProgress() {
  try {
    if (!Number.isInteger(gameState.activeSaveSlot)) return false;
    const slots = getSaveSlots();
    slots[gameState.activeSaveSlot] = createSaveData(gameState);
    writeSaveSlots(slots);
    localStorage.setItem(LAST_PLAYED_SLOT_KEY, String(gameState.activeSaveSlot));
    return true;
  } catch (error) {
    // 无痕模式或浏览器禁止本地存储时，游戏仍可运行，只是刷新后不会保留进度。
    console.warn("第一章本地存档失败：", error);
    return false;
  }
}

/** 只检查是否存在有效角色档案，不会把档案数据写入当前游戏状态。 */
export function hasFirstChapterProgress() {
  return getSaveSlots().some((slot) => isValidSaveData(slot));
}

/**
 * 准备一个全新的角色创建表单。
 * 注意：这里只重置内存中的表单，尚不会删除旧存档；玩家确认进入村庄后才会覆盖旧档。
 */
export function prepareNewCharacter(slotIndex) {
  gameState.activeSaveSlot = slotIndex;
  const defaults = createDefaultSaveData();
  replaceObject(gameState.player, defaults.player);
  replaceObject(gameState.chapter, defaults.chapter);
  replaceObject(gameState.world, defaults.world);
}

/**
 * 读取已存在的第一章存档。读取成功返回 true；没有存档或格式不正确则返回 false。
 */
export function loadFirstChapterProgress(slotIndex) {
  try {
    const saveData = getSaveSlots()[slotIndex];
    const migrated = migrateSaveData(saveData);
    if (!migrated.ok) return false;
    replaceObject(gameState.player, migrated.data.player);
    replaceObject(gameState.chapter, migrated.data.chapter);
    replaceObject(gameState.world, migrated.data.world);
    gameState.activeSaveSlot = slotIndex;
    localStorage.setItem(LAST_PLAYED_SLOT_KEY, String(slotIndex));

    // 给现有测试档案一次性补发一百万灵石。标记会随角色档案一起保存，
    // 所以刷新后能保留余额，也不会每次刷新都把已经消费的灵石补满。
    if (gameState.player.testSpiritStoneGrantV1 !== true) {
      gameState.player.spiritStones = 1000000;
      gameState.player.testSpiritStoneGrantV1 = true;
      saveFirstChapterProgress();
    }
    return true;
  } catch (error) {
    console.warn("第一章本地存档读取失败，将进入角色创建：", error);
    return false;
  }
}

/**
 * 尝试读取最近游玩的角色。网页刷新后会调用这里，成功时直接回到青云山，
 * 不需要每次都从封面、角色选择重新进入。
 */
export function loadLastPlayedProgress() {
  try {
    const rawSlotIndex = localStorage.getItem(LAST_PLAYED_SLOT_KEY);
    const slotIndex = rawSlotIndex === null ? -1 : Number(rawSlotIndex);
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < MAX_SAVE_SLOTS && loadFirstChapterProgress(slotIndex)) return true;
    // 兼容本次改动前已经存在的旧档案：没有“最近游玩”标记时，自动读取第一个有效档案。
    const fallbackSlot = getSaveSlots().findIndex((slot) => isValidSaveData(slot));
    return fallbackSlot >= 0 ? loadFirstChapterProgress(fallbackSlot) : false;
  } catch (error) {
    console.warn("最近角色读取失败：", error);
    return false;
  }
}

/** 删除指定档案位。删除后这个位置会立即变成“新建角色”。 */
export function deleteSaveSlot(slotIndex) {
  try {
    const slots = getSaveSlots();
    if (!slots[slotIndex]) return false;
    slots[slotIndex] = null;
    writeSaveSlots(slots);
    if (gameState.activeSaveSlot === slotIndex) gameState.activeSaveSlot = null;
    return true;
  } catch (error) {
    console.warn("角色档案删除失败：", error);
    return false;
  }
}

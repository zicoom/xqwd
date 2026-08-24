/**
 * 游戏状态仓库。
 *
 * 对零基础同学的说明：这里像一个“角色档案盒”。场景切换时，角色名字、属性等
 * 数据不会丢失，因为它们统一保存在这里，而不是放在某个场景里。
 */
export const gameState = {
  // 当前正在游玩的档案位（0 到 4）。所有自动存档都会写回这个位置。
  activeSaveSlot: null,
  player: {
    name: "无名散修",
    gender: "男",
    // 五行灵根的初始可分配点。创建角色时共可分配 10 点。
    roots: { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 },
    selectedElement: "火",
    // 第一章原型只演示生命、灵气与基础战斗数值。
    hp: 60,
    maxHp: 60,
    qi: 30,
    maxQi: 30,
    attack: 9,
    defense: 3,
    // 物品使用后的成长与临时增益。旧档案没有这些字段时会自动补为默认值。
    resistance: 0,
    resistanceTypes: [],
    cultivationExp: 0,
    learnedSkills: [],
    learnedTechniques: [],
    // 功法装备栏：1 个主修、4 个辅修与 1 个速度位。速度位只提供战斗先手加成，
    // 不改变大地图移动速度；保存的是功法 id，方便编辑器改名后仍能正确对应。
    equippedTechniques: { main: null, auxiliary: [null, null, null, null], speed: null },
    knownRecipes: [],
    studiedBooks: [],
    activeItemEffects: [],
    realm: "炼气初期",
    hasJade: false,
    // 灵石与储物袋从商人系统开始使用；物品按「物品 id: 数量」保存。
    spiritStones: 125850,
    // 测试用的一次性灵石补给标记。已领取的档案不会在每次刷新时重复补发。
    testSpiritStoneGrantV1: false,
    inventory: {},
  },
  chapter: {
    ancientJadeFound: false,
    eliteDefeated: false,
    // 村长分支对话可接取的第一章主线任务：not_started → active → completed。
    qingyunInvestigation: "not_started",
    // 接到任务后先只记录在日志里；玩家点击“开启引路”才显示地图方向箭头。
    qingyunGuideEnabled: false,
  },
  // 每个角色自己的世界进度。击败编辑器放置的怪物后，怪物不会因刷新页面而复活。
  world: {
    defeatedMonsterIds: [],
    // 玩家在大地图中的最后位置。每张地图以后可各自保存一个位置；当前先记录青云山。
    playerPosition: { x: 980, y: 1260 },
    // 小地图已探索的足迹。每个点都是主角实际走到过的位置，保存后刷新页面也不会变黑。
    miniMapVisitedPoints: [],
    // 商人库存按物品 id 保存；买走的灵草刷新网页后不会凭空补回。
    merchantStock: {},
    // 商人的灵石独立保存：玩家购买时会转入商人账本，取消购物则会退回。
    merchantSpiritStones: 125850,
  },
};

// 浏览器本地存档名称。它只保存在当前浏览器、当前电脑中，不会上传网络。
const LEGACY_SAVE_KEY = "xuanqiong-wendao-first-chapter-save-v1";
const SAVE_SLOTS_KEY = "xuanqiong-wendao-save-slots-v1";
// 记录最近一次实际游玩的档案位，刷新页面时用它自动回到对应角色的地图进度。
const LAST_PLAYED_SLOT_KEY = "xuanqiong-wendao-last-played-slot-v1";
export const MAX_SAVE_SLOTS = 5;

/** 判断一份数据是否是可读取的角色存档。 */
function isValidSaveData(saveData) {
  return Boolean(saveData?.player?.roots && saveData?.chapter);
}

/**
 * 读取五个档案位。旧版本只有一个角色存档时，会自动迁移到第一个档案位。
 */
export function getSaveSlots() {
  try {
    const rawSlots = localStorage.getItem(SAVE_SLOTS_KEY);
    if (rawSlots) {
      const parsed = JSON.parse(rawSlots);
      if (Array.isArray(parsed?.slots)) {
        return Array.from({ length: MAX_SAVE_SLOTS }, (_, index) => parsed.slots[index] ?? null);
      }
    }

    // 兼容之前已经创建过角色的玩家：把旧单存档放到第一个格子中。
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    const legacySave = legacyRaw ? JSON.parse(legacyRaw) : null;
    const slots = Array.from({ length: MAX_SAVE_SLOTS }, () => null);
    if (isValidSaveData(legacySave)) {
      slots[0] = legacySave;
      localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify({ version: 1, slots }));
    }
    return slots;
  } catch (error) {
    console.warn("角色档案读取失败：", error);
    return Array.from({ length: MAX_SAVE_SLOTS }, () => null);
  }
}

/** 将完整档案位数组写入浏览器。 */
function writeSaveSlots(slots) {
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify({ version: 1, slots }));
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
    slots[gameState.activeSaveSlot] = {
      version: 1,
      player: gameState.player,
      chapter: gameState.chapter,
      world: gameState.world,
    };
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
  Object.assign(gameState.player, {
    name: "无名散修",
    gender: "男",
    roots: { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 },
    selectedElement: "火",
    hp: 60,
    maxHp: 60,
    qi: 30,
    maxQi: 30,
    attack: 9,
    defense: 3,
    resistance: 0,
    resistanceTypes: [],
    cultivationExp: 0,
    learnedSkills: [],
    learnedTechniques: [],
    equippedTechniques: { main: null, auxiliary: [null, null, null, null], speed: null },
    knownRecipes: [],
    studiedBooks: [],
    activeItemEffects: [],
    realm: "炼气初期",
    hasJade: false,
    spiritStones: 125850,
    testSpiritStoneGrantV1: false,
    inventory: {},
  });
  Object.assign(gameState.chapter, { ancientJadeFound: false, eliteDefeated: false, qingyunInvestigation: "not_started", qingyunGuideEnabled: false });
  Object.assign(gameState.world, { defeatedMonsterIds: [], playerPosition: { x: 980, y: 1260 }, miniMapVisitedPoints: [], merchantStock: {}, merchantSpiritStones: 125850 });
}

/**
 * 读取已存在的第一章存档。读取成功返回 true；没有存档或格式不正确则返回 false。
 */
export function loadFirstChapterProgress(slotIndex) {
  try {
    const saveData = getSaveSlots()[slotIndex];
    if (!isValidSaveData(saveData)) return false;

    // 使用默认五行结构兜底，防止未来新增字段时旧存档造成页面报错。
    const normalizedRoots = { ...gameState.player.roots, ...saveData.player.roots };
    const savedSpiritStones = Number(saveData.player.spiritStones);
    const savedInventory = saveData.player.inventory && typeof saveData.player.inventory === "object"
      ? saveData.player.inventory
      : {};
    Object.assign(gameState.player, saveData.player, {
      roots: normalizedRoots,
      // 兼容旧存档：过去没有灵石和储物袋时，读取后自动给出商店的初始数据。
      spiritStones: Number.isFinite(savedSpiritStones) ? Math.max(0, savedSpiritStones) : 125850,
      inventory: savedInventory,
      resistance: Math.max(0, Number(saveData.player.resistance) || 0),
      resistanceTypes: Array.isArray(saveData.player.resistanceTypes) ? saveData.player.resistanceTypes : [],
      cultivationExp: Math.max(0, Number(saveData.player.cultivationExp) || 0),
      learnedSkills: Array.isArray(saveData.player.learnedSkills) ? saveData.player.learnedSkills : [],
      learnedTechniques: Array.isArray(saveData.player.learnedTechniques) ? saveData.player.learnedTechniques : [],
      // 兼容旧档：没有功法栏时自动补齐 1 主修、4 辅修、1 速度位。
      equippedTechniques: {
        main: saveData.player.equippedTechniques?.main || null,
        auxiliary: Array.from({ length: 4 }, (_, index) => saveData.player.equippedTechniques?.auxiliary?.[index] || null),
        speed: saveData.player.equippedTechniques?.speed || null,
      },
      knownRecipes: Array.isArray(saveData.player.knownRecipes) ? saveData.player.knownRecipes : [],
      studiedBooks: Array.isArray(saveData.player.studiedBooks) ? saveData.player.studiedBooks : [],
      activeItemEffects: Array.isArray(saveData.player.activeItemEffects) ? saveData.player.activeItemEffects : [],
    });
    // 老存档没有“是否开启引路”字段时默认关闭，避免读档后自动出现箭头。
    Object.assign(gameState.chapter, {
      ancientJadeFound: false,
      eliteDefeated: false,
      qingyunInvestigation: "not_started",
      qingyunGuideEnabled: false,
      ...saveData.chapter,
    });
    Object.assign(gameState.world, { defeatedMonsterIds: [], playerPosition: { x: 980, y: 1260 }, miniMapVisitedPoints: [], merchantStock: {}, merchantSpiritStones: 125850, ...(saveData.world || {}) });
    if (!Number.isFinite(Number(gameState.world.merchantSpiritStones))) gameState.world.merchantSpiritStones = 125850;
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

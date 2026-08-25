/**
 * 物品模板仓库。
 *
 * 物品资料只在这里保存一次；商人、储物袋和以后战利品都会读取同一份模板。
 */
const ITEM_STORE_KEY = "xuanqiong-wendao-item-templates-v1";

// 编辑器与游戏内筛选统一使用这些类型，材料包含炼器、炼丹等基础素材。
export const ITEM_TYPES = ["灵草", "丹药", "功法", "法宝", "书籍", "装备", "材料", "其他"];
export const ITEM_GRADES = ["凡品", "灵品", "玄品", "地品", "天品", "仙品", "神器"];
// 物品抗性使用固定属性列表，避免编辑时手动填写造成名称不统一。
export const RESISTANCE_TYPES = ["无", "全属性", "金", "木", "水", "火", "土", "风", "雷", "冰", "魔", "神"];
// 装备套装使用固定部位，方便后续在角色装备栏中准确统计套装数量。
export const EQUIPMENT_SLOTS = ["武器", "头盔", "护肩", "胸甲", "腰带", "护腕", "护手", "戒指", "项链", "鞋靴", "其他"];
// 物品专属属性的固定选项：编辑器与游戏内展示共用，避免名称不一致。
export const ELEMENT_TYPES = ["无", "金", "木", "水", "火", "土", "风", "雷", "冰", "魔", "神"];
export const HERB_EFFECT_TYPES = ["炼丹材料", "恢复生命", "恢复修为", "解毒", "淬体", "突破辅助"];
export const PILL_EFFECT_TYPES = ["恢复生命", "恢复修为", "解毒", "淬体强化", "突破辅助", "抗性提升"];
export const BOOK_KINDS = ["功法秘籍", "法术书", "丹方", "炼器配方", "阵法图谱", "杂记"];
export const TECHNIQUE_KINDS = ["心法", "法术", "身法", "秘术"];
export const ARTIFACT_CATEGORIES = ["御剑", "防御", "属性", "攻击", "辅助", "抗性"];
export const MATERIAL_PURPOSES = ["炼丹材料", "炼器材料", "锻造材料", "布阵材料", "任务材料", "其他"];
export const OTHER_KINDS = ["任务物品", "货币", "凭证", "宝箱", "杂物"];

const DEFAULT_ITEMS = [
  ["baixiangye", "百香叶", "凡品", 50, "merchant-herb-baixiangye", "化解普通蛇毒、虫毒和低阶瘴气，是基础解毒丹的核心材料。", 4, 0],
  ["juqicao", "聚气草", "灵品", 88, "merchant-herb-juqicao", "蕴含温和灵气，可用于炼制聚气类丹药。", 0, 8],
  ["xingyingguo", "星萤果", "玄品", 1800, "merchant-herb-xingyingguo", "夜间会泛起微光，是几种高阶凝神丹的重要辅材。", 0, 18],
  ["ninglutai", "凝露苔", "地品", 1450, "merchant-herb-ninglutai", "采自阴湿崖壁，能稳定药性并缓和灵力冲突。", 8, 4],
  ["linggugen", "灵谷根", "天品", 2450, "merchant-herb-linggugen", "根须厚实、灵性充盈，是锻体药剂的珍贵材料。", 20, 0],
  ["yuyazhi", "玉芽芝", "仙品", 1640, "merchant-herb-yuyazhi", "菌盖如玉，可迅速滋养经脉，适合炼气期修士服用。", 16, 16],
  ["qingmaiteng", "青脉藤", "凡品", 80, "merchant-herb-qingmaiteng", "韧性极佳，常被用于炼制疗伤丹和束缚类符箓。", 8, 0],
  ["yuelulan", "月露兰", "神器", 2450, "merchant-herb-yuelulan", "承接月华而生的罕见灵兰，目前仅供展示。", 0, 0],
  ["qinglinghua", "清灵花", "灵品", 88, "merchant-herb-qinglinghua", "花蕊清澈，可辅助修士平复气息。", 0, 12],
  ["chiyangshen", "赤阳参", "天品", 2450, "merchant-herb-chiyangshen", "阳性浓烈，适合修炼火系功法的修士。", 10, 20],
].map(([id, name, grade, price, texture, description, restoreHp, restoreQi]) => ({
  id, name, type: "灵草", grade, price, stock: 50, texture, description, restoreHp, restoreQi,
  attackBonus: 0, defenseBonus: 0, skillText: "", imageData: "", canUse: restoreHp > 0 || restoreQi > 0, sellable: true,
}));

// 书籍负责闭关、配方和学习内容；功法负责角色后续可装备、可施放的技能。
// 这些只是起始模板：已有存档不会被覆盖，首次读取时只会补入缺少的模板。
const BOOK_AND_TECHNIQUE_DEFAULT_ITEMS = [
  {
    id: "book-qingxin-jue", name: "清心诀残卷", type: "书籍", grade: "凡品", price: 120, stock: 50,
    description: "记载凝神静气的基础心法，可用于闭关入门。", bookKind: "功法秘籍",
    bookLearnName: "清心诀", bookRequiredRealm: "炼气初期", bookCultivationExp: 120,
    bookSuccessRate: 100, bookDuration: 20, canUse: true, sellable: true,
  },
  {
    id: "book-huoqiu-shu", name: "火球术要略", type: "书籍", grade: "灵品", price: 420, stock: 50,
    description: "初阶火系术法书，学习后可施展火球术。", bookKind: "法术书",
    bookLearnName: "火球术", bookRequiredRealm: "炼气初期", bookCultivationExp: 180,
    bookSuccessRate: 85, bookDuration: 35, canUse: true, sellable: true,
  },
  {
    id: "book-juqi-danfang", name: "聚气丹方", type: "书籍", grade: "灵品", price: 560, stock: 50,
    description: "记载聚气丹的炼制手法与所需药材。", bookKind: "丹方",
    bookLearnName: "聚气丹", bookRequiredRealm: "炼气初期", bookSuccessRate: 100,
    bookDuration: 25, bookFormulaOutput: "聚气丹", bookIngredientText: "聚气草×3、百香叶×1",
    canUse: true, sellable: true,
  },
  {
    id: "book-lianqi-yaojue", name: "初阶炼器要诀", type: "书籍", grade: "玄品", price: 980, stock: 50,
    description: "记载炼气期常用法器的基础锻造方法。", bookKind: "炼器配方",
    bookLearnName: "青云短剑", bookRequiredRealm: "炼气中期", bookCultivationExp: 220,
    bookSuccessRate: 75, bookDuration: 50, bookFormulaOutput: "青云短剑",
    bookIngredientText: "百炼精铁×3、青云铁矿×2", canUse: true, sellable: true,
  },
  {
    id: "technique-qingxin-jue", name: "清心诀", type: "功法", grade: "凡品", price: 300, stock: 50,
    description: "守心宁神的基础心法。", techniqueKind: "心法", techniqueElement: "无",
    techniqueLearnRealm: "炼气初期", techniqueLevelLimit: 10,
    skillText: "被动：闭关修炼经验提高 10%。", canUse: true, sellable: true,
  },
  {
    id: "technique-huoqiu", name: "火球术", type: "功法", grade: "灵品", price: 720, stock: 50,
    description: "凝聚火灵力发射火球的基础术法。", techniqueKind: "法术", techniqueElement: "火",
    techniqueDamage: 45, techniqueQiCost: 15, techniqueCooldown: 3, techniqueRange: 360,
    techniqueLearnRealm: "炼气初期", techniqueLevelLimit: 12,
    skillText: "主动：造成 45 点火属性伤害。", canUse: true, sellable: true,
  },
  {
    id: "technique-yufeng-bu", name: "御风步", type: "功法", grade: "玄品", price: 1280, stock: 50,
    description: "借风势提升身法的轻灵秘术。", techniqueKind: "身法", techniqueElement: "风",
    techniqueQiCost: 12, techniqueCooldown: 5, techniqueDuration: 6, techniqueInitiative: 20,
    techniqueLearnRealm: "炼气中期", techniqueLevelLimit: 15,
    skillText: "主动：移动速度提高 35%，持续 6 秒。", canUse: true, sellable: true,
  },
  {
    id: "technique-xuanbing-huti", name: "玄冰护体", type: "功法", grade: "地品", price: 2200, stock: 50,
    description: "以寒冰灵力凝结护体冰甲。", techniqueKind: "秘术", techniqueElement: "冰",
    techniqueQiCost: 25, techniqueCooldown: 18, techniqueDuration: 12,
    techniqueLearnRealm: "筑基初期", techniqueLevelLimit: 20,
    skillText: "主动：防御提高 30，持续 12 秒。", canUse: true, sellable: true,
  },
];

// 战斗内置掉落也必须登记到统一物品目录，确保结算后能在储物袋真实显示。
const BATTLE_REWARD_DEFAULT_ITEMS = [
  { id: "material-low-tier", name: "低阶材料", type: "材料", grade: "凡品", price: 4, description: "常见的低阶炼制材料。", materialPurpose: "炼器材料", sellable: true },
  { id: "material-wolf-pelt", name: "狼皮", type: "材料", grade: "凡品", price: 10, description: "山狼留下的完整皮毛。", materialPurpose: "锻造材料", sellable: true },
  { id: "material-earth-crystal", name: "土灵晶", type: "材料", grade: "灵品", price: 80, description: "蕴含土属性灵力的晶石。", materialPurpose: "炼器材料", materialElement: "土", sellable: true },
  { id: "pill-low-qi", name: "低阶回灵丹", type: "丹药", grade: "凡品", price: 35, description: "服用后恢复少量灵气。", pillEffect: "恢复修为", pillQiRestore: 10, restoreQi: 10, canUse: true, sellable: true },
  { id: "quest-eclipse-token-fragment", name: "蚀月盟令牌残片", type: "其他", grade: "凡品", description: "蚀月盟令牌的一块残片，似乎与本章线索有关。", otherKind: "任务物品", otherTradable: "不可交易", sellable: false },
];

const INITIAL_TEMPLATE_ITEMS = [...DEFAULT_ITEMS, ...BOOK_AND_TECHNIQUE_DEFAULT_ITEMS, ...BATTLE_REWARD_DEFAULT_ITEMS];

const clampNumber = (value, fallback = 0, min = 0, max = 999999) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};

const pickChoice = (value, choices, fallback) => choices.includes(value) ? value : fallback;

/** 统一清洗数据，避免空值、错误数值让商店或储物袋报错。 */
export function normalizeItem(item = {}) {
  const isNew = Boolean(item.isNew);
  return {
    id: String(item.id || `item-${Date.now()}-${Math.floor(Math.random() * 10000)}`).trim(),
    isNew,
    name: isNew ? String(item.name ?? "").trim() : (String(item.name || "未命名物品").trim() || "未命名物品"),
    type: ITEM_TYPES.includes(item.type) ? item.type : "其他",
    grade: ITEM_GRADES.includes(item.grade) ? item.grade : "凡品",
    description: String(item.description || "").trim(),
    price: clampNumber(item.price, 0),
    stock: clampNumber(item.stock, 50),
    restoreHp: clampNumber(item.restoreHp, 0),
    restoreQi: clampNumber(item.restoreQi, 0),
    attackBonus: clampNumber(item.attackBonus, 0),
    defenseBonus: clampNumber(item.defenseBonus, 0),
    resistance: clampNumber(item.resistance, 0),
    resistanceType: RESISTANCE_TYPES.includes(item.resistanceType) ? item.resistanceType : "无",
    cultivationExp: clampNumber(item.cultivationExp, 0),
    duration: clampNumber(item.duration, 0),
    successRate: clampNumber(item.successRate, 100, 0, 100),
    skillText: String(item.skillText || "").trim(),
    setName: String(item.setName || "").trim(),
    equipmentSlot: EQUIPMENT_SLOTS.includes(item.equipmentSlot) ? item.equipmentSlot : "其他",
    setBonus2: String(item.setBonus2 || "").trim(),
    setBonus4: String(item.setBonus4 || "").trim(),
    setBonus6: String(item.setBonus6 || "").trim(),

    // 灵草专属属性
    herbEffect: pickChoice(item.herbEffect, HERB_EFFECT_TYPES, "炼丹材料"),
    herbMaturity: clampNumber(item.herbMaturity, 0),
    herbMedicinalPower: clampNumber(item.herbMedicinalPower, 0),
    herbAlchemyValue: clampNumber(item.herbAlchemyValue, 0),
    herbElement: pickChoice(item.herbElement, ELEMENT_TYPES, "无"),

    // 丹药专属属性
    pillEffect: pickChoice(item.pillEffect, PILL_EFFECT_TYPES, "恢复生命"),
    pillRealm: String(item.pillRealm || "").trim(),
    pillHpRestore: clampNumber(item.pillHpRestore ?? item.restoreHp, 0),
    pillQiRestore: clampNumber(item.pillQiRestore ?? item.restoreQi, 0),
    pillResistanceType: pickChoice(item.pillResistanceType ?? item.resistanceType, RESISTANCE_TYPES, "无"),
    pillResistance: clampNumber(item.pillResistance ?? item.resistance, 0),
    pillDuration: clampNumber(item.pillDuration ?? item.duration, 0),
    pillSuccessRate: clampNumber(item.pillSuccessRate ?? item.successRate, 100, 0, 100),
    pillBreakthrough: clampNumber(item.pillBreakthrough, 0),

    // 功法专属属性
    techniqueKind: pickChoice(item.techniqueKind, TECHNIQUE_KINDS, "心法"),
    techniqueElement: pickChoice(item.techniqueElement, ELEMENT_TYPES, "无"),
    techniqueDamage: clampNumber(item.techniqueDamage ?? item.attackBonus, 0),
    techniqueQiCost: clampNumber(item.techniqueQiCost, 0),
    techniqueCooldown: clampNumber(item.techniqueCooldown, 0),
    techniqueDuration: clampNumber(item.techniqueDuration ?? item.duration, 0),
    techniqueRange: clampNumber(item.techniqueRange, 0),
    // 仅当功法装入“速度位”时，用于战斗的先手判定。
    techniqueInitiative: clampNumber(item.techniqueInitiative, 0),
    techniqueLearnRealm: String(item.techniqueLearnRealm || "").trim(),
    techniqueLevelLimit: clampNumber(item.techniqueLevelLimit, 1, 1, 99),

    // 法宝专属属性：类别同时决定角色菜单中的可装备槽位。
    artifactCategory: pickChoice(item.artifactCategory, ARTIFACT_CATEGORIES, "辅助"),

    // 书籍 / 配方专属属性
    bookKind: pickChoice(item.bookKind, BOOK_KINDS, "功法秘籍"),
    bookLearnName: String(item.bookLearnName || "").trim(),
    bookRequiredRealm: String(item.bookRequiredRealm || "").trim(),
    bookCultivationExp: clampNumber(item.bookCultivationExp ?? item.cultivationExp, 0),
    bookSuccessRate: clampNumber(item.bookSuccessRate ?? item.successRate, 100, 0, 100),
    bookDuration: clampNumber(item.bookDuration ?? item.duration, 0),
    bookFormulaOutput: String(item.bookFormulaOutput || "").trim(),
    bookIngredientText: String(item.bookIngredientText || "").trim(),

    // 装备专属属性
    equipAttack: clampNumber(item.equipAttack ?? item.attackBonus, 0),
    equipDefense: clampNumber(item.equipDefense ?? item.defenseBonus, 0),
    equipDamage: clampNumber(item.equipDamage, 0),
    equipHp: clampNumber(item.equipHp, 0),
    equipQi: clampNumber(item.equipQi, 0),
    equipCritRate: clampNumber(item.equipCritRate, 0, 0, 100),
    equipCritDamage: clampNumber(item.equipCritDamage, 0),
    equipElement: pickChoice(item.equipElement, ELEMENT_TYPES, "无"),
    equipElementDamage: clampNumber(item.equipElementDamage, 0),
    equipResistanceType: pickChoice(item.equipResistanceType ?? item.resistanceType, RESISTANCE_TYPES, "无"),
    equipResistance: clampNumber(item.equipResistance ?? item.resistance, 0),

    // 材料专属属性
    materialPurpose: pickChoice(item.materialPurpose, MATERIAL_PURPOSES, "炼器材料"),
    materialElement: pickChoice(item.materialElement, ELEMENT_TYPES, "无"),
    materialPurity: clampNumber(item.materialPurity, 0, 0, 100),
    materialHardness: clampNumber(item.materialHardness, 0),
    materialStackLimit: clampNumber(item.materialStackLimit, 99, 1, 9999),
    materialForgeValue: clampNumber(item.materialForgeValue, 0),
    materialTaskLevel: clampNumber(item.materialTaskLevel, 0),
    materialOrigin: String(item.materialOrigin || "").trim(),
    materialUseText: String(item.materialUseText || "").trim(),

    // 其他物品专属属性
    otherKind: pickChoice(item.otherKind, OTHER_KINDS, "杂物"),
    otherValue: clampNumber(item.otherValue, 0),
    otherTaskId: String(item.otherTaskId || "").trim(),
    otherDuration: clampNumber(item.otherDuration ?? item.duration, 0),
    otherTradable: ["可交易", "不可交易"].includes(item.otherTradable) ? item.otherTradable : "可交易",
    otherCustomValue: clampNumber(item.otherCustomValue, 0),
    otherUseText: String(item.otherUseText || "").trim(),
    texture: String(item.texture || "").trim(),
    imageData: String(item.imageData || ""),
    canUse: Boolean(item.canUse),
    sellable: item.sellable !== false,
  };
}

const createInitialItems = () => INITIAL_TEMPLATE_ITEMS.map(normalizeItem);

export function getItemTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(ITEM_STORE_KEY) || "null");
    if (Array.isArray(saved)) {
      const existingItems = saved.map(normalizeItem);
      const existingIds = new Set(existingItems.map((item) => item.id));
      const additions = createInitialItems().filter((item) => !existingIds.has(item.id));

      if (additions.length === 0) return existingItems;

      const merged = [...existingItems, ...additions];
      localStorage.setItem(ITEM_STORE_KEY, JSON.stringify(merged));
      return merged;
    }

    const initial = createInitialItems();
    localStorage.setItem(ITEM_STORE_KEY, JSON.stringify(initial));
    return initial;
  } catch (error) {
    console.warn("物品模板读取失败：", error);
    return createInitialItems();
  }
}

export function saveItemTemplates(items) {
  try {
    const normalizedItems = items.map((item) => normalizeItem(item));
    const serializedItems = JSON.stringify(normalizedItems);
    localStorage.setItem(ITEM_STORE_KEY, serializedItems);

    // 保存后立刻读回验证，避免储存空间不足时仍误提示“保存成功”。
    const confirmedItems = localStorage.getItem(ITEM_STORE_KEY);
    if (confirmedItems !== serializedItems) {
      throw new Error("物品资料未能写入本地储存");
    }

    const parsedItems = JSON.parse(confirmedItems);
    const isValid = Array.isArray(parsedItems)
      && parsedItems.length === normalizedItems.length
      && parsedItems.every((item, index) => item?.id === normalizedItems[index]?.id);
    if (!isValid) {
      throw new Error("物品资料写入验证失败");
    }

    return true;
  } catch (error) {
    console.warn("物品模板保存失败：", error);
    return false;
  }
}

export function getItemTemplate(id) { return getItemTemplates().find((item) => item.id === id) || null; }

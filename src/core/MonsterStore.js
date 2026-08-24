/**
 * 怪物模板仓库。
 * 地图不再保存每一只怪物的完整数值，只保存 monsterTemplateId（模板编号）。
 * 这样修改“青木狼”模板后，地图上所有青木狼都会同步使用新数值。
 */
const MONSTER_STORE_KEY = "xuanqiong-wendao-monster-templates-v1";

/** 初始示例数据：可直接用于测试，也可以在怪物编辑器中修改或删除。 */
const DEFAULT_MONSTERS = [
  {
    id: "monster-green-wood-wolf",
    name: "青木狼",
    grade: "普通",
    realm: "炼气初期",
    element: "木",
    maxHp: 45,
    qi: 16,
    attack: 8,
    defense: 2,
    skills: [{ name: "撕咬", damage: 8, qiCost: 0, cooldown: 0 }],
    drops: ["灵石 × 3", "狼皮 × 1"],
    imageData: "",
    soundUrl: "",
  },
  {
    id: "monster-stone-spirit",
    name: "岩甲灵",
    grade: "精英",
    realm: "炼气中期",
    element: "土",
    maxHp: 86,
    qi: 24,
    attack: 13,
    defense: 6,
    skills: [{ name: "岩刺", damage: 14, qiCost: 4, cooldown: 1 }],
    drops: ["灵石 × 12", "土灵晶 × 1"],
    imageData: "",
    soundUrl: "",
  },
];

/** 数值和数组统一整理，防止输入框填入空值导致战斗报错。 */
export function normalizeMonster(monster = {}) {
  const toNumber = (value, fallback, min = 0, max = 999999) => Phaser.Math.Clamp(Number(value) || fallback, min, max);
  return {
    id: monster.id || `monster-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: String(monster.name || "未命名怪物").trim() || "未命名怪物",
    grade: monster.grade || "普通",
    realm: monster.realm || "炼气初期",
    element: monster.element || "无",
    maxHp: toNumber(monster.maxHp, 45, 1),
    qi: toNumber(monster.qi, 16, 0),
    attack: toNumber(monster.attack, 8, 1, 999),
    defense: toNumber(monster.defense, 2, 0, 999),
    skills: Array.isArray(monster.skills) ? monster.skills.map((skill) => ({
      name: String(skill.name || "攻击"),
      damage: toNumber(skill.damage, 8, 1, 999999),
      qiCost: toNumber(skill.qiCost, 0, 0, 999999),
      cooldown: toNumber(skill.cooldown, 0, 0, 99),
    })) : [],
    drops: Array.isArray(monster.drops) ? monster.drops.filter(Boolean) : [],
    imageData: monster.imageData || "",
    soundUrl: monster.soundUrl || "",
  };
}

/** 获取所有模板；第一次使用时自动创建示例怪物。 */
export function getMonsterTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem(MONSTER_STORE_KEY) || "null");
    if (Array.isArray(stored)) return stored.map(normalizeMonster);
    const initial = DEFAULT_MONSTERS.map(normalizeMonster);
    localStorage.setItem(MONSTER_STORE_KEY, JSON.stringify(initial));
    return initial;
  } catch (error) {
    console.warn("怪物模板读取失败：", error);
    return DEFAULT_MONSTERS.map(normalizeMonster);
  }
}

/** 保存整个模板列表。 */
export function saveMonsterTemplates(templates) {
  try {
    localStorage.setItem(MONSTER_STORE_KEY, JSON.stringify(templates.map(normalizeMonster)));
    return true;
  } catch (error) {
    console.warn("怪物模板保存失败：", error);
    return false;
  }
}

/** 按编号取一只怪物，用于地图和战斗读取。 */
export function getMonsterTemplate(id) {
  return getMonsterTemplates().find((monster) => monster.id === id) || null;
}

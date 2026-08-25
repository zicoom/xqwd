import { getPlayerPortrait } from "../PortraitCatalog.js";

export const CURRENT_SAVE_VERSION = 3;
export const CURRENT_SAVE_CONTAINER_VERSION = 2;

export const TECHNIQUE_SLOTS = Object.freeze({ main: null, auxiliary: [null, null, null, null], speed: null });
export const ARTIFACT_SLOT_IDS = Object.freeze(["御剑", "防御", "属性", "攻击", "辅助", "抗性"]);

const finite = (value, fallback = 0, min = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, number) : fallback;
};
const array = (value) => Array.isArray(value) ? [...value] : [];
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const defaultCombatShortcuts = (selectedElement = "火") => [
  { kind: "action", id: "normal-attack" },
  { kind: "spell", id: `element-${({ 金: "metal", 木: "wood", 水: "water", 火: "fire", 土: "earth" })[selectedElement] || "fire"}` },
  { kind: "action", id: "defend" },
  null, null, null, null, null, null, null,
];
const normalizeCombatShortcuts = (value, selectedElement) => {
  const source = Array.isArray(value) ? value : defaultCombatShortcuts(selectedElement);
  return Array.from({ length: 10 }, (_, index) => {
    const entry = source[index];
    return entry?.kind && entry?.id ? { kind: String(entry.kind), id: String(entry.id) } : null;
  });
};

const normalizeQuantities = (value) => Object.fromEntries(
  Object.entries(record(value))
    .map(([id, quantity]) => [id, Math.floor(finite(quantity, 0))])
    .filter(([id, quantity]) => id && quantity > 0),
);
const normalizeStock = (value) => Object.fromEntries(
  Object.entries(record(value))
    .map(([id, quantity]) => [id, Math.floor(finite(quantity, 0))])
    .filter(([id]) => id),
);

export function createDefaultSaveData() {
  return {
    version: CURRENT_SAVE_VERSION,
    player: {
      name: "无名散修", gender: "女", roots: { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 }, selectedElement: "火",
      // 存档只保存立绘编号；实际图片由 PortraitCatalog 按编号加载，避免把图片数据写入 localStorage。
      portraitId: "cultivator-female",
      hp: 60, maxHp: 60, qi: 30, maxQi: 30, attack: 9, defense: 3,
      resistance: 0, resistanceTypes: [], cultivationExp: 0, learnedSkills: [], learnedTechniques: [],
      equippedTechniques: clone(TECHNIQUE_SLOTS),
      equippedArtifacts: Object.fromEntries(ARTIFACT_SLOT_IDS.map((slotId) => [slotId, null])),
      combatShortcuts: defaultCombatShortcuts("火"),
      knownRecipes: [], studiedBooks: [], activeItemEffects: [], realm: "炼气初期", hasJade: false,
      spiritStones: 125850, testSpiritStoneGrantV1: false, inventory: {},
    },
    chapter: {
      ancientJadeFound: false, eliteDefeated: false,
      qingyunInvestigation: "not_started", qingyunGuideEnabled: false,
    },
    world: {
      defeatedMonsterIds: [], playerPosition: { x: 980, y: 1260 }, miniMapVisitedPoints: [],
      merchantStock: {}, merchantSpiritStones: 125850,
    },
  };
}

function normalizeCurrentSave(input) {
  const defaults = createDefaultSaveData();
  const source = clone(input);
  const player = record(source.player);
  const chapter = record(source.chapter);
  const world = record(source.world);
  const maxHp = Math.max(1, finite(player.maxHp, defaults.player.maxHp, 1));
  const maxQi = finite(player.maxQi, defaults.player.maxQi);
  const position = record(world.playerPosition);

  return {
    ...source,
    version: CURRENT_SAVE_VERSION,
    player: {
      ...defaults.player,
      ...player,
      // 旧档、手工导入档或未来被移除的编号都回退到默认立绘，避免地图 HUD 找不到图片。
      portraitId: getPlayerPortrait(player.portraitId).id,
      roots: Object.fromEntries(Object.keys(defaults.player.roots).map((element) => [element, finite(player.roots?.[element], 0)])),
      maxHp,
      hp: Math.min(maxHp, finite(player.hp, maxHp)),
      maxQi,
      qi: Math.min(maxQi, finite(player.qi, maxQi)),
      attack: finite(player.attack, defaults.player.attack),
      defense: finite(player.defense, defaults.player.defense),
      resistance: finite(player.resistance, 0),
      cultivationExp: finite(player.cultivationExp, 0),
      spiritStones: finite(player.spiritStones, defaults.player.spiritStones),
      resistanceTypes: array(player.resistanceTypes),
      learnedSkills: array(player.learnedSkills),
      learnedTechniques: array(player.learnedTechniques),
      knownRecipes: array(player.knownRecipes),
      studiedBooks: array(player.studiedBooks),
      activeItemEffects: array(player.activeItemEffects),
      inventory: normalizeQuantities(player.inventory),
      equippedTechniques: {
        main: player.equippedTechniques?.main || null,
        auxiliary: Array.from({ length: 4 }, (_, index) => player.equippedTechniques?.auxiliary?.[index] || null),
        speed: player.equippedTechniques?.speed || null,
      },
      equippedArtifacts: Object.fromEntries(
        ARTIFACT_SLOT_IDS.map((slotId) => [slotId, player.equippedArtifacts?.[slotId] || null]),
      ),
      combatShortcuts: normalizeCombatShortcuts(player.combatShortcuts, player.selectedElement || defaults.player.selectedElement),
    },
    chapter: { ...defaults.chapter, ...chapter },
    world: {
      ...defaults.world,
      ...world,
      defeatedMonsterIds: array(world.defeatedMonsterIds),
      miniMapVisitedPoints: array(world.miniMapVisitedPoints),
      // 商店库存的 0 表示已售罄，必须保留；背包的 0 才可以删除。
      merchantStock: normalizeStock(world.merchantStock),
      merchantSpiritStones: finite(world.merchantSpiritStones, defaults.world.merchantSpiritStones),
      playerPosition: { x: finite(position.x, 980), y: finite(position.y, 1260) },
    },
  };
}

// 注册表中的每一步只负责 vN → vN+1；字段清洗统一在迁移链结束后执行。
export const SAVE_MIGRATIONS = new Map([
  [1, (save) => ({ ...save, version: 2 })],
  [2, (save) => ({
    ...save,
    version: 3,
    player: {
      ...save.player,
      combatShortcuts: defaultCombatShortcuts(save.player?.selectedElement),
    },
  })],
]);

export function migrateSaveData(input) {
  if (!input?.player?.roots || !input?.chapter) return { ok: false, error: "缺少角色或章节数据" };
  let save = clone(input);
  let version = save.version == null ? 1 : Number(save.version);
  if (!Number.isInteger(version) || version < 1) return { ok: false, error: "存档版本无效" };
  if (version > CURRENT_SAVE_VERSION) return { ok: false, error: `存档版本 ${version} 高于当前支持版本` };
  while (version < CURRENT_SAVE_VERSION) {
    const migrate = SAVE_MIGRATIONS.get(version);
    if (!migrate) return { ok: false, error: `缺少 v${version} 到 v${version + 1} 的迁移步骤` };
    save = migrate(save);
    version = Number(save.version);
  }
  const data = normalizeCurrentSave(save);
  return {
    ok: true,
    migrated: Number(input.version ?? 1) !== CURRENT_SAVE_VERSION || JSON.stringify(data) !== JSON.stringify(input),
    data,
  };
}

export function createSaveData({ player, chapter, world }) {
  return normalizeCurrentSave({ version: CURRENT_SAVE_VERSION, player, chapter, world });
}

export function migrateSaveContainer(input, maxSlots = 5) {
  if (!Array.isArray(input?.slots)) return { ok: false, error: "档案位容器格式无效" };
  const version = input.version == null ? 1 : Number(input.version);
  if (!Number.isInteger(version) || version < 1) return { ok: false, error: "档案位容器版本无效" };
  if (version > CURRENT_SAVE_CONTAINER_VERSION) return { ok: false, error: `档案位容器版本 ${version} 高于当前支持版本` };
  const slots = [];
  let slotMigrated = false;
  for (let index = 0; index < maxSlots; index += 1) {
    const slot = input.slots[index];
    if (slot == null) {
      slots.push(null);
      continue;
    }
    const migrated = migrateSaveData(slot);
    if (!migrated.ok) return { ok: false, error: `档案位 ${index + 1}：${migrated.error}` };
    slotMigrated ||= migrated.migrated;
    slots.push(migrated.data);
  }
  return {
    ok: true,
    migrated: version !== CURRENT_SAVE_CONTAINER_VERSION || input.slots.length !== maxSlots || slotMigrated,
    data: { version: CURRENT_SAVE_CONTAINER_VERSION, slots },
  };
}

export function createSaveContainer(slots, maxSlots = 5) {
  const migrated = migrateSaveContainer({ version: CURRENT_SAVE_CONTAINER_VERSION, slots }, maxSlots);
  if (!migrated.ok) throw new Error(migrated.error);
  return migrated.data;
}

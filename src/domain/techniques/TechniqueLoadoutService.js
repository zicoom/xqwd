/** 功法槽位集中定义，UI 和战斗不再各自解析字符串。 */
export const TECHNIQUE_SLOT_IDS = Object.freeze([
  "speed", "auxiliary-0", "auxiliary-1", "main", "auxiliary-2", "auxiliary-3",
]);

export function normalizeTechniqueLoadout(loadout = {}) {
  return {
    main: loadout.main || null,
    auxiliary: Array.from({ length: 4 }, (_, index) => loadout.auxiliary?.[index] || null),
    speed: loadout.speed || null,
  };
}

function readSlot(loadout, slotId) {
  if (slotId === "main" || slotId === "speed") return loadout[slotId];
  return loadout.auxiliary[Number(slotId.split("-")[1])] || null;
}

function writeSlot(loadout, slotId, techniqueId) {
  if (slotId === "main" || slotId === "speed") loadout[slotId] = techniqueId;
  else loadout.auxiliary[Number(slotId.split("-")[1])] = techniqueId;
}

/**
 * 功法配装领域服务。
 * 它负责拥有校验、槽位规则、去重和保存；界面只展示结果。
 */
export class TechniqueLoadoutService {
  constructor({ player, catalog, save = () => true }) {
    this.player = player;
    this.catalog = catalog;
    this.save = save;
  }

  getLoadout() {
    return normalizeTechniqueLoadout(this.player.equippedTechniques);
  }

  getEquippedId(slotId) {
    return TECHNIQUE_SLOT_IDS.includes(slotId) ? readSlot(this.getLoadout(), slotId) : null;
  }

  listOwned() {
    return this.catalog.ownedBy(this.player, (item) => item.type === "功法")
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }

  validateEquip(slotId, techniqueId) {
    if (!TECHNIQUE_SLOT_IDS.includes(slotId)) return { ok: false, message: "未知的功法槽位。" };
    const technique = this.listOwned().find((item) => item.id === techniqueId);
    if (!technique) return { ok: false, message: "角色尚未拥有该功法。" };
    if (slotId === "speed" && technique.techniqueKind !== "身法" && Number(technique.techniqueInitiative) <= 0) {
      return { ok: false, message: "速度位只能装备身法或带先手加成的功法。" };
    }
    return { ok: true, technique };
  }

  equip(slotId, techniqueId) {
    const validation = this.validateEquip(slotId, techniqueId);
    if (!validation.ok) return validation;
    const loadout = this.getLoadout();
    if (loadout.main === techniqueId) loadout.main = null;
    if (loadout.speed === techniqueId) loadout.speed = null;
    loadout.auxiliary = loadout.auxiliary.map((id) => id === techniqueId ? null : id);
    writeSlot(loadout, slotId, techniqueId);
    this.player.equippedTechniques = loadout;
    this.save();
    return validation;
  }

  unequip(slotId) {
    if (!TECHNIQUE_SLOT_IDS.includes(slotId)) return { ok: false, message: "未知的功法槽位。" };
    const loadout = this.getLoadout();
    writeSlot(loadout, slotId, null);
    this.player.equippedTechniques = loadout;
    this.save();
    return { ok: true };
  }
}

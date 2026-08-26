import { ARTIFACT_CATEGORIES } from "../../core/ItemStore.js";

export const ARTIFACT_SLOT_IDS = Object.freeze([...ARTIFACT_CATEGORIES]);

/** 旧档或不完整对象统一补成六个明确槽位。 */
export function normalizeArtifactLoadout(loadout = {}) {
  return Object.fromEntries(ARTIFACT_SLOT_IDS.map((slotId) => [slotId, loadout?.[slotId] || null]));
}

/**
 * 法宝配装领域服务。
 * 负责拥有校验、类别槽位、去重装备、卸下和保存；不依赖 Phaser 或页面对象。
 */
export class ArtifactLoadoutService {
  constructor({ player, catalog, save = () => true }) {
    this.player = player;
    this.catalog = catalog;
    this.save = save;
  }

  getLoadout() {
    return normalizeArtifactLoadout(this.player.equippedArtifacts);
  }

  getEquippedId(slotId) {
    return ARTIFACT_SLOT_IDS.includes(slotId) ? this.getLoadout()[slotId] : null;
  }

  getEquipped(slotId) {
    const itemId = this.getEquippedId(slotId);
    return itemId ? this.catalog.getById(itemId) : null;
  }

  listOwned(category = null) {
    return this.catalog.ownedBy(this.player, (item) => (
      item.type === "法宝" && (!category || item.artifactCategory === category)
    )).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }

  validateEquip(slotId, artifactId) {
    if (!ARTIFACT_SLOT_IDS.includes(slotId)) return { ok: false, message: "未知的法宝槽位。" };
    const artifact = this.listOwned().find((item) => item.id === artifactId);
    if (!artifact) return { ok: false, message: "角色尚未拥有该法宝。" };
    if (artifact.artifactCategory !== slotId) {
      return { ok: false, message: `${artifact.name} 属于${artifact.artifactCategory}类，不能装入${slotId}位。` };
    }
    return { ok: true, artifact };
  }

  equip(slotId, artifactId) {
    const validation = this.validateEquip(slotId, artifactId);
    if (!validation.ok) return validation;
    const loadout = this.getLoadout();
    ARTIFACT_SLOT_IDS.forEach((id) => {
      if (loadout[id] === artifactId) loadout[id] = null;
    });
    loadout[slotId] = artifactId;
    this.player.equippedArtifacts = loadout;
    this.save();
    return validation;
  }

  unequip(slotId) {
    if (!ARTIFACT_SLOT_IDS.includes(slotId)) return { ok: false, message: "未知的法宝槽位。" };
    const loadout = this.getLoadout();
    loadout[slotId] = null;
    this.player.equippedArtifacts = loadout;
    this.save();
    return { ok: true };
  }
}

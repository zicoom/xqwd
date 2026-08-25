import { getItemTemplates } from "../../core/ItemStore.js";

/**
 * 游戏运行时统一使用的物品目录。
 *
 * 目录只负责回答“有哪些物品、角色拥有哪些物品”，不会关心商店库存、
 * Phaser 场景或具体界面。商店、背包、功法页都依赖这里，彼此不再互相调用。
 */
export class ItemCatalog {
  constructor({ loadTemplates = getItemTemplates, resolveTexture = (item) => item.texture } = {}) {
    this.loadTemplates = loadTemplates;
    this.resolveTexture = resolveTexture;
  }

  all() {
    return this.loadTemplates().map((item) => ({ ...item, texture: this.resolveTexture(item) }));
  }

  getById(itemId) {
    return this.all().find((item) => item.id === itemId) || null;
  }

  sellable() {
    return this.all().filter((item) => item.sellable);
  }

  ownedBy(player, predicate = () => true) {
    const inventory = player?.inventory || {};
    return this.all()
      .map((item) => ({ ...item, quantity: Math.max(0, Number(inventory[item.id]) || 0) }))
      .filter((item) => item.quantity > 0 && predicate(item));
  }
}

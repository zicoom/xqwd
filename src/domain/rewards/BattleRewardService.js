import { RewardCatalog, parseRewardText } from "./RewardCatalog.js";
import { grantCultivationExp } from "../cultivation/CultivationProgressService.js";

export { parseRewardText } from "./RewardCatalog.js";

const toQuantity = (value) => {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
};

/**
 * 战斗胜利结算服务。
 * 负责奖励解析、实际入账、怪物击败标记、章节推进与重复结算保护。
 */
export class BattleRewardService {
  constructor({ player, world, chapter, catalog, save = () => true }) {
    this.player = player;
    this.world = world;
    this.chapter = chapter;
    this.catalog = catalog;
    this.rewardCatalog = new RewardCatalog({ itemCatalog: catalog });
    this.save = save;
  }

  settleVictory({ monsterId = null, rewards = [], chapterElite = false } = {}) {
    const defeatedIds = Array.isArray(this.world.defeatedMonsterIds)
      ? this.world.defeatedMonsterIds
      : (this.world.defeatedMonsterIds = []);
    if (monsterId && defeatedIds.includes(monsterId)) {
      return { ok: false, alreadySettled: true, message: "该怪物的奖励已经结算。" };
    }
    if (chapterElite && this.chapter.eliteDefeated) {
      return { ok: false, alreadySettled: true, message: "本章精英奖励已经结算。" };
    }

    const entries = rewards.map(parseRewardText).filter(Boolean);
    const catalogItems = this.catalog?.all?.() || [];
    const itemByName = new Map(catalogItems.map((item) => [item.name, item]));
    const itemById = new Map(catalogItems.map((item) => [item.id, item]));
    const granted = [];
    const unresolved = [];
    let spiritStones = 0;
    let cultivationExp = 0;

    for (const entry of entries) {
      const definition = this.rewardCatalog.resolve(entry.name);
      if (definition?.kind === "currency") {
        spiritStones += entry.quantity;
        granted.push({ kind: "currency", ...entry });
        continue;
      }
      if (definition?.kind === "experience") {
        cultivationExp += entry.quantity;
        granted.push({ kind: "experience", ...entry });
        continue;
      }
      const item = definition?.kind === "item"
        ? itemById.get(definition.itemId)
        : itemByName.get(entry.name) || itemById.get(entry.name);
      if (!item) {
        unresolved.push(entry);
        continue;
      }
      const inventory = this.player.inventory || (this.player.inventory = {});
      inventory[item.id] = toQuantity(inventory[item.id]) + entry.quantity;
      granted.push({ kind: "item", name: item.name, itemId: item.id, quantity: entry.quantity });
    }

    this.player.spiritStones = toQuantity(this.player.spiritStones) + spiritStones;
    const cultivation = grantCultivationExp(this.player, cultivationExp);
    if (monsterId) defeatedIds.push(monsterId);
    if (chapterElite) this.chapter.eliteDefeated = true;
    const saved = this.save() !== false;

    return {
      ok: true,
      saved,
      alreadySettled: false,
      granted,
      unresolved,
      spiritStones,
      cultivationExp: cultivation.gained,
      cultivationOverflow: cultivation.overflow,
      needsBreakthrough: cultivationExp > 0 && cultivation.isFull,
      rewardText: this.formatResult(granted, unresolved, cultivation),
    };
  }

  formatResult(granted, unresolved, cultivation = null) {
    let hasExperience = false;
    const received = granted.flatMap(({ kind, name, quantity }) => {
      if (kind === "experience") {
        hasExperience = true;
        return [];
      }
      return `${name} × ${quantity}`;
    });
    if (hasExperience) {
      received.push(cultivation?.gained > 0 ? `修炼经验 +${cultivation.gained}` : "修为已达当前上限，经验未吸收");
      if (cultivation?.reachedCap) received.push("需要突破后才能继续修炼");
    }
    const missing = unresolved.map(({ name, quantity }) => `${name} × ${quantity}（未登记，未入包）`);
    return [...received, ...missing].join("、") || "无";
  }
}

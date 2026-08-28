const TALK_REWARD_MODE = "talk_reward";
const VALID_REPEAT_POLICIES = new Set(["once", "if_missing", "always"]);

const toQuantity = (value) => {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
};

/**
 * NPC 对话结算服务。
 *
 * 编辑器只负责保存“何时发、发什么”；这里负责校验物品、判断能否重复领取、
 * 发放到真实背包并记录一次性领取状态。服务不依赖 Phaser，可在 Node 中独立验证。
 */
export class NpcInteractionService {
  constructor({ player, world, inventoryService, itemCatalog, save = () => true }) {
    this.player = player;
    this.world = world;
    this.inventoryService = inventoryService;
    this.itemCatalog = itemCatalog;
    this.save = save;
  }

  getDialogueReward(npcTemplate) {
    const quest = npcTemplate?.quest || {};
    if (!quest.enabled || quest.mode !== TALK_REWARD_MODE) return null;
    const rewards = (Array.isArray(quest.rewardItems) ? quest.rewardItems : [])
      .map((entry) => ({ itemId: String(entry?.itemId || "").trim(), quantity: toQuantity(entry?.quantity) }))
      .filter((entry) => entry.itemId && entry.quantity > 0);
    return {
      claimId: String(quest.claimId || `npc-talk-reward:${npcTemplate?.id || "unknown"}`).trim(),
      completionQuestId: String(quest.completionQuestId || "").trim(),
      repeatPolicy: VALID_REPEAT_POLICIES.has(quest.repeatPolicy) ? quest.repeatPolicy : "once",
      rewards,
    };
  }

  hasDialogueReward(npcTemplate) {
    return Boolean(this.getDialogueReward(npcTemplate));
  }

  completeDialogue(npcTemplate) {
    const config = this.getDialogueReward(npcTemplate);
    if (!config) return { ok: false, reason: "inactive", message: "这个 NPC 没有配置对话赠礼。" };
    if (!config.rewards.length) return { ok: false, reason: "empty", message: "尚未选择赠送物品。" };

    const completed = new Set(Array.isArray(this.world?.completedQuestIds) ? this.world.completedQuestIds : []);
    if (config.repeatPolicy === "once" && completed.has(config.claimId)) {
      return { ok: false, reason: "already-claimed", message: "这份赠礼已经领取过了。" };
    }

    // 必须先把全部物品校验完再开始发放，避免配置中途出错后只到账一半。
    const resolved = config.rewards.map((reward) => ({
      ...reward,
      item: this.itemCatalog?.getById?.(reward.itemId) || null,
    }));
    const invalid = resolved.find((reward) => !reward.item);
    if (invalid) return { ok: false, reason: "unknown-item", message: `未找到奖励物品：${invalid.itemId}` };

    const pending = resolved.map((reward) => {
      if (config.repeatPolicy !== "if_missing") return reward;
      const owned = this.inventoryService?.getQuantity?.(reward.itemId) || 0;
      return { ...reward, quantity: Math.max(0, reward.quantity - owned) };
    }).filter((reward) => reward.quantity > 0);
    if (!pending.length) {
      return { ok: false, reason: "already-owned", message: "所配置的赠礼已经持有。" };
    }

    const grants = [];
    for (const reward of pending) {
      const result = this.inventoryService.grant(reward.itemId, reward.quantity);
      if (!result.ok) return { ...result, reason: "grant-failed", grants };
      grants.push({ item: reward.item, itemId: reward.itemId, quantity: result.quantity });
    }

    if (config.repeatPolicy === "once") completed.add(config.claimId);
    if (config.completionQuestId) completed.add(config.completionQuestId);
    this.world.completedQuestIds = Array.from(completed);
    this.save();
    return { ok: true, reason: "granted", grants, completionQuestId: config.completionQuestId };
  }
}

import assert from "node:assert/strict";
import { InventoryService } from "../src/domain/inventory/InventoryService.js";
import { NpcInteractionService } from "../src/domain/quests/NpcInteractionService.js";

const items = new Map([
  ["sect:tianjian-token", { id: "sect:tianjian-token", name: "天剑宗令牌" }],
  ["herb:test", { id: "herb:test", name: "试炼草" }],
]);
const itemCatalog = { getById: (itemId) => items.get(itemId) || null };
const player = { inventory: {} };
const world = { completedQuestIds: [] };
let saveCount = 0;
const inventoryService = new InventoryService({
  player,
  save: () => { saveCount += 1; return true; },
});
const service = new NpcInteractionService({
  player,
  world,
  inventoryService,
  itemCatalog,
  save: () => { saveCount += 1; return true; },
});

const template = (overrides = {}) => ({
  id: "npc-tianjian-guide",
  quest: {
    enabled: true,
    mode: "talk_reward",
    rewardItems: [{ itemId: "sect:tianjian-token", quantity: 1 }],
    repeatPolicy: "if_missing",
    completionQuestId: "quest:tianjian-introduction",
    ...overrides,
  },
});

assert.equal(service.completeDialogue({ id: "plain", quest: { enabled: false } }).reason, "inactive");
assert.equal(service.completeDialogue(template({ rewardItems: [{ itemId: "missing", quantity: 1 }] })).reason, "unknown-item");
assert.deepEqual(player.inventory, {}, "无效配置不得发放一半奖励");

const firstToken = service.completeDialogue(template());
assert.equal(firstToken.ok, true);
assert.equal(firstToken.grants[0].item.name, "天剑宗令牌");
assert.equal(player.inventory["sect:tianjian-token"], 1);
assert.ok(world.completedQuestIds.includes("quest:tianjian-introduction"));
assert.equal(service.completeDialogue(template()).reason, "already-owned", "补发规则不得重复赠送令牌");

const onceNpc = template({
  rewardItems: [{ itemId: "herb:test", quantity: 2 }],
  repeatPolicy: "once",
  claimId: "claim:test-herb",
  completionQuestId: "",
});
assert.equal(service.completeDialogue(onceNpc).ok, true);
assert.equal(player.inventory["herb:test"], 2);
delete player.inventory["herb:test"];
assert.equal(service.completeDialogue(onceNpc).reason, "already-claimed", "一次性赠礼丢弃后也不得重复领取");

const repeatNpc = template({
  rewardItems: [{ itemId: "herb:test", quantity: 1 }],
  repeatPolicy: "always",
  completionQuestId: "",
});
assert.equal(service.completeDialogue(repeatNpc).ok, true);
assert.equal(service.completeDialogue(repeatNpc).ok, true);
assert.equal(player.inventory["herb:test"], 2);
assert.ok(saveCount >= 5, "物品发放与领取状态应立即触发存档");

console.log("NPC 互动冒烟测试通过：物品校验、对话赠礼、令牌补发、一次领取与重复发放正确。");

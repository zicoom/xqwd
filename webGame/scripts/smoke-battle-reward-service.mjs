import assert from "node:assert/strict";
import { BattleRewardService, parseRewardText } from "../src/domain/rewards/BattleRewardService.js";
import { RewardCatalog } from "../src/domain/rewards/RewardCatalog.js";

const items = [
  { id: "wolf-pelt", name: "狼皮" },
  { id: "qi-pill", name: "低阶回灵丹" },
];
const makeState = () => ({
  player: { spiritStones: 5, cultivationExp: 2, inventory: {} },
  world: { defeatedMonsterIds: [] },
  chapter: { eliteDefeated: false },
});
const makeService = (state, save = () => true) => new BattleRewardService({
  ...state,
  catalog: { all: () => items },
  save,
});

assert.deepEqual(parseRewardText("狼皮 × 3"), { name: "狼皮", quantity: 3 });
assert.deepEqual(parseRewardText("灵石*12"), { name: "灵石", quantity: 12 });
assert.deepEqual(parseRewardText("无数量物品"), { name: "无数量物品", quantity: 1 });
assert.equal(parseRewardText(""), null);

const rewardCatalog = new RewardCatalog({ itemCatalog: { all: () => [...items, { id: "duplicate-wolf", name: "狼皮" }] } });
assert.deepEqual(rewardCatalog.all().map(({ name }) => name), ["灵石", "修炼经验", "狼皮", "低阶回灵丹"]);
assert.equal(rewardCatalog.resolve("经验").kind, "experience");
const parsedDrops = rewardCatalog.parseDrops(["狼皮 × 2", "狼皮 × 1", "旧版遗物 × 1"]);
assert.equal(parsedDrops[0].resolved, true);
assert.equal(parsedDrops[0].itemId, "wolf-pelt");
assert.equal(parsedDrops[0].quantity, 3);
assert.equal(parsedDrops[1].resolved, false);
assert.deepEqual(rewardCatalog.serializeDrops(parsedDrops), ["狼皮 × 3", "旧版遗物 × 1"]);

let saveCount = 0;
const state = makeState();
const service = makeService(state, () => { saveCount += 1; return true; });
const result = service.settleVictory({
  monsterId: "monster-wolf-1",
  rewards: ["灵石 × 3", "修炼经验 × 8", "狼皮 × 2", "未知遗物 × 1"],
});
assert.equal(result.ok, true);
assert.equal(state.player.spiritStones, 8);
assert.equal(state.player.cultivationExp, 10);
assert.equal(state.player.inventory["wolf-pelt"], 2);
assert.deepEqual(state.world.defeatedMonsterIds, ["monster-wolf-1"]);
assert.equal(result.unresolved.length, 1);
assert.match(result.rewardText, /未登记，未入包/);
assert.equal(saveCount, 1);

const duplicate = service.settleVictory({ monsterId: "monster-wolf-1", rewards: ["灵石 × 999"] });
assert.equal(duplicate.alreadySettled, true);
assert.equal(state.player.spiritStones, 8);
assert.equal(saveCount, 1);

const eliteState = makeState();
const elite = makeService(eliteState);
assert.equal(elite.settleVictory({ chapterElite: true, rewards: ["低阶回灵丹 × 1"] }).ok, true);
assert.equal(eliteState.chapter.eliteDefeated, true);
assert.equal(eliteState.player.inventory["qi-pill"], 1);
assert.equal(elite.settleVictory({ chapterElite: true, rewards: ["灵石 × 20"] }).alreadySettled, true);

// 旧档可能没有背包、修炼经验或击败列表，服务必须就地补齐后仍可结算。
const legacyState = { player: { spiritStones: "7" }, world: {}, chapter: {} };
const legacy = makeService(legacyState);
assert.equal(legacy.settleVictory({ monsterId: "legacy-monster", rewards: ["狼皮 × 1"] }).ok, true);
assert.equal(legacyState.player.inventory["wolf-pelt"], 1);
assert.equal(legacyState.player.cultivationExp, 0);
assert.deepEqual(legacyState.world.defeatedMonsterIds, ["legacy-monster"]);

console.log("战斗奖励冒烟测试通过：解析、入账、未登记提示、章节推进和防重复结算正确。");

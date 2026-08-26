import assert from "node:assert/strict";
import { AlchemyService } from "../src/domain/alchemy/AlchemyService.js";
import { InventoryService } from "../src/domain/inventory/InventoryService.js";

const items = [
  { id: "juqicao", name: "聚气草" },
  { id: "qinglinghua", name: "清灵花" },
  { id: "pill-low-qi", name: "低阶回灵丹" },
  { id: "book-juqi-danfang", name: "聚气丹方" },
  { id: "qingmaiteng", name: "青脉藤" },
  { id: "baixiangye", name: "炼气丹" },
];
const itemCatalog = { getById: (id) => items.find((item) => item.id === id) || null };

const player = { inventory: { juqicao: 10, qinglinghua: 5 }, knownRecipes: [] };
const world = { sectProgress: {} };
let saves = 0;
const inventoryService = new InventoryService({ player, save: () => { saves += 1; return true; } });
const randomValues = [0.1, 0.99];
const service = new AlchemyService({
  player, world, inventoryService, itemCatalog,
  save: () => { saves += 1; return true; },
  random: () => randomValues.shift() ?? 0.99,
});

assert.equal(service.refine("recipe-low-qi").ok, false, "旧式直接炼制入口必须被禁止");
assert.equal(service.beginRefinement("recipe-low-qi").ok, false, "未安置丹炉时不能开炉");
assert.equal(service.selectFurnace("furnace-iron").ok, true, "应可安置有效丹炉");
assert.equal(world.sectProgress["sect:tianjian"].alchemy.furnaceId, "furnace-iron");
assert.equal(service.beginRefinement("recipe-low-qi").ok, false, "未学习丹方时不能开炉");
assert.equal(service.learnRecipe("recipe-low-qi").ok, true, "宗门入门丹方可以直接学习");

const started = service.beginRefinement("recipe-low-qi");
assert.equal(started.ok, true, "材料足够时应进入控火阶段");
assert.equal(player.inventory.juqicao, 8, "开炉时应立即扣除主药");
assert.equal(player.inventory.qinglinghua, 4, "开炉时应立即扣除辅药");
assert.equal(player.inventory["pill-low-qi"], undefined, "未完成小游戏前绝不能直接产出丹药");
assert.equal(service.beginRefinement("recipe-low-qi").ok, false, "同一时间只能炼制一炉");
assert.equal(service.completeRefinement(null).ok, false, "无效控火结果不能结算");

const success = service.completeRefinement({
  ok: true, score: 90, grade: "天成", successBonus: 18, yieldBonus: 35, forcedFailure: false,
});
assert.equal(success.ok, true, "高分控火且判定成功时应炼成丹药");
assert.equal(success.quantity, 1);
assert.equal(player.inventory["pill-low-qi"], 1, "成丹应真实进入背包");
assert.equal(world.sectProgress["sect:tianjian"].alchemy.refinementCount, 1);
assert.equal(world.sectProgress["sect:tianjian"].alchemy.successCount, 1);
assert.equal(world.sectProgress["sect:tianjian"].alchemy.bestControlScore, 90);
assert.equal(service.completeRefinement({ ok: true }).ok, false, "同一炉不能重复结算");

const failedStart = service.beginRefinement("recipe-low-qi");
assert.equal(failedStart.ok, true);
const failed = service.completeRefinement({
  ok: true, score: 18, grade: "炸炉", successBonus: -100, yieldBonus: 0, forcedFailure: true,
});
assert.equal(failed.ok, false, "操作成绩过低应强制失败，不再只看基础概率");
assert.equal(world.sectProgress["sect:tianjian"].alchemy.lastControlGrade, "炸炉");

const abortedStart = service.beginRefinement("recipe-low-qi");
assert.equal(abortedStart.ok, true);
assert.equal(service.abortRefinement().ok, true, "玩家可放弃本炉，但材料不返还");
assert.equal(world.sectProgress["sect:tianjian"].alchemy.lastControlGrade, "放弃");

const practiceIngredients = { juqicao: player.inventory.juqicao, qinglinghua: player.inventory.qinglinghua };
assert.equal(service.beginPractice("recipe-low-qi").ok, true, "已学丹方可以进入无消耗控火演练");
assert.equal(service.completeRefinement({ ok: true }).ok, false, "演练不能伪装成真实炼制结算");
const practice = service.completePractice({
  ok: true, score: 76, grade: "上品", successBonus: 10, yieldBonus: 15, forcedFailure: false,
});
assert.equal(practice.ok, true);
assert.equal(practice.practice, true);
assert.equal(player.inventory.juqicao, practiceIngredients.juqicao, "演练不能消耗主药");
assert.equal(player.inventory.qinglinghua, practiceIngredients.qinglinghua, "演练不能消耗辅药");

const noBook = service.learnRecipe("recipe-lianqi");
assert.equal(noBook.ok, false, "缺少丹方书时不能学习进阶丹方");
player.inventory["book-juqi-danfang"] = 1;
assert.equal(service.learnRecipe("recipe-lianqi").ok, true, "持有丹方书时可以学习");
const missingIngredient = service.beginRefinement("recipe-lianqi");
assert.equal(missingIngredient.ok, false, "药材不足时不能开始控火");
assert.equal(missingIngredient.consumed, undefined, "校验失败不能消耗药材");
assert.ok(saves >= 6, "开炉、评分、成丹和放弃结果都必须保存");

console.log("smoke-alchemy-service: ok");

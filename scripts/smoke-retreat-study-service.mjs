import assert from "node:assert/strict";
import { InventoryService } from "../src/domain/inventory/InventoryService.js";
import { RetreatStudyService } from "../src/domain/cultivation/RetreatStudyService.js";

const items = [
  { id: "book-qingxin-jue", name: "清心诀残卷" },
  { id: "technique-qingxin-jue", name: "清心诀", type: "功法" },
  { id: "book-huoqiu-shu", name: "火球术要略" },
  { id: "technique-huoqiu", name: "火球术", type: "功法", techniqueKind: "法术" },
];
const itemCatalog = { getById: (id) => items.find((item) => item.id === id) || null };
const createContext = () => {
  const player = {
    inventory: { "book-qingxin-jue": 1, "book-huoqiu-shu": 1 },
    learnedTechniques: [], studiedBooks: [], cultivationExp: 0,
  };
  const world = { sectProgress: {} };
  let saves = 0;
  const inventoryService = new InventoryService({ player, save: () => { saves += 1; return true; } });
  const service = new RetreatStudyService({
    player, world, inventoryService, itemCatalog,
    save: () => { saves += 1; return true; },
  });
  return { player, world, service, getSaves: () => saves };
};

const { player, world, service, getSaves } = createContext();

assert.equal(service.listStudies("spell").length, 1, "法术与功法应按类型筛选");
assert.equal(service.beginStudy("study-huoqiu", 1).ok, false, "未配置的闭关时长不能领悟");
assert.equal(service.study("study-huoqiu", 12).ok, false, "旧入口不能绕过心境小游戏");
const started = service.beginStudy("study-huoqiu", 12);
assert.equal(started.ok, true);
assert.equal(player.learnedTechniques.length, 0, "开始闭关时不能提前学会法术");
assert.equal(service.beginStudy("study-qingxin-jue", 12).ok, false, "同一时间只能进行一次闭关");
const result = service.completeStudy({ ok: true, score: 82, grade: "入定", expMultiplier: 1.15, forcedFailure: false });
assert.equal(result.ok, true, "完成心境小游戏后应领悟法术");
assert.equal(result.gainedExp, 207, "心境等级应修正闭关修为");
assert.deepEqual(player.learnedTechniques, ["technique-huoqiu"]);
assert.deepEqual(player.studiedBooks, ["book-huoqiu-shu"]);
assert.equal(player.inventory["technique-huoqiu"], 1, "学习结果要进入现有功法物品系统");
assert.equal(player.cultivationExp, 207);
assert.equal(world.sectProgress["sect:tianjian"].retreat.totalMonths, 12);
assert.equal(service.beginStudy("study-huoqiu", 12).alreadyLearned, true, "同一法术不能重复学习");
assert.equal(service.completeStudy({ ok: true }).ok, false, "同一结果不能重复结算");

delete player.inventory["book-qingxin-jue"];
assert.equal(service.beginStudy("study-qingxin-jue", 12).ok, false, "缺少秘籍时不能闭关领悟");
assert.ok(getSaves() >= 1, "闭关结果必须保存");

const failedContext = createContext();
assert.equal(failedContext.service.beginStudy("study-qingxin-jue", 12).ok, true);
const failure = failedContext.service.completeStudy({ ok: true, score: 42, grade: "心乱", expMultiplier: 0.35, forcedFailure: true });
assert.equal(failure.ok, false, "心境失败不能领悟秘籍");
assert.equal(failure.gainedExp, 42, "失败只保留少量静修所得");
assert.deepEqual(failedContext.player.learnedTechniques, []);
assert.equal(failedContext.world.sectProgress["sect:tianjian"].retreat.totalMonths, 12, "失败仍应消耗已闭关月份");

const practiceContext = createContext();
delete practiceContext.player.inventory["book-qingxin-jue"];
assert.equal(practiceContext.service.beginPractice("study-qingxin-jue", 12).ok, true, "演练不要求持有秘籍");
const practice = practiceContext.service.completePractice({ ok: true, score: 90, grade: "澄明", forcedFailure: false });
assert.equal(practice.practice, true);
assert.equal(practiceContext.player.cultivationExp, 0, "演练不能获得修为");
assert.deepEqual(practiceContext.world.sectProgress, {}, "演练不能写入闭关进度");

assert.equal(practiceContext.service.beginPractice("study-qingxin-jue", 12).ok, true);
assert.equal(practiceContext.service.abortStudy().consumedTime, false, "放弃演练不能消耗时间");

const timedContext = createContext();
const timedStart = timedContext.service.beginTimedStudy("study-huoqiu", 12, 0);
assert.equal(timedStart.ok, true, "Pixso 学习流程应能开始定时参悟");
assert.equal(timedStart.learningDurationMs, 5000);
assert.equal(timedContext.service.completeTimedStudy().ok, false, "进度未满不能提前获得法术");
timedContext.service.advanceTimedStudy(1000);
timedContext.service.advanceTimedStudy(2000);
const timedHalfway = timedContext.service.advanceTimedStudy(2500);
assert.equal(timedHalfway.progress, 0.5, "学习进度应按实际经过时间推进");
timedContext.service.advanceTimedStudy(3500);
timedContext.service.advanceTimedStudy(4500);
const timedDone = timedContext.service.advanceTimedStudy(5500);
assert.equal(timedDone.completed, true);
const timedResult = timedContext.service.completeTimedStudy();
assert.equal(timedResult.ok, true);
assert.deepEqual(timedContext.player.learnedTechniques, ["technique-huoqiu"]);
assert.equal(timedContext.service.completeTimedStudy().ok, false, "定时学习结果不能重复结算");

console.log("smoke-retreat-study-service: ok");

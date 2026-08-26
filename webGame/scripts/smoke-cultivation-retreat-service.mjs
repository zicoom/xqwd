import assert from "node:assert/strict";
import { CultivationRetreatService } from "../src/domain/cultivation/CultivationRetreatService.js";

function createContext() {
  const player = { cultivationExp: 100 };
  const world = { sectProgress: {} };
  let saves = 0;
  const service = new CultivationRetreatService({
    player,
    world,
    save: () => { saves += 1; return true; },
  });
  return { player, world, service, saves: () => saves };
}

function advanceSeconds(service, start, seconds) {
  let result = null;
  for (let second = 1; second <= seconds; second += 1) result = service.advanceMeditation(start + second * 1000);
  return result;
}

const context = createContext();
assert.equal(context.service.beginMeditation(2, 0).ok, false, "未配置时长不能开始闭关");
const started = context.service.beginMeditation(12, 0);
assert.equal(started.ok, true);
assert.equal(started.totalExp, 3600);
assert.equal(context.player.cultivationExp, 100, "开始时不能瞬间获得修为");
assert.equal(context.service.beginMeditation(12, 0).ok, false, "不能同时开始两次清修");

const halfway = advanceSeconds(context.service, 0, 6);
assert.equal(halfway.progress, 0.5);
assert.equal(halfway.gainedExp, 1800, "修为应随闭关进度逐步增加");
assert.equal(context.player.cultivationExp, 1900);
const aborted = context.service.abortMeditation();
assert.equal(aborted.aborted, true);
assert.equal(aborted.gainedExp, 1800, "提前出关应保留已经吐纳所得修为");
assert.equal(context.world.sectProgress["sect:tianjian"].retreat.totalMonths, 0, "未完成整段闭关不累计完整月份");

assert.equal(context.service.beginMeditation(12, 10000).ok, true);
const completed = advanceSeconds(context.service, 10000, 12);
assert.equal(completed.completed, true);
assert.equal(completed.gainedExp, 3600);
assert.equal(context.player.cultivationExp, 5500);
assert.equal(context.world.sectProgress["sect:tianjian"].retreat.totalMonths, 12);
assert.equal(context.world.sectProgress["sect:tianjian"].retreat.meditationSessions, 1);
assert.equal(context.world.sectProgress["sect:tianjian"].retreat.meditationCultivation, 3600);
assert.equal(context.service.advanceMeditation(23000).ok, false, "完成后不能重复结算");
assert.ok(context.saves() >= 2, "逐步获得与出关结果必须写入存档");

console.log("普通清修冒烟测试通过：逐步增长、时长校验、提前出关、完整结算和防重复正确。");

import assert from "node:assert/strict";
import {
  CultivationBreakthroughService,
  getBreakthroughInfo,
} from "../src/domain/cultivation/CultivationBreakthroughService.js";
import { BreakthroughTrialService } from "../src/domain/cultivation/BreakthroughTrialService.js";
import { BREAKTHROUGH_TRIALS } from "../src/domain/cultivation/BreakthroughTrialCatalog.js";

assert.equal(new Set(BREAKTHROUGH_TRIALS.map((entry) => entry.type)).size, BREAKTHROUGH_TRIALS.length,
  "每个大境界必须使用不同的突破小游戏类型");

const player = { realm: "炼气初期", cultivationExp: 999, cultivationExpTarget: 1000 };
let saved = 0;
const service = new CultivationBreakthroughService({
  player,
  save: () => { saved += 1; return true; },
});

assert.equal(getBreakthroughInfo(player).canBreakthrough, false, "未圆满时不能突破");
assert.equal(service.resolveTrial({ finished: true, trialId: "spirit-orbit", success: true }).ok, false, "未圆满时不能修改角色境界");
assert.equal(player.realm, "炼气初期");

player.cultivationExp = 1000;
assert.equal(service.resolveTrial({ finished: true, trialId: "spirit-orbit", success: true }).ok, false, "没有完成小游戏不能直接突破");
const rules = new BreakthroughTrialService();
const trial = rules.createTrial(player, { random: () => 0.5 });
assert.equal(trial.ok, true);
while (!trial.finished) rules.recordHit(trial, 0.5);
const result = service.resolveTrial(rules.advanceTrial(trial, 0));
assert.equal(result.ok, true, "圆满后应能突破");
assert.equal(player.realm, "炼气中期");
assert.equal(player.cultivationExp, 0, "突破后从下一阶段的 0 修为开始");
assert.equal(player.cultivationExpTarget, 1000);
assert.equal(saved, 1, "突破必须立即写入角色档案");

const legacyPlayer = { realm: "炼气·初期", cultivationExp: 1000, cultivationExpTarget: 1000 };
const legacyRules = new BreakthroughTrialService();
const legacyTrial = legacyRules.createTrial(legacyPlayer, { random: () => 0.5 });
while (!legacyTrial.finished) legacyRules.recordHit(legacyTrial, 0.5);
const legacyResult = new CultivationBreakthroughService({ player: legacyPlayer }).resolveTrial(legacyRules.advanceTrial(legacyTrial, 0));
assert.equal(legacyResult.ok, true, "旧档带分隔点的炼气境界也必须能突破");
assert.equal(legacyPlayer.realm, "炼气中期");

const failedPlayer = { realm: "炼气初期", cultivationExp: 1000, cultivationExpTarget: 1000 };
const failedRules = new BreakthroughTrialService();
const failedTrial = failedRules.createTrial(failedPlayer, { random: () => 0.5 });
while (!failedTrial.finished) failedRules.advanceTrial(failedTrial, 500);
const failedResult = new CultivationBreakthroughService({ player: failedPlayer }).resolveTrial(failedRules.advanceTrial(failedTrial, 0));
assert.equal(failedResult.success, false, "小游戏失败必须带来失败结果");
assert.equal(failedPlayer.cultivationExp, 900, "炼气突破失败应跌落 10% 修为");

console.log("修为突破冒烟测试通过：满值校验、境界推进、经验重置与旧境界兼容正确。");

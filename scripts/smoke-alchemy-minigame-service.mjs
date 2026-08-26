import assert from "node:assert/strict";
import { AlchemyMinigameService } from "../src/domain/alchemy/AlchemyMinigameService.js";

const rules = new AlchemyMinigameService();
const session = rules.createSession({ difficulty: 0 });
assert.equal(rules.getStage(session).id, "warm");
rules.tick(session, { deltaMs: 250, heating: true });
assert.ok(session.temperature > 20, "催火必须提高炉温");
const heated = session.temperature;
rules.tick(session, { deltaMs: 250, heating: false });
assert.ok(session.temperature < heated, "松开催火后炉温必须下降");
assert.equal(rules.finish(session, { manual: true }).ok, false, "未进入凝丹阶段不能提前结算");

// 用简单反馈控制模拟玩家：低于温区中心时催火，高于中心时松开。
while (session.stageIndex < 2 || session.stageElapsedMs < 3500) {
  const stage = rules.getStage(session);
  const center = (stage.targetMin + stage.targetMax) / 2;
  rules.tick(session, { deltaMs: 50, heating: session.temperature < center });
}
assert.equal(rules.canCondense(session), true, "凝丹阶段稳定三秒后应允许主动收诀");
const controlled = rules.finish(session, { manual: true });
assert.equal(controlled.ok, true);
assert.equal(controlled.forcedFailure, false, "持续控温并主动收诀不应被强制失败");
assert.ok(controlled.score >= 52, `反馈控温成绩应达到稳定档，实际 ${controlled.score}`);
assert.equal(controlled.stageRatios.length, 3);

const timeoutSession = rules.createSession({ difficulty: 1 });
while (!timeoutSession.expired) rules.tick(timeoutSession, { deltaMs: 250, heating: false });
const timeout = rules.finish(timeoutSession, { manual: false });
assert.equal(timeout.forcedFailure, true, "凝丹阶段超时未收诀必须失败");
assert.equal(timeout.grade, "炸炉");

const hardSession = rules.createSession({ difficulty: 1 });
const normalWidth = session.stages[2].targetMax - session.stages[2].targetMin;
const hardWidth = hardSession.stages[2].targetMax - hardSession.stages[2].targetMin;
assert.ok(hardWidth < normalWidth, "高阶丹方的安全温区应更窄");

console.log("smoke-alchemy-minigame-service: ok");

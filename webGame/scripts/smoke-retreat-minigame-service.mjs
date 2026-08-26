import assert from "node:assert/strict";
import { RetreatMinigameService } from "../src/domain/cultivation/RetreatMinigameService.js";

const rules = new RetreatMinigameService();
const advance = (session, durationMs) => {
  let remaining = durationMs;
  while (remaining > 0) {
    const deltaMs = Math.min(1000, remaining);
    rules.tick(session, { deltaMs });
    remaining -= deltaMs;
  }
};
const session = rules.createSession({ months: 12 });
assert.equal(session.memory.sequence.length, 6, "闭关一年应使用最长铭法符序");
assert.equal(rules.getStage(session).id, "breath");

rules.tick(session, { deltaMs: 600 });
assert.ok(rules.tapBreath(session).quality >= 99, "呼吸环与心环重合时应获得高契合");
advance(session, 2400);
rules.tapBreath(session);
advance(session, 2400);
assert.equal(rules.tapBreath(session).stageChanged, true, "三次吐纳后应进入守心");
assert.equal(rules.getStage(session).id, "focus");

[1, 2, 0, 1].forEach((answer) => rules.chooseFocus(session, answer));
assert.equal(rules.getStage(session).id, "inscribe", "完成四道心念后应进入铭法");
assert.equal(rules.chooseMemoryRune(session, 0).ok, false, "符文展示阶段不能提前输入");
advance(session, rules.getMemoryShowDuration(session));
session.memory.sequence.forEach((answer) => rules.chooseMemoryRune(session, answer));
const perfect = rules.finish(session, { manual: true });
assert.equal(perfect.score, 100);
assert.equal(perfect.grade, "澄明");
assert.equal(perfect.forcedFailure, false);

const failedSession = rules.createSession({ months: 1 });
rules.tapBreath(failedSession);
advance(failedSession, 1200);
rules.tapBreath(failedSession);
advance(failedSession, 1200);
rules.tapBreath(failedSession);
[0, 0, 1, 0].forEach((answer) => rules.chooseFocus(failedSession, answer));
advance(failedSession, rules.getMemoryShowDuration(failedSession));
failedSession.memory.sequence.forEach((answer) => rules.chooseMemoryRune(failedSession, (answer + 1) % 4));
const failed = rules.finish(failedSession, { manual: true });
assert.equal(failed.forcedFailure, true, "低于 55 分不能领悟秘籍");

const timeoutSession = rules.createSession({ months: 1 });
for (let index = 0; index < 48; index += 1) rules.tick(timeoutSession, { deltaMs: 1000 });
const timeout = rules.finish(timeoutSession, { manual: false });
assert.equal(timeout.forcedFailure, true, "铭法超时必须失败");

console.log("smoke-retreat-minigame-service: ok");

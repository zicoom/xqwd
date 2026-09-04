import assert from "node:assert/strict";
import { DungeonMonsterAiService } from "../src/domain/world/DungeonMonsterAiService.js";

globalThis.Phaser = { Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)) } };
const { normalizeMonster } = await import("../src/core/MonsterStore.js");

const service = new DungeonMonsterAiService();
const origin = { x: 500, y: 500 };
const state = service.createState({
  spawnId: "wolf-a",
  origin,
  config: { patrolRadius: 100, detectionRadius: 200, disengageRadius: 320, leashRadius: 280, patrolSpeed: 40, chaseSpeed: 100, contactRadius: 60 },
});

const patrolStarted = service.update({ state: { ...state, waitMs: 0 }, position: origin, playerPosition: { x: 900, y: 900 }, deltaMs: 100 });
assert.equal(patrolStarted.state.mode, "patrol");
const patrolMoved = service.update({ state: patrolStarted.state, position: patrolStarted.position, playerPosition: { x: 900, y: 900 }, deltaMs: 250 });
assert.notDeepEqual(patrolMoved.position, origin, "未发现玩家时应在出生点附近巡逻");

const chasing = service.update({ state, position: origin, playerPosition: { x: 650, y: 500 }, deltaMs: 250 });
assert.equal(chasing.state.mode, "chase");
assert.equal(chasing.position.x, 525);
assert.equal(chasing.engage, false);

const contact = service.update({ state: chasing.state, position: { x: 600, y: 500 }, playerPosition: { x: 650, y: 500 }, deltaMs: 16 });
assert.equal(contact.engage, true, "进入接触距离后应请求场景开始战斗");

const returning = service.update({ state: chasing.state, position: { x: 790, y: 500 }, playerPosition: { x: 800, y: 500 }, deltaMs: 250 });
assert.equal(returning.state.mode, "return", "越过出生点牵引范围后必须脱离追击");
assert.ok(returning.position.x < 790, "脱战后应向出生点返回");

assert.deepEqual(
  service.createState({ spawnId: "wolf-a", origin }),
  service.createState({ spawnId: "wolf-a", origin }),
  "相同出生点必须生成确定性巡逻状态",
);
assert.equal(service.update({}).reason, "missing-state");

const normalizedMonster = normalizeMonster({
  id: "wolf-template",
  ai: { patrolRadius: 120, detectionRadius: 260, chaseSpeed: 95, contactRadius: 68 },
});
assert.equal(normalizedMonster.ai.patrolRadius, 120);
assert.equal(normalizedMonster.ai.detectionRadius, 260);
assert.equal(normalizedMonster.ai.chaseSpeed, 95);
assert.equal(normalizedMonster.ai.contactRadius, 68);

console.log("洞穴妖兽 AI 冒烟测试通过：巡逻、追击、接触开战、脱战返回和确定性状态正确。");

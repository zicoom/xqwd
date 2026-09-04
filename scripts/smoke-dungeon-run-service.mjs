import assert from "node:assert/strict";
import { DungeonRunService } from "../src/domain/world/DungeonRunService.js";
import { getWorldSceneDestination } from "../src/core/WorldSceneCatalog.js";
import { SceneKeys } from "../src/core/SceneKeys.js";

const world = {};
let saves = 0;
const service = new DungeonRunService({ world, save: () => { saves += 1; return true; } });

const first = service.beginRun("monster-cave-1", { x: 10.4, y: 20.7 });
assert.equal(first.ok, true);
assert.equal(first.run.runNumber, 1);
assert.deepEqual(first.run.playerPosition, { x: 10, y: 21 });
assert.equal(saves, 1);

service.recordPosition("monster-cave-1", { x: 30, y: 40 });
assert.equal(saves, 1, "普通移动只更新内存，不应逐帧写入浏览器");
assert.deepEqual(service.resumeRun("monster-cave-1").run.playerPosition, { x: 30, y: 40 });

assert.equal(service.markDefeated("monster-cave-1", "wolf-a", 999).reason, "stale-run");
assert.equal(service.markDefeated("monster-cave-1", "wolf-a", 1).alreadyDefeated, false);
assert.equal(service.markDefeated("monster-cave-1", "wolf-a", 1).alreadyDefeated, true);
assert.equal(DungeonRunService.settlementId("monster-cave-1", 1, "wolf-a"), "dungeon:monster-cave-1:run-1:wolf-a");
assert.deepEqual(service.getClearState("monster-cave-1", 1, ["wolf-a", "wolf-b"]), {
  ok: true, cleared: false, defeated: 1, remaining: 1, total: 2,
});
service.markDefeated("monster-cave-1", "wolf-b", 1);
assert.equal(service.getClearState("monster-cave-1", 1, ["wolf-a", "wolf-b", "wolf-b"]).cleared, true);
assert.equal(DungeonRunService.clearSettlementId("monster-cave-1", 1), "dungeon:monster-cave-1:run-1:clear");

service.leaveRun("monster-cave-1", { x: 50, y: 60 });
assert.equal(service.getRun("monster-cave-1").active, false);
const second = service.beginRun("monster-cave-1");
assert.equal(second.run.runNumber, 2);
assert.deepEqual(second.run.defeatedSpawnIds, [], "重新进入必须开始新轮次并刷新怪物");
assert.equal(getWorldSceneDestination("monster-cave-1").sceneKey, SceneKeys.MONSTER_CAVE);
assert.equal(getWorldSceneDestination("../../bad"), null);

console.log("洞穴轮次冒烟测试通过：进入、恢复、击败、清场、退出、刷新和目标白名单正确。");

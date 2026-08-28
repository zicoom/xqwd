import assert from "node:assert/strict";
import { MapExplorationService } from "../src/domain/world/MapExplorationService.js";

const world = { miniMapVisitedPoints: [] };
const service = new MapExplorationService({ world });

const first = service.recordPosition(100.4, 200.6);
assert.deepEqual(first, {
  recorded: true,
  reason: "recorded",
  point: { x: 100, y: 201 },
  trimmedCount: 0,
  total: 1,
}, "首次进入地图必须记录四舍五入后的世界坐标");
assert.deepEqual(world.miniMapVisitedPoints, [{ x: 100, y: 201 }]);

const tooClose = service.recordPosition(219, 201);
assert.equal(tooClose.recorded, false, "移动不足 120 世界像素时不应产生重复足迹");
assert.equal(tooClose.reason, "too-close");
assert.equal(world.miniMapVisitedPoints.length, 1);

const threshold = service.recordPosition(220, 201);
assert.equal(threshold.recorded, true, "移动达到 120 世界像素时必须记录新足迹");
assert.deepEqual(threshold.point, { x: 220, y: 201 });

const invalid = service.recordPosition(Number.NaN, 300);
assert.equal(invalid.recorded, false, "非法坐标不能污染探索存档");
assert.equal(invalid.reason, "invalid-position");
assert.equal(world.miniMapVisitedPoints.length, 2);

const snapshot = service.getVisitedPoints();
snapshot[0].x = 9999;
snapshot.push({ x: 1, y: 1 });
assert.deepEqual(world.miniMapVisitedPoints, [{ x: 100, y: 201 }, { x: 220, y: 201 }],
  "UI 查询足迹时只能取得快照，不能绕过服务修改存档");

const legacyWorld = {
  miniMapVisitedPoints: [
    { x: "10.4", y: "20.6" },
    null,
    { x: 30, y: Number.POSITIVE_INFINITY },
    { x: 40, y: 50 },
    { x: 60, y: 70 },
  ],
};
let saveCount = 0;
const legacyService = new MapExplorationService({
  world: legacyWorld,
  maxPoints: 2,
  save: () => { saveCount += 1; return true; },
});
const repaired = legacyService.reconcileLegacyState();
assert.equal(repaired.changed, true, "旧档中的无效坐标和超量足迹必须显式修复");
assert.equal(repaired.removedCount, 3);
assert.deepEqual(legacyWorld.miniMapVisitedPoints, [{ x: 40, y: 50 }, { x: 60, y: 70 }],
  "修复后只保留最新的有效足迹");
assert.equal(saveCount, 1, "旧档发生实际修复时只保存一次");
assert.equal(legacyService.reconcileLegacyState().changed, false, "重复修复必须幂等");
assert.equal(saveCount, 1, "状态未变化时不能重复保存");

const cappedWorld = { miniMapVisitedPoints: [] };
const cappedService = new MapExplorationService({ world: cappedWorld, sampleDistance: 1, maxPoints: 3 });
cappedService.recordPosition(0, 0);
cappedService.recordPosition(1, 0);
cappedService.recordPosition(2, 0);
const capped = cappedService.recordPosition(3, 0);
assert.equal(capped.trimmedCount, 1, "超过容量时必须报告被移除的旧足迹数量");
assert.deepEqual(cappedWorld.miniMapVisitedPoints, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  "探索足迹必须限制容量并优先保留最新记录");

console.log("小地图探索领域冒烟测试通过：距离采样、旧档修复、容量限制和只读查询正确。");

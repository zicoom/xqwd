import assert from "node:assert/strict";
import {
  getBuildingCollisionVertices,
  getDistanceToBuildingCollision,
  isMovementBlockedByBuildings,
  movementCrossesBuilding,
} from "../src/domain/world/BuildingCollisionService.js";

const building = {
  id: "test-building",
  type: "building",
  x: 100,
  y: 100,
  scale: 2,
  buildingTemplate: {
    display: { width: 100, height: 100, anchor: "bottom" },
    collision: {
      enabled: true,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    },
  },
};

assert.deepEqual(getBuildingCollisionVertices(building), [
  { x: 0, y: -100 }, { x: 200, y: -100 }, { x: 200, y: 100 }, { x: 0, y: 100 },
], "实例缩放应同步作用于建筑碰撞顶点");
assert.equal(movementCrossesBuilding({ x: 100, y: 120 }, { x: 100, y: 90 }, building), true, "从下往上进入必须阻挡");
assert.equal(movementCrossesBuilding({ x: 100, y: -120 }, { x: 100, y: -90 }, building), true, "从上往下进入必须阻挡");
assert.equal(movementCrossesBuilding({ x: 100, y: 150 }, { x: 100, y: -150 }, building), true, "一步跨过完整建筑也必须阻挡");
assert.equal(movementCrossesBuilding({ x: 240, y: 120 }, { x: 240, y: -120 }, building), false, "建筑外侧移动不应被误挡");
assert.equal(movementCrossesBuilding({ x: 100, y: 0 }, { x: 100, y: 130 }, building), false, "旧存档已在建筑内时必须允许向外脱困");
assert.equal(isMovementBlockedByBuildings({ x: 100, y: 120 }, { x: 100, y: 90 }, [building]), true, "建筑集合检测应返回阻挡");
assert.equal(getDistanceToBuildingCollision({ x: 100, y: 140 }, building), 40, "建筑下方距离应按碰撞边缘计算");
assert.equal(getDistanceToBuildingCollision({ x: -30, y: 0 }, building), 30, "建筑侧面距离应按最近边计算");
assert.equal(getDistanceToBuildingCollision({ x: 100, y: 0 }, building), 0, "建筑轮廓内部距离应为零");

console.log("建筑双向碰撞冒烟测试通过");

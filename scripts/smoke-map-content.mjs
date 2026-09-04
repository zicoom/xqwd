import assert from "node:assert/strict";
import { normalizeMapObject, normalizeMapRegion } from "../src/core/MapContentStore.js";

const baseObject = { id: "building-test", type: "building", name: "测试建筑", x: 100, y: 200 };

assert.equal(normalizeMapObject(baseObject).scale, 1, "旧地图对象应自动补为 100%");
assert.equal(normalizeMapObject({ ...baseObject, scale: 1.75 }).scale, 1.75, "实例缩放应保留");
assert.equal(normalizeMapObject({ ...baseObject, scale: 9 }).scale, 4, "实例缩放最大应限制为 400%");
assert.equal(normalizeMapObject({ ...baseObject, scale: 0.1 }).scale, 0.25, "实例缩放最小应限制为 25%");
assert.equal(normalizeMapObject({ ...baseObject, scale: "无效" }).scale, 1, "无效缩放应回退为 100%");
assert.equal(normalizeMapObject({ ...baseObject, scale: null }).scale, 1, "空缩放应回退为 100%");

const region = normalizeMapRegion({
  id: "walkable-test",
  type: "walkable",
  name: "测试道路",
  points: [{ x: 1.2, y: 2.8 }, { x: 50, y: 2 }, { x: 50, y: 40 }, { x: "错误", y: 10 }],
});
assert.equal(region.type, "walkable");
assert.deepEqual(region.points, [{ x: 1, y: 3 }, { x: 50, y: 2 }, { x: 50, y: 40 }]);
assert.equal(normalizeMapRegion({ type: "unknown", points: [] }).type, "blocked", "非法区域类型应安全回退为阻挡区");

console.log("地图对象与区域冒烟测试通过：对象缩放、区域类型和世界坐标规范正确。");

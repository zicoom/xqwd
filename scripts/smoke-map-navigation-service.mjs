import assert from "node:assert/strict";
import { MapNavigationService, isPointInMapRegion } from "../src/domain/world/MapNavigationService.js";

const walkable = {
  id: "walkable-main",
  type: "walkable",
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
};
const blocked = {
  id: "blocked-pool",
  type: "blocked",
  points: [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }],
};

assert.equal(isPointInMapRegion({ x: 10, y: 10 }, walkable), true);
assert.equal(isPointInMapRegion({ x: 0, y: 50 }, walkable), true, "区域边线应属于该区域");
assert.equal(isPointInMapRegion({ x: 120, y: 50 }, walkable), false);

const service = new MapNavigationService({
  regions: [walkable, blocked],
  bounds: { left: 0, right: 100, top: 0, bottom: 100 },
});
assert.equal(service.isWalkable({ x: 20, y: 20 }), true);
assert.equal(service.isWalkable({ x: 110, y: 20 }), false, "可行走区之外不可通行");
assert.equal(service.isWalkable({ x: 50, y: 50 }), false, "阻挡区优先于可行走区");
assert.equal(service.canTraverse({ x: 20, y: 50 }, { x: 80, y: 50 }), false, "不能一步跨过阻挡区");

const slide = service.resolveMovement({ x: 35, y: 50 }, { x: 45, y: 55 });
assert.equal(slide.moved, true);
assert.equal(slide.blocked, true);
assert.deepEqual(slide.position, { x: 35, y: 55 }, "斜向撞墙时应沿未受阻方向滑动");

const recovered = service.findNearestWalkable({ x: 50, y: 50 });
assert.equal(service.isWalkable(recovered), true, "旧存档落入新阻挡区时应移到附近合法位置");

const blockersOnly = new MapNavigationService({ regions: [blocked] });
assert.equal(blockersOnly.isWalkable({ x: 20, y: 20 }), true, "没有可行走区时默认地图其余部分可走");
assert.equal(blockersOnly.isWalkable({ x: 50, y: 50 }), false);

console.log("地图区域通行冒烟测试通过：可行走区、阻挡优先、跨越拦截、贴墙滑动和旧位置恢复正确。");

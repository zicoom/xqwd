import assert from "node:assert/strict";
import { normalizeBuilding } from "../src/core/WorldTemplateStore.js";

// 旧版只有 blocked 与 interactionText，升级后必须得到可直接手绘的默认矩形。
const legacy = normalizeBuilding({ id: "old-house", name: "旧民居", blocked: true, interactionText: "屋内有人。" });
assert.equal(legacy.collision.enabled, true);
assert.equal(legacy.collision.points.length, 4);
assert.equal(legacy.interaction.kind, "dialogue");
assert.equal(legacy.interaction.prompt, "屋内有人。");

// 新版多边形要限制在图片相对坐标 0～1 内，防止错误输入导致地图碰撞跑出建筑。
const polygon = normalizeBuilding({
  id: "mountain-gate",
  type: "门派",
  display: { width: 600, height: 480, anchor: "center" },
  collision: { enabled: true, points: [{ x: -2, y: 0.2 }, { x: 0.7, y: 2 }, { x: 0.3, y: 0.4 }] },
  interaction: { enabled: true, kind: "sect", title: "青云山门", prompt: "来者止步。", targetId: "sect-qingyun" },
});
assert.deepEqual(polygon.collision.points[0], { x: 0, y: 0.2 });
assert.deepEqual(polygon.collision.points[1], { x: 0.7, y: 1 });
assert.equal(polygon.display.anchor, "center");
assert.equal(polygon.interaction.targetId, "sect-qingyun");

console.log("建筑模板冒烟测试通过：旧档兼容、相对碰撞顶点与交互字段正确。");

import assert from "node:assert/strict";
import { normalizeBuilding } from "../src/core/WorldTemplateStore.js";
import { buildCollisionOutlineFromAlpha } from "../src/utils/ImageStorage.js";

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

// 建筑透明图上传后应自动生成少量、位于图片相对坐标内的可编辑轮廓。
const width = 8;
const height = 8;
const alpha = new Uint8ClampedArray(width * height * 4);
for (let y = 1; y <= 6; y += 1) {
  for (let x = y < 3 ? 3 : 2; x <= (y < 3 ? 4 : 5); x += 1) alpha[(y * width + x) * 4 + 3] = 255;
}
const outline = buildCollisionOutlineFromAlpha(alpha, width, height);
assert.equal(outline.usesTransparency, true);
assert.ok(outline.points.length >= 4 && outline.points.length <= 8);
assert.ok(outline.points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));

const opaque = new Uint8ClampedArray(width * height * 4);
for (let index = 3; index < opaque.length; index += 4) opaque[index] = 255;
const opaqueOutline = buildCollisionOutlineFromAlpha(opaque, width, height);
assert.equal(opaqueOutline.usesTransparency, false);
assert.equal(opaqueOutline.points.length, 4);

console.log("建筑模板冒烟测试通过：旧档兼容、相对碰撞顶点、图片自动轮廓与交互字段正确。");

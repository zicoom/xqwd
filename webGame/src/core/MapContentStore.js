/**
 * 地图内容仓库。
 * 开发服务器会把地图摆放内容保存到项目 data/editor/map-content.json。
 * 游戏场景和地图编辑器都会读取这里的数据，所以点击“保存”后重新进入游戏即可立刻生效。
 */
import { getLegacyEditorData, loadEditorData, saveEditorData } from "./EditorFileRepository.js";
const MAP_CONTENT_SAVE_KEY = "xuanqiong-wendao-map-content-v1";

/** 编辑器第一版允许放置的四类地图对象。 */
export const MAP_OBJECT_TYPES = Object.freeze({
  npc: { name: "NPC", color: 0x62b5e5, symbol: "人" },
  monster: { name: "怪物", color: 0xd65b56, symbol: "怪" },
  building: { name: "建筑", color: 0xd6a85b, symbol: "建" },
  portal: { name: "传送点", color: 0xa47ce6, symbol: "传" },
});

/** 读取某张地图的已编辑对象。 */
export function getMapObjects(mapId) {
  const result = loadEditorData("map-content");
  if (result.ok) return Array.isArray(result.data?.[mapId]) ? result.data[mapId].map(normalizeMapObject) : [];
  const legacy = result.ok ? null : getLegacyEditorData(MAP_CONTENT_SAVE_KEY);
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    if (result.missing) {
      const migrated = saveEditorData("map-content", legacy);
      if (migrated.ok) return Array.isArray(migrated.data?.[mapId]) ? migrated.data[mapId].map(normalizeMapObject) : [];
    }
    return Array.isArray(legacy[mapId]) ? legacy[mapId].map(normalizeMapObject) : [];
  }
  if (!result.unavailable) console.warn("地图内容读取失败：", result.error);
  return [];
}

/** 保存某张地图的完整对象列表。 */
export function saveMapObjects(mapId, objects) {
  const current = loadEditorData("map-content");
  const allMaps = current.ok ? current.data : (getLegacyEditorData(MAP_CONTENT_SAVE_KEY) || {});
  const saved = saveEditorData("map-content", { ...allMaps, [mapId]: objects.map(normalizeMapObject) });
  if (!saved.ok) console.warn("地图内容保存失败：", saved.error);
  return saved.ok;
}

/** 创建一条可保存的对象数据。id 用于之后编辑、删除和任务关联。 */
export function createMapObject(type, x, y, name, extra = {}) {
  return normalizeMapObject({
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    type,
    name: name?.trim() || MAP_OBJECT_TYPES[type]?.name || "未命名对象",
    x: Math.round(x),
    y: Math.round(y),
    ...extra,
  });
}

/**
 * 把对象整理成统一格式。这样无论对象来自旧存档、编辑器还是未来导入的 JSON，
 * 游戏场景都能放心读取 dialogue、battle 等字段。
 */
export function normalizeMapObject(object) {
  const requestedScale = object.scale == null || object.scale === "" ? Number.NaN : Number(object.scale);
  const base = {
    ...object,
    name: object.name?.trim() || MAP_OBJECT_TYPES[object.type]?.name || "未命名对象",
    // 缩放属于地图实例，而不是模板。这样同一种 NPC、怪物或建筑可以在不同位置使用不同尺寸。
    scale: Number.isFinite(requestedScale) ? Math.min(4, Math.max(0.25, requestedScale)) : 1,
  };
  if (base.type === "npc") {
    return {
      ...base,
      // 用数组保存多句对话，未来任务系统可在这里按条件切换不同对话。
      dialogue: Array.isArray(base.dialogue) && base.dialogue.length
        ? base.dialogue
        : [`${base.name}：你好，外来的修士。`, "青云山近日并不太平，出行务必小心。"],
    };
  }
  if (base.type === "monster") {
    return {
      ...base,
      battle: {
        maxHp: 45,
        attack: 8,
        defense: 2,
        qi: 16,
        ...(base.battle || {}),
      },
      drops: Array.isArray(base.drops) && base.drops.length ? base.drops : ["灵石 × 3", "低阶材料 × 1"],
    };
  }
  return base;
}

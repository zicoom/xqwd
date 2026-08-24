/**
 * 地图内容仓库。
 * 浏览器版无法直接修改项目中的 JSON 文件，因此编辑器先把玩家放置的内容保存到浏览器本地。
 * 游戏场景和地图编辑器都会读取这里的数据，所以点击“保存”后重新进入游戏即可立刻生效。
 */
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
  try {
    const allMaps = JSON.parse(localStorage.getItem(MAP_CONTENT_SAVE_KEY) || "{}");
    // 旧版本对象只有“名称和坐标”。这里补上默认配置，保证以前放好的对象也能直接交互。
    return Array.isArray(allMaps[mapId]) ? allMaps[mapId].map(normalizeMapObject) : [];
  } catch (error) {
    console.warn("地图内容读取失败：", error);
    return [];
  }
}

/** 保存某张地图的完整对象列表。 */
export function saveMapObjects(mapId, objects) {
  try {
    const allMaps = JSON.parse(localStorage.getItem(MAP_CONTENT_SAVE_KEY) || "{}");
    allMaps[mapId] = objects;
    localStorage.setItem(MAP_CONTENT_SAVE_KEY, JSON.stringify(allMaps));
    return true;
  } catch (error) {
    console.warn("地图内容保存失败：", error);
    return false;
  }
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
  const base = {
    ...object,
    name: object.name?.trim() || MAP_OBJECT_TYPES[object.type]?.name || "未命名对象",
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

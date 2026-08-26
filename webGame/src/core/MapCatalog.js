/** 地图目录：编辑器和未来地图场景通过稳定 ID 识别不同大地图。 */
export const MAP_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "qingyun-mountain", name: "青云山", kind: "tiles",
    columns: 5, rows: 5, tileSize: 1200, displayScale: 0.6,
    worldWidth: 6000, worldHeight: 6000, backgroundColor: 0x9faf78,
  }),
  Object.freeze({
    id: "luanxing-sea", name: "乱星海", kind: "placeholder",
    columns: 0, rows: 0, tileSize: 1200, displayScale: 1,
    worldWidth: 6000, worldHeight: 6000, backgroundColor: 0x426f78,
  }),
]);

export function getMapDefinition(id) {
  return MAP_DEFINITIONS.find((map) => map.id === id) || MAP_DEFINITIONS[0];
}

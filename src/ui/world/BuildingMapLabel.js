import { addText } from "../../utils/UiHelpers.js";

// 用户提供的 110_1.png 原始尺寸。名称牌只允许等比缩放，不能拉宽或压扁。
export const BUILDING_LABEL_WIDTH = 86;
export const BUILDING_LABEL_HEIGHT = 296;

// 所有大地图建筑统一使用与新手村相同的紧凑名称牌。宽高使用同一个比例，
// 因此用户提供的笔刷不会被拉宽或压扁，也不会再因建筑实例缩放而出现一大一小。
const MAP_BUILDING_LABEL_SCALE = 0.74;
const MAP_BUILDING_LABEL_TOP_OFFSET = 160;

const BUILDING_LABEL_FONT = '"Microsoft YaHei", "Noto Sans SC", sans-serif';

/**
 * 创建大地图建筑名称牌。
 *
 * 组件只负责笔刷底板和竖排文字；建筑模板名称、位置和缩放仍由场景传入。
 * 名称按 Unicode 字符拆分，避免中文、数字或较长门派名被当作字节截断。
 */
export function createBuildingMapLabel(scene, { name, buildingTopY = 0 } = {}) {
  const normalizedName = String(name || "建筑").trim() || "建筑";
  const characters = Array.from(normalizedName).slice(0, 5);
  const baseFontSize = characters.length >= 5 ? 27 : characters.length === 4 ? 31 : 38;
  const fontSize = Math.round(baseFontSize * MAP_BUILDING_LABEL_SCALE);
  const displayWidth = BUILDING_LABEL_WIDTH * MAP_BUILDING_LABEL_SCALE;
  const displayHeight = BUILDING_LABEL_HEIGHT * MAP_BUILDING_LABEL_SCALE;

  // 所有名称牌使用同一个屋顶偏移，确保不同建筑之间的样式和位置规则一致。
  const label = scene.add.container(0, buildingTopY + MAP_BUILDING_LABEL_TOP_OFFSET);
  const brush = scene.add.image(0, 0, "map-building-name-brush")
    .setDisplaySize(displayWidth, displayHeight);
  const text = addText(scene, 0, -3, characters.join("\n"), fontSize, "#ffffff", {
    fontFamily: BUILDING_LABEL_FONT,
    fontStyle: "normal",
    strokeThickness: 0,
    align: "center",
    lineSpacing: 7,
  }).setOrigin(0.5);

  label.add([brush, text]);
  return label;
}

/**
 * 建筑模板在地图中的显示配置。
 * 地图实例只保存 buildingTemplateId 和坐标；图片、尺寸和锚点始终从模板读取，
 * 因此在建筑管理中换图或改尺寸后，所有已放置建筑都会同步更新。
 */
export function resolveBuildingAppearance(building = {}) {
  return {
    imageData: building.imageData || "",
    width: Math.min(1024, Math.max(48, Number(building.display?.width) || 256)),
    height: Math.min(1024, Math.max(48, Number(building.display?.height) || 256)),
    anchor: building.display?.anchor === "center" ? "center" : "bottom",
  };
}

/** 图片内容变化时生成新纹理键，避免 Phaser 继续显示建筑管理中的旧图。 */
export function getBuildingAppearanceTextureKey(building, prefix = "building") {
  const { imageData } = resolveBuildingAppearance(building);
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(imageData.length / 128));
  for (let index = 0; index < imageData.length; index += step) {
    hash ^= imageData.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${building?.id || "unknown"}-${(hash >>> 0).toString(36)}`;
}

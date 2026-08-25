/** 怪物外观模式。当前先渲染静态立绘，animated 为未来动态图集 / 序列帧预留。 */
export const MONSTER_APPEARANCE_MODES = Object.freeze({
  STATIC: "static",
  ANIMATED: "animated",
});

/**
 * 地图、地图编辑器和战斗统一从这里读取怪物外观。
 * 将来接动态立绘时只需扩展 renderer 对 animation 的处理，静态回退图仍可继续使用。
 */
export function resolveMonsterAppearance(monster = {}) {
  const appearance = monster.appearance && typeof monster.appearance === "object" ? monster.appearance : {};
  const staticImageData = monster.imageData || appearance.staticFallback || "";
  return {
    mode: appearance.mode === MONSTER_APPEARANCE_MODES.ANIMATED
      ? MONSTER_APPEARANCE_MODES.ANIMATED
      : MONSTER_APPEARANCE_MODES.STATIC,
    staticImageData,
    animation: appearance.animation && typeof appearance.animation === "object"
      ? { ...appearance.animation }
      : null,
  };
}

/** 图片内容变化时生成新的纹理键，避免 Phaser 继续复用上传前的旧立绘。 */
export function getMonsterAppearanceTextureKey(monster, prefix) {
  const { staticImageData } = resolveMonsterAppearance(monster);
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(staticImageData.length / 128));
  for (let index = 0; index < staticImageData.length; index += step) {
    hash ^= staticImageData.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${monster?.id || "unknown"}-${(hash >>> 0).toString(36)}`;
}

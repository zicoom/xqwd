/**
 * 可供主角选择的初始立绘目录。
 *
 * 这里只保存稳定编号、素材路径和展示信息，不保存 Phaser 对象；存档中只记录 portraitId，
 * 因此未来替换图片或新增立绘时，旧角色档案仍能正确找到原来的形象。
 */
export const PLAYER_PORTRAITS = Object.freeze([
  { id: "innkeeper", name: "市井掌柜", gender: "男", textureKey: "player-portrait-innkeeper", imagePath: "./public/assets/images/portraits/innkeeper.png" },
  { id: "hunter", name: "山野猎户", gender: "男", textureKey: "player-portrait-hunter", imagePath: "./public/assets/images/portraits/hunter.png" },
  { id: "cultivator-female", name: "紫衣散修", gender: "女", textureKey: "player-portrait-cultivator-female", imagePath: "./public/assets/images/portraits/cultivator-female.png" },
  { id: "scholar", name: "青衣书生", gender: "男", textureKey: "player-portrait-scholar", imagePath: "./public/assets/images/portraits/scholar.png" },
  { id: "elder", name: "白发道人", gender: "男", textureKey: "player-portrait-elder", imagePath: "./public/assets/images/portraits/elder.png" },
]);

export const DEFAULT_PLAYER_PORTRAIT_ID = "cultivator-female";

/** 即使未来删除或重命名某张立绘，旧档也会安全回退到默认立绘。 */
export function getPlayerPortrait(id) {
  return PLAYER_PORTRAITS.find((portrait) => portrait.id === id)
    ?? PLAYER_PORTRAITS.find((portrait) => portrait.id === DEFAULT_PLAYER_PORTRAIT_ID);
}

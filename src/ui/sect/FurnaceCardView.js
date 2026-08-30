import { addText } from "../../utils/UiHelpers.js";

const ASSET_ROOT = "./public/assets/images/pixso/alchemy/furnace-picker";
const TITLE_FONT = '"SJ yuantijian-C", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const BODY_FONT = '"Noto Sans SC Battle Popup", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const GRADE_FONT = '"SJ yuantijian-Z", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';

const FURNACE_TEXTURE_BY_ID = Object.freeze({
  "furnace-iron": "alchemy-furnace-picker-iron",
  "furnace-spirit-fire": "alchemy-furnace-picker-spirit-fire",
  "furnace-mystic-ice": "alchemy-furnace-picker-mystic-ice",
  "furnace-earth-heart": "alchemy-furnace-picker-earth-heart",
  "furnace-nine-sun": "alchemy-furnace-picker-nine-sun",
});

// Pixso 为每张炉卡使用独立强调色；颜色只影响文字，不参与任何炼丹数值计算。
const FURNACE_ACCENT_BY_ID = Object.freeze({
  "furnace-iron": "#000000",
  "furnace-spirit-fire": "#3d8b68",
  "furnace-mystic-ice": "#b56f2a",
  "furnace-earth-heart": "#704293",
  "furnace-nine-sun": "#e99800",
});

export const FURNACE_CARD_SIZE = Object.freeze({ width: 280, height: 401 });

/** 预加载炼丹房与丹炉选择弹窗共同使用的炉卡素材。 */
export function preloadFurnaceCardAssets(scene) {
  const assets = {
    "alchemy-furnace-picker-card": "furnace-card.png",
    "alchemy-furnace-picker-grade": "furnace-grade-badge.png",
    "alchemy-furnace-picker-iron": "furnace-iron.png",
    "alchemy-furnace-picker-spirit-fire": "furnace-spirit-fire.png",
    "alchemy-furnace-picker-mystic-ice": "furnace-mystic-ice.png",
    "alchemy-furnace-picker-earth-heart": "furnace-earth-heart.png",
    "alchemy-furnace-picker-nine-sun": "furnace-nine-sun.png",
  };
  Object.entries(assets).forEach(([textureKey, fileName]) => {
    scene.load.image(textureKey, `${ASSET_ROOT}/${fileName}`);
  });
}

/**
 * 创建 Pixso 炉卡视图。组件只消费普通丹炉数据并绘制，不读取服务或存档。
 * 炼丹房中央展示与选择弹窗共用本组件，保证炉图、品阶与加成排版一致。
 */
export function createFurnaceCardView(scene, furnace, {
  x = 0,
  y = 0,
  interactive = false,
  onSelect = null,
} = {}) {
  const data = furnace || {
    id: "",
    name: "尚未安置丹炉",
    grade: "未安",
    successBonus: 0,
    yieldBonus: 0,
  };
  const accent = FURNACE_ACCENT_BY_ID[data.id] || "#6f5540";
  const textureKey = FURNACE_TEXTURE_BY_ID[data.id];
  const root = scene.add.container(x, y);
  const card = scene.add.image(0, 0, "alchemy-furnace-picker-card")
    .setOrigin(0)
    .setDisplaySize(FURNACE_CARD_SIZE.width, FURNACE_CARD_SIZE.height);
  root.add(card);

  if (textureKey && scene.textures.exists(textureKey)) {
    root.add(scene.add.image(16.71, 28.216, textureKey)
      .setOrigin(0)
      .setDisplaySize(224, 224));
  }

  root.add(scene.add.image(26.5, 272.717, "pixso-alchemy-c13")
    .setOrigin(0)
    .setDisplaySize(200, 5.419));

  const badgeLeft = 197.912;
  const badgeTop = 34;
  root.add(scene.add.image(badgeLeft, badgeTop, "alchemy-furnace-picker-grade")
    .setOrigin(0)
    .setDisplaySize(27.464, 57.759));
  root.add(addText(scene, badgeLeft + 13.732, badgeTop + 29.2,
    formatGrade(data.grade), 16, accent, {
      origin: 0.5,
      align: "center",
      lineSpacing: -2,
      fontFamily: GRADE_FONT,
      strokeThickness: 0,
    }));

  const bonusY = 300.27;
  const bonusStyle = { fontFamily: BODY_FONT, strokeThickness: 0 };
  root.add(addText(scene, 44.75, bonusY, "成丹", 16, "#000000", bonusStyle));
  root.add(addText(scene, 77.5, bonusY, `+${data.successBonus || 0}%`, 16, accent, bonusStyle));
  root.add(addText(scene, 138.5, bonusY, "额外", 16, "#000000", bonusStyle));
  root.add(addText(scene, 171.5, bonusY, `+${data.yieldBonus || 0}%`, 16, accent, bonusStyle));
  root.add(addText(scene, 140, 345.2, data.name, 24, "#ddac4f", {
    origin: 0.5,
    fontFamily: TITLE_FONT,
    strokeThickness: 1,
    stroke: "#000000",
  }));

  let hit = null;
  if (interactive || typeof onSelect === "function") {
    hit = scene.add.rectangle(140, 200.5, FURNACE_CARD_SIZE.width, FURNACE_CARD_SIZE.height,
      0xffffff, 0.001).setInteractive({ useHandCursor: true });
    root.add(hit);
    hit.on("pointerover", () => card.setTint(0xfff3d6));
    hit.on("pointerout", () => card.clearTint());
    if (typeof onSelect === "function") hit.on("pointerdown", () => onSelect(data.id));
  }

  return { root, card, hit };
}

function formatGrade(grade) {
  const value = String(grade || "凡品");
  return value.endsWith("品") ? `${value.slice(0, -1)}\n品` : value.length > 1 ? `${value[0]}\n${value[1]}` : value;
}

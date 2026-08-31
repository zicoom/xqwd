import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const UI_FONT = '"SJ yuantijian-C-Regular", "Microsoft YaHei", sans-serif';
const ASSET_ROOT = "./public/assets/images/pixso/retreat-room/book-picker";

export const RETREAT_BOOK_PICKER_ASSETS = Object.freeze({
  panel: "pixso-retreat-book-picker-panel",
  card: "pixso-retreat-book-picker-card",
  selectedCard: "pixso-retreat-book-picker-card-selected",
  selectedRibbon: "pixso-retreat-book-picker-selected-ribbon",
  closeButton: "pixso-retreat-book-picker-close-button",
  titleDivider: "pixso-retreat-book-picker-title-divider",
  requirementSelected: "pixso-retreat-book-picker-requirement-selected",
  requirementCommon: "pixso-retreat-book-picker-requirement-common",
  requirementImmortal: "pixso-retreat-book-picker-requirement-immortal",
  requirementEarth: "pixso-retreat-book-picker-requirement-earth",
  requirementHeaven: "pixso-retreat-book-picker-requirement-heaven",
  requirementThunder: "pixso-retreat-book-picker-requirement-thunder",
});

const CARD_LAYOUT = Object.freeze([
  Object.freeze({ x: 713.264282, y: 328.688232 }),
  Object.freeze({ x: 1185.505249, y: 328.688232 }),
  Object.freeze({ x: 713.264282, y: 573.688232 }),
  Object.freeze({ x: 1193.960938, y: 569.733887 }),
  Object.freeze({ x: 713.264282, y: 818.688232 }),
  Object.freeze({ x: 1185.505249, y: 818.688232 }),
]);

const GRADE_COLORS = Object.freeze({
  凡品: "#6d6d6c",
  灵品: "#277b3c",
  地品: "#dc8c47",
  天品: "#9154da",
  仙品: "#e5a800",
});

const REQUIREMENT_ASSETS = Object.freeze({
  凡品: RETREAT_BOOK_PICKER_ASSETS.requirementCommon,
  灵品: RETREAT_BOOK_PICKER_ASSETS.requirementSelected,
  地品: RETREAT_BOOK_PICKER_ASSETS.requirementEarth,
  天品: RETREAT_BOOK_PICKER_ASSETS.requirementHeaven,
  仙品: RETREAT_BOOK_PICKER_ASSETS.requirementImmortal,
  雷: RETREAT_BOOK_PICKER_ASSETS.requirementThunder,
});

/** 预加载 Pixso“改版 / 闭关室-法术”(73:243)的语义化素材。 */
export function preloadRetreatBookPickerAssets(scene) {
  scene.load.image(RETREAT_BOOK_PICKER_ASSETS.panel, `${ASSET_ROOT}/book-picker-panel.png`);
  scene.load.image(RETREAT_BOOK_PICKER_ASSETS.card, `${ASSET_ROOT}/book-card.png`);
  scene.load.image(RETREAT_BOOK_PICKER_ASSETS.selectedCard, `${ASSET_ROOT}/book-card-selected.png`);
  scene.load.image(RETREAT_BOOK_PICKER_ASSETS.selectedRibbon, `${ASSET_ROOT}/selected-ribbon.png`);
  scene.load.image(RETREAT_BOOK_PICKER_ASSETS.closeButton, `${ASSET_ROOT}/close-button.png`);
  scene.load.image(RETREAT_BOOK_PICKER_ASSETS.titleDivider, `${ASSET_ROOT}/title-divider.png`);
  scene.load.svg(RETREAT_BOOK_PICKER_ASSETS.requirementSelected, `${ASSET_ROOT}/requirement-selected.svg`);
  scene.load.svg(RETREAT_BOOK_PICKER_ASSETS.requirementCommon, `${ASSET_ROOT}/requirement-common.svg`);
  scene.load.svg(RETREAT_BOOK_PICKER_ASSETS.requirementImmortal, `${ASSET_ROOT}/requirement-immortal.svg`);
  scene.load.svg(RETREAT_BOOK_PICKER_ASSETS.requirementEarth, `${ASSET_ROOT}/requirement-earth.svg`);
  scene.load.svg(RETREAT_BOOK_PICKER_ASSETS.requirementHeaven, `${ASSET_ROOT}/requirement-heaven.svg`);
  scene.load.svg(RETREAT_BOOK_PICKER_ASSETS.requirementThunder, `${ASSET_ROOT}/requirement-thunder.svg`);
}

const createText = (scene, x, y, value, size, color, extra = {}) => addText(scene, x, y, value, size, color, {
  origin: 0.5,
  fontFamily: UI_FONT,
  strokeThickness: 0,
  ...extra,
});

/**
 * 法术与功法共用的秘籍选择界面；只负责绘制和输入，不读取领域服务或修改存档。
 */
export class RetreatBookPickerDialog {
  constructor(scene, { title, entries = [], selectedIndex = 0, onSelect, onClose }) {
    this.scene = scene;
    this.entries = entries.slice(0, CARD_LAYOUT.length);
    this.selectedIndex = selectedIndex;
    this.onSelect = onSelect;
    this.onClose = onClose;
    this.root = scene.add.container(0, 0).setDepth(1200);
    this.draw(title);
  }

  draw(title) {
    const scene = this.scene;
    this.root.add(scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.5).setInteractive());
    this.root.add(scene.add.image(960, 540, RETREAT_BOOK_PICKER_ASSETS.panel).setDisplaySize(1094, 933));
    this.root.add(createText(scene, 960, 130.5, title, 49, "#ddac4f"));
    this.root.add(scene.add.image(960, 194.545654, RETREAT_BOOK_PICKER_ASSETS.titleDivider).setDisplaySize(463, 27));

    const close = scene.add.image(1436.226685, 140.5, RETREAT_BOOK_PICKER_ASSETS.closeButton)
      .setDisplaySize(72, 72)
      .setInteractive({ useHandCursor: true });
    close.on("pointerover", () => close.setScale(1.04));
    close.on("pointerout", () => close.setScale(1));
    close.on("pointerdown", () => {
      playUiClickSound(scene);
      this.onClose?.();
    });
    this.root.add(close);

    CARD_LAYOUT.forEach((position, index) => this.drawCard(position, this.entries[index], index));
  }

  drawCard({ x, y }, entry, index) {
    const scene = this.scene;
    const selected = Boolean(entry) && index === this.selectedIndex;
    const card = scene.add.container(x, y);
    const background = scene.add.image(0, 0, selected
      ? RETREAT_BOOK_PICKER_ASSETS.selectedCard
      : RETREAT_BOOK_PICKER_ASSETS.card).setDisplaySize(442, 225);
    card.add(background);
    this.root.add(card);

    if (!entry?.preview) {
      card.add(createText(scene, 28, 0, "尚未收录", 24, "#877968"));
      return;
    }

    const { preview, study } = entry;
    if (scene.textures.exists(preview.artKey)) {
      card.add(scene.add.image(-101.25, 3, preview.artKey).setDisplaySize(120, 120));
    }
    card.add(createText(scene, 67, -32, `《${preview.name}》`, 24, "#000000"));
    card.add(createText(scene, 67, 7, `${preview.grade} · ${preview.element}系`, 18,
      GRADE_COLORS[preview.grade] || "#6d6d6c"));

    const requirement = study?.learned ? "已领悟" : preview.requirement;
    const requirementGroup = scene.add.container(67, 47);
    const requirementAsset = preview.element === "雷"
      ? REQUIREMENT_ASSETS.雷
      : REQUIREMENT_ASSETS[preview.grade] || RETREAT_BOOK_PICKER_ASSETS.requirementCommon;
    requirementGroup.add(scene.add.image(-34, 0, requirementAsset).setDisplaySize(20, 22));
    requirementGroup.add(createText(scene, 7, 0, requirement, 20, "#27201c"));
    card.add(requirementGroup);

    if (selected) {
      const ribbon = scene.add.image(-162.26416, -45.27832, RETREAT_BOOK_PICKER_ASSETS.selectedRibbon)
        .setDisplaySize(42, 90);
      const ribbonText = createText(scene, -162.26416, -46.27832, "已\n选", 18, "#e5d0b5", {
        align: "center",
        lineSpacing: -1,
      });
      card.add([ribbon, ribbonText]);
    }

    const hit = scene.add.rectangle(0, 0, 442, 225, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => background.setTint(0xfff1cf));
    hit.on("pointerout", () => background.clearTint());
    hit.on("pointerdown", () => {
      playUiClickSound(scene);
      this.onSelect?.(entry, index);
    });
    card.add(hit);
  }
}

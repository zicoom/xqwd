import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const ASSET_ROOT = "./public/assets/images/pixso/character-create/portrait-picker";
const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const UI_FONT = '"Microsoft YaHei", "Noto Sans SC", sans-serif';

export const PORTRAIT_PICKER_ASSETS = Object.freeze({
  titlePlaque: "pixso-portrait-picker-title-plaque",
  portraitCard: "pixso-portrait-picker-card",
  cardNameplate: "pixso-portrait-picker-card-nameplate",
  arrowLeft: "pixso-portrait-picker-arrow-left",
  arrowRight: "pixso-portrait-picker-arrow-right",
  confirmButton: "pixso-portrait-picker-confirm-button",
  backButton: "pixso-portrait-picker-back-button",
});

const LAYOUT = Object.freeze({
  title: Object.freeze({ x: 960, y: 158, width: 531, height: 102 }),
  back: Object.freeze({ x: 160, y: 82, width: 253, height: 80 }),
  previous: Object.freeze({ x: 105, y: 580, width: 97, height: 166 }),
  next: Object.freeze({ x: 1815, y: 580, width: 97, height: 166 }),
  confirm: Object.freeze({ x: 960, y: 935, width: 340, height: 90 }),
  slots: Object.freeze([
    Object.freeze({ x: 360, y: 540, width: 194, height: 318, portraitWidth: 138, portraitHeight: 190, nameplateWidth: 154, nameplateHeight: 42, nameplateY: 658, offset: -2 }),
    Object.freeze({ x: 635, y: 540, width: 252, height: 414, portraitWidth: 190, portraitHeight: 254, nameplateWidth: 194, nameplateHeight: 53, nameplateY: 700, offset: -1 }),
    Object.freeze({ x: 960, y: 540, width: 310, height: 509, portraitWidth: 274, portraitHeight: 382, nameplateWidth: 240, nameplateHeight: 66, nameplateY: 730, offset: 0 }),
    Object.freeze({ x: 1295, y: 540, width: 252, height: 414, portraitWidth: 190, portraitHeight: 254, nameplateWidth: 194, nameplateHeight: 53, nameplateY: 700, offset: 1 }),
    Object.freeze({ x: 1568, y: 540, width: 194, height: 318, portraitWidth: 138, portraitHeight: 190, nameplateWidth: 154, nameplateHeight: 42, nameplateY: 658, offset: 2 }),
  ]),
});

export function preloadPortraitPickerAssets(scene) {
  scene.load.image(PORTRAIT_PICKER_ASSETS.titlePlaque, `${ASSET_ROOT}/title-plaque.png`);
  scene.load.image(PORTRAIT_PICKER_ASSETS.portraitCard, `${ASSET_ROOT}/selected-card.png`);
  scene.load.image(PORTRAIT_PICKER_ASSETS.cardNameplate, `${ASSET_ROOT}/card-nameplate.png`);
  scene.load.image(PORTRAIT_PICKER_ASSETS.arrowLeft, `${ASSET_ROOT}/arrow-left.png`);
  scene.load.image(PORTRAIT_PICKER_ASSETS.arrowRight, `${ASSET_ROOT}/arrow-right.png`);
  scene.load.image(PORTRAIT_PICKER_ASSETS.confirmButton, `${ASSET_ROOT}/button-confirm.png`);
  scene.load.image(PORTRAIT_PICKER_ASSETS.backButton, `${ASSET_ROOT}/button-back.png`);
}

/**
 * Pixso“选择立绘”的纯 UI 视图。
 *
 * 视图只绘制五卡轮播、维护预览高亮并转发输入；角色数据写入和性别规则仍由
 * CharacterCreationService 负责。
 */
export class PortraitPickerView {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(100).setVisible(false);
    this.cards = scene.add.container(0, 0);
    this.transitioning = false;
  }

  render({ portraits = [], selectedIndex = 0 } = {}, callbacks = {}) {
    this.portraits = portraits;
    this.selectedIndex = selectedIndex;
    this.callbacks = callbacks;

    this.addImage(960, 540, "xuanqiong-wendao-cover", 1920, 1080);
    this.root.add(this.scene.add.rectangle(960, 540, 1920, 1080, 0x020605, 0.78));

    this.addImage(
      LAYOUT.title.x,
      LAYOUT.title.y,
      PORTRAIT_PICKER_ASSETS.titlePlaque,
      LAYOUT.title.width,
      LAYOUT.title.height,
    );
    this.addCenteredText(960, 154, "选择你的定形象", 38, "#f6d98d", {
      fontFamily: TITLE_FONT,
      fontStyle: "bold",
      stroke: "#17110b",
      strokeThickness: 3,
    });
    this.root.add(this.cards);

    this.createImageButton({
      ...LAYOUT.back,
      texture: PORTRAIT_PICKER_ASSETS.backButton,
      label: "返回创建",
      fontSize: 24,
      textColor: "#f1d28a",
      hoverTextColor: "#fff0bd",
      strokeColor: "#1c120a",
      strokeThickness: 3,
      onClick: callbacks.onBack,
    });
    this.createArrowButton(LAYOUT.previous, PORTRAIT_PICKER_ASSETS.arrowLeft, "❮", () => callbacks.onPrevious?.());
    this.createArrowButton(LAYOUT.next, PORTRAIT_PICKER_ASSETS.arrowRight, "❯", () => callbacks.onNext?.());
    this.createImageButton({
      ...LAYOUT.confirm,
      texture: PORTRAIT_PICKER_ASSETS.confirmButton,
      label: "确认形象",
      fontSize: 25,
      textColor: "#f5d992",
      hoverTextColor: "#fff1bd",
      strokeColor: "#1c120a",
      strokeThickness: 3,
      onClick: callbacks.onConfirm,
    });

    this.keyboardHandler = (event) => {
      if (!this.root.visible) return;
      if (event.key === "ArrowLeft") callbacks.onPrevious?.();
      else if (event.key === "ArrowRight") callbacks.onNext?.();
      else if (event.key === "Escape") callbacks.onBack?.();
      else if (event.key === "Enter") callbacks.onConfirm?.();
    };
    this.scene.input.keyboard?.on("keydown", this.keyboardHandler);
    this.update({ portraits, selectedIndex });
    return this;
  }

  update({ portraits = this.portraits, selectedIndex = this.selectedIndex, direction = 0 } = {}) {
    if (direction && this.root.visible && this.cardEntries?.length === LAYOUT.slots.length) {
      this.transitionTo({ portraits, selectedIndex, direction });
      return;
    }
    this.portraits = portraits;
    this.selectedIndex = selectedIndex;
    this.renderCards();
  }

  transitionTo({ portraits, selectedIndex, direction }) {
    const normalizedDirection = Math.sign(direction) || 1;
    this.transitioning = true;
    let completedEntries = 0;
    const finishEntry = () => {
      completedEntries += 1;
      if (completedEntries !== LAYOUT.slots.length) return;
      this.scene.time.delayedCall(0, () => {
        if (!this.cards) return;
        this.portraits = portraits;
        this.selectedIndex = selectedIndex;
        this.renderCards();
        this.transitioning = false;
      });
    };

    this.cardEntries.forEach((entry) => {
      const targetSlotIndex = (entry.slotIndex - normalizedDirection + LAYOUT.slots.length) % LAYOUT.slots.length;
      const targetSlot = LAYOUT.slots[targetSlotIndex];
      const wraps = (normalizedDirection > 0 && entry.slotIndex === 0)
        || (normalizedDirection < 0 && entry.slotIndex === LAYOUT.slots.length - 1);
      if (wraps) {
        this.animateWrappedEntry(entry, targetSlot, normalizedDirection, finishEntry);
        return;
      }
      this.animateEntryToSlot(entry, targetSlot, finishEntry);
    });
  }

  canNavigate() {
    return !this.transitioning;
  }

  renderCards() {
    this.cardEntries?.forEach((entry) => this.killEntryTweens(entry));
    this.cards.removeAll(true);
    this.cardEntries = [];
    if (!this.portraits.length) return;

    LAYOUT.slots.forEach((slot, slotIndex) => {
      const portraitIndex = (this.selectedIndex + slot.offset + this.portraits.length) % this.portraits.length;
      const portrait = this.portraits[portraitIndex];
      const container = this.scene.add.container(slot.x, slot.y);
      const frame = this.scene.add.image(0, 0, PORTRAIT_PICKER_ASSETS.portraitCard)
        .setDisplaySize(slot.width, slot.height);
      // 人物下沿延伸到姓名牌后方，由姓名牌自然遮住，卡框与姓名牌本身不移动。
      const image = this.scene.add.image(0, 26, portrait.textureKey);
      this.fitPortrait(image, portrait.textureKey, slot.portraitWidth, slot.portraitHeight);
      const nameplateY = slot.nameplateY - slot.y;
      const namePlate = this.scene.add.image(0, nameplateY, PORTRAIT_PICKER_ASSETS.cardNameplate)
        .setDisplaySize(slot.nameplateWidth, slot.nameplateHeight);
      const label = this.makeCenteredText(
        0,
        nameplateY - 1,
        portrait.name,
        20,
        "#49311f",
        {
          fontFamily: UI_FONT,
          fontStyle: "bold",
          stroke: "#f8e7be",
          strokeThickness: 1,
        },
      ).setScale(this.getLabelScale(slot));

      const hitArea = this.scene.add.zone(0, 0, slot.width, slot.height)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerover", () => {
        frame.setTint(0xffe6aa);
      });
      hitArea.on("pointerout", () => {
        frame.clearTint();
      });
      hitArea.on("pointerdown", () => {
        playUiClickSound(this.scene);
        this.callbacks.onSelect?.(portraitIndex, slot.offset);
      });
      container.add([frame, image, namePlate, label, hitArea]);
      this.cards.add(container);
      this.cardEntries.push({
        container,
        frame,
        image,
        namePlate,
        label,
        hitArea,
        portraitIndex,
        portrait,
        slotIndex,
      });
    });
  }

  animateEntryToSlot(entry, slot, onComplete) {
    const portraitSize = this.getPortraitDisplaySize(entry.portrait.textureKey, slot.portraitWidth, slot.portraitHeight);
    const nameplateY = slot.nameplateY - slot.y;
    const duration = 300;
    const ease = "Cubic.InOut";
    this.scene.tweens.add({
      targets: entry.container,
      x: slot.x,
      y: slot.y,
      duration,
      ease,
      onComplete,
    });
    this.scene.tweens.add({
      targets: entry.frame,
      displayWidth: slot.width,
      displayHeight: slot.height,
      duration,
      ease,
    });
    this.scene.tweens.add({
      targets: entry.image,
      displayWidth: portraitSize.width,
      displayHeight: portraitSize.height,
      y: 26,
      duration,
      ease,
    });
    this.scene.tweens.add({
      targets: entry.namePlate,
      displayWidth: slot.nameplateWidth,
      displayHeight: slot.nameplateHeight,
      y: nameplateY,
      duration,
      ease,
    });
    this.scene.tweens.add({
      targets: entry.label,
      y: nameplateY - 1,
      scaleX: this.getLabelScale(slot),
      scaleY: this.getLabelScale(slot),
      duration,
      ease,
    });
  }

  animateWrappedEntry(entry, slot, direction, onComplete) {
    this.scene.tweens.add({
      targets: entry.container,
      x: entry.container.x - direction * 135,
      alpha: 0,
      duration: 135,
      ease: "Sine.In",
      onComplete: () => {
        this.applyEntrySlot(entry, slot);
        entry.container.setPosition(slot.x + direction * 105, slot.y).setAlpha(0);
        this.scene.tweens.add({
          targets: entry.container,
          x: slot.x,
          alpha: 1,
          duration: 165,
          ease: "Cubic.Out",
          onComplete,
        });
      },
    });
  }

  applyEntrySlot(entry, slot) {
    const portraitSize = this.getPortraitDisplaySize(entry.portrait.textureKey, slot.portraitWidth, slot.portraitHeight);
    const nameplateY = slot.nameplateY - slot.y;
    entry.frame.setDisplaySize(slot.width, slot.height);
    entry.image.setPosition(0, 26).setDisplaySize(portraitSize.width, portraitSize.height);
    entry.namePlate.setPosition(0, nameplateY).setDisplaySize(slot.nameplateWidth, slot.nameplateHeight);
    entry.label.setPosition(0, nameplateY - 1).setScale(this.getLabelScale(slot));
  }

  getLabelScale(slot) {
    if (slot.offset === 0) return 1;
    return Math.abs(slot.offset) === 1 ? 0.85 : 0.75;
  }

  getPortraitDisplaySize(texture, maxWidth, maxHeight) {
    const source = this.scene.textures.get(texture).getSourceImage();
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
    return { width: source.width * scale, height: source.height * scale };
  }

  fitPortrait(image, texture, maxWidth, maxHeight) {
    const size = this.getPortraitDisplaySize(texture, maxWidth, maxHeight);
    image.setDisplaySize(size.width, size.height);
  }

  killEntryTweens(entry) {
    [entry.container, entry.frame, entry.image, entry.namePlate, entry.label]
      .forEach((target) => this.scene.tweens.killTweensOf(target));
  }

  createArrowButton(layout, texture, label, onClick) {
    const background = this.addImage(layout.x, layout.y, texture, layout.width, layout.height)
      .setInteractive({ useHandCursor: true });
    // 箭头素材包含下方流苏，文字需按上半部黑色按钮主体居中，而不是按整张 PNG 居中。
    const text = this.addCenteredText(layout.x, layout.y - 41, label, 52, "#f8e2a2", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      stroke: "#17110b",
      strokeThickness: 3,
    });
    background.on("pointerover", () => {
      background.setTint(0xffdf8e);
      text.setScale(1.08);
    });
    background.on("pointerout", () => {
      background.clearTint();
      text.setScale(1);
    });
    background.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onClick?.();
    });
  }

  createImageButton({
    x,
    y,
    width,
    height,
    texture,
    label,
    fontSize,
    textColor,
    hoverTextColor,
    strokeColor = "#1c120a",
    strokeThickness = 2,
    onClick,
  }) {
    const image = this.addImage(x, y, texture, width, height).setInteractive({ useHandCursor: true });
    const labelText = this.addCenteredText(x, y - 2, label, fontSize, textColor, {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      stroke: strokeColor,
      strokeThickness,
    });
    image.on("pointerover", () => {
      image.setTint(0xffe39a);
      labelText.setColor(hoverTextColor);
      labelText.setScale(1.04);
    });
    image.on("pointerout", () => {
      image.clearTint();
      labelText.setColor(textColor);
      labelText.setScale(1);
    });
    image.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onClick?.();
    });
  }

  show() {
    this.transitioning = false;
    this.cards.setPosition(0, 0).setAlpha(1).setScale(1);
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 180, ease: "Sine.Out" });
  }

  hide(onComplete) {
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 130,
      ease: "Sine.In",
      onComplete: () => {
        this.root.setVisible(false).setAlpha(1);
        onComplete?.();
      },
    });
  }

  addImage(x, y, texture, width, height) {
    const image = this.scene.add.image(x, y, texture).setDisplaySize(width, height);
    this.root.add(image);
    return image;
  }

  makeCenteredText(x, y, value, size, color, extra = {}) {
    const text = addText(this.scene, x, y, value, size, color, extra).setOrigin(0.5);
    text.setResolution?.(2);
    return text;
  }

  addCenteredText(x, y, value, size, color, extra = {}) {
    const text = this.makeCenteredText(x, y, value, size, color, extra);
    this.root.add(text);
    return text;
  }

  destroy() {
    this.cardEntries?.forEach((entry) => this.killEntryTweens(entry));
    this.scene.tweens.killTweensOf(this.cards);
    if (this.keyboardHandler) this.scene.input.keyboard?.off("keydown", this.keyboardHandler);
    this.keyboardHandler = null;
    this.root?.destroy(true);
    this.root = null;
    this.cards = null;
  }
}

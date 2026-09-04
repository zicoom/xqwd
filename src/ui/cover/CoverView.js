import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const COVER_ASSET_PATH = "./public/assets/images/pixso/cover";

export const COVER_ASSETS = Object.freeze({
  background: "cover-background",
  title: "cover-title-plaque",
  startButton: "cover-button-start",
  settingsButton: "cover-button-settings",
  consoleButton: "cover-button-console",
});

/**
 * Pixso 封面节点 78:367 的 1920×1080 一对一坐标。
 * 按钮素材包含向下垂落的流苏，文字中心因此位于整张素材中心的上方。
 */
export const COVER_LAYOUT = Object.freeze({
  title: Object.freeze({ x: 573, y: 126.79, width: 774, height: 315 }),
  shadeAlpha: 0.06,
  buttonTop: 783,
  // 三张按钮图的主牌匾可见区都在素材 Y=5～108 左右，设计页中的旧基线偏上约 9px。
  // 文字按牌匾主体而不是包含流苏的整张 PNG 居中，三枚按钮统一使用这一中心线。
  buttonTextCenterY: 839,
  buttons: Object.freeze([
    Object.freeze({ id: "start", centerX: 462, texture: COVER_ASSETS.startButton, width: 390, height: 172 }),
    Object.freeze({ id: "settings", centerX: 960, texture: COVER_ASSETS.settingsButton, width: 404, height: 173 }),
    Object.freeze({ id: "console", centerX: 1458, texture: COVER_ASSETS.consoleButton, width: 396, height: 172 }),
  ]),
});

export function preloadCoverAssets(scene) {
  scene.load.image(COVER_ASSETS.background, "./public/assets/images/covers/xuanqiong-wendao-cover-2048.jpg");
  scene.load.image(COVER_ASSETS.title, `${COVER_ASSET_PATH}/title-plaque.png`);
  scene.load.image(COVER_ASSETS.startButton, `${COVER_ASSET_PATH}/button-start.png`);
  scene.load.image(COVER_ASSETS.settingsButton, `${COVER_ASSET_PATH}/button-settings.png`);
  scene.load.image(COVER_ASSETS.consoleButton, `${COVER_ASSET_PATH}/button-console.png`);
}

/**
 * 封面纯 UI 视图。
 * 只负责 Pixso 素材、排版、悬浮反馈和点击转发；场景跳转与设置流程仍由 CoverScene 决定。
 */
export class CoverView {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.buttons = [];
  }

  render({ onStart, onSettings, onConsole } = {}) {
    this.destroy();

    this.track(
      this.scene.add.image(960, 540, COVER_ASSETS.background).setDisplaySize(1920, 1080),
      this.scene.add.rectangle(960, 540, 1920, 1080, 0x000000, COVER_LAYOUT.shadeAlpha),
    );

    const title = COVER_LAYOUT.title;
    this.track(
      this.scene.add.image(
        title.x + title.width / 2,
        title.y + title.height / 2,
        COVER_ASSETS.title,
      ).setDisplaySize(title.width, title.height),
    );

    const callbacks = {
      start: onStart,
      settings: onSettings,
      console: onConsole,
    };
    const labels = {
      start: "踏入仙途",
      settings: "设置",
      console: "控制台",
    };

    COVER_LAYOUT.buttons.forEach((layout) => {
      this.buttons.push(this.createButton(layout, labels[layout.id], callbacks[layout.id]));
    });
    return this;
  }

  createButton(layout, label, onClick) {
    const imageCenterY = COVER_LAYOUT.buttonTop + layout.height / 2;
    // 两侧按钮是浅色宣纸，中间按钮是黑色锦纹，不能共用同一种金色文字。
    // 浅底使用棕墨色提高明度对比，深底仍使用亮金色，避免封面入口在 1920×1080 下发虚。
    const isLightButton = layout.id !== "settings";
    const normalColor = isLightButton ? "#573414" : "#f1bd55";
    const hoverColor = isLightButton ? "#2f1b0b" : "#ffe3a0";
    const buttonImage = this.scene.add.image(layout.centerX, imageCenterY, layout.texture)
      .setDisplaySize(layout.width, layout.height);
    const buttonText = addText(
      this.scene,
      layout.centerX,
      COVER_LAYOUT.buttonTextCenterY,
      label,
      34,
      normalColor,
      {
        fontFamily: '"三极圆体简-粗", "Noto Sans SC Battle Popup", "Microsoft YaHei", sans-serif',
        fontStyle: "bold",
        stroke: isLightButton ? "#f6dda5" : "#2b1607",
        strokeThickness: isLightButton ? 2 : 3,
      },
    ).setOrigin(0.5);

    // 命中区只覆盖牌匾主体，不把向下垂落的流苏算成按钮，避免三个入口出现意外的大命中范围。
    const hitArea = this.scene.add.zone(layout.centerX, COVER_LAYOUT.buttonTextCenterY, layout.width - 20, 86)
      .setInteractive({ useHandCursor: true });
    const setHovered = (hovered) => {
      this.scene.tweens.killTweensOf([buttonImage, buttonText]);
      this.scene.tweens.add({
        targets: [buttonImage, buttonText],
        scaleX: hovered ? 1.018 : 1,
        scaleY: hovered ? 1.018 : 1,
        duration: 110,
        ease: "Sine.easeOut",
      });
      buttonText.setColor(hovered ? hoverColor : normalColor);
    };
    hitArea.on("pointerover", () => setHovered(true));
    hitArea.on("pointerout", () => setHovered(false));
    hitArea.on("pointerdown", () => {
      playUiClickSound(this.scene);
      onClick?.();
    });

    this.track(buttonImage, buttonText, hitArea);
    return { image: buttonImage, text: buttonText, hitArea };
  }

  track(...objects) {
    this.objects.push(...objects.filter(Boolean));
  }

  destroy() {
    this.buttons = [];
    this.objects.splice(0).forEach((object) => object?.destroy?.());
  }
}

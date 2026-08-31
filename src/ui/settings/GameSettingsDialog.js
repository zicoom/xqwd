import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../../core/DisplayConfig.js";
import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const ASSET_ROOT = "./public/assets/images/pixso/settings";
const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const UI_FONT = '"SJ yuantijian-C-Regular", "Microsoft YaHei", sans-serif';

export const GAME_SETTINGS_ASSETS = Object.freeze({
  panel: "pixso-game-settings-panel",
  titlePlaque: "pixso-game-settings-title-plaque",
  closeButton: "pixso-game-settings-close-button",
  buttonDark: "pixso-game-settings-button-dark",
  buttonGold: "pixso-game-settings-button-gold",
  buttonDanger: "pixso-game-settings-button-danger",
});

const SETTINGS_LAYOUT = Object.freeze({
  panel: Object.freeze({ x: 960, y: 586, width: 1115, height: 688 }),
  titlePlaque: Object.freeze({ x: 960, y: 290, width: 347, height: 93 }),
  title: Object.freeze({ x: 960, y: 292 }),
  subtitle: Object.freeze({ x: 960, y: 351 }),
  close: Object.freeze({ x: 1468, y: 278, width: 70, height: 72 }),
  buttonStartY: 414,
  buttonGap: 75,
  noticeY: 865,
});

const BUTTON_ASSETS = Object.freeze({
  dark: Object.freeze({ key: GAME_SETTINGS_ASSETS.buttonDark, width: 411, height: 68, text: "#e8d2a5" }),
  gold: Object.freeze({ key: GAME_SETTINGS_ASSETS.buttonGold, width: 411, height: 69, text: "#f6e2b7" }),
  danger: Object.freeze({ key: GAME_SETTINGS_ASSETS.buttonDanger, width: 411, height: 64, text: "#f0d2ad" }),
});

const PARCHMENT_NOTICE_COLORS = Object.freeze({
  "#c3ebba": "#35663d",
  "#ffb5a2": "#923c31",
  "#f4d58c": "#81581d",
  "#d2c5aa": "#5f5242",
  "#e7aba5": "#8d4138",
});

const getParchmentNoticeColor = (color) => PARCHMENT_NOTICE_COLORS[color?.toLowerCase()] ?? color;

/** 预加载 Pixso“改版 / 游戏设置”的宣纸墨金素材。 */
export function preloadGameSettingsAssets(scene) {
  scene.load.image(GAME_SETTINGS_ASSETS.panel, `${ASSET_ROOT}/settings-panel.png`);
  scene.load.image(GAME_SETTINGS_ASSETS.titlePlaque, `${ASSET_ROOT}/title-plaque.png`);
  scene.load.image(GAME_SETTINGS_ASSETS.closeButton, `${ASSET_ROOT}/close-button.png`);
  scene.load.image(GAME_SETTINGS_ASSETS.buttonDark, `${ASSET_ROOT}/button-dark.png`);
  scene.load.image(GAME_SETTINGS_ASSETS.buttonGold, `${ASSET_ROOT}/button-gold.png`);
  scene.load.image(GAME_SETTINGS_ASSETS.buttonDanger, `${ASSET_ROOT}/button-danger.png`);
}

const createCenteredText = (scene, x, y, value, size, color, width, extra = {}) => {
  const text = addText(scene, x - width / 2, y, value, size, color, {
    fontFamily: UI_FONT,
    align: "center",
    strokeThickness: 0,
    ...extra,
  });
  text.setFixedSize(width, 0).setOrigin(0, 0.5);
  return text;
};

/**
 * 游戏设置专用的 Pixso 视觉组件。
 *
 * 组件只绘制按钮、转发点击并显示调用方传入的状态文字；全屏、资料导入导出、
 * 保存和场景跳转仍由各场景现有方法与 core 服务负责。
 */
export class GameSettingsDialog {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.noticeText = null;
    this.options = null;
    this.isOpen = false;
  }

  open(options = {}) {
    if (this.isOpen) return this;
    this.options = options;
    this.isOpen = true;

    const depth = options.depth ?? 2500;
    this.root = this.scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setAlpha(0);

    const blocker = this.scene.add.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, options.overlayAlpha ?? 0.66)
      .setOrigin(0)
      .setInteractive();
    blocker.on("pointerdown", () => {});
    this.root.add(blocker);

    const { panel, titlePlaque, close, title, subtitle } = SETTINGS_LAYOUT;
    this.root.add(this.scene.add.image(panel.x, panel.y, GAME_SETTINGS_ASSETS.panel)
      .setDisplaySize(panel.width, panel.height));
    this.root.add(this.scene.add.image(titlePlaque.x, titlePlaque.y, GAME_SETTINGS_ASSETS.titlePlaque)
      .setDisplaySize(titlePlaque.width, titlePlaque.height));

    this.root.add(addText(this.scene, title.x, title.y, options.title ?? "游戏设置", options.titleSize ?? 38, "#8a591c", {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      strokeThickness: 0,
    }));
    this.root.add(createCenteredText(
      this.scene,
      subtitle.x,
      subtitle.y,
      options.subtitle ?? "全屏、存档与两台电脑的数据同步",
      options.subtitleSize ?? 17,
      "#47392b",
      760,
    ));

    (options.buttons ?? []).forEach((button, index) => this.createButton(button, index));

    this.noticeText = createCenteredText(
      this.scene,
      960,
      options.noticeY ?? SETTINGS_LAYOUT.noticeY,
      options.notice ?? "",
      options.noticeSize ?? 16,
      options.noticeColor ?? "#315f3b",
      820,
      { wordWrap: { width: 820 } },
    );
    this.root.add(this.noticeText);

    const closeImage = this.scene.add.image(close.x, close.y, GAME_SETTINGS_ASSETS.closeButton)
      .setDisplaySize(close.width, close.height)
      .setInteractive({ useHandCursor: true });
    closeImage.on("pointerover", () => closeImage.setTint(0xffe3a2));
    closeImage.on("pointerout", () => closeImage.clearTint());
    closeImage.on("pointerdown", () => {
      playUiClickSound(this.scene);
      this.close();
    });
    this.root.add(closeImage);

    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 180, ease: "Sine.Out" });
    return this;
  }

  createButton(button, index) {
    const variant = BUTTON_ASSETS[button.variant] || BUTTON_ASSETS.dark;
    const hoverVariant = button.hoverVariant
      ? BUTTON_ASSETS[button.hoverVariant]
      : (button.variant === "dark" ? BUTTON_ASSETS.gold : null);
    const x = button.x ?? 960;
    const y = button.y ?? (SETTINGS_LAYOUT.buttonStartY + index * SETTINGS_LAYOUT.buttonGap);
    const baseTextColor = button.color ?? variant.text;
    const image = this.scene.add.image(x, y, variant.key)
      .setDisplaySize(button.width ?? variant.width, button.height ?? variant.height)
      .setInteractive({ useHandCursor: true });
    const label = addText(this.scene, x, y, button.label ?? "确认", button.size ?? 23, baseTextColor, {
      origin: 0.5,
      fontFamily: UI_FONT,
      stroke: "#26190e",
      strokeThickness: 1,
    });

    image.on("pointerover", () => {
      if (hoverVariant) {
        image.setTexture(hoverVariant.key)
          .setDisplaySize(button.width ?? hoverVariant.width, button.height ?? hoverVariant.height);
        label.setColor(button.hoverColor ?? hoverVariant.text);
        return;
      }
      image.setTint(0xffedc2);
    });
    image.on("pointerout", () => {
      image.clearTint();
      if (!hoverVariant) return;
      image.setTexture(variant.key)
        .setDisplaySize(button.width ?? variant.width, button.height ?? variant.height);
      label.setColor(baseTextColor);
    });
    image.on("pointerdown", () => {
      playUiClickSound(this.scene);
      button.onClick?.(this);
    });
    this.root.add([image, label]);
  }

  setNotice(message = "", color = "#315f3b") {
    this.noticeText?.setText(message).setColor(getParchmentNoticeColor(color));
    return this;
  }

  close({ immediate = false } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    const finish = () => {
      this.root?.destroy(true);
      this.root = null;
      this.noticeText = null;
      const onClose = this.options?.onClose;
      this.options = null;
      onClose?.();
    };

    if (immediate) {
      finish();
      return;
    }
    this.root?.list?.forEach((child) => child.disableInteractive?.());
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 140, ease: "Sine.In", onComplete: finish });
  }

  destroy() {
    this.close({ immediate: true });
  }
}

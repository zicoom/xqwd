import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const RESULT_ASSET_ROOT = "./public/assets/images/battle/result-dialog";
const RESULT_TITLE_FONT = '"SJ yuantijian-C-Regular", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const RESULT_BODY_FONT = '"Noto Sans SC Battle Popup", "Noto Sans SC", "Microsoft YaHei", sans-serif';

/**
 * 预加载 Pixso“新战斗界面-弹窗”使用的四张无字素材。
 * BattleScene 仍负责 Phaser 资源生命周期，组件只公开稳定纹理键。
 */
export function preloadBattleResultDialogAssets(scene) {
  scene.load.image("battle-result-panel", `${RESULT_ASSET_ROOT}/result-panel.png`);
  scene.load.image("battle-result-title-plaque", `${RESULT_ASSET_ROOT}/result-title-plaque.png`);
  scene.load.image("battle-result-primary-button", `${RESULT_ASSET_ROOT}/result-primary-button.png`);
  scene.load.image("battle-result-divider", `${RESULT_ASSET_ROOT}/result-divider.png`);
}

/**
 * 战斗胜利结果弹窗。
 *
 * 本组件只负责 Pixso 视觉、点击和淡入淡出。战斗胜负、奖励入账、状态恢复与
 * 场景跳转仍由 CombatEngine、BattleRewardService 和 BattleScene 负责。
 */
export class BattleResultDialog {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.root = null;
    this.options = null;
    this.confirmButton = null;
  }

  open(options = {}) {
    if (this.isOpen) return this;
    this.isOpen = true;
    this.options = options;

    const depth = options.depth ?? 2500;
    this.root = this.scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setAlpha(0);

    // Pixso 节点 69:245：全屏半透明黑色遮罩，同时吸收弹窗以外的点击。
    const overlay = this.scene.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.5)
      .setOrigin(0)
      .setInteractive();
    overlay.on("pointerdown", () => {});

    // 以下坐标和尺寸均直接来自 1920×1080 Pixso 画板节点 69:170。
    const panel = this.scene.add.image(612, 276, "battle-result-panel").setOrigin(0).setDisplaySize(696, 528);
    const titlePlaque = this.scene.add.image(753, 257.963, "battle-result-title-plaque").setOrigin(0).setDisplaySize(414, 90);
    const divider = this.scene.add.image(701, 502.631, "battle-result-divider").setOrigin(0).setDisplaySize(518, 23);
    this.confirmButton = this.scene.add.image(795.5, 641, "battle-result-primary-button")
      .setOrigin(0)
      .setDisplaySize(329, 76)
      .setInteractive({ useHandCursor: true });

    const title = this.createCenteredText(960, 302, options.title || "战斗胜利", 520, 36, "#f1d47d", {
      fontFamily: RESULT_TITLE_FONT,
    });
    const summary = this.createCenteredText(960, 432, options.summary || "战斗已经结束", 560, 28, "#f8f0d8", {
      fontFamily: RESULT_BODY_FONT,
    });
    const message = this.createCenteredText(960, 558, options.message || "", 540, 22, "#f8f0d8", {
      fontFamily: RESULT_BODY_FONT,
      wordWrap: { width: 540, useAdvancedWrap: true },
      lineSpacing: 7,
    });
    const buttonLabel = this.createCenteredText(960, 681, options.buttonLabel || "确认", 300, 28, "#f1d47d", {
      fontFamily: RESULT_TITLE_FONT,
    });
    const notice = this.createCenteredText(960, 742, options.notice || "Enter 确认", 620, 16, "#f8f0d8", {
      fontFamily: RESULT_BODY_FONT,
    }).setAlpha(0.5);

    this.root.add([
      overlay,
      panel,
      titlePlaque,
      divider,
      this.confirmButton,
      title,
      summary,
      message,
      buttonLabel,
      notice,
    ]);

    this.confirmButton.on("pointerover", () => {
      this.confirmButton?.setAlpha(0.9);
      buttonLabel.setColor("#ffe9a5");
    });
    this.confirmButton.on("pointerout", () => {
      this.confirmButton?.setAlpha(1);
      buttonLabel.setColor("#f1d47d");
    });
    this.confirmButton.on("pointerdown", () => {
      playUiClickSound(this.scene);
      options.onConfirm?.();
    });

    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 160, ease: "Sine.Out" });
    return this;
  }

  createCenteredText(x, y, value, width, size, color, style = {}) {
    const text = addText(this.scene, x - width / 2, y, value, size, color, {
      align: "center",
      strokeThickness: 0,
      ...style,
    });
    text.setFixedSize(width, 0);
    text.setOrigin(0, 0.5);
    return text;
  }

  close({ immediate = false } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.confirmButton?.disableInteractive();
    if (immediate) {
      this.destroyObjects();
      return;
    }
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 130,
      ease: "Sine.In",
      onComplete: () => this.destroyObjects(),
    });
  }

  destroyObjects() {
    this.root?.destroy(true);
    this.root = null;
    this.confirmButton = null;
    const onClose = this.options?.onClose;
    this.options = null;
    onClose?.();
  }

  destroy() {
    this.close({ immediate: true });
  }
}

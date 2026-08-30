import { addText, playUiClickSound } from "../../utils/UiHelpers.js";
import {
  createFurnaceCardView,
  FURNACE_CARD_SIZE,
  preloadFurnaceCardAssets,
} from "./FurnaceCardView.js";

const ASSET_ROOT = "./public/assets/images/pixso/alchemy/furnace-picker";
const TITLE_FONT = '"SJ yuantijian-C", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const BODY_FONT = '"Noto Sans SC Battle Popup", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const BUTTON_FONT = '"SJ yuantijian-Z", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';

const CARD_LAYOUT = Object.freeze({
  firstX: 217.684,
  top: 378.542,
  width: FURNACE_CARD_SIZE.width,
  height: FURNACE_CARD_SIZE.height,
  gap: 25.158,
});

/**
 * 预加载 Pixso“炼丹房-选择凡炉”使用的无字底板和五种丹炉素材。
 * SectScene 负责资源生命周期，本组件只公开稳定纹理键。
 */
export function preloadFurnacePickerAssets(scene) {
  preloadFurnaceCardAssets(scene);
  const assets = {
    "alchemy-furnace-picker-panel": "picker-panel.png",
    "alchemy-furnace-picker-cancel": "picker-cancel-button.png",
    "alchemy-furnace-picker-close": "picker-close-button.png",
  };
  Object.entries(assets).forEach(([textureKey, fileName]) => {
    scene.load.image(textureKey, `${ASSET_ROOT}/${fileName}`);
  });
}

/**
 * 丹炉选择弹窗。
 *
 * 这里只消费 AlchemyService 返回的普通炉体数据并负责显示、悬停和点击。丹炉是否合法、
 * 加成数值、当前选择与存档仍由 AlchemyService 统一处理，弹窗不会直接读写游戏状态。
 */
export class FurnacePickerDialog {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.options = null;
    this.isOpen = false;
    this.interactiveObjects = [];
  }

  open(options = {}) {
    if (this.isOpen) return this;
    this.isOpen = true;
    this.options = options;
    this.root = this.scene.add.container(0, 0)
      .setDepth(options.depth ?? 1200)
      .setScrollFactor(0)
      .setAlpha(0);

    // Pixso 节点 70:219：半透明遮罩只阻断下层输入，不负责业务取消。
    const overlay = this.scene.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.5)
      .setOrigin(0)
      .setInteractive();
    overlay.on("pointerdown", () => {});

    // 以下坐标和尺寸均来自 1920×1080 Pixso 画板 70:1。
    const panel = this.scene.add.image(135, 139.994, "alchemy-furnace-picker-panel")
      .setOrigin(0)
      .setDisplaySize(1650, 800);
    const title = addText(this.scene, 960, 259.75, "择一座丹炉", 40, "#ddac4f", {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      strokeThickness: 1,
      stroke: "#000000",
    });
    const subtitle = addText(this.scene, 960, 312.86,
      options.subtitle || "不同丹炉会改变成丹与额外产出，不会消耗背包物品",
      16, "#f8f0d8", {
        origin: 0.5,
        fontFamily: BODY_FONT,
        strokeThickness: 1,
        stroke: "#000000",
      });

    this.root.add([overlay, panel, title, subtitle]);
    (Array.isArray(options.furnaces) ? options.furnaces : []).slice(0, 5)
      .forEach((furnace, index) => this.drawFurnaceCard(furnace, index));

    const cancelButton = this.scene.add.image(785.5, 888.994, "alchemy-furnace-picker-cancel")
      .setOrigin(0)
      .setDisplaySize(349, 81)
      .setInteractive({ useHandCursor: true });
    const cancelLabel = addText(this.scene, 960, 929.49, "取消", 30, "#e7c977", {
      origin: 0.5,
      fontFamily: BUTTON_FONT,
      strokeThickness: 1,
      stroke: "#000000",
    });
    const closeButton = this.scene.add.image(1717.392, 127, "alchemy-furnace-picker-close")
      .setOrigin(0)
      .setDisplaySize(78, 78)
      .setInteractive({ useHandCursor: true });
    this.root.add([cancelButton, cancelLabel, closeButton]);
    this.interactiveObjects.push(cancelButton, closeButton);

    this.bindDismissButton(cancelButton, cancelLabel);
    this.bindDismissButton(closeButton);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 120, ease: "Sine.Out" });
    return this;
  }

  drawFurnaceCard(furnace, index) {
    const left = CARD_LAYOUT.firstX + index * (CARD_LAYOUT.width + CARD_LAYOUT.gap);
    const top = CARD_LAYOUT.top;
    const view = createFurnaceCardView(this.scene, furnace, {
      x: left,
      y: top,
      interactive: true,
    });
    this.root.add(view.root);
    const { hit } = view;
    this.interactiveObjects.push(hit);
    hit.on("pointerdown", () => {
      playUiClickSound(this.scene);
      const onSelect = this.options?.onSelect;
      this.close({ immediate: true });
      onSelect?.(furnace.id);
    });
  }

  bindDismissButton(button, label = null) {
    button.on("pointerover", () => {
      button.setAlpha(0.88);
      label?.setColor("#ffe29a");
    });
    button.on("pointerout", () => {
      button.setAlpha(1);
      label?.setColor("#e7c977");
    });
    button.on("pointerdown", () => {
      playUiClickSound(this.scene);
      const onCancel = this.options?.onCancel;
      this.close({ immediate: true });
      onCancel?.();
    });
  }

  close({ immediate = true } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.interactiveObjects.forEach((object) => object?.disableInteractive?.());
    if (immediate) {
      this.destroyObjects();
      return;
    }
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: 100,
      ease: "Sine.In",
      onComplete: () => this.destroyObjects(),
    });
  }

  destroyObjects() {
    this.root?.destroy(true);
    this.root = null;
    this.options = null;
    this.interactiveObjects = [];
  }

  destroy() {
    this.close({ immediate: true });
  }
}

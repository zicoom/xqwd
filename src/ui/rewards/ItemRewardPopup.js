import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

/** 通用“获得物品”弹窗。只负责显示，奖励结算必须由领域服务完成。 */
export class ItemRewardPopup {
  constructor(scene) {
    this.scene = scene;
    this.layer = scene.add.container(0, 0).setScrollFactor(0).setDepth(2600).setVisible(false);
    const shade = scene.add.rectangle(0, 0, 1920, 1080, 0x09120f, 0.7).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    const panel = scene.add.rectangle(960, 540, 1040, 400, 0x0d1a20, 0.98)
      .setStrokeStyle(2, 0x997540);
    this.title = addText(scene, 960, 385, "获得物品", 38, "#f4cb62", { origin: 0.5, strokeThickness: 2 });
    const card = scene.add.rectangle(960, 535, 150, 170, 0x3c4042, 1).setStrokeStyle(2, 0xa9a5a0);
    this.icon = scene.add.image(960, 515, "__WHITE").setDisplaySize(88, 88);
    this.quantity = addText(scene, 1018, 460, "1", 21, "#ffffff", { origin: 0.5, strokeThickness: 2 });
    this.itemName = addText(scene, 960, 603, "", 19, "#f5ede0", { origin: 0.5, strokeThickness: 1 });
    this.hint = addText(scene, 960, 688, "点击任意位置关闭", 18, "#9da7a5", { origin: 0.5, strokeThickness: 0 });
    this.layer.add([shade, panel, this.title, card, this.icon, this.quantity, this.itemName, this.hint]);
    shade.on("pointerdown", (_pointer, _localX, _localY, event) => {
      event?.stopPropagation?.();
      playUiClickSound(scene);
      this.hide();
    });
  }

  get visible() { return Boolean(this.layer.visible); }

  show(item, quantity = 1) {
    const texture = item?.texture && this.scene.textures.exists(item.texture) ? item.texture : "__WHITE";
    this.icon.setTexture(texture).setDisplaySize(88, 88).setTint(texture === "__WHITE" ? 0xb58b45 : 0xffffff);
    this.quantity.setText(String(Math.max(1, Number(quantity) || 1)));
    this.itemName.setText(item?.name || "未知物品");
    this.layer.setVisible(true);
  }

  /** 多种奖励按顺序展示；玩家关闭当前卡片后自动显示下一种。 */
  showMany(entries = []) {
    this.queue = entries.filter((entry) => entry?.item && Number(entry.quantity) > 0).map((entry) => ({ ...entry }));
    const first = this.queue.shift();
    if (first) this.show(first.item, first.quantity);
  }

  hide() {
    const next = this.queue?.shift?.();
    if (next) {
      this.show(next.item, next.quantity);
      return;
    }
    this.queue = [];
    this.layer.setVisible(false);
  }
}

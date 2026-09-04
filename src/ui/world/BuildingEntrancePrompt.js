import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

/** 地图上所有可交互建筑共用的“进入”按钮；按钮跟随建筑世界坐标。 */
export class BuildingEntrancePrompt {
  constructor(scene, onEnter) {
    this.scene = scene;
    this.onEnter = onEnter;
    this.entry = null;
    this.layer = scene.add.container(0, 0).setDepth(1450).setVisible(false);
    this.buttonGraphics = scene.add.graphics();
    this.drawButton(false);
    const hitArea = scene.add.zone(0, 0, 128, 58).setInteractive({ useHandCursor: true });
    const label = addText(scene, 0, -1, "进入", 24, "#f6cb62", { strokeThickness: 1 })
      .setOrigin(0.5, 0.5);
    this.layer.add([this.buttonGraphics, label, hitArea]);
    hitArea.on("pointerover", () => this.drawButton(true));
    hitArea.on("pointerout", () => this.drawButton(false));
    hitArea.on("pointerdown", (_pointer, _localX, _localY, event) => {
      event?.stopPropagation?.();
      if (!this.entry) return;
      playUiClickSound(scene);
      this.onEnter(this.entry);
    });
  }

  drawButton(hovered) {
    const graphics = this.buttonGraphics;
    graphics.clear();
    graphics.fillStyle(0x20150f, 0.32);
    graphics.fillRoundedRect(-65, -26, 130, 60, 11);
    graphics.fillStyle(hovered ? 0x71472b : 0x56351f, 0.98);
    graphics.fillRoundedRect(-64, -30, 128, 58, 10);
    graphics.lineStyle(1.5, hovered ? 0xc59a5d : 0x8f6a42, 0.95);
    graphics.strokeRoundedRect(-64, -30, 128, 58, 10);
    graphics.lineStyle(1, 0xd5aa67, 0.28);
    graphics.strokeRoundedRect(-60, -26, 120, 50, 8);
  }

  get visible() { return Boolean(this.layer.visible); }

  show({ entry, x = entry?.buildingObject?.x, y }) {
    this.entry = entry;
    this.layer.setPosition(x, y).setVisible(true);
  }

  hide() {
    this.entry = null;
    this.layer.setVisible(false);
  }
}

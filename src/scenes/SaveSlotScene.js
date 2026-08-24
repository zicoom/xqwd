import { deleteSaveSlot, getSaveSlots, loadFirstChapterProgress, MAX_SAVE_SLOTS } from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addButton, addText } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";

/**
 * 角色档案选择场景。
 * 固定显示 5 个档案位：空白档案位创建角色，已有档案位可以进入或删除。
 */
export class SaveSlotScene extends Phaser.Scene {
  constructor() { super(SceneKeys.SLOT_SELECT); }

  create() {
    configureFullHdScene(this);
    // 封面场景已经加载过这张图，Phaser 会把它保留为全局资源，可直接复用。
    this.add.image(960, 540, "xuanqiong-wendao-cover").setDisplaySize(1920, 1080);
    this.add.rectangle(960, 540, 1920, 1080, 0x071117, 0.58);
    addText(this, 960, 123, "选 择 角 色", 57, "#ffe5a3", { origin: 0.5, fontStyle: "bold", strokeThickness: 11 });
    addText(this, 960, 195, `可创建 ${MAX_SAVE_SLOTS} 位角色 · 选择空白档案即可新建`, 26, "#f5ead4", { origin: 0.5 });

    const slots = getSaveSlots();
    const startX = 233;
    const gap = 363;
    slots.forEach((slot, index) => this.createSlotCard(startX + index * gap, 585, index, slot));
    addButton(this, 150, 1013, 195, "返回封面", () => this.scene.start(SceneKeys.COVER), { height: 63, size: 24 });
  }

  /** 绘制一个角色档案卡片。 */
  createSlotCard(x, y, index, slot) {
    const hasCharacter = Boolean(slot?.player?.roots);
    const color = hasCharacter ? 0x1b2c2d : 0xddd9dc;
    const borderColor = hasCharacter ? 0xd8b66c : 0xa8a3a7;
    const card = this.add.rectangle(x, y, 308, 525, color, 0.95).setStrokeStyle(5, borderColor);

    if (!hasCharacter) {
      card.setInteractive({ useHandCursor: true });
      this.add.text(x, y - 72, "＋", { fontSize: "108px", color: "#817c82" }).setOrigin(0.5);
      addText(this, x, y + 57, "新建角色", 32, "#6f6870", { origin: 0.5, strokeThickness: 0 });
      addText(this, x, y + 117, `档案位 ${index + 1}`, 23, "#8c848b", { origin: 0.5, strokeThickness: 0 });
      card.on("pointerdown", () => this.createNewCharacter(index));
      return;
    }

    // 暂时使用简洁的人物剪影；后续接入立绘选择后，这里会显示玩家自己选定的外观。
    this.add.circle(x, y - 158, 63, 0xdcc8a7).setStrokeStyle(5, 0xb89962);
    this.add.triangle(x, y - 80, x - 65, y - 9, x + 65, y - 9, x, y - 117, slot.player.gender === "女" ? 0x80538b : 0x385f82);
    addText(this, x, y + 3, slot.player.name, 35, "#fff1c8", { origin: 0.5 });
    addText(this, x, y + 59, slot.player.realm, 26, "#cfe1d3", { origin: 0.5 });
    addText(this, x, y + 108, `主灵根：${slot.player.selectedElement || "未定"}`, 23, "#dfe9cb", { origin: 0.5 });
    addText(this, x, y + 150, slot.chapter?.eliteDefeated ? "进度：第一章已完成" : "进度：青云山探索中", 21, "#d1d9ca", { origin: 0.5 });
    addButton(this, x, y + 218, 225, "进入游戏", () => this.enterSlot(index), { height: 63, size: 24 });
    addButton(this, x, y + 288, 225, "删除角色", () => this.deleteSlot(index, slot.player.name), { height: 57, size: 23 });
  }

  /** 进入一个已有角色。 */
  enterSlot(index) {
    if (loadFirstChapterProgress(index)) this.scene.start(SceneKeys.VILLAGE);
  }

  /** 创建新角色；只有角色创建完成后才会真正占用这个档案位。 */
  createNewCharacter(index) {
    this.scene.start(SceneKeys.CREATE, { newCharacter: true, slotIndex: index });
  }

  /** 删除前使用浏览器确认框，避免误触导致角色档案丢失。 */
  deleteSlot(index, name) {
    if (!window.confirm(`确定删除角色“${name}”吗？删除后无法恢复。`)) return;
    if (deleteSaveSlot(index)) this.scene.restart();
  }
}

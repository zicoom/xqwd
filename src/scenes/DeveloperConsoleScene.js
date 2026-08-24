import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addButton, addText, addTitle } from "../utils/UiHelpers.js";

/**
 * 开发者控制台第一版。
 * 目前只放已经真正可以使用的两个工具，避免出现大量“点了没有实际功能”的按钮。
 * 后续完成 NPC、建筑等编辑器后，再逐个增加到这个界面。
 */
export class DeveloperConsoleScene extends Phaser.Scene {
  constructor() { super(SceneKeys.DEVELOPER_CONSOLE); }

  create() {
    rememberEditorRoute(SceneKeys.DEVELOPER_CONSOLE);
    this.add.rectangle(960, 540, 1920, 1080, 0x10182b);
    addTitle(this, "玄穹问道 · 控制台", "选择一个编辑工具；保存后会立刻在游戏中生效");

    // 控制台中的模板都会保存到浏览器本地，地图和游戏 UI 会读取同一份资料。
    this.createToolCard(525, 310, "🧪", "物品管理编辑器", "灵草、丹药、功法、装备：品阶、图标、价格、库存与使用效果。", () => {
      this.scene.start(SceneKeys.ITEM_EDITOR);
    });
    this.createToolCard(1395, 310, "🐺", "怪物编辑器", "名称、品阶、属性、技能、图片、音效、掉落。", () => {
      this.scene.start(SceneKeys.MONSTER_EDITOR);
    });
    this.createToolCard(525, 585, "👤", "NPC 编辑器", "名称、立绘与多句对话。", () => {
      this.scene.start(SceneKeys.NPC_EDITOR);
    });
    this.createToolCard(1395, 585, "🏯", "建筑编辑器", "建筑名称、类型、阻挡与交互说明。", () => {
      this.scene.start(SceneKeys.BUILDING_EDITOR);
    });
    this.createToolCard(960, 845, "🗺", "地图编辑器", "选择已有模板，并放置 NPC、怪物、建筑、传送点。", () => {
      this.scene.start(SceneKeys.MAP_EDITOR);
    });
    addButton(this, 960, 1015, 285, "返回游戏封面", () => this.scene.start(SceneKeys.COVER), { height: 54, size: 24 });
  }

  /** 创建一个醒目的工具卡片，整个卡片区域都可以点击。 */
  createToolCard(x, y, icon, title, detail, onClick) {
    const card = this.add.rectangle(x, y, 750, 255, 0x20384a, 0.98)
      .setStrokeStyle(5, 0x7eb08c)
      .setInteractive({ useHandCursor: true });
    const iconText = addText(this, x - 285, y - 45, icon, 54, "#ffffff", { origin: 0.5 });
    const titleText = addText(this, x - 188, y - 57, title, 38, "#ffe2a0", { origin: 0.5 });
    const detailText = addText(this, x - 188, y + 6, detail, 23, "#dce8e3", { wordWrap: { width: 390 } });
    const enterText = addText(this, x + 255, y + 68, "点击进入", 24, "#aee0af", { origin: 0.5 });
    card.on("pointerover", () => {
      card.setFillStyle(0x315269);
      enterText.setColor("#fff0ba");
    });
    card.on("pointerout", () => {
      card.setFillStyle(0x20384a);
      enterText.setColor("#aee0af");
    });
    card.on("pointerdown", onClick);
    // 文字也放入同样的点击区域，视觉上它们属于一个完整按钮。
    [iconText, titleText, detailText, enterText].forEach((item) => item.setInteractive({ useHandCursor: true }).on("pointerdown", onClick));
  }
}

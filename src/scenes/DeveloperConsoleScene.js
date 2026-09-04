import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { rememberSceneRoute } from "../core/SceneResumeState.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";

const TOOL_CARDS = Object.freeze([
  { seal: "物", title: "物品编辑", detail: "丹药、材料、装备与效果", sceneKey: SceneKeys.ITEM_EDITOR },
  { seal: "怪", title: "怪物编辑", detail: "属性、技能、掉落与战斗资源", sceneKey: SceneKeys.MONSTER_EDITOR },
  { seal: "人", title: "NPC 编辑", detail: "立绘、对话与人物资料", sceneKey: SceneKeys.NPC_EDITOR },
  { seal: "建", title: "建筑编辑", detail: "建筑类型、阻挡与交互", sceneKey: SceneKeys.BUILDING_EDITOR },
  { seal: "图", title: "地图编辑", detail: "摆放模板、传送点与区域", sceneKey: SceneKeys.MAP_EDITOR },
  { seal: "采", title: "采收资源", detail: "灵草、矿脉、刷新与掉落" },
  { seal: "宗", title: "门派编辑", detail: "宗门成员、建筑与势力关系" },
  { seal: "任", title: "任务编辑", detail: "章节、条件、分支与奖励" },
  { seal: "术", title: "法术编辑", detail: "属性、消耗、冷却与特效" },
  { seal: "功", title: "功法编辑", detail: "层级、条件与修炼效果" },
  { seal: "宝", title: "法宝编辑", detail: "器灵、祭炼与专属技能" },
  { seal: "丹", title: "丹方编辑", detail: "材料、成功率与产物" },
  { seal: "景", title: "场景编辑", detail: "洞府、城镇与室内场景" },
  { seal: "境", title: "秘境编辑", detail: "节点、事件、奖励与离场" },
  { seal: "兽", title: "灵兽编辑", detail: "血脉、成长与出战技能" },
  { seal: "阵", title: "Buff / 阵法", detail: "增减益、持续与叠加规则" },
]);

const CARD_WIDTH = 405;
const CARD_HEIGHT = 142;
const CARD_COLUMNS = 4;
const CARD_FIRST_X = 310;
const CARD_FIRST_Y = 315;
const CARD_GAP_X = 430;
const CARD_GAP_Y = 165;

/**
 * 开发者控制台。
 *
 * 这是所有内容工具的导航页，只维护入口排版和点击反馈；各项数据规则仍然归各自的
 * 编辑器、领域服务与存储模块所有。16 个固定卡位为后续系统预留，新增编辑器时只需
 * 把对应卡片接到新的 SceneKey，不会破坏现有布局。
 */
export class DeveloperConsoleScene extends Phaser.Scene {
  constructor() { super(SceneKeys.DEVELOPER_CONSOLE); }

  create() {
    rememberEditorRoute(SceneKeys.DEVELOPER_CONSOLE);
    configureFullHdScene(this);
    this.createBackground();
    this.createHeader();
    this.createEditorGrid();
    this.createFooter();
  }

  createBackground() {
    this.add.rectangle(960, 540, 1920, 1080, 0x0d1720);
    this.add.rectangle(960, 88, 1920, 176, 0x13282a, 1);
    this.add.rectangle(960, 176, 1920, 1, 0x9e8250, 0.72);

    const lines = this.add.graphics();
    lines.lineStyle(1, 0x42645e, 0.2);
    for (let x = 100; x <= 1820; x += 215) lines.lineBetween(x, 210, x, 920);
    for (let y = 230; y <= 890; y += 165) lines.lineBetween(100, y, 1820, y);
  }

  createHeader() {
    addText(this, 960, 61, "玄穹问道 · 编辑器总览", 42, "#f2cd80", {
      fontStyle: "bold",
      strokeThickness: 2,
    }).setOrigin(0.5);
    addText(this, 960, 113, "内容模板与世界配置统一保存；启用后的修改会在游戏中立即生效", 20, "#cad9c8", {
      strokeThickness: 0,
    }).setOrigin(0.5);

    addText(this, 108, 214, "编辑器模块", 24, "#ebd19b", { fontStyle: "bold", strokeThickness: 0 }).setOrigin(0, 0.5);
    addText(this, 1812, 214, "5 已开放   ·   11 筹备中", 18, "#9fb8ab", { strokeThickness: 0 }).setOrigin(1, 0.5);
    const rule = this.add.graphics();
    rule.lineStyle(1, 0x8e7850, 0.62);
    rule.lineBetween(108, 240, 1812, 240);
  }

  createEditorGrid() {
    TOOL_CARDS.forEach((tool, index) => {
      const column = index % CARD_COLUMNS;
      const row = Math.floor(index / CARD_COLUMNS);
      this.createToolCard(
        CARD_FIRST_X + column * CARD_GAP_X,
        CARD_FIRST_Y + row * CARD_GAP_Y,
        tool,
      );
    });
  }

  createToolCard(x, y, tool) {
    const available = Boolean(tool.sceneKey);
    const card = this.add.graphics();
    const drawCard = (hovered = false) => {
      card.clear();
      card.fillStyle(available ? (hovered ? 0x294348 : 0x1b3037) : 0x15242c, available ? 0.98 : 0.84);
      card.fillRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 8);
      card.lineStyle(available ? (hovered ? 2 : 1) : 1, available ? (hovered ? 0xf0ca79 : 0xa88954) : 0x4f6765, available ? 1 : 0.72);
      card.strokeRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 8);
      card.fillStyle(available ? 0x385556 : 0x263b40, available ? 1 : 0.7);
      card.fillRoundedRect(x - 178, y - 42, 58, 58, 7);
    };
    drawCard();

    const seal = addText(this, x - 149, y - 13, tool.seal, 31, available ? "#f2cd80" : "#7b928d", {
      fontStyle: "bold",
      strokeThickness: 0,
    }).setOrigin(0.5);
    const title = addText(this, x - 105, y - 35, tool.title, 25, available ? "#f3d59a" : "#aab7af", {
      fontStyle: "bold",
      strokeThickness: 0,
    }).setOrigin(0, 0.5);
    const detail = addText(this, x - 105, y + 7, tool.detail, 16, available ? "#c8d5c9" : "#7f918e", {
      strokeThickness: 0,
    }).setOrigin(0, 0.5);

    const status = available ? "已开放" : "筹备中";
    const statusWidth = available ? 62 : 68;
    const chip = this.add.graphics();
    chip.fillStyle(available ? 0x3d644f : 0x34464b, available ? 0.96 : 0.75);
    chip.fillRoundedRect(x + 112, y - 47, statusWidth, 28, 14);
    const statusText = addText(this, x + 112 + statusWidth / 2, y - 33, status, 14, available ? "#d8f0c6" : "#a6b6b0", {
      strokeThickness: 0,
    }).setOrigin(0.5);
    const action = addText(this, x + 166, y + 43, available ? "进入 ›" : "预留位置", 16, available ? "#e6ca88" : "#78908b", {
      strokeThickness: 0,
    }).setOrigin(1, 0.5);

    if (!available) return;
    const hitArea = this.add.zone(x, y, CARD_WIDTH, CARD_HEIGHT).setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => {
      drawCard(true);
      action.setColor("#fff0bd");
    });
    hitArea.on("pointerout", () => {
      drawCard(false);
      action.setColor("#e6ca88");
    });
    hitArea.on("pointerdown", () => {
      playUiClickSound(this);
      this.scene.start(tool.sceneKey);
    });

    // 卡片文字属于同一个入口，文字层也接受点击，避免点到文字时误以为按钮失效。
    [seal, title, detail, statusText, action].forEach((textObject) => textObject
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playUiClickSound(this);
        this.scene.start(tool.sceneKey);
      }));
  }

  createFooter() {
    const button = this.add.graphics();
    button.fillStyle(0x3b2a1d, 0.96);
    button.fillRoundedRect(825, 974, 270, 54, 7);
    button.lineStyle(1, 0xd2a958, 1);
    button.strokeRoundedRect(825, 974, 270, 54, 7);
    const label = addText(this, 960, 1001, "返回游戏封面", 22, "#f5d993", {
      fontStyle: "bold",
      strokeThickness: 0,
    }).setOrigin(0.5);
    const hitArea = this.add.zone(960, 1001, 270, 54).setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => button.setAlpha(0.78));
    hitArea.on("pointerout", () => button.setAlpha(1));
    hitArea.on("pointerdown", () => {
      playUiClickSound(this);
      this.returnToCover();
    });
    label.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      playUiClickSound(this);
      this.returnToCover();
    });
  }

  /** 编辑器可独立刷新，返回时必须显式覆盖旧的封面子界面恢复记录。 */
  returnToCover() {
    rememberSceneRoute({ sceneKey: SceneKeys.COVER });
    this.scene.start(SceneKeys.COVER, { interfaceId: "" });
  }
}

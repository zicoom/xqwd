import { SceneKeys } from "../core/SceneKeys.js";
import { addButton, addText } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { clearEditorRoute } from "../core/EditorRoute.js";
import { XianxiaDialog } from "../ui/XianxiaDialog.js";

/**
 * 游戏封面场景。
 * 它只负责展示游戏名称和开始入口；点击“踏入仙途”后必定进入角色档案选择。
 */
export class CoverScene extends Phaser.Scene {
  constructor() { super(SceneKeys.COVER); }

  preload() {
    // 用户提供的水墨仙侠图片，作为《玄穹问道》的正式启动封面。
    // 使用已压缩的 2048 像素版本：原图超过部分显卡的安全贴图上限，
    // 会使 WebGL 出现黑屏、绿屏或只有背景色；这个版本在全屏下依然清晰且更快加载。
    this.load.image("xuanqiong-wendao-cover", "./public/assets/images/covers/xuanqiong-wendao-cover-2048.jpg");
  }

  create() {
    clearEditorRoute();
    configureFullHdScene(this);
    // 场景从角色选择页返回后会复用同一个实例，因此每次显示封面都要重置开始标记。
    this.isStarting = false;
    // 封面原图比例接近 16:9，按 Full HD 一对一铺满 1920×1080。
    this.add.image(960, 540, "xuanqiong-wendao-cover").setDisplaySize(1920, 1080);

    // 轻微暗化上半部，确保金色标题在明亮云海上仍然清楚。
    this.add.rectangle(960, 285, 1920, 570, 0x08151c, 0.28);
    this.add.rectangle(960, 930, 1920, 300, 0x071117, 0.42);

    addText(this, 960, 218, "玄 穹 问 道", 87, "#ffe5a3", {
      origin: 0.5,
      fontStyle: "bold",
      stroke: "#17222a",
      strokeThickness: 12,
    });
    addText(this, 960, 330, "凡尘问道，逆天而行", 33, "#f7ead0", { origin: 0.5 });
    addText(this, 960, 822, "第一章 · 青云山的古玉", 30, "#fff0c8", { origin: 0.5 });

    // 封面主菜单固定为三个入口，布局与用户提供的参考图一致。
    addButton(this, 585, 938, 315, "踏 入 仙 途", () => this.startGame(), { height: 87, size: 35 });
    addButton(this, 960, 938, 255, "设 置", () => this.showSettings(), { height: 87, size: 35 });
    // 开发者控制台是全部编辑器的总入口；地图编辑器、怪物编辑器等都在其中统一管理。
    addButton(this, 1335, 938, 315, "控 制 台", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), { height: 87, size: 35 });
    addText(this, 960, 1028, "点击“踏入仙途”后：选择已有角色，或创建新角色。", 23, "#dce5d5", { origin: 0.5 });

    this.input.keyboard.once("keydown-ENTER", () => this.startGame());
  }

  /** 防止按钮和 Enter 在同一瞬间重复切换场景。 */
  startGame() {
    if (this.isStarting) return;
    this.isStarting = true;
    // 这是玩家主动从封面点击进入游戏：始终先展示五个档案位，
    // 让玩家自行决定继续哪位角色或点击空位创建角色。
    // BootScene 只用于网页刷新后的自动续玩，两种入口职责明确分开。
    this.scene.start(SceneKeys.SLOT_SELECT);
  }

  /** 显示基础设置说明；完整的音量、画面和按键设置将在设置系统阶段继续扩展。 */
  showSettings() {
    if (this.settingsPanel) return;
    // 封面与游戏内设置共享同一套 XianxiaDialog，保证玩家从启动到游戏中的视觉一致性。
    this.settingsDialog = new XianxiaDialog(this);
    this.settingsPanel = this.settingsDialog;
    this.settingsDialog.open({
      title: "设置",
      subtitle: "基础画面与操作说明",
      body: "画面：高清渲染已开启\n全屏：可在游戏内设置中一键开启\n存档：角色创建后会自动保存",
      width: 720,
      height: 420,
      bodyY: -28,
      buttons: [{ label: "知 晓", variant: "primary", y: 130, onClick: () => this.settingsDialog?.close() }],
      onClose: () => {
        this.settingsDialog = null;
        this.settingsPanel = null;
      },
    });
  }

}

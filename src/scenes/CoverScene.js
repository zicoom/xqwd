import { SceneKeys } from "../core/SceneKeys.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { clearEditorRoute } from "../core/EditorRoute.js";
import { XianxiaDialog } from "../ui/XianxiaDialog.js";
import { PLAYER_PORTRAITS } from "../core/PortraitCatalog.js";
import { rememberSceneRoute } from "../core/SceneResumeState.js";

/**
 * 游戏封面场景。
 * 它只负责展示游戏名称和开始入口；点击“踏入仙途”后必定进入角色档案选择。
 */
export class CoverScene extends Phaser.Scene {
  constructor() { super(SceneKeys.COVER); }

  init(data) {
    this.resumeInterfaceId = data?.interfaceId || "";
  }

  preload() {
    // 用户提供的水墨仙侠图片，作为《玄穹问道》的正式启动封面。
    // 使用已压缩的 2048 像素版本：原图超过部分显卡的安全贴图上限，
    // 会使 WebGL 出现黑屏、绿屏或只有背景色；这个版本在全屏下依然清晰且更快加载。
    this.load.image("xuanqiong-wendao-cover", "./public/assets/images/covers/xuanqiong-wendao-cover-2048.jpg");
    // 角色档案、创建页面和后续地图 HUD 共用同一套立绘；封面一次预加载，页面切换时无需重复闪烁。
    PLAYER_PORTRAITS.forEach((portrait) => this.load.image(portrait.textureKey, portrait.imagePath));
  }

  create() {
    clearEditorRoute();
    rememberSceneRoute({ sceneKey: SceneKeys.COVER, interfaceId: this.resumeInterfaceId });
    configureFullHdScene(this);
    // 场景从角色选择页返回后会复用同一个实例，因此每次显示封面都要重置开始标记。
    this.isStarting = false;
    // 封面原图比例接近 16:9，按 Full HD 一对一铺满 1920×1080。
    this.add.image(960, 540, "xuanqiong-wendao-cover").setDisplaySize(1920, 1080);

    // 底部轻微压暗，保证章节与菜单可读，同时完整保留天门、云海和古树主视觉。
    this.add.rectangle(960, 930, 1920, 300, 0x071117, 0.36);

    // 标题落在天门左侧的留白处；两层文字形成稳定描边，不依赖不同浏览器的阴影算法。
    addText(this, 1395, 266, "玄穹问道", 90, "#101b22", {
      fontStyle: "bold",
      stroke: "#101b22",
      strokeThickness: 14,
    }).setOrigin(0.5);
    addText(this, 1395, 266, "玄穹问道", 90, "#ffe5a3", {
      fontStyle: "bold",
      stroke: "#17222a",
      strokeThickness: 7,
    }).setOrigin(0.5);
    const titleRule = this.add.graphics();
    titleRule.lineStyle(1, 0xe3bf6f, 0.82);
    titleRule.lineBetween(1158, 340, 1265, 340);
    titleRule.lineBetween(1525, 340, 1632, 340);
    titleRule.fillStyle(0xe3bf6f, 0.95);
    titleRule.fillCircle(1395, 340, 4);
    addText(this, 1395, 376, "凡尘问道，逆天而行", 29, "#f7ead0", { strokeThickness: 0 }).setOrigin(0.5);

    // 章节信息以独立的半透明墨色条承托，云海仍然清晰可见。
    const chapterPlate = this.add.graphics();
    chapterPlate.fillStyle(0x101713, 0.56);
    chapterPlate.fillRoundedRect(655, 782, 610, 64, 8);
    chapterPlate.lineStyle(1, 0xd7ad58, 0.72);
    chapterPlate.strokeRoundedRect(655, 782, 610, 64, 8);
    addText(this, 960, 814, "第一章 · 青云山的古玉", 28, "#fff0c8", { strokeThickness: 0 }).setOrigin(0.5);

    // 三枚主按钮统一 320×82，按钮中心、文字中心和字距共享同一套规则。
    // 标签本身不再填充空格，避免“设置”出现视觉重心偏移。
    this.createMainMenuButton(610, 925, "踏入仙途", () => this.startGame());
    this.createMainMenuButton(960, 925, "设置", () => this.showSettings());
    // 开发者控制台是全部编辑器的总入口；地图编辑器、怪物编辑器等都在其中统一管理。
    this.createMainMenuButton(1310, 925, "控制台", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE));
    addText(this, 960, 1022, "踏入仙途后，可选择已有角色或创建新角色", 22, "#e4dfc9", { strokeThickness: 0 }).setOrigin(0.5);

    this.input.keyboard.once("keydown-ENTER", () => this.startGame());
    if (this.resumeInterfaceId === "settings") this.time.delayedCall(0, () => this.showSettings());
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
    rememberSceneRoute({ sceneKey: SceneKeys.COVER, interfaceId: "settings" });
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
        rememberSceneRoute({ sceneKey: SceneKeys.COVER });
      },
    });
  }

  /**
   * 封面专用主按钮。
   * 三个按钮都以容器原点为文字和背景的共同中心，禁止再用不同宽度或手工空格定位。
   */
  createMainMenuButton(x, y, label, onClick) {
    const button = this.add.container(x, y);
    const background = this.add.graphics();
    const draw = (hovered = false) => {
      background.clear();
      background.fillStyle(hovered ? 0x5a412c : 0x34251c, 0.94);
      background.fillRoundedRect(-160, -41, 320, 82, 7);
      background.lineStyle(hovered ? 2 : 1, hovered ? 0xf2d17f : 0xd6aa54, 1);
      background.strokeRoundedRect(-160, -41, 320, 82, 7);
      background.lineStyle(1, 0xf5df9b, hovered ? 0.62 : 0.38);
      background.lineBetween(-146, -27, 146, -27);
    };
    draw();
    const text = addText(this, 0, 0, label, 34, "#ffe6a4", {
      fontStyle: "bold",
      letterSpacing: 7,
      stroke: "#211b15",
      strokeThickness: 4,
    }).setOrigin(0.5);
    const hitArea = this.add.zone(0, 0, 320, 82).setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => draw(true));
    hitArea.on("pointerout", () => draw(false));
    hitArea.on("pointerdown", () => {
      playUiClickSound(this);
      onClick();
    });
    button.add([background, text, hitArea]);
    return button;
  }

}

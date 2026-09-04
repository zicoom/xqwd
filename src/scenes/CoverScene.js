import { SceneKeys } from "../core/SceneKeys.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { clearEditorRoute } from "../core/EditorRoute.js";
import { exportLocalGameData, importLocalGameDataFromFile } from "../core/LocalDataTransfer.js";
import { rememberSceneRoute } from "../core/SceneResumeState.js";
import { CoverView, preloadCoverAssets } from "../ui/cover/CoverView.js";
import { GameSettingsDialog, preloadGameSettingsAssets } from "../ui/settings/GameSettingsDialog.js";

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
    preloadCoverAssets(this);
    preloadGameSettingsAssets(this);
  }

  create() {
    clearEditorRoute();
    rememberSceneRoute({ sceneKey: SceneKeys.COVER, interfaceId: this.resumeInterfaceId });
    configureFullHdScene(this);
    // 场景从角色选择页返回后会复用同一个实例，因此每次显示封面都要重置开始标记。
    this.isStarting = false;
    this.coverView = new CoverView(this).render({
      onStart: () => this.startGame(),
      onSettings: () => this.showSettings(),
      // 开发者控制台是全部编辑器的总入口；地图、怪物等编辑器仍在其中独立管理。
      onConsole: () => this.openDeveloperConsole(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.settingsDialog?.destroy();
      this.settingsDialog = null;
      this.settingsPanel = null;
      this.coverView?.destroy();
      this.coverView = null;
    });

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

  /** 主动进入编辑器前清掉封面子界面，防止返回时恢复已经离开的设置面板。 */
  openDeveloperConsole() {
    rememberSceneRoute({ sceneKey: SceneKeys.COVER });
    this.scene.start(SceneKeys.DEVELOPER_CONSOLE);
  }

  /** 封面与游戏内复用同一套设置组件，避免入口不同却出现两种界面。 */
  showSettings() {
    if (this.settingsPanel) return;
    rememberSceneRoute({ sceneKey: SceneKeys.COVER, interfaceId: "settings" });
    this.settingsDialog = new GameSettingsDialog(this);
    this.settingsPanel = this.settingsDialog;
    this.settingsDialog.open({
      title: "游戏设置",
      subtitle: "全屏、存档与两台电脑的数据同步",
      buttons: [
        { label: "进入全屏", variant: "dark", onClick: () => this.enterFullscreen() },
        { label: "窗口化", variant: "dark", onClick: () => this.exitFullscreen() },
        { label: "导出游戏数据", variant: "dark", hoverVariant: "gold", onClick: () => this.exportGameData() },
        { label: "导入游戏数据", variant: "dark", onClick: () => this.importGameData() },
        { label: "保存并退出到封面", variant: "dark", onClick: () => this.closeGameSettings() },
        { label: "关闭", variant: "danger", onClick: () => this.closeGameSettings() },
      ],
      onClose: () => this.resetGameSettingsDialog(),
    });
  }

  enterFullscreen() {
    if (!this.scale.isFullscreen) this.scale.startFullscreen();
    this.showSettingsNotice("已请求进入全屏；按 Esc 可退出全屏。", "#c3ebba");
  }

  exitFullscreen() {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    this.showSettingsNotice("已切换为窗口化显示。", "#c3ebba");
  }

  exportGameData() {
    const result = exportLocalGameData();
    this.showSettingsNotice(
      result.success ? `已导出 ${result.count} 项数据：请在浏览器下载列表查看。` : (result.message || "导出失败。"),
      result.success ? "#c3ebba" : "#ffb5a2",
    );
  }

  async importGameData() {
    this.showSettingsNotice("请选择另一台电脑导出的 JSON 数据备份…", "#f4d58c");
    const result = await importLocalGameDataFromFile();
    if (result.cancelled) {
      this.showSettingsNotice("已取消导入，当前资料未改变。", "#d2c5aa");
      return;
    }
    if (!result.success) {
      this.showSettingsNotice(result.message || "导入失败。", "#e7aba5");
      return;
    }
    this.showSettingsNotice(`已导入 ${result.count} 项资料，正在重新载入游戏…`, "#c3ebba");
    window.setTimeout(() => window.location.reload(), 700);
  }

  showSettingsNotice(message, color) {
    this.settingsDialog?.setNotice(message, color);
  }

  closeGameSettings() {
    this.settingsDialog?.close();
  }

  resetGameSettingsDialog() {
    this.settingsDialog = null;
    this.settingsPanel = null;
    rememberSceneRoute({ sceneKey: SceneKeys.COVER });
  }

}

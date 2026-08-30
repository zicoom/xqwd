import {
  createCurrentProgressSnapshot,
  gameState,
  restoreCurrentProgressSnapshot,
  saveFirstChapterProgress,
} from "../core/GameState.js";
import { getPlayerPortrait } from "../core/PortraitCatalog.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { clearSceneResumeRoute, rememberSectRoute } from "../core/SceneResumeState.js";
import { getSectTemplate } from "../core/SectCatalog.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { getItemTemplates } from "../core/ItemStore.js";
import { exportLocalGameData, importLocalGameDataFromFile } from "../core/LocalDataTransfer.js";
import { SaveArchiveRepository } from "../core/save/SaveArchiveRepository.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { InventoryService } from "../domain/inventory/InventoryService.js";
import { TechniqueLoadoutService } from "../domain/techniques/TechniqueLoadoutService.js";
import { SpellService } from "../domain/spells/SpellService.js";
import { ArtifactLoadoutService } from "../domain/artifacts/ArtifactLoadoutService.js";
import { CombatShortcutService } from "../domain/combat/CombatShortcutService.js";
import { SaveArchiveService } from "../domain/save/SaveArchiveService.js";
import { AlchemyService } from "../domain/alchemy/AlchemyService.js";
import { AlchemyMinigameService } from "../domain/alchemy/AlchemyMinigameService.js";
import { RetreatStudyService } from "../domain/cultivation/RetreatStudyService.js";
import { CultivationBreakthroughService } from "../domain/cultivation/CultivationBreakthroughService.js";
import { BreakthroughTrialService } from "../domain/cultivation/BreakthroughTrialService.js";
import { CultivationRetreatService } from "../domain/cultivation/CultivationRetreatService.js";
import { AlchemyRoomPanel } from "../ui/sect/AlchemyRoomPanel.js";
import { preloadAlchemyMinigameAssets } from "../ui/sect/AlchemyMinigamePanel.js";
import { preloadAlchemyResultAssets } from "../ui/sect/AlchemyResultPanel.js";
import { preloadFurnacePickerAssets } from "../ui/sect/FurnacePickerDialog.js";
import { RetreatRoomPanel, preloadRetreatRoomAssets } from "../ui/sect/RetreatRoomPanel.js";
import { SectOverviewPanel } from "../ui/sect/SectOverviewPanel.js";
import { preloadPlayerTopToolbarAssets } from "../ui/PlayerTopToolbar.js";
import { CharacterMenuPanel, preloadCharacterMenuAssets } from "../ui/character/CharacterMenuPanel.js";
import { XianxiaDialog } from "../ui/XianxiaDialog.js";

/** 门派内部总览场景；负责资源与服务装配，具体规则和绘制分别留在 domain / ui。 */
export class SectScene extends Phaser.Scene {
  constructor() { super(SceneKeys.SECT); }

  init(data) {
    this.sectId = data?.sectId || "sect:tianjian";
    this.resumeFeatureId = data?.featureId || "";
  }

  preload() {
    // 门派总览使用独立的宗门山水图；炼丹房、闭关室继续加载各自的专用背景，不能混用。
    this.load.image("sect-mountain-background", "./public/assets/images/sects/sect-tianjian-background.jpg");
    // 门派总览的雕花底板来自当前 Pixso“进入门派”画板的无字素材。
    // 文字和点击区域仍由 Phaser 单独绘制，避免把具体门派数据烘焙进图片。
    const overviewAssetRoot = "./public/assets/images/sects/overview";
    this.load.image("sect-overview-members-panel", `${overviewAssetRoot}/members-panel.png`);
    this.load.image("sect-overview-member-seal", `${overviewAssetRoot}/member-seal.png`);
    this.load.image("sect-overview-member-card", `${overviewAssetRoot}/member-card.png`);
    this.load.image("sect-overview-title-plaque", `${overviewAssetRoot}/title-plaque.png`);
    this.load.image("sect-overview-affairs-panel", `${overviewAssetRoot}/affairs-panel.png`);
    this.load.image("sect-overview-feature-panel", `${overviewAssetRoot}/feature-panel.png`);
    this.load.image("sect-overview-back-button", `${overviewAssetRoot}/back-button.png`);
    // Pixso“改版 / 炼丹房”画板导出的无字素材。界面文字与交互继续由 Phaser 绘制，
    // 但背景、三栏面板、卡片、进度条和按钮全部使用原始素材，避免程序近似绘制造成尺寸偏差。
    const alchemyAssetRoot = "./public/assets/images/pixso/alchemy";
    this.load.image("pixso-alchemy-background", `${alchemyAssetRoot}/ux.jpg`);
    ["b7", "c2", "c3", "c4", "c5", "c6", "c7", "c9", "c10", "c11", "c12", "c13", "c14", "c15", "c16", "c17", "c18", "c19", "c20"]
      .forEach((name) => this.load.image(`pixso-alchemy-${name}`, `${alchemyAssetRoot}/${name}.png`));
    preloadAlchemyMinigameAssets(this);
    preloadAlchemyResultAssets(this);
    preloadFurnacePickerAssets(this);
    preloadRetreatRoomAssets(this);
    const retreatAssetRoot = "./public/assets/images/pixso/retreat";
    this.load.image("pixso-retreat-meditation", `${retreatAssetRoot}/8cdee4c3a21d40617d9605e80eed37a8088c52d1.png`);
    this.load.image("pixso-retreat-success-huoqiu", `${retreatAssetRoot}/3bcbc2d74acc69897b07b32731e4ca2debd5edac.png`);
    this.load.image("pixso-retreat-book-huoqiu", `${retreatAssetRoot}/dec4d46fe3b91fe88846008c6d10efd397e4837d.png`);
    this.load.image("pixso-retreat-book-bengshan", `${retreatAssetRoot}/aba7cdfe66d76f756192deb3165cfa6f2d7e0cdf.png`);
    this.load.image("pixso-retreat-book-xuanbing", `${retreatAssetRoot}/79ba5213d9c1df9addb088116e1f44e846b3e230.png`);
    this.load.image("pixso-retreat-book-fuhu", `${retreatAssetRoot}/dc522cb3bdc85d5848c8b23ce3863758e1cbde26.png`);
    this.load.image("pixso-retreat-book-fentian", `${retreatAssetRoot}/1afe7790f4e99eb85b090c819b29021def80430a.png`);
    this.load.image("pixso-retreat-book-jiuxiao", `${retreatAssetRoot}/f027acf614bd59545b3fa101439b31433d6e4dca.png`);
    const portrait = getPlayerPortrait(gameState.player.portraitId);
    this.load.image(portrait.textureKey, portrait.imagePath);
    preloadPlayerTopToolbarAssets(this);
    preloadCharacterMenuAssets(this, getItemTemplates());
  }

  create() {
    configureFullHdScene(this);
    const sect = getSectTemplate(this.sectId);
    if (!sect) {
      clearSceneResumeRoute();
      this.scene.start(SceneKeys.VILLAGE);
      return;
    }
    this.activeFeaturePanel = null;
    rememberSectRoute({
      sectId: sect.id,
      saveSlot: gameState.activeSaveSlot,
    });
    this.itemCatalog = new ItemCatalog({
      resolveTexture: (item) => {
        const customTexture = `item-custom-${item.id}`;
        return item.imageData && this.textures.exists(customTexture) ? customTexture : item.texture;
      },
    });
    this.inventoryService = new InventoryService({ player: gameState.player, save: saveFirstChapterProgress });
    this.techniqueService = new TechniqueLoadoutService({ player: gameState.player, catalog: this.itemCatalog, save: saveFirstChapterProgress });
    this.spellService = new SpellService({ player: gameState.player, catalog: this.itemCatalog });
    this.artifactService = new ArtifactLoadoutService({ player: gameState.player, catalog: this.itemCatalog, save: saveFirstChapterProgress });
    this.shortcutService = new CombatShortcutService({
      player: gameState.player,
      catalog: this.itemCatalog,
      spellService: this.spellService,
      save: saveFirstChapterProgress,
    });
    this.saveArchiveService = new SaveArchiveService({
      repository: new SaveArchiveRepository(),
      profileId: `role-slot-${Number.isInteger(gameState.activeSaveSlot) ? gameState.activeSaveSlot : "unsaved"}`,
      captureSnapshot: createCurrentProgressSnapshot,
      restoreSnapshot: restoreCurrentProgressSnapshot,
    });
    this.characterMenu = new CharacterMenuPanel(this, {
      catalog: this.itemCatalog,
      inventoryService: this.inventoryService,
      techniqueService: this.techniqueService,
      spellService: this.spellService,
      artifactService: this.artifactService,
      shortcutService: this.shortcutService,
      saveArchiveService: this.saveArchiveService,
      beforeSave: () => {},
      onLoaded: () => this.returnToWorld(),
    });
    this.settingsDialog = null;
    this.settingsPanel = null;
    this.alchemyService = new AlchemyService({
      player: gameState.player,
      world: gameState.world,
      inventoryService: this.inventoryService,
      itemCatalog: this.itemCatalog,
      sectId: sect.id,
      save: saveFirstChapterProgress,
    });
    this.alchemyMinigameService = new AlchemyMinigameService();
    this.retreatService = new RetreatStudyService({
      player: gameState.player,
      world: gameState.world,
      inventoryService: this.inventoryService,
      itemCatalog: this.itemCatalog,
      sectId: sect.id,
      save: saveFirstChapterProgress,
    });
    this.cultivationRetreatService = new CultivationRetreatService({
      player: gameState.player,
      world: gameState.world,
      sectId: sect.id,
      save: saveFirstChapterProgress,
    });
    this.cultivationBreakthroughService = new CultivationBreakthroughService({
      player: gameState.player,
      save: saveFirstChapterProgress,
    });
    this.breakthroughTrialService = new BreakthroughTrialService();
    this.overview = new SectOverviewPanel(this, {
      sect,
      onBack: () => this.returnToWorld(),
      onFeature: (feature) => this.openFeature(feature),
      onToolbarAction: (actionId) => this.openToolbarAction(actionId),
    });
    this.input.on("pointerdown", (pointer) => {
      if (this.characterMenu.visible) this.characterMenu.handlePointer(pointer);
    });
    this.input.on("pointermove", (pointer) => {
      if (this.characterMenu.visible) this.characterMenu.handlePointerMove(pointer);
    });
    this.input.on("wheel", (pointer, _objects, _deltaX, deltaY) => {
      if (this.characterMenu.visible && this.characterMenu.isGridPointer(pointer)) {
        this.characterMenu.scroll(deltaY > 0 ? 1 : -1);
      }
    });
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.settingsPanel) this.closeGameSettings();
      else if (this.characterMenu.visible) this.characterMenu.close();
      else if (this.activeFeaturePanel) this.activeFeaturePanel.handleEscape();
      else if (this.overview.dialog.visible) this.overview.dialog.setVisible(false);
      else this.returnToWorld();
    });
    const resumeFeature = sect.features.find((feature) => feature.id === this.resumeFeatureId && feature.enabled);
    if (resumeFeature) this.openFeature(resumeFeature);
  }

  openFeature(feature) {
    this.activeFeaturePanel?.close();
    const common = {
      sectName: this.overview.sect.name,
      onBack: () => {
        this.activeFeaturePanel = null;
        this.overview.setTitleVisible(true);
        rememberSectRoute({ sectId: this.sectId, saveSlot: gameState.activeSaveSlot });
      },
      onReturnToWorld: () => this.returnToWorld(),
    };
    if (feature.id === "alchemy") {
      this.overview.setTitleVisible(false);
      rememberSectRoute({ sectId: this.sectId, featureId: feature.id, saveSlot: gameState.activeSaveSlot });
      this.activeFeaturePanel = new AlchemyRoomPanel(this, {
        ...common,
        service: this.alchemyService,
        minigameRules: this.alchemyMinigameService,
      });
      return;
    }
    if (feature.id === "retreat") {
      this.overview.setTitleVisible(false);
      rememberSectRoute({ sectId: this.sectId, featureId: feature.id, saveSlot: gameState.activeSaveSlot });
      this.activeFeaturePanel = new RetreatRoomPanel(this, {
        ...common,
        service: this.retreatService,
        cultivationService: this.cultivationRetreatService,
        breakthroughService: this.cultivationBreakthroughService,
        breakthroughRules: this.breakthroughTrialService,
        onProgressChanged: () => this.overview.playerTopToolbar.refreshPlayerStatus?.(),
      });
      return;
    }
    this.overview.showFeature(feature, feature.description);
  }

  returnToWorld() {
    clearSceneResumeRoute();
    this.scene.start(SceneKeys.VILLAGE);
  }

  /** 门派总览、炼丹房和闭关室共用真实角色菜单入口，不再显示占位说明。 */
  openToolbarAction(actionId) {
    if (actionId === "settings") {
      this.openGameSettings();
      return;
    }
    const tabs = {
      storage: "储物袋",
      spells: "法术",
      techniques: "功法",
      artifacts: "法宝",
      save: "存档",
    };
    const tab = tabs[actionId];
    if (!tab) return;
    this.overview.dialog.setVisible(false);
    this.characterMenu.open(tab);
  }

  openGameSettings() {
    if (this.settingsPanel) return;
    this.settingsDialog = new XianxiaDialog(this);
    this.settingsPanel = this.settingsDialog;
    this.settingsDialog.open({
      title: "游戏设置",
      subtitle: "全屏、存档与两台电脑的数据同步",
      width: 814,
      height: 660,
      noticeY: 262,
      buttonGroupY: 48,
      buttonGap: 61,
      buttons: [
        { label: "进入全屏", variant: "secondary", onClick: () => this.enterFullscreen() },
        { label: "窗口化", variant: "secondary", onClick: () => this.exitFullscreen() },
        { label: "导出游戏数据", variant: "utility", onClick: () => this.exportGameData() },
        { label: "导入游戏数据", variant: "utility", onClick: () => this.importGameData() },
        { label: "保存并退出到封面", variant: "primary", onClick: () => this.exitToCover() },
        { label: "关闭", variant: "danger", onClick: () => this.closeGameSettings() },
      ],
      onClose: () => {
        this.settingsDialog = null;
        this.settingsPanel = null;
      },
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
    saveFirstChapterProgress();
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

  exitToCover() {
    saveFirstChapterProgress();
    clearSceneResumeRoute();
    this.closeGameSettings();
    this.scene.start(SceneKeys.COVER);
  }

  showSettingsNotice(message, color) {
    this.settingsDialog?.setNotice(message, color);
  }

  closeGameSettings() {
    this.settingsDialog?.close();
  }
}

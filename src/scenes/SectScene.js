import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { getPlayerPortrait } from "../core/PortraitCatalog.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { clearSceneResumeRoute, rememberSectRoute } from "../core/SceneResumeState.js";
import { getSectTemplate } from "../core/SectCatalog.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { InventoryService } from "../domain/inventory/InventoryService.js";
import { AlchemyService } from "../domain/alchemy/AlchemyService.js";
import { AlchemyMinigameService } from "../domain/alchemy/AlchemyMinigameService.js";
import { RetreatStudyService } from "../domain/cultivation/RetreatStudyService.js";
import { CultivationRetreatService } from "../domain/cultivation/CultivationRetreatService.js";
import { startCultivationBackgroundMusic, stopCultivationBackgroundMusic } from "../utils/UiHelpers.js";
import { AlchemyRoomPanel } from "../ui/sect/AlchemyRoomPanel.js";
import { RetreatRoomPanel } from "../ui/sect/RetreatRoomPanel.js";
import { SectOverviewPanel } from "../ui/sect/SectOverviewPanel.js";
import { preloadPlayerTopToolbarAssets } from "../ui/PlayerTopToolbar.js";

/** 门派内部总览场景；负责资源与服务装配，具体规则和绘制分别留在 domain / ui。 */
export class SectScene extends Phaser.Scene {
  constructor() { super(SceneKeys.SECT); }

  init(data) {
    this.sectId = data?.sectId || "sect:tianjian";
    this.resumeFeatureId = data?.featureId || "";
  }

  preload() {
    this.load.image("sect-mountain-background", "./public/assets/images/battle/battle-mountain-background.png");
    const retreatAssetRoot = "./public/assets/images/pixso/retreat";
    this.load.image("pixso-retreat-background", `${retreatAssetRoot}/1ce11dac1b3ae7ddf89196f96f332081a4307d24.png`);
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
    startCultivationBackgroundMusic(this);
    this.events.once("shutdown", () => stopCultivationBackgroundMusic());
    this.itemCatalog = new ItemCatalog();
    this.inventoryService = new InventoryService({ player: gameState.player, save: saveFirstChapterProgress });
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
    this.overview = new SectOverviewPanel(this, {
      sect,
      onBack: () => this.returnToWorld(),
      onFeature: (feature) => this.openFeature(feature),
      onToolbarAction: (actionId) => this.openToolbarAction(actionId),
    });
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.activeFeaturePanel) this.activeFeaturePanel.handleEscape();
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
        rememberSectRoute({ sectId: this.sectId, saveSlot: gameState.activeSaveSlot });
      },
    };
    if (feature.id === "alchemy") {
      rememberSectRoute({ sectId: this.sectId, featureId: feature.id, saveSlot: gameState.activeSaveSlot });
      this.activeFeaturePanel = new AlchemyRoomPanel(this, {
        ...common,
        service: this.alchemyService,
        minigameRules: this.alchemyMinigameService,
      });
      return;
    }
    if (feature.id === "retreat") {
      rememberSectRoute({ sectId: this.sectId, featureId: feature.id, saveSlot: gameState.activeSaveSlot });
      this.activeFeaturePanel = new RetreatRoomPanel(this, {
        ...common,
        service: this.retreatService,
        cultivationService: this.cultivationRetreatService,
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

  /**
   * 门派总览先复用大地图的完整顶栏外观；公共功能入口保留稳定动作 ID，
   * 后续可直接装配角色菜单服务，而不用再改顶栏绘制和点击坐标。
   */
  openToolbarAction(actionId) {
    const entries = {
      storage: { label: "储物袋", seal: "袋" },
      spells: { label: "法术", seal: "术" },
      techniques: { label: "功法", seal: "功" },
      artifacts: { label: "法宝", seal: "宝" },
      save: { label: "存档", seal: "存" },
      settings: { label: "设置", seal: "设" },
    };
    const entry = entries[actionId];
    if (!entry) return;
    this.overview.showFeature(
      { id: actionId, label: entry.label, seal: entry.seal },
      `${entry.label}入口已与大地图使用同一套顶栏接口。\n当前请返回大地图使用完整功能。`,
    );
  }
}

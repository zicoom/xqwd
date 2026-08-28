import {
  createCurrentProgressSnapshot,
  gameState,
  restoreCurrentProgressSnapshot,
  saveFirstChapterProgress,
} from "../core/GameState.js";
import { getMapObjects, MAP_OBJECT_TYPES } from "../core/MapContentStore.js";
import { getMonsterTemplate } from "../core/MonsterStore.js";
import { getMonsterAppearanceTextureKey, resolveMonsterAppearance } from "../core/MonsterAppearance.js";
import { getItemTemplates } from "../core/ItemStore.js";
import { getBuildingTemplate, getNpcTemplate } from "../core/WorldTemplateStore.js";
import { getBuildingAppearanceTextureKey, resolveBuildingAppearance } from "../core/BuildingAppearance.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addButton, addText, playUiClickSound, stopCultivationBackgroundMusic } from "../utils/UiHelpers.js";
import { ChapterMapHud } from "../ui/ChapterMapHud.js";
import { preloadPlayerTopToolbarAssets } from "../ui/PlayerTopToolbar.js";
import { CharacterMenuPanel } from "../ui/character/CharacterMenuPanel.js";
import { XianxiaDialog } from "../ui/XianxiaDialog.js";
import { configureFullHdScene, SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/DisplayConfig.js";
import { clearEditorRoute } from "../core/EditorRoute.js";
import { clearSceneResumeRoute } from "../core/SceneResumeState.js";
import { getPlayerPortrait } from "../core/PortraitCatalog.js";
import { exportLocalGameData, importLocalGameDataFromFile } from "../core/LocalDataTransfer.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { TechniqueLoadoutService } from "../domain/techniques/TechniqueLoadoutService.js";
import { SpellService } from "../domain/spells/SpellService.js";
import { ShopService } from "../domain/shop/ShopService.js";
import { InventoryService } from "../domain/inventory/InventoryService.js";
import { ArtifactLoadoutService } from "../domain/artifacts/ArtifactLoadoutService.js";
import { CombatShortcutService } from "../domain/combat/CombatShortcutService.js";
import { SaveArchiveService } from "../domain/save/SaveArchiveService.js";
import {
  getBuildingCollisionVertices,
  getDistanceToBuildingCollision,
  isMovementBlockedByBuildings,
} from "../domain/world/BuildingCollisionService.js";
import { SectAccessService } from "../domain/world/SectAccessService.js";
import { MapExplorationService } from "../domain/world/MapExplorationService.js";
import { SaveArchiveRepository } from "../core/save/SaveArchiveRepository.js";
import {
  ChapterQuestService,
  QINGYUN_INVESTIGATION_ID,
  QUEST_EVENTS,
  QINGYUN_QUEST_STEPS,
} from "../domain/quests/ChapterQuestService.js";
import { NpcInteractionService } from "../domain/quests/NpcInteractionService.js";
import { MerchantPanel } from "../ui/merchant/MerchantPanel.js";
import { ItemRewardPopup } from "../ui/rewards/ItemRewardPopup.js";
import { SectEntrancePrompt } from "../ui/sect/SectEntrancePrompt.js";
import { createBuildingMapLabel } from "../ui/world/BuildingMapLabel.js";

/**
 * 栖霞村探索场景。
 * 演示 WASD/方向键移动与鼠标点击移动。正式项目会替换为地图编辑器导出的地图数据。
 */
export class VillageScene extends Phaser.Scene {
  constructor() { super(SceneKeys.VILLAGE); }

  /** 世界物件统一按脚底 Y 坐标排序；数值保持低于固定 HUD、弹窗和任务提示。 */
  worldActorDepth(y) { return 6 + (Number(y) || 0) / 100000; }

  /** 建筑属于地景层，始终低于角色、NPC 和怪物，避免任何建筑像素盖住人物。 */
  worldBuildingDepth(y) { return 4 + (Number(y) || 0) / 100000; }

  /** 建筑以碰撞轮廓的最下沿作为“脚底”，避免透明留白让建筑继续压住门前角色。 */
  worldObjectSortY(object) {
    if (object?.type === "building") {
      const vertices = getBuildingCollisionVertices(object);
      if (vertices.length) return Math.max(...vertices.map((point) => point.y));
    }
    return Number(object?.y) || 0;
  }

  /**
   * 在进入村庄前加载本场景专用背景图。
   * 以后每张地图都可以像这样拥有自己的图片和数据，不会把所有资源都塞进启动阶段。
   */
  preload() {
    // 刷新时角色可能保存在地图任意位置，因此预加载“当前存档位置”周围的 3×3 块。
    // 这样场景一出现就是完整地图，不会先显示深色空白再慢慢补图。
    const savedPosition = gameState.world.playerPosition || { x: 980, y: 1260 };
    const currentX = Phaser.Math.Clamp(Math.floor((Number(savedPosition.x) || 980) / 1200), 0, 4);
    const currentY = Phaser.Math.Clamp(Math.floor((Number(savedPosition.y) || 1260) / 1200), 0, 4);
    this.initialMapTiles = [];
    for (let x = Math.max(0, currentX - 1); x <= Math.min(4, currentX + 1); x += 1) {
      for (let y = Math.max(0, currentY - 1); y <= Math.min(4, currentY + 1); y += 1) {
        this.initialMapTiles.push([x, y]);
      }
    }
    for (const [x, y] of this.initialMapTiles) {
      this.load.image(this.getMapTileKey(x, y), this.getMapTilePath(x, y));
    }

    // 两张角色图每个小格都是 256×256 像素。
    // 待机图为 5 行 × 1 列；行走图为 5 行 × 8 列。
    this.load.spritesheet("player-idle-5dir", "./public/assets/images/characters/player-idle-5dir.png", {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.spritesheet("player-walk-5dir", "./public/assets/images/characters/player-walk-5dir.png", {
      frameWidth: 256,
      frameHeight: 256,
    });
    // 对话右侧使用主角专属半身立绘，不再复用左上角的小头像。
    this.load.image("player-dialogue-portrait", "./public/assets/images/characters/player-dialogue-portrait.png");
    // 左上资料栏的头像从角色创建时选定的立绘生成，无须额外上传头像素材。
    const selectedPortrait = getPlayerPortrait(gameState.player.portraitId);
    // 纹理键包含立绘 ID。不同角色连续进入地图时不会复用上一位角色的缓存图片。
    this.load.image(selectedPortrait.textureKey, selectedPortrait.imagePath);
    // 物品编辑器上传的自定义图标会随场景预加载；刷新或重新进入地图后，商店与储物袋立即显示新图。
    getItemTemplates().filter((item) => item.imageData).forEach((item) => {
      this.load.image(`item-custom-${item.id}`, item.imageData);
    });
    this.load.image("system-item-sect-tianjian-token", "./public/assets/images/items/tianjian-token.svg");
    this.load.image("storage-background", "./public/assets/images/ui/storage/storage-background.png");
    this.load.image("storage-bag-frame", "./public/assets/images/ui/storage/storage-bag-frame.png");
    this.load.image("storage-category", "./public/assets/images/ui/storage/storage-category.png");
    this.load.image("storage-category-selected", "./public/assets/images/ui/storage/storage-category-selected.png");
    this.load.image("storage-grade-option", "./public/assets/images/ui/storage/storage-grade-option.png");
    this.load.image("storage-grade-option-selected", "./public/assets/images/ui/storage/storage-grade-option-selected.png");
    this.load.image("storage-grade-arrow", "./public/assets/images/ui/storage/storage-grade-arrow.png");
    this.load.image("storage-grade-arrow-selected", "./public/assets/images/ui/storage/storage-grade-arrow-selected.png");
    // 储物袋右键操作菜单：三张底图由 UI 素材单独提供。
    this.load.image("storage-action-use", "./public/assets/images/ui/storage/storage-action-use.png");
    this.load.image("storage-action-detail", "./public/assets/images/ui/storage/storage-action-detail.png");
    this.load.image("storage-action-discard", "./public/assets/images/ui/storage/storage-action-discard.png");
    // 法宝页使用用户提供的原始木质边框（860 × 638）与分类名签（90 × 33）。
    // 保持原图尺寸，避免浏览器缩放造成边框纹理模糊或比例失真。
    this.load.image("artifact-frame", "./public/assets/images/ui/artifact/artifact-frame.png");
    this.load.image("artifact-category-label", "./public/assets/images/ui/artifact/artifact-category-label.png");
    // 法术页十键战斗快捷栏下方的 130×33 原始文字底签。
    this.load.image("combat-shortcut-label", "./public/assets/images/ui/spells/combat-shortcut-label.png");
    // 游戏设置弹窗使用用户提供的新版深棕面板底图。
    this.load.image("game-settings-panel", "./public/assets/images/ui/chapter-map/settings-panel.png");
    // 编辑器放置的 NPC 和怪物暂时复用现有角色立绘。
    // 日后加入 NPC/怪物图片库后，只需要把这两个纹理键替换成对应模板图片。
    this.load.image("map-monster-portrait", "./public/assets/images/battle/swordsman.png");

    // 大地图与门派内部共用同一个角色顶栏素材入口，图标路径和显示版本保持一致。
    preloadPlayerTopToolbarAssets(this);
    // 主线任务方向箭头：素材本身默认朝右，运行时根据古潭位置旋转。
    this.load.image("quest-direction-arrow", "./public/assets/images/ui/chapter-map/quest-direction-arrow.png");
    // NPC 尚未制作地图立绘时使用的任务问号。
    this.load.image("npc-map-question-mark", "./public/assets/images/ui/chapter-map/npc-question-mark.png");
    // 建筑名称统一使用用户提供的 86×296 黑色竖向笔刷，不再显示小号描边文字。
    this.load.image("map-building-name-brush", "./public/assets/images/ui/chapter-map/building-name-brush.png");
    // 附近修士资料卡的 Pixso 装饰线与按钮图标。
    this.load.image("npc-profile-divider-top", "./public/assets/images/ui/npc-profile/profile-divider-top.png");
    this.load.image("npc-profile-divider-center", "./public/assets/images/ui/npc-profile/profile-divider-center.png");
    this.load.image("npc-profile-divider-bottom", "./public/assets/images/ui/npc-profile/profile-divider-bottom.png");
    this.load.image("npc-profile-chat-icon", "./public/assets/images/ui/npc-profile/profile-chat-icon.png");
    this.load.image("npc-profile-friend-icon", "./public/assets/images/ui/npc-profile/profile-friend-icon.png");

    // 商人界面使用用户提供的原始立绘、头像与草药图片，不以截图代替可交互的物品。
    const merchantPath = "./public/assets/images/merchant";
    this.load.image("merchant-profile-portrait", `${merchantPath}/merchant-portrait.png`);
    this.load.image("merchant-avatar", `${merchantPath}/merchant-avatar.png`);
    this.load.image("merchant-spirit-stone", `${merchantPath}/spirit-stone.png`);
    [
      ["baixiangye", "百香叶"], ["juqicao", "聚气草"], ["xingyingguo", "星萤果"],
      ["ninglutai", "凝露苔"], ["linggugen", "灵谷根"], ["yuyazhi", "玉芽芝"],
      ["qingmaiteng", "青脉藤"], ["yuelulan", "月露兰"], ["qinglinghua", "清灵花"], ["chiyangshen", "赤阳参"],
    ].forEach(([key, file]) => this.load.image(`merchant-herb-${key}`, `${merchantPath}/herb-${key}.png`));
    // 商店分类使用用户提供的两张按钮底图：1_1 是未选中，1_2 是选中状态。
    this.load.image("merchant-category-normal", "./public/assets/images/ui/merchant/category-button-normal.png");
    this.load.image("merchant-category-selected", "./public/assets/images/ui/merchant/category-button-selected.png");
    // 储物袋物品悬浮时的“取消购物”按钮底图。
    this.load.image("merchant-cart-cancel", "./public/assets/images/ui/merchant/cart-cancel-button.png");
  }

  create() {
    clearEditorRoute();
    clearSceneResumeRoute();
    configureFullHdScene(this);
    // 探索画面整体拉远一点：背景、主角和地图实例会按同一比例缩小，
    // 但世界坐标、存档位置、建筑碰撞和地图编辑器资料都保持原值，不会因此错位。
    this.cameras.main.setZoom(0.88);
    this.worldCamera = this.cameras.main;
    // UI 镜头必须在第一张地图块显示之前创建。这样初始预加载的地图块与探索途中
    // 异步补上的地图块走同一条“仅世界镜头渲染”的路径，避免任何一块短暂漏到右侧 HUD 附近。
    this.uiCamera = this.cameras.add(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).setName("village-ui").setZoom(1);
    // 场景只在这里装配业务服务；商店、功法、法术之间不再互相调用 UI 方法。
    this.itemCatalog = new ItemCatalog({
      resolveTexture: (item) => {
        const customTexture = `item-custom-${item.id}`;
        return item.imageData && this.textures.exists(customTexture) ? customTexture : item.texture;
      },
    });
    this.techniqueService = new TechniqueLoadoutService({ player: gameState.player, catalog: this.itemCatalog, save: saveFirstChapterProgress });
    this.spellService = new SpellService({ player: gameState.player, catalog: this.itemCatalog });
    this.shopService = new ShopService({ player: gameState.player, world: gameState.world, catalog: this.itemCatalog, save: saveFirstChapterProgress });
    this.inventoryService = new InventoryService({ player: gameState.player, save: saveFirstChapterProgress });
    this.sectAccessService = new SectAccessService({
      player: gameState.player,
      world: gameState.world,
      inventoryService: this.inventoryService,
      save: saveFirstChapterProgress,
    });
    this.npcInteractionService = new NpcInteractionService({
      player: gameState.player,
      world: gameState.world,
      inventoryService: this.inventoryService,
      itemCatalog: this.itemCatalog,
      save: saveFirstChapterProgress,
    });
    this.artifactService = new ArtifactLoadoutService({ player: gameState.player, catalog: this.itemCatalog, save: saveFirstChapterProgress });
    this.shortcutService = new CombatShortcutService({
      player: gameState.player,
      catalog: this.itemCatalog,
      spellService: this.spellService,
      save: saveFirstChapterProgress,
    });
    // 五个手动档位和自动存档间隔由纯领域服务管理；场景只注入浏览器仓库与快照方法。
    this.saveArchiveService = new SaveArchiveService({
      repository: new SaveArchiveRepository(),
      profileId: `role-slot-${Number.isInteger(gameState.activeSaveSlot) ? gameState.activeSaveSlot : "unsaved"}`,
      captureSnapshot: createCurrentProgressSnapshot,
      restoreSnapshot: restoreCurrentProgressSnapshot,
    });
    // 章节任务规则集中在纯 JavaScript 领域服务中；场景只负责装配并报告地图事件。
    this.questService = new ChapterQuestService({
      chapter: gameState.chapter,
      player: gameState.player,
      save: saveFirstChapterProgress,
    });
    // 旧版本可能留下“进行中却已有古玉”等矛盾状态，只在装配阶段显式修复一次。
    this.questService.reconcileLegacyState();
    // 小地图足迹的采样、容量和存档状态修改属于世界规则；HUD 只消费服务返回的坐标并绘制。
    this.mapExplorationService = new MapExplorationService({
      world: gameState.world,
      save: saveFirstChapterProgress,
    });
    this.mapExplorationService.reconcileLegacyState();
    this.merchantPanel = new MerchantPanel({ scene: this, shopService: this.shopService, save: saveFirstChapterProgress });
    this.characterMenu = new CharacterMenuPanel(this, {
      catalog: this.itemCatalog,
      inventoryService: this.inventoryService,
      techniqueService: this.techniqueService,
      spellService: this.spellService,
      artifactService: this.artifactService,
      shortcutService: this.shortcutService,
      saveArchiveService: this.saveArchiveService,
    });
    // 当前按用户要求暂时关闭大地图背景音乐；保留音乐生成函数，后续需要时可以重新启用。
    // 进入地图时主动停止旧场景可能残留的循环声，但按钮点击音等界面音效不受影响。
    stopCultivationBackgroundMusic();
    this.events.once("shutdown", () => stopCultivationBackgroundMusic());
    // Phaser 会复用同一个场景实例。上一次从设置面板退出到封面后，
    // JavaScript 属性仍可能指向已经销毁的面板和透明点击区；再次进入地图时，
    // 这些旧引用会让地图误以为弹窗仍然打开，从而拦截鼠标操作。
    // 每次进入地图都先重置所有只属于上一次运行的界面状态。
    this.settingsPanel = null;
    this.settingsActionHitAreas = null;
    this.settingsInputBlocker = null;
    this.settingsNotice = null;
    // 通用弹窗实例独立保存；设置和功能说明共用同一套仙侠风格弹窗组件。
    this.settingsDialog = null;
    this.featurePanel = null;
    this.featureDialog = null;

    // 青云山原图每块是 2000×2000 像素。显示时按 60% 缩小，
    // 既能让一屏看到更多地形，也能让水墨线条在缩小后更清楚。
    // 以后新增其他大地图时，只要换成对应配置即可复用同一套按需加载逻辑。
    this.mapConfig = { id: "qingyun-mountain", columns: 5, rows: 5, tileSize: 1200, displayScale: 0.6 };
    this.worldSize = { width: 6000, height: 6000 };
    this.mapTileObjects = new Map();
    this.mapTilesLoading = new Set();
    this.mapStreamElapsed = 0;
    this.drawQingyunMountain();
    this.sectEntrancePrompt = new SectEntrancePrompt(this, (sect, buildingObject) => this.tryEnterSect(sect, buildingObject));
    // 读取地图编辑器保存的内容：在编辑器中放下的 NPC、怪物、建筑、传送点会出现在这里。
    this.renderEditorObjects();
    this.createPlayerAnimations();

    // setOrigin(0.5, 0.86) 会把人物的“脚底”放在坐标位置上。
    // 这样人物走路时不会像飘在地面上，姓名也会稳定显示在头顶。
    // 从角色存档读取最后站立位置；第一次进游戏时才使用栖霞村默认出生点。
    const savedPosition = gameState.world.playerPosition || { x: 980, y: 1260 };
    const spawnX = Phaser.Math.Clamp(Number(savedPosition.x) || 980, 50, this.worldSize.width - 50);
    const spawnY = Phaser.Math.Clamp(Number(savedPosition.y) || 1260, 110, this.worldSize.height - 80);
    this.player = this.add.sprite(spawnX, spawnY, "player-idle-5dir", 0)
      .setOrigin(0.5, 0.86)
      // 地图缩小后，人物也随之缩小，保持自然的角色与环境比例。
      .setScale(0.48)
      .setDepth(this.worldActorDepth(spawnY));

    // 半透明椭圆模拟人物脚下的投影。它比人物层级低，移动时会同步更新位置，
    // 因此人物能稳定“站”在地面上，而不是看起来悬浮。
    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 17, 74, 22, 0x14221e, 0.32)
      .setDepth(this.worldActorDepth(spawnY) - 0.002);
    this.playerDirection = { row: 0, flipX: false };
    this.player.play("player-idle-row-0");
    // 地图角色头顶只保留姓名；文字底部贴近头顶并以角色 X 坐标为中心。
    this.playerName = addText(this, spawnX, spawnY - 160, gameState.player.name, 16, "#fff9df", { align: "center" })
      .setOrigin(0.5, 1)
      .setDepth(this.worldActorDepth(spawnY) + 0.002);

    // 设置世界边界并让镜头平滑追随主角；UI 会在下方单独固定，不随镜头移动。
    this.worldCamera.setBounds(0, 0, this.worldSize.width, this.worldSize.height);
    this.worldCamera.startFollow(this.player, true, 0.09, 0.09);

    this.target = null;
    this.jadePosition = new Phaser.Math.Vector2(2440, 760);
    this.jadeMarker = [];
    this.jadeMarker.push(this.add.circle(this.jadePosition.x, this.jadePosition.y, 28, 0x7ddfcf, 0.92).setStrokeStyle(3, 0xfff0ad).setDepth(30));
    // 两层光圈模拟古玉微光；正式项目中可替换为粒子特效贴图。
    this.jadeMarker.push(this.add.circle(this.jadePosition.x, this.jadePosition.y, 52, 0x9cf2de, 0.2).setStrokeStyle(2, 0xeef4bd, 0.8).setDepth(29));
    this.jadeMarker.push(addText(this, this.jadePosition.x, this.jadePosition.y - 78, "任务地点：古潭问道台", 18, "#fff2a7", { origin: 0.5 }).setDepth(31));
    // 第一章的主线不再直接把玩家送到古玉旁。两个清晰的世界锚点让“采集—抉择—战斗/绕路”
    // 发生在地图上；它们只保存阶段，不把坐标、图形或动画写入存档。
    this.herbPosition = new Phaser.Math.Vector2(1810, 1260);
    this.pathPosition = new Phaser.Math.Vector2(2160, 990);
    this.herbMarker = this.createQingyunAdventureMarker(this.herbPosition, {
      title: "异光灵草",
      subtitle: "采集线索",
      color: 0x8fd693,
      glow: 0x3f8757,
    });
    this.pathMarker = this.createQingyunAdventureMarker(this.pathPosition, {
      title: "雾岚岔路",
      subtitle: "作出抉择",
      color: 0xf0bb62,
      glow: 0x8c5b2d,
    });
    this.createQuestGuide();
    this.createQuestAcceptedNotice();

    // ── 附近修士人物对话：按 Pixso 稿做成「双人立绘 + 底部羊皮纸对话框」。 ──
    this.dialog = this.add.container(0, 0).setScrollFactor(0).setVisible(false).setDepth(1500);
    const dialogShade = this.add.rectangle(0, 0, 1920, 1080, 0x0b120c, 0.48).setOrigin(0);
    const dialogPanel = this.add.graphics();
    dialogPanel.fillStyle(0xd4b18d, 1);
    // 对话区按效果图采用紧凑的 970 × 260 尺寸，避免遮住整张地图。
    dialogPanel.fillRoundedRect(500, 760, 970, 260, 8);
    dialogPanel.lineStyle(2, 0x755339, 1);
    dialogPanel.strokeRoundedRect(500, 760, 970, 260, 8);
    // 说话人名牌：棕色圆角、深色边线，压在羊皮纸上沿。
    this.dialogNameTab = this.add.graphics();
    this.drawDialogNameTab(508);
    this.dialogNameText = addText(this, 556, 746, "", 16, "#fff4df", { strokeThickness: 1 }).setOrigin(0.5);
    this.dialogText = addText(this, 535, 792, "", 16, "#3b291d", { wordWrap: { width: 885 }, lineSpacing: 6, strokeThickness: 0 });
    // 左边为 NPC 对话立绘，右边为主角立绘；二者均停在对话框上沿，构图与效果图一致。
    this.dialogPortrait = this.add.image(590, 760, "player-idle-5dir", 0)
      .setOrigin(0.5, 1)
      .setScale(0.58)
      .setVisible(false);
    this.dialogPlayerPortrait = this.add.image(1370, 760, "player-dialogue-portrait")
      .setOrigin(0.5, 1)
      .setDisplaySize(210, 330)
      .setVisible(false)
      .setAlpha(0.92);
    this.dialogChoices = this.add.container(0, 0);
    // 选项点击区单独置于最上层，避免容器缩放或遮罩拦截点击。
    this.dialogChoiceHitAreas = [];
    this.dialog.add([dialogShade, this.dialogPortrait, this.dialogPlayerPortrait, dialogPanel, this.dialogNameTab, this.dialogNameText, this.dialogText, this.dialogChoices]);
    // 右下角提供小型返回按钮；Esc 也可关闭，避免它抢占对话内容的空间。
    this.dialogReturnButton = addButton(this, 1390, 1042, 140, "返回地图", () => this.closeDialogue(), { size: 16, height: 40 })
      .setScrollFactor(0)
      .setDepth(1501)
      .setVisible(false);
    this.itemRewardPopup = new ItemRewardPopup(this);

    // “附近修士”卡片点击后出现的个人资料弹窗。
    this.createNearbyNpcProfilePanel();

    this.createHud();
    this.syncExploreCameraLayers();
    this.cameraLayerSyncElapsed = 0;
    this.updateQingyunQuestMarker();
    // 坐标仍每两秒更新到内存；真正写入浏览器则按玩家选择的 5/10/15/30 分钟执行。
    this.positionRememberElapsed = 0;
    this.autoSaveCheckElapsed = 0;
    this.refreshNearbyMapTiles();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,E,ESC,ONE,TWO,THREE,FOUR");
    // 清除离开旧场景时可能残留的按键按下状态，保证重新进入地图后立即可移动。
    this.input.keyboard.resetKeys();
    this.input.on("pointerdown", (pointer) => {
      // 游戏界面始终按 1920×1080 的逻辑坐标排版；getUiPointer 会统一取用
      // Phaser 已换算好的坐标，避免浏览器缩放后再次换算而导致按钮点偏。
      const uiPointer = this.getUiPointer(pointer);
      // 奖励弹窗显示时只允许关闭弹窗，绝不把点击穿透到地图寻路。
      if (this.itemRewardPopup?.visible) return;
      // 打开任务日志时，所有地图点击都由日志界面接管，不能触发寻路。
      if (this.chapterMapHud?.isTaskLogOpen()) return;
      // 储物袋和商店一样是独立的最上层界面，绝不允许点击穿透到大地图。
      if (this.characterMenu.visible) {
        this.characterMenu.handlePointer(uiPointer);
        return;
      }
      // 商店是最高层全屏界面，打开时绝不能把点击穿透到大地图寻路。
      if (this.merchantPanel.visible) {
        this.merchantPanel.handlePointer(uiPointer);
        return;
      }
      // 功能提示弹窗位于最上层；它打开时只接收自己的关闭按钮点击。
      if (this.featurePanel) {
        return;
      }
      // 点击底部文字框时不移动，避免玩家阅读对话时误走位。
      if (this.npcProfilePanel?.visible) {
        this.handleNpcProfilePointer(uiPointer);
        return;
      }
      // 选项文字本身以及羊皮纸区域都由这里统一判断，缩放后点击仍然可靠。
      if (this.dialog.visible) {
        this.handleDialoguePointer(uiPointer);
        return;
      }
      if (!this.dialog.visible && !this.npcProfilePanel?.visible && this.chapterMapHud?.isPointerOverNearbyCard(uiPointer)) {
        // 左下卡片点击始终先打开个人资料，不会被地图自动寻路抢走这次点击。
        this.openNearbyNpcProfile(this.chapterMapHud.nearbyObject);
        return;
      }
      if (!this.dialog.visible && !this.npcProfilePanel?.visible && !this.settingsPanel && !this.featurePanel && !this.characterMenu.visible && !this.chapterMapHud?.isPointerOverHud(uiPointer) && uiPointer.y < 915) {
        // 镜头开始滚动后，pointer.x/y 只是屏幕坐标；worldX/worldY 才是地图上的真实位置。
        this.sectEntrancePrompt?.hide();
        this.target = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      }
    });
    this.input.on("pointermove", (pointer) => {
      if (this.characterMenu.visible) this.characterMenu.handlePointerMove(this.getUiPointer(pointer));
      if (this.merchantPanel.visible) this.merchantPanel.handlePointerMove(this.getUiPointer(pointer));
    });
    this.input.on("pointerup", () => {
      // 商品列表滚动条拖动结束后立刻解除状态，避免后续点击仍被当成拖动。
      this.merchantPanel.endProductScrollDrag();
    });
    // 储物袋只显示两行格子。超过 24 件时可以在袋子区域滚轮翻到下一行。
    this.input.on("wheel", (pointer, _objects, _deltaX, deltaY) => {
      if (this.characterMenu.visible && this.characterMenu.isGridPointer(this.getUiPointer(pointer))) {
        this.characterMenu.scroll(deltaY > 0 ? 1 : -1);
        return;
      }
      if (!this.merchantPanel.visible) return;
      const uiPointer = this.getUiPointer(pointer);
      this.merchantPanel.handleWheel(uiPointer, deltaY);
    });
  }

  /**
   * 取得固定 1920×1080 UI 坐标。
   *
   * Phaser 的 pointer.x / pointer.y 已经由 Scale Manager 按游戏设计尺寸换算过。
   * 旧代码又按照 Canvas 的显示尺寸重复乘了一次缩放比例，窗口缩放或高分屏时
   * 会让“看起来点到按钮、程序却判定点在别处”。所有游戏 UI 统一直接使用
   * Phaser 提供的逻辑坐标，资料卡、储物袋和设置面板就会保持一致。
   */
  getUiPointer(pointer) {
    // 保留鼠标按键资料；储物袋右键使用物品时需要知道这是右键。
    return {
      x: Number(pointer?.x) || 0,
      y: Number(pointer?.y) || 0,
      button: pointer.button,
      buttons: pointer.buttons,
      event: pointer.event,
      rightButtonDown: typeof pointer.rightButtonDown === "function"
        ? () => pointer.rightButtonDown()
        : undefined,
    };
  }

  /**
   * 建立角色动画。
   * 原图的五行依次为：下、左下、左、左上、上。
   * 右侧三个方向没有单独图片，因此游戏会镜像对应的左侧动画，视觉上就是完整八方向。
   */
  createPlayerAnimations() {
    for (let row = 0; row < 5; row += 1) {
      const walkKey = `player-walk-row-${row}`;
      const idleKey = `player-idle-row-${row}`;

      // Phaser 的动画管理器是全局的：切换场景后仍会保留，所以先判断再创建。
      if (!this.anims.exists(walkKey)) {
        this.anims.create({
          key: walkKey,
          frames: this.anims.generateFrameNumbers("player-walk-5dir", { start: row * 8, end: row * 8 + 7 }),
          frameRate: 10,
          repeat: -1,
        });
      }
      if (!this.anims.exists(idleKey)) {
        this.anims.create({
          key: idleKey,
          frames: [{ key: "player-idle-5dir", frame: row }],
          frameRate: 1,
          repeat: -1,
        });
      }
    }
  }

  createHud() {
    // 界面由独立文件 ChapterMapHud 负责，地图场景不再混入大量排版代码。
    this.chapterMapHud = new ChapterMapHud(this, {
      questService: this.questService,
      explorationService: this.mapExplorationService,
    });
    this.chapterMapHud.create();
    // 保留以下引用，兼容地图场景已有的附近对象检测逻辑。
    this.nearbyNameText = this.chapterMapHud.nearbyNameText;
    this.nearbyRealmText = this.chapterMapHud.nearbyRealmText;
    this.operationHint = this.chapterMapHud.operationHint;
  }

  /**
   * 将探索地图与固定 UI 分给两台镜头绘制。
   *
   * 固定 UI 的唯一判定是两个 scrollFactor 都为 0：HUD、弹窗、背包与后续新增界面都遵守这一约定；
   * 其余对象仍属于可跟随主角移动的世界。递归处理容器，避免容器内的文字或按钮被另一台镜头重复绘制。
   */
  syncExploreCameraLayers() {
    if (!this.worldCamera || !this.uiCamera) return;
    const screenUi = [];
    const world = [];
    const collected = new Set();
    const collect = (display, inheritedUi = false) => {
      if (!display || collected.has(display)) return;
      collected.add(display);
      const isScreenUi = inheritedUi || (display.scrollFactorX === 0 && display.scrollFactorY === 0);
      (isScreenUi ? screenUi : world).push(display);
      if (Array.isArray(display.list)) display.list.forEach((child) => collect(child, isScreenUi));
    };
    this.children.list.forEach((display) => collect(display));
    this.worldCamera.ignore(screenUi);
    this.uiCamera.ignore(world);
  }

  /** 用浏览器画布生成圆角渐变按钮，避免 Graphics 渐变出现可见的拼接线。 */
  createProfileButtonTexture(key, width, height, topColor, bottomColor, borderColor) {
    if (this.textures.exists(key)) return;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const radius = 8;
    const path = () => {
      context.beginPath();
      context.moveTo(radius, 1);
      context.lineTo(width - radius, 1);
      context.quadraticCurveTo(width - 1, 1, width - 1, radius);
      context.lineTo(width - 1, height - radius);
      context.quadraticCurveTo(width - 1, height - 1, width - radius, height - 1);
      context.lineTo(radius, height - 1);
      context.quadraticCurveTo(1, height - 1, 1, height - radius);
      context.lineTo(1, radius);
      context.quadraticCurveTo(1, 1, radius, 1);
      context.closePath();
    };
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    context.fillStyle = gradient;
    path();
    context.fill();
    // 仅三个资料卡按钮使用 1px 边线。
    context.lineWidth = 1;
    context.strokeStyle = borderColor;
    path();
    context.stroke();
    this.textures.addCanvas(key, canvas);
  }

  /** 建立「附近修士」的人物资料弹窗；资料来自 NPC 管理界面保存的模板。 */
  createNearbyNpcProfilePanel() {
    this.npcProfilePanel = this.add.container(960, 540).setScrollFactor(0).setVisible(false).setDepth(1600);
    const shade = this.add.rectangle(0, 0, 1920, 1080, 0x071009, 0.56).setInteractive();
    const card = this.add.graphics();
    card.fillStyle(0x241c13, 0.98);
    // 按 Pixso 效果图：资料卡是窄而高的比例，不占满屏幕中央。
    card.fillRoundedRect(-180, -350, 360, 750, 8);
    // 最外层资料卡边线保持原来的 2px。
    card.lineStyle(2, 0x87643f, 1);
    card.strokeRoundedRect(-180, -350, 360, 750, 8);
    // 三条由用户提供的原图装饰线：立绘下方、资料与属性之间、按钮上方。
    const dividerTop = this.add.image(0, -70, "npc-profile-divider-top").setDisplaySize(312, 3);
    const dividerCenter = this.add.image(0, 120, "npc-profile-divider-center").setDisplaySize(300, 12);
    const dividerBottom = this.add.image(0, 265, "npc-profile-divider-bottom").setDisplaySize(312, 1);

    this.npcProfilePortrait = this.add.image(0, -72, "player-idle-5dir", 0)
      .setOrigin(0.5, 1)
      .setScale(0.7);
    this.npcProfileName = addText(this, -148, -37, "", 20, "#f5e2ba", { strokeThickness: 1 });
    this.npcProfileRealm = addText(this, 148, -33, "", 13, "#d5c4a2", { strokeThickness: 0 }).setOrigin(1, 0);
    this.npcProfileRows = [
      addText(this, -148, 4, "", 13, "#a99c89", { strokeThickness: 0 }),
      addText(this, -148, 31, "", 13, "#a99c89", { strokeThickness: 0 }),
      addText(this, -148, 58, "", 13, "#a99c89", { strokeThickness: 0 }),
      addText(this, -148, 85, "", 13, "#a99c89", { strokeThickness: 0 }),
    ];
    this.npcProfileValues = [
      addText(this, 148, 4, "", 13, "#eee0c8", { strokeThickness: 0 }).setOrigin(1, 0),
      addText(this, 148, 31, "", 13, "#eee0c8", { strokeThickness: 0 }).setOrigin(1, 0),
      addText(this, 148, 58, "", 13, "#eee0c8", { strokeThickness: 0 }).setOrigin(1, 0),
      addText(this, 148, 85, "", 13, "#eee0c8", { strokeThickness: 0 }).setOrigin(1, 0),
    ];

    const statBox = this.add.graphics();
    statBox.fillStyle(0x18140f, 0.88);
    [-148, 8].forEach((x) => {
      statBox.fillRoundedRect(x, 145, 140, 28, 3);
      statBox.fillRoundedRect(x, 183, 140, 28, 3);
      statBox.fillRoundedRect(x, 221, 140, 28, 3);
    });
    this.npcProfileStats = [
      addText(this, -136, 151, "", 12, "#d6c9b0", { strokeThickness: 0 }),
      addText(this, 20, 151, "", 12, "#d6c9b0", { strokeThickness: 0 }),
      addText(this, -136, 189, "", 12, "#d6c9b0", { strokeThickness: 0 }),
      addText(this, 20, 189, "", 12, "#d6c9b0", { strokeThickness: 0 }),
      addText(this, -136, 227, "", 12, "#d6c9b0", { strokeThickness: 0 }),
      addText(this, 20, 227, "", 12, "#d6c9b0", { strokeThickness: 0 }),
    ];

    // 关闭按钮与“村长”标题在同一水平线上，符合资料区的阅读顺序。
    const close = this.add.rectangle(145, -37, 24, 24, 0x38291c, 1).setInteractive({ useHandCursor: true });
    const closeText = addText(this, 145, -37, "×", 16, "#c9b797", { strokeThickness: 0 }).setOrigin(0.5);
    this.createProfileButtonTexture("npc-profile-button-chat", 145, 46, "#3c674b", "#234531", "#5d8065");
    this.createProfileButtonTexture("npc-profile-button-friend", 145, 46, "#84651f", "#503b13", "#987936");
    this.createProfileButtonTexture("npc-profile-button-battle", 300, 44, "#684549", "#512d31", "#87595c");
    this.createProfileButtonTexture("npc-profile-button-shop", 300, 44, "#80593b", "#4e3021", "#b28152");
    const chatBackground = this.add.image(-77, 305, "npc-profile-button-chat").setInteractive({ useHandCursor: true });
    const chatIcon = this.add.image(-108, 305, "npc-profile-chat-icon").setDisplaySize(12, 11);
    const chatText = addText(this, -61, 305, "交谈", 16, "#fff3da", { strokeThickness: 0 }).setOrigin(0.5);
    chatBackground.on("pointerover", () => chatBackground.setTint(0xc5ddc8));
    chatBackground.on("pointerout", () => chatBackground.clearTint());
    const friendBackground = this.add.image(77, 305, "npc-profile-button-friend").setInteractive({ useHandCursor: true });
    const friendIcon = this.add.image(43, 305, "npc-profile-friend-icon").setDisplaySize(15, 13);
    const friendText = addText(this, 96, 305, "加为好友", 15, "#fff3da", { strokeThickness: 0 }).setOrigin(0.5);
    // 第三行会随人物身份切换：普通 NPC 是“战斗”，商人则是“购物”。
    this.npcProfileActionBackground = this.add.image(0, 360, "npc-profile-button-battle").setInteractive({ useHandCursor: true });
    this.npcProfileActionIcon = addText(this, -25, 360, "⚔", 21, "#f4d28e", { strokeThickness: 0 }).setOrigin(0.5);
    this.npcProfileActionText = addText(this, 20, 360, "战斗", 17, "#fff0d9", { strokeThickness: 0 }).setOrigin(0.5);
    this.npcProfileActionBackground.on("pointerover", () => this.npcProfileActionBackground.setTint(0xe3c7ca));
    this.npcProfileActionBackground.on("pointerout", () => this.npcProfileActionBackground.clearTint());
    // 所有资料卡按钮都由场景最上层的统一点击判断处理，避免同一次点击
    // 同时关闭卡片、打开商店，又继续穿透到大地图。
    this.npcProfileNotice = addText(this, 0, 280, "", 13, "#d8c9a5", { strokeThickness: 0 }).setOrigin(0.5);
    this.npcProfilePanel.add([
      shade, card, this.npcProfilePortrait, dividerTop, this.npcProfileName, this.npcProfileRealm,
      ...this.npcProfileRows, ...this.npcProfileValues, statBox, ...this.npcProfileStats,
      dividerCenter, dividerBottom, close, closeText, chatBackground, chatIcon, chatText,
      friendBackground, friendIcon, friendText, this.npcProfileActionBackground, this.npcProfileActionIcon, this.npcProfileActionText, this.npcProfileNotice,
    ]);
  }

  /** 打开个人资料，并把 NPC 管理中填写的头像、立绘、属性显示到对应位置。 */
  openNearbyNpcProfile(object) {
    if (!object || object.type !== "npc") return;
    const template = object.npcTemplate || {};
    const profile = template.profile || {};
    this.target = null;
    this.npcProfileObject = object;
    this.npcProfileIsMerchant = this.isMerchantNpc(object);
    // 资料卡标题只显示称谓；“栖霞村”属于地点信息，按效果图不放在标题里。
    this.npcProfileName.setText((object.name || "未命名修士").replace(/^栖霞村/, ""));
    this.npcProfileRealm.setText("");
    this.npcProfileRows[0].setText("境界"); this.npcProfileValues[0].setText(profile.realm || "炼气初期");
    this.npcProfileRows[1].setText("性别"); this.npcProfileValues[1].setText(profile.gender || "未知");
    this.npcProfileRows[2].setText("宗门"); this.npcProfileValues[2].setText(profile.sect || "无门派");
    this.npcProfileRows[3].setText("身份"); this.npcProfileValues[3].setText(profile.identity || "散修");
    const stats = [
      `✦ 气血  ${profile.lifespan || 0}/100`, `✦ 灵力  ${profile.spirit || 0}/50`,
      `⚔ 攻击  ${profile.attack || 0}`, `○ 防御  ${profile.defense || 0}`,
      `✦ 身法  ${profile.agility || 0}`, `◇ 灵根  ${Object.values(profile.roots || {}).filter((value) => Number(value) > 0).join("、") || "无"}`,
    ];
    this.npcProfileStats.forEach((text, index) => text.setText(stats[index]));
    this.npcProfileNotice.setText("");
    if (this.npcProfileIsMerchant) {
      this.npcProfilePortrait.setTexture("merchant-profile-portrait").setOrigin(0.5, 1).setPosition(0, -72).setDisplaySize(203, 270);
      this.npcProfileActionBackground.setTexture("npc-profile-button-shop").clearTint();
      this.npcProfileActionIcon.setText("🛒").setFontSize(17);
      this.npcProfileActionText.setText("购物");
    } else {
      this.setNpcProfilePortrait(template.portraitData || template.avatarData || template.imageData || "", object.id);
      this.npcProfileActionBackground.setTexture("npc-profile-button-battle").clearTint();
      this.npcProfileActionIcon.setText("⚔").setFontSize(21);
      this.npcProfileActionText.setText("战斗");
    }
    this.npcProfilePanel.setAlpha(0).setVisible(true);
    this.tweens.killTweensOf(this.npcProfilePanel);
    this.tweens.add({ targets: this.npcProfilePanel, alpha: 1, duration: 180, ease: "Sine.Out" });
  }

  /** 将上传的 NPC 立绘安全显示在资料卡上。 */
  setNpcProfilePortrait(imageData, objectId) {
    if (!imageData) {
      this.npcProfilePortrait.setTexture("player-idle-5dir", 0).setOrigin(0.5, 1).setPosition(0, -72).setScale(0.7);
      return;
    }
    const textureKey = `npc-profile-${objectId}`;
    const apply = () => {
      if (!this.npcProfilePanel?.visible || this.npcProfileObject?.id !== objectId) return;
      const source = this.textures.get(textureKey).getSourceImage();
      const scale = Math.min(240 / source.width, 270 / source.height);
      this.npcProfilePortrait.setTexture(textureKey).setOrigin(0.5, 1).setPosition(0, -72).setDisplaySize(source.width * scale, source.height * scale);
    };
    if (this.textures.exists(textureKey)) { apply(); return; }
    const image = new Image();
    image.onload = () => { this.textures.addImage(textureKey, image); apply(); };
    image.onerror = () => this.npcProfilePortrait.setTexture("player-idle-5dir", 0).setOrigin(0.5, 1).setPosition(0, -72).setScale(0.7);
    image.src = imageData;
  }

  closeNearbyNpcProfile() {
    this.npcProfilePanel?.setVisible(false);
    this.npcProfileObject = null;
    this.npcProfileIsMerchant = false;
  }

  showNpcProfileNotice(message) {
    this.npcProfileNotice?.setText(message);
  }

  /** 商人身份由 NPC 模板的 merchant 标记控制；旧 NPC 也可直接把身份或名称写成“商人”。 */
  isMerchantNpc(object) {
    const template = object?.npcTemplate || {};
    const profile = template.profile || {};
    return Boolean(template.merchant || object?.merchant || /商人|行商|杂货/.test(`${object?.name || ""}${profile.identity || ""}`));
  }

  /**
   * 未配置大地图立绘的 NPC 会显示「问号 + 圆牌」。圆牌只放一个识别字，
   * 方便玩家在地图上快速区分不同角色；商人始终显示“商”，其余取当前名称
   * 的第一个可见字符。接引人名称会在渲染前替换为“天剑宗接引人”，因此会
   * 自然显示“天”，不需要再为门派 NPC 额外写死分支。
   */
  getNpcMapMarkerText(object) {
    if (this.isMerchantNpc(object)) return "商";
    const name = String(object?.name || object?.npcTemplate?.name || "修士").trim();
    return Array.from(name)[0] || "修";
  }

  activateNpcProfileAction() {
    const object = this.npcProfileObject;
    if (!object) return;
    if (this.npcProfileIsMerchant) {
      this.closeNearbyNpcProfile();
      this.merchantPanel.open(object);
      return;
    }
    this.rememberPlayerPosition();
    this.closeNearbyNpcProfile();
    this.scene.start(SceneKeys.BATTLE, { testBattle: true });
  }

  /**
   * 资料卡内的按钮点击统一在场景坐标中判断。
   * 这避免 Phaser 容器缩放时，透明遮罩盖住图片按钮的实际点击区域。
   */
  handleNpcProfilePointer(pointer) {
    const x = pointer.x - 960;
    const y = pointer.y - 540;
    if (x >= 133 && x <= 157 && y >= -49 && y <= -25) {
      this.closeNearbyNpcProfile();
      return;
    }
    if (y >= 282 && y <= 328 && x >= -150 && x <= -4) {
      const object = this.npcProfileObject;
      this.closeNearbyNpcProfile();
      if (object) this.interactWithMapObject(object);
      return;
    }
    if (y >= 282 && y <= 328 && x >= 4 && x <= 150) {
      this.showNpcProfileNotice("好感系统将在后续章节开放。");
      return;
    }
    if (y >= 338 && y <= 382 && x >= -150 && x <= 150) this.activateNpcProfileAction();
  }


  // 角色菜单外壳统一装配储物袋、法宝和功法子页；场景入口只指定初始页签。
  openStorageBag() {
    this.characterMenu.open("储物袋");
  }

  /**
   * 从地图顶部“法宝”图标直接进入法宝页。
   * 法宝是角色菜单的独立子页，不经过储物袋页面实现。
   */
  openArtifactBag() {
    this.characterMenu.open("法宝");
  }

  /** 从顶部入口直接打开功法页；与法宝一样只负责界面装配。 */
  openTechniqueBag() {
    this.characterMenu.open("功法");
  }

  /** 法术是角色菜单的独立子页，不复用功能说明弹窗。 */
  openSpellPanel() {
    this.characterMenu.open("法术");
  }

  /** 顶部“存档”入口打开独立五档存档页，不再把点击直接当作一次无提示保存。 */
  openSavePanel() {
    this.characterMenu.open("存档");
  }

  closeStorageBag() {
    this.characterMenu.close();
  }

  /** 判断鼠标是否点在顶部 UI 区域，避免图标点击同时被误当成地图自动寻路。 */
  isSettingsButtonPointer(pointer) {
    return this.chapterMapHud?.isPointerOverTopToolbar(pointer) ?? false;
  }

  /** 展示顶部图标尚未开放的功能说明，保证每个 Pixso 图标都有清晰、可用的反馈。 */
  openSimpleFeaturePanel(title, message) {
    if (this.featurePanel) return;
    // 功能说明弹窗也改用通用组件：以后新增“阵法”“炼丹”等说明，只传标题与正文即可。
    this.featureDialog = new XianxiaDialog(this);
    this.featurePanel = this.featureDialog;
    this.featureDialog.open({
      title,
      subtitle: "功能说明",
      body: message,
      width: 694,
      height: 350,
      bodyY: -12,
      buttons: [{ label: "知 晓", variant: "primary", y: 105, onClick: () => this.closeSimpleFeaturePanel() }],
      onClose: () => {
        this.featurePanel = null;
        this.featureDialog = null;
      },
    });
  }

  closeSimpleFeaturePanel() {
    this.featureDialog?.close();
  }

  /** 统一用 1920×1080 坐标命中关闭键，缩放浏览器后仍可稳定关闭。 */
  handleSimpleFeaturePanelPointer(pointer) {
    // 点击由 XianxiaDialog 的独立透明点击区处理；保留方法仅为了兼容旧调用代码。
  }

  /** 打开游戏内设置面板：全屏、窗口化、保存和返回封面都集中在这里。 */
  openGameSettings() {
    if (this.settingsPanel) return;
    // 设置是通用弹窗的第一处实际使用。按钮的颜色语义固定：
    // 蓝灰＝显示设置、金棕＝数据工具、青绿＝安全保存、赤褐＝关闭/离开。
    this.settingsDialog = new XianxiaDialog(this);
    this.settingsPanel = this.settingsDialog;
    this.settingsDialog.open({
      title: "游戏设置",
      subtitle: "全屏、存档与两台电脑的数据同步",
      width: 814,
      height: 660,
      noticeY: 262,
      // 顶部标题区不计入正文中心；按钮组稍向下放置，使上下留白在视觉上完全平衡。
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
      onClose: () => this.resetGameSettingsDialog(),
    });
  }

  /** 浏览器全屏由 Phaser 封装；如果浏览器阻止全屏，游戏仍会保持当前窗口状态。 */
  enterFullscreen() {
    if (!this.scale.isFullscreen) this.scale.startFullscreen();
    this.showSettingsNotice("已请求进入全屏；按 Esc 可退出全屏。", "#c3ebba");
  }

  exitFullscreen() {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    this.showSettingsNotice("已切换为窗口化显示。", "#c3ebba");
  }

  /**
   * 导出前先保存当前角色的即时进度，再交由备份模块下载 JSON 文件。
   * 导出的文件要与 webGame 文件夹一起带到另一台电脑，之后通过“导入数据”恢复。
   */
  exportGameData() {
    saveFirstChapterProgress();
    const result = exportLocalGameData();
    if (result.success) {
      this.showSettingsNotice(`已导出 ${result.count} 项数据：请在浏览器下载列表查看。`, "#c3ebba");
    } else {
      this.showSettingsNotice(result.message || "导出失败。", "#ffb5a2");
    }
  }

  /**
   * 从另一台电脑导出的 JSON 备份恢复资料。
   * 成功后必须刷新网页：各个场景和模板仓库才能重新读取导入后的完整数据。
   */
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
    // 给玩家一点时间看见成功提示，再刷新到导入后的角色/场景状态。
    window.setTimeout(() => window.location.reload(), 700);
  }

  /** 手动保存按钮会把当前生命、灵气、剧情和已击败怪物写回当前角色档案。 */
  saveGameFromMenu() {
    const success = saveFirstChapterProgress();
    this.showSettingsNotice(success ? "保存成功。" : "保存失败：请先进入一个角色档案。", success ? "#c3ebba" : "#ffb5a2");
  }

  /** 先保存再回到封面，避免用户退出时遗漏当前进度。 */
  exitToCover() {
    saveFirstChapterProgress();
    // 设置面板之外还有一组独立透明点击区，必须在切换场景前主动销毁。
    // 否则同一个 VillageScene 实例再次启动时可能保留旧的输入状态。
    this.closeGameSettings();
    this.target = null;
    this.scene.start(SceneKeys.COVER);
  }

  showSettingsNotice(message, color) {
    this.settingsDialog?.setNotice(message, color);
  }

  closeGameSettings() {
    this.settingsDialog?.close();
  }

  /** 统一弹窗真正关闭后才清空引用，避免淡出动画期间重复开启两层设置面板。 */
  resetGameSettingsDialog() {
    this.settingsDialog = null;
    this.settingsPanel = null;
    this.settingsActionHitAreas = null;
    this.settingsInputBlocker = null;
    this.settingsNotice = null;
  }

  /** 返回地图块的 Phaser 资源名称，格式固定，方便多地图统一管理。 */
  getMapTileKey(x, y) {
    return `${this.mapConfig?.id || "qingyun-mountain"}-tile-x${x}-y${y}`;
  }

  /**
   * 返回地图块文件路径。
   * 用户提供的原始排序是“行_列”：例如同一行从 0_0、0_1、0_2 向右排列，
   * 下一行才是 1_0。因此世界坐标的 x/y 在读取文件时需要交换。
   */
  getMapTilePath(x, y) {
    return `./public/assets/images/maps/qingyun-mountain/tiles/tile-x${y}-y${x}.webp`;
  }

  /**
   * 将已经加载完成的地图块放到正确的世界位置。
   * 每块图的左上角与相邻图片严丝合缝，不会产生缩放接缝。
   */
  showMapTile(x, y) {
    const key = this.getMapTileKey(x, y);
    if (this.mapTileObjects.has(key) || !this.textures.exists(key)) return;

    const tile = this.add.image(x * this.mapConfig.tileSize, y * this.mapConfig.tileSize, key)
      .setOrigin(0, 0)
      .setScale(this.mapConfig.displayScale)
      .setDepth(-10);
    // 地图块会在探索途中异步加载。创建后必须立刻排除 1:1 的 UI 镜头；
    // 若等到下一次低频镜头同步，短暂的双镜头绘制会把新地图块覆盖在错误的屏幕坐标上，
    // 玩家移动到新区域时就会看见一次闪屏。
    this.uiCamera?.ignore(tile);
    this.mapTileObjects.set(key, tile);
  }

  /**
   * 根据主角当前位置维护“附近 3×3 块”地图。
   * 好处是青云山再大也不会一次加载 25 张超大图片；未来 100×100 块地图同样可用。
   */
  refreshNearbyMapTiles() {
    const currentX = Phaser.Math.Clamp(Math.floor(this.player.x / this.mapConfig.tileSize), 0, this.mapConfig.columns - 1);
    const currentY = Phaser.Math.Clamp(Math.floor(this.player.y / this.mapConfig.tileSize), 0, this.mapConfig.rows - 1);

    for (let x = Math.max(0, currentX - 1); x <= Math.min(this.mapConfig.columns - 1, currentX + 1); x += 1) {
      for (let y = Math.max(0, currentY - 1); y <= Math.min(this.mapConfig.rows - 1, currentY + 1); y += 1) {
        this.requestMapTile(x, y);
      }
    }

    // 超出主角两块距离的图片会被释放，保证长时间探索也不会持续占用显存。
    for (const [key, tile] of this.mapTileObjects) {
      const match = key.match(/tile-x(\d+)-y(\d+)$/);
      if (!match) continue;
      const tileX = Number(match[1]);
      const tileY = Number(match[2]);
      if (Math.abs(tileX - currentX) > 2 || Math.abs(tileY - currentY) > 2) {
        tile.destroy();
        this.mapTileObjects.delete(key);
        this.textures.remove(key);
      }
    }
  }

  /** 请求一张尚未加载的地图块；加载完成后立即显示到世界中。 */
  requestMapTile(x, y) {
    const key = this.getMapTileKey(x, y);
    if (this.textures.exists(key)) {
      this.showMapTile(x, y);
      return;
    }
    if (this.mapTilesLoading.has(key)) return;

    this.mapTilesLoading.add(key);
    this.load.once(`filecomplete-image-${key}`, () => {
      this.mapTilesLoading.delete(key);
      this.showMapTile(x, y);
    });
    this.load.image(key, this.getMapTilePath(x, y));
    this.load.start();
  }

  drawQingyunMountain() {
    this.cameras.main.setBackgroundColor("#1f3430");
    // preload 已加载存档位置周围的地图块；这里立即放进正确世界坐标。
    for (const [x, y] of this.initialMapTiles || []) this.showMapTile(x, y);
  }

  /** 将地图编辑器保存的对象显示为第一章中的真实交互对象。 */
  renderEditorObjects() {
    const objects = [...getMapObjects(this.mapConfig.id)];
    // 第一位云游商人是第一章的基础功能 NPC：若地图编辑器还没有放置商人，
    // 就临时站在栖霞村出生点附近。玩家以后自己在地图编辑器放置商人时，这个默认角色自动消失。
    if (!objects.some((object) => object.type === "npc" && (object.npcTemplateId === "npc-qixia-merchant" || this.isMerchantNpc(object)))) {
      objects.push({
        id: "chapter-default-traveling-merchant",
        type: "npc",
        name: "云游商人",
        x: 1170,
        y: 1320,
        npcTemplateId: "npc-qixia-merchant",
      });
    }
    // 先统一挂载所有模板，再判断“哪个 NPC 位于门派旁边”。这样无论对象在文件中的先后顺序如何，
    // 接引人识别都不会因为门派建筑尚未遍历到而失败。
    objects.forEach((object) => {
      if (object.type === "monster" && object.monsterTemplateId) {
        const template = getMonsterTemplate(object.monsterTemplateId);
        if (template) Object.assign(object, { name: template.name, battle: template, drops: template.drops });
      }
      if (object.type === "npc" && object.npcTemplateId) {
        const template = getNpcTemplate(object.npcTemplateId);
        if (template) Object.assign(object, { name: template.name, dialogue: template.dialogue, npcTemplate: template });
      }
      if (object.type === "building" && object.buildingTemplateId) {
        const template = getBuildingTemplate(object.buildingTemplateId);
        if (template) Object.assign(object, { name: template.name, buildingTemplate: template });
      }
    });
    this.editorObjects = objects;
    this.editorActors = new Map();
    objects.forEach((object) => {
      // 新版怪物只存模板编号；在进入地图时读取模板的最新战斗数据。
      if (object.type === "monster" && object.monsterTemplateId) {
        const template = getMonsterTemplate(object.monsterTemplateId);
        if (template) Object.assign(object, { name: template.name, battle: template, drops: template.drops });
      }
      if (object.type === "npc" && object.npcTemplateId) {
        const template = getNpcTemplate(object.npcTemplateId);
        if (template) Object.assign(object, { name: template.name, dialogue: template.dialogue, npcTemplate: template });
      }
      if (object.type === "building" && object.buildingTemplateId) {
        const template = getBuildingTemplate(object.buildingTemplateId);
        if (template) Object.assign(object, { name: template.name, buildingTemplate: template });
      }
      if (object.type === "npc") {
        const guideContext = this.sectAccessService.getGuideContext(object, objects);
        if (guideContext?.guide?.title) object.name = guideContext.guide.title;
      }
      // 已被这个角色击败的怪物，不会再次出现在地图中。
      if (object.type === "monster" && gameState.world.defeatedMonsterIds.includes(object.id)) return;
      const info = MAP_OBJECT_TYPES[object.type] || MAP_OBJECT_TYPES.npc;
      const instanceScale = Number(object.scale) || 1;
      const markerDepth = object.type === "building"
        ? this.worldBuildingDepth(this.worldObjectSortY(object))
        : this.worldActorDepth(object.y);
      const marker = this.add.container(object.x, object.y).setDepth(markerDepth);
      const shadow = this.add.ellipse(0, 4 * instanceScale, 50, 13, 0x17221e, 0.32).setScale(instanceScale);
      let portrait;
      let questionMark = null;
      let markerNumber = null;
      let buildingLabel = null;
      let labelY = -58 * instanceScale;
      let typeLabelY = -39 * instanceScale;
      const isMerchant = object.type === "npc" && this.isMerchantNpc(object);
      // 商人与普通修士一样：没有专用“大地图立绘”时只显示问号交互标记，
      // 不直接把对话立绘摆到地图上。
      const npcNeedsMapPortrait = object.type === "npc" && !object.npcTemplate?.mapPortraitData;
      if (object.type === "npc") {
        if (npcNeedsMapPortrait) {
          // 还没有游戏地图立绘：显示「问号 + 圆牌」，避免把对话头像误当作地图角色。
          shadow.setVisible(false);
          portrait = this.add.circle(0, 20 * instanceScale, 23, 0xd1c5af, 1).setStrokeStyle(2, 0x5b4d40).setScale(instanceScale);
          questionMark = this.add.image(0, -37 * instanceScale, "npc-map-question-mark").setDisplaySize(43 * instanceScale, 56 * instanceScale).setOrigin(0.5);
          const markerText = this.getNpcMapMarkerText(object);
          markerNumber = addText(this, 0, 20 * instanceScale, markerText, markerText === "商" ? 21 : 19, "#30271f", { strokeThickness: 0 }).setOrigin(0.5).setScale(instanceScale);
        } else {
          // 已上传专用地图立绘时，按原比例放到角色站立点。
          portrait = this.add.image(0, 0, "player-idle-5dir", 0).setOrigin(0.5, 0.86).setScale(0.32 * instanceScale);
        }
        if (!npcNeedsMapPortrait && object.npcTemplate?.mapPortraitData) {
          const textureKey = `map-npc-custom-${object.npcTemplate.id}`;
          const applyNpcPortrait = () => {
            const source = this.textures.get(textureKey).getSourceImage();
            const scale = Math.min(120 / source.width, 135 / source.height) * instanceScale;
            if (portrait.active) portrait.setTexture(textureKey).setDisplaySize(source.width * scale, source.height * scale);
          };
          if (this.textures.exists(textureKey)) applyNpcPortrait();
          else this.textures.addBase64(textureKey, object.npcTemplate.mapPortraitData, applyNpcPortrait);
        }
      } else if (object.type === "monster") {
        portrait = this.add.image(0, 0, "map-monster-portrait").setOrigin(0.5, 0.87).setScale(0.34 * instanceScale).setTint(0xe9b4b4);
        // 怪物编辑器上传的是 Base64 图片数据。首次进入地图时异步注册纹理，
        // 注册完成后直接替换当前立绘，不需要玩家重新进入场景。
        const appearance = resolveMonsterAppearance(object.battle);
        if (appearance.staticImageData) {
          const textureKey = getMonsterAppearanceTextureKey(object.battle, "map-monster-custom");
          const applyMonsterPortrait = () => {
            if (!portrait.active || !this.textures.exists(textureKey)) return;
            const source = this.textures.get(textureKey).getSourceImage();
            const scale = Math.min(105 / source.width, 130 / source.height, 1) * instanceScale;
            portrait.setTexture(textureKey).clearTint().setDisplaySize(source.width * scale, source.height * scale);
          };
          if (this.textures.exists(textureKey)) {
            applyMonsterPortrait();
          } else {
            const image = new Image();
            image.onload = () => {
              if (!this.textures.exists(textureKey)) this.textures.addImage(textureKey, image);
              applyMonsterPortrait();
            };
            image.src = appearance.staticImageData;
          }
        }
      } else if (object.type === "building") {
        const appearance = resolveBuildingAppearance(object.buildingTemplate);
        const width = appearance.width * instanceScale;
        const height = appearance.height * instanceScale;
        const originY = appearance.anchor === "center" ? 0.5 : 1;
        shadow.setVisible(false);
        portrait = this.add.image(0, 0, "__WHITE").setOrigin(0.5, originY).setTint(info.color)
          .setDisplaySize(appearance.imageData ? width : 58 * instanceScale, appearance.imageData ? height : 58 * instanceScale);
        const buildingTopY = appearance.anchor === "center" ? -height / 2 : -height;
        buildingLabel = createBuildingMapLabel(this, {
          name: object.name,
          buildingTopY,
        });
        if (appearance.imageData) {
          const textureKey = getBuildingAppearanceTextureKey(object.buildingTemplate, "map-building-custom");
          const applyBuildingImage = () => {
            if (!portrait.active || !this.textures.exists(textureKey)) return;
            portrait.setTexture(textureKey).clearTint().setDisplaySize(width, height);
          };
          if (this.textures.exists(textureKey)) applyBuildingImage();
          else {
            const image = new Image();
            image.onload = () => {
              if (!this.textures.exists(textureKey)) this.textures.addImage(textureKey, image);
              applyBuildingImage();
            };
            image.src = appearance.imageData;
          }
        }
      } else {
        portrait = this.add.circle(0, -6 * instanceScale, 22, info.color, 0.92).setStrokeStyle(3, 0xfff0bd).setScale(instanceScale);
      }
      // 问号标记严格保持图 2 的简洁样式；姓名与交互提示在靠近后的左下信息卡显示。
      const label = npcNeedsMapPortrait || object.type === "building" ? null : addText(this, 0, labelY, object.name, 14, "#fff8de", { origin: 0.5 });
      const typeLabel = npcNeedsMapPortrait || object.type === "building" ? null : addText(this, 0, typeLabelY, object.type === "monster" ? "怪物 · 按 E 战斗" : isMerchant ? "商人 · 按 E 购物" : object.type === "npc" ? "NPC · 按 E 对话" : info.name, 11, "#e2efcf", { origin: 0.5, strokeThickness: 2 });
      marker.add([shadow, portrait, questionMark, markerNumber, buildingLabel, label, typeLabel].filter(Boolean));
      if (object.type === "npc") {
        // NPC 既保留靠近后按 E，也支持直接点击；距离不足时先自动走近，避免接引流程只靠键盘。
        const interactionZone = this.add.zone(0, -22 * instanceScale, 110 * instanceScale, 150 * instanceScale)
          .setInteractive({ useHandCursor: true });
        marker.add(interactionZone);
        interactionZone.on("pointerdown", (_pointer, _localX, _localY, event) => {
          event?.stopPropagation?.();
          const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, object.x, object.y);
          if (distance <= 74) this.interactWithMapObject(object);
          else this.target = new Phaser.Math.Vector2(object.x, object.y);
        });
      }
      if (questionMark) {
        // 问号持续轻轻上下浮动，提示这里有尚未制作地图立绘的可交互 NPC。
        this.tweens.add({
          targets: questionMark,
          y: -43 * instanceScale,
          // 一次上升或下降 0.42 秒；完整往返约 0.84 秒，比旧版更灵敏，
          // Sine.InOut 在两个折返点都会自然减速，不会出现生硬跳动。
          duration: 420,
          ease: "Sine.InOut",
          yoyo: true,
          repeat: -1,
        });
      }
      this.editorActors.set(object.id, { object, marker });
    });
  }

  update(_, delta) {
    // 面板、地图块和奖励弹窗可能在运行中才创建；低频同步即可保证它们进入正确镜头，
    // 又不需要在每个 UI 模块里手工维护镜头名单。
    this.cameraLayerSyncElapsed += delta;
    if (this.cameraLayerSyncElapsed >= 250) {
      this.cameraLayerSyncElapsed = 0;
      this.syncExploreCameraLayers();
    }
    this.positionRememberElapsed += delta;
    if (this.positionRememberElapsed >= 2000) {
      this.positionRememberElapsed = 0;
      this.rememberPlayerPosition();
    }
    this.autoSaveCheckElapsed += delta;
    if (this.autoSaveCheckElapsed >= 1000) {
      this.autoSaveCheckElapsed = 0;
      if (this.saveArchiveService.shouldAutoSave()) {
        this.rememberPlayerPosition();
        if (saveFirstChapterProgress()) this.saveArchiveService.markAutoSaved();
      }
    }
    if (this.itemRewardPopup?.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.itemRewardPopup.hide();
      return;
    }
    if (this.npcProfilePanel?.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.closeNearbyNpcProfile();
      return;
    }
    if (this.characterMenu.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.closeStorageBag();
      return;
    }
    if (this.merchantPanel.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.merchantPanel.close();
      return;
    }
    if (this.dialog.visible) {
      if (this.dialogTree && this.currentDialogueChoices?.length) {
        // 分支对话除了鼠标和数字键，也允许沿用地图最常用的 E / 空格确认第一项。
        // 古玉战斗选择因此不会出现“文字说按 E，实际却只能按数字”的假卡死。
        if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.E)) {
          this.chooseDialogueChoice(this.currentDialogueChoices[0]);
        }
        [this.keys.ONE, this.keys.TWO, this.keys.THREE, this.keys.FOUR].forEach((key, index) => {
          if (Phaser.Input.Keyboard.JustDown(key) && this.currentDialogueChoices[index]) this.chooseDialogueChoice(this.currentDialogueChoices[index]);
        });
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.E)) this.advanceDialogue();
      // Esc 与按钮作用相同：直接返回地图，且不触发对话结束后的战斗回调。
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.closeDialogue();
      return;
    }
    // 不必每一帧检查地图块；每 0.3 秒检查一次即可，性能更稳定。
    this.mapStreamElapsed += delta;
    if (this.mapStreamElapsed >= 300) {
      this.mapStreamElapsed = 0;
      this.refreshNearbyMapTiles();
    }
    const speed = 200;
    let dx = 0;
    let dy = 0;
    let isMoving = false;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;
    if (dx || dy) {
      this.target = null;
      const length = Math.hypot(dx, dy) || 1;
      this.movePlayer((dx / length) * speed * delta / 1000, (dy / length) * speed * delta / 1000);
      isMoving = true;
    } else if (this.target) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
      if (distance < 5) this.target = null;
      else {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.target.x, this.target.y);
        this.movePlayer(Math.cos(angle) * speed * delta / 1000, Math.sin(angle) * speed * delta / 1000);
        isMoving = true;
      }
    }
    this.updatePlayerAnimation(isMoving);
    const playerDepth = this.worldActorDepth(this.player.y);
    this.player.setDepth(playerDepth);
    this.playerName.setPosition(this.player.x, this.player.y - this.player.displayHeight * this.player.originY - 8).setDepth(playerDepth + 0.002);
    this.playerShadow.setPosition(this.player.x, this.player.y + 17).setDepth(playerDepth - 0.002);
    // 同步小地图的蓝色主角点，并记录走过的区域来逐步揭开探索迷雾。
    this.chapterMapHud?.updateMiniMap(this.player.x, this.player.y, this.worldSize);
    this.updateQuestGuide();
    this.updateNearbyInteraction();
    this.updateNearbySectEntrance();
    this.updateQingyunAdventureInteraction();
  }

  /** 寻找最近的编辑器对象，并在底部告诉玩家可以做什么。 */
  updateNearbyInteraction() {
    let nearest = null;
    // 信息卡的发现范围按地图上的大红圈设置；玩家不用贴到 NPC 身边才知道附近有人。
    const nearbyCardRange = 280;
    // 真正的 E 键交互仍需走近，避免隔着一大片地图直接开始对话或战斗。
    const interactionRange = 74;
    let nearestDistance = nearbyCardRange;
    this.editorActors?.forEach((actor) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, actor.object.x, actor.object.y);
      if (distance < nearestDistance) {
        nearest = actor;
        nearestDistance = distance;
      }
    });
    this.nearbyActor = nearest;
    const canInteract = Boolean(nearest && nearestDistance <= interactionRange);
    this.chapterMapHud?.setNearby(nearest?.object || null, canInteract);
    if (nearest) {
      const isMerchant = nearest.object.type === "npc" && this.isMerchantNpc(nearest.object);
      // 同步更新左下“附近修士”卡片，让 Pixso 设计稿中的信息区变成真实动态数据。
      this.nearbyNameText?.setText(nearest.object.name);
      this.nearbyRealmText?.setText(canInteract
        ? (nearest.object.type === "monster" ? "妖兽 · 可进入战斗" : isMerchant ? "商人 · 可购物" : "练气初期 · 可交谈")
        : `在附近 · 靠近后可${isMerchant ? "购物" : "交谈"}`);
      const action = nearest.object.type === "monster" ? "战斗" : isMerchant ? "购物" : nearest.object.type === "npc" ? "对话" : "查看";
      this.operationHint.setText(canInteract ? `靠近 ${nearest.object.name}：按 E ${action}。` : `发现 ${nearest.object.name}：继续靠近后可按 E ${action}。`);
      if (canInteract && Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interactWithMapObject(nearest.object);
    } else {
      this.nearbyNameText?.setText("暂未发现");
      this.nearbyRealmText?.setText("靠近 NPC 可交谈");
      this.operationHint.setText("操作：WASD / 方向键移动；鼠标点击自动前往；靠近人物或怪物按 E 交互。");
    }
  }

  /** 根据对象类型执行对应功能：NPC 对话、怪物战斗，其他对象显示说明。 */
  interactWithMapObject(object) {
    this.target = null;
    // 切换到战斗场景前先记住脚下位置；战斗结束返回时会原地恢复。
    this.rememberPlayerPosition();
    if (object.type === "npc") {
      if (this.isMerchantNpc(object)) {
        this.openNearbyNpcProfile(object);
        return;
      }
      // 地图上的问号与编号只用于引导；进入对话后隐藏，避免看起来像出现两个问题。
      this.dialogMapObjectId = object.id;
      this.setDialogueMapMarkerVisible(false);
      const guideContext = this.sectAccessService.getGuideContext(object, this.editorObjects);
      const hasConfiguredReward = this.npcInteractionService.hasDialogueReward(object.npcTemplate);
      if (guideContext && !hasConfiguredReward) {
        const ownsToken = this.sectAccessService.hasAccessToken(guideContext.sect);
        this.dialogNameText.setText(guideContext.guide.title || object.name || "接引人");
        this.openDialogue(
          ownsToken ? guideContext.guide.repeatDialogue : guideContext.guide.dialogue,
          ownsToken ? null : () => this.grantSectGuideToken(object),
          object.npcTemplate?.portraitData,
        );
        return;
      }
      this.dialogNameText.setText((object.name || "修士").replace(/^栖霞村/, ""));
      this.openDialogue(
        object.dialogue,
        hasConfiguredReward ? () => this.completeNpcDialogueInteraction(object) : null,
        object.npcTemplate?.portraitData,
        object.npcTemplate?.dialogueTree,
      );
    } else if (object.type === "monster") {
      this.scene.start(SceneKeys.BATTLE, { mapMonster: object });
    } else if (object.type === "building") {
      const sect = this.sectAccessService.resolveForBuilding(object);
      if (sect) {
        const appearance = resolveBuildingAppearance(object.buildingTemplate);
        this.showSectEntrancePrompt(sect, object, appearance, Number(object.scale) || 1);
      } else {
        this.dialogNameText.setText(object.name || "建筑");
        this.openDialogue([object.buildingTemplate?.interactionText || `${object.name}：目前是第一章原型建筑。`]);
      }
    } else {
      this.dialogNameText.setText(object.name || "提示");
      this.openDialogue([`${object.name}：传送点已被记录。后续区域地图完成后，可以在这里配置目的地。`]);
    }
  }

  /** 靠近门派碰撞边缘后自动显示入口；离开范围立即隐藏。 */
  updateNearbySectEntrance() {
    let nearest = null;
    this.editorActors?.forEach((actor) => {
      if (actor.object.type !== "building") return;
      const sect = this.sectAccessService.resolveForBuilding(actor.object);
      if (!sect) return;
      const distance = getDistanceToBuildingCollision(this.player, actor.object);
      const range = Math.max(0, Number(sect.building?.autoPromptRange) || 320);
      if (distance > range || (nearest && distance >= nearest.distance)) return;
      nearest = { object: actor.object, sect, distance };
    });
    if (!nearest) {
      this.sectEntrancePrompt.hide();
      return;
    }
    const appearance = resolveBuildingAppearance(nearest.object.buildingTemplate);
    this.showSectEntrancePrompt(nearest.sect, nearest.object, appearance, Number(nearest.object.scale) || 1);
  }

  /** 把自动出现的入口按钮放在建筑画面中央。 */
  showSectEntrancePrompt(sect, buildingObject, appearance, instanceScale = 1) {
    const displayedHeight = (Number(appearance?.height) || 256) * instanceScale;
    const originOffset = appearance?.anchor === "center" ? 0 : displayedHeight / 2;
    const view = this.cameras.main.worldView;
    // 巨型建筑可能只有一角露在屏幕里；入口按钮要限制在当前可视区域，且避开右侧 HUD。
    const x = Phaser.Math.Clamp(buildingObject.x, view.left + 150, view.right - 400);
    const y = Phaser.Math.Clamp(buildingObject.y - originOffset, view.top + 150, view.bottom - 180);
    this.sectEntrancePrompt.show({ sect, buildingObject, x, y });
  }

  /** 门派入口统一走准入领域服务；令牌只判定持有，不会被消耗。 */
  tryEnterSect(sect) {
    this.sectEntrancePrompt.hide();
    const access = this.sectAccessService.evaluate(sect.id);
    if (!access.ok) {
      this.dialogNameText.setText(sect.name);
      this.openDialogue([
        `山门禁制尚未认可你的身份。${access.message}`,
        "可与宗门附近的接引人完成对话，取得入门令牌后再来。",
      ]);
      return;
    }
    this.rememberPlayerPosition();
    saveFirstChapterProgress();
    this.scene.start(SceneKeys.SECT, { sectId: sect.id });
  }

  /** 完成接引人对话后由服务发放令牌，再显示通用获得物品弹窗。 */
  grantSectGuideToken(npcObject) {
    const result = this.sectAccessService.grantGuideToken(npcObject, this.editorObjects);
    if (!result.ok) return;
    this.itemRewardPopup.show(this.itemCatalog.getById(result.itemId), result.quantity);
  }

  /** 结算 NPC 编辑器配置的对话赠礼；场景只负责展示，发放和防重复由领域服务完成。 */
  completeNpcDialogueInteraction(npcObject) {
    const result = this.npcInteractionService.completeDialogue(npcObject?.npcTemplate);
    if (!result.ok) return result;
    this.itemRewardPopup.showMany(result.grants);
    return result;
  }

  /** 开始一段可翻页的对话；最后一句结束后执行可选回调。 */
  openDialogue(lines, onFinish = null, portraitData = "", dialogueTree = null) {
    this.dialogLines = Array.isArray(lines) ? lines : [String(lines)];
    this.dialogIndex = 0;
    this.dialogFinish = onFinish;
    this.dialogTree = dialogueTree?.nodes?.length ? dialogueTree : null;
    this.dialogNodeId = this.dialogTree?.startId || null;
    this.dialogNpcName = this.dialogNameText.text || "修士";
    this.dialogPendingChoice = null;
    this.dialogChoiceDelay?.remove(false);
    this.dialogChoiceDelay = null;
    this.clearDialogueChoiceHitAreas();
    this.setQuestGuideVisible(false);
    this.dialog.setVisible(true);
    this.dialogReturnButton.setVisible(false);
    // 流雨属于对话固定角色，不再因 NPC 尚未上传立绘而被一并隐藏。
    this.dialogPlayerPortrait.setVisible(Boolean(this.dialogTree || portraitData));
    this.setDialoguePortrait(portraitData);
    this.setDialogueSpeaker("npc");
    this.showCurrentDialogueLine();
  }

  /** 切换对话半身立绘；没有上传时仍保持紧凑对话版式。 */
  setDialoguePortrait(portraitData) {
    if (!portraitData) {
      this.dialogPortrait.setVisible(false);
      this.dialogText.setPosition(535, 792).setWordWrapWidth(885);
      return;
    }
    const textureKey = "npc-dialogue-portrait";
    const requestId = (this.dialogPortraitRequestId || 0) + 1;
    this.dialogPortraitRequestId = requestId;
    const applyPortrait = () => {
      // 只允许最后一次打开的对话更新画面，防止退出后旧图片异步回来覆盖新状态。
      if (!this.dialog.active || !this.dialog.visible || requestId !== this.dialogPortraitRequestId) return;
      const source = this.textures.get(textureKey).getSourceImage();
      const scale = Math.min(260 / source.width, 360 / source.height);
      this.dialogPortrait.setTexture(textureKey).setOrigin(0.5, 1).setPosition(590, 760).setDisplaySize(source.width * scale, source.height * scale).setVisible(true);
      this.dialogText.setPosition(535, 792).setWordWrapWidth(885);
    };
    const image = new Image();
    image.onload = () => {
      if (requestId !== this.dialogPortraitRequestId || !this.dialog.visible) return;
      if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
      this.textures.addImage(textureKey, image);
      applyPortrait();
    };
    image.onerror = () => {
      if (requestId !== this.dialogPortraitRequestId) return;
      this.dialogPortrait.setVisible(false);
      this.dialogText.setPosition(535, 792).setWordWrapWidth(885);
    };
    image.src = portraitData;
  }

  showCurrentDialogueLine() {
    if (this.dialogTree) return this.showDialogueNode();
    this.setDialogueSpeaker("npc");
    const suffix = this.dialogIndex < this.dialogLines.length - 1 ? "\n\n按 空格 / E 继续" : "\n\n按 空格 / E 结束";
    this.dialogText.setText(this.dialogLines[this.dialogIndex] + suffix);
    this.renderDialogueChoices([]);
  }

  /** 展示分支节点：NPC 回复在上方，主角可选回答显示为可点击按钮。 */
  showDialogueNode() {
    const node = this.dialogTree.nodes.find((entry) => entry.id === this.dialogNodeId);
    if (!node) return this.finishDialogue();
    this.setDialogueSpeaker("npc");
    const choices = (node.choices || []).filter((choice) => choice.text);
    this.currentDialogueChoices = choices;
    this.dialogText.setText(`${this.formatDialogueText(node.text) || "……"}${choices.length ? "" : "\n\n按 空格 / E 结束"}`);
    this.renderDialogueChoices(choices);
  }

  /** 村长名字已在羊皮纸标签中显示，正文不再重复“村长：”，避免看起来像两段问题。 */
  formatDialogueText(text) {
    if (this.dialogNameText.text !== "村长") return String(text || "");
    return String(text || "")
      .replace(/(?:栖霞村)?村长：?/g, "")
      .replace(/\s*\n\s*/g, " ")
      .trim();
  }

  /** 重画姓名标签；NPC 在左，主角发言时移到右侧。 */
  drawDialogNameTab(x) {
    this.dialogNameTab.clear();
    this.dialogNameTab.fillStyle(0xb7632f, 1);
    this.dialogNameTab.fillRoundedRect(x, 730, 96, 32, 5);
    this.dialogNameTab.lineStyle(2, 0x63351f, 1);
    this.dialogNameTab.strokeRoundedRect(x, 730, 96, 32, 5);
    this.dialogNameTab.lineStyle(1, 0xd28a50, 0.7);
    this.dialogNameTab.strokeRoundedRect(x + 2, 732, 92, 28, 4);
  }

  /** 仅显示当前说话者的立绘：村长发言时不显示流雨，流雨发言时再显示她。 */
  setDialogueSpeaker(speaker) {
    const playerSpeaking = speaker === "player";
    this.dialogSpeaker = speaker;
    this.dialogPortrait.setAlpha(playerSpeaking ? 0.28 : 1);
    this.dialogPlayerPortrait.setVisible(playerSpeaking).setAlpha(1);
    const tabX = playerSpeaking ? 1322 : 508;
    this.drawDialogNameTab(tabX);
    this.dialogNameText
      .setPosition(tabX + 48, 746)
      .setText(playerSpeaking ? gameState.player.name : (this.dialogNpcName || "修士"));
  }

  renderDialogueChoices(choices) {
    this.dialogChoices.removeAll(true);
    this.clearDialogueChoiceHitAreas();
    this.currentDialogueChoices = choices;
    choices.slice(0, 4).forEach((choice, index) => {
      // 文字保持效果图的轻量样式，整行点击由下方透明区域处理。
      const label = addText(this, 545, 864 + index * 34, `${index + 1}.  ${choice.text}`, 16, "#4d3326", { strokeThickness: 0 });
      this.dialogChoices.add(label);
      const hitArea = this.add.zone(985, 864 + index * 34, 880, 32)
        .setScrollFactor(0)
        .setDepth(1502)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => this.chooseDialogueChoice(choice));
      this.dialogChoiceHitAreas.push(hitArea);
    });
  }

  /** 移除对话专用透明点击层，退出与再次进入不会遗留在地图上。 */
  clearDialogueChoiceHitAreas() {
    (this.dialogChoiceHitAreas || []).forEach((hitArea) => {
      hitArea.removeInteractive();
      hitArea.destroy();
    });
    this.dialogChoiceHitAreas = [];
  }

  chooseDialogueChoice(choice) {
    if (!this.dialogTree) return;
    playUiClickSound(this);
    // 选择后立即进入下一段，避免停在主角发言状态而无法继续点击。
    this.resolveDialogueChoice(choice);
  }

  /** 主角回答展示完成后，跳转到对应 NPC 回复或结束对话。 */
  resolveDialogueChoice(choice) {
    if (!this.dialog.visible) return;
    this.dialogPendingChoice = null;
    this.dialogChoiceDelay = null;
    // 兼容已经保存过的旧版村长对话：早期“我愿意前往”没有写入 action，
    // 现在也会立刻接取主线并刷新右侧任务栏。
    const acceptsQingyunQuest = choice.action === "accept-qingyun-investigation"
      || ["elder-start-1", "elder-accept-1", "elder-clue-1", "elder-worry-1"].includes(choice.id);
    if (acceptsQingyunQuest) this.acceptQingyunInvestigation();
    if (choice.action === "qingyun-safe-route") {
      this.finishDialogue();
      this.chooseQingyunPath(QUEST_EVENTS.SAFE_PATH_CHOSEN);
      return;
    }
    if (choice.action === "qingyun-risk-route") {
      this.finishDialogue();
      this.chooseQingyunPath(QUEST_EVENTS.RISK_PATH_CHOSEN);
      return;
    }
    if (choice.action === "qingyun-jade-battle") {
      this.finishDialogue();
      this.scene.start(SceneKeys.BATTLE, { testBattle: true });
      return;
    }
    if (choice.action === "qingyun-jade-leave") {
      this.finishDialogue();
      this.operationHint?.setText("古玉已取得。想再次试战时，靠近玉光按 E 即可。");
      return;
    }
    if (choice.nextId && this.dialogTree.nodes.some((node) => node.id === choice.nextId)) {
      this.dialogNodeId = choice.nextId;
      this.showDialogueNode();
      return;
    }
    this.finishDialogue();
  }

  /** 对话框的点击入口：不依赖文字对象本身，画面缩放时选项也能稳定点击。 */
  handleDialoguePointer(pointer) {
    const choices = this.currentDialogueChoices || [];
    // 分支选择由每行透明点击区处理，避免页面缩放后坐标换算出现偏差。
    if (choices.length) return;
    // 没有选项的普通对话，可直接点击羊皮纸继续阅读。
    if (!choices.length && pointer.x >= 500 && pointer.x <= 1470 && pointer.y >= 760 && pointer.y <= 1020) this.advanceDialogue();
  }

  /** 显示或隐藏当前正在对话的地图 NPC 引导标记。 */
  setDialogueMapMarkerVisible(visible) {
    if (!this.dialogMapObjectId) return;
    this.editorActors?.get(this.dialogMapObjectId)?.marker?.setVisible(visible);
  }

  advanceDialogue() {
    if (this.dialogTree) return this.finishDialogue();
    this.dialogIndex += 1;
    if (this.dialogIndex < this.dialogLines.length) return this.showCurrentDialogueLine();
    this.finishDialogue();
  }

  finishDialogue() {
    this.dialog.setVisible(false);
    this.dialogPortrait.setVisible(false);
    this.dialogPlayerPortrait.setVisible(false);
    this.dialogReturnButton.setVisible(false);
    this.renderDialogueChoices([]);
    this.dialogTree = null;
    this.dialogPendingChoice = null;
    this.dialogChoiceDelay?.remove(false);
    this.dialogChoiceDelay = null;
    this.clearDialogueChoiceHitAreas();
    this.setDialogueMapMarkerVisible(true);
    this.dialogMapObjectId = null;
    const finish = this.dialogFinish;
    this.dialogFinish = null;
    if (finish) finish();
  }

  /**
   * 主动关闭对话：清除结束回调，因此“返回地图”绝不会误触发战斗。
   * 这个方法也可复用于今后的任务对话、商店对话等场景。
   */
  closeDialogue() {
    this.dialog.setVisible(false);
    this.dialogPortrait.setVisible(false);
    this.dialogPlayerPortrait.setVisible(false);
    this.dialogReturnButton.setVisible(false);
    this.renderDialogueChoices([]);
    this.dialogTree = null;
    this.dialogFinish = null;
    this.dialogPendingChoice = null;
    this.dialogChoiceDelay?.remove(false);
    this.dialogChoiceDelay = null;
    this.clearDialogueChoiceHitAreas();
    this.setDialogueMapMarkerVisible(true);
    this.dialogMapObjectId = null;
  }

  /** 村长的“我现在就出发”选择会开启主线、刷新任务栏并显示古潭任务地点。 */
  acceptQingyunInvestigation() {
    const result = this.questService.acceptQuest(QINGYUN_INVESTIGATION_ID);
    if (!result.ok) return result;
    // 第一次接取任务就自动开始引路。新玩家不会因为不知道“任务日志”入口而在出生点迷路；
    // 仍可在日志中关闭/重开，不改变领域层的手动引路规则。
    this.questService.setGuideEnabled(QINGYUN_INVESTIGATION_ID, true);
    this.chapterMapHud?.updateQuestPanel();
    this.updateQingyunQuestMarker();
    this.showQuestAcceptedNotice();
    this.updateQuestGuide();
    return result;
  }

  /** 供任务日志的“重新体验”按钮调用；旧档可直接回到第一步试玩新的主线循环。 */
  restartQingyunQuest() {
    const result = this.questService.restartChapter();
    if (!result.ok) return result;
    this.target = null;
    this.chapterMapHud?.updateQuestPanel();
    this.chapterMapHud?.closeTaskLog();
    this.updateQingyunQuestMarker();
    this.updateQuestGuide();
    this.operationHint?.setText("第一章已重置：前往村长重新接取“调查青云山异光”。");
    return result;
  }

  updateQingyunQuestMarker() {
    const visible = this.questService.shouldShowTargetMarker(QINGYUN_INVESTIGATION_ID);
    this.jadeMarker?.forEach((display) => display.setVisible(visible));
    const showAdventureMarker = this.questService.shouldShowGuide(QINGYUN_INVESTIGATION_ID);
    const step = this.questService.getStep(QINGYUN_INVESTIGATION_ID);
    this.setQingyunMarkerVisible(this.herbMarker, showAdventureMarker && step === QINGYUN_QUEST_STEPS.GATHER_HERB);
    this.setQingyunMarkerVisible(this.pathMarker, showAdventureMarker && [
      QINGYUN_QUEST_STEPS.CHOOSE_PATH,
      QINGYUN_QUEST_STEPS.DEFEAT_GUARDIAN,
    ].includes(step));
  }

  /** 创建没有图片依赖的主线锚点：中心符印、呼吸光圈与两行短标签。 */
  createQingyunAdventureMarker(position, { title, subtitle, color, glow }) {
    const ring = this.add.circle(position.x, position.y, 54, glow, 0.22)
      .setStrokeStyle(2, color, 0.8)
      .setDepth(28)
      .setVisible(false);
    const core = this.add.circle(position.x, position.y, 26, color, 0.9)
      .setStrokeStyle(3, 0xfff3bf, 0.92)
      .setDepth(30)
      .setVisible(false);
    const glyph = addText(this, position.x, position.y - 1, title === "异光灵草" ? "采" : "途", 22, "#24301f", { origin: 0.5 })
      .setDepth(31)
      .setVisible(false);
    const label = addText(this, position.x, position.y - 88, title, 18, "#fff2b6", { origin: 0.5 })
      .setDepth(31)
      .setVisible(false);
    const detail = addText(this, position.x, position.y - 62, subtitle, 14, "#d8e6c4", { origin: 0.5 })
      .setDepth(31)
      .setVisible(false);
    this.tweens.add({ targets: ring, scale: 1.14, alpha: 0.42, duration: 860, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    return [ring, core, glyph, label, detail];
  }

  setQingyunMarkerVisible(marker, visible) {
    marker?.forEach((display) => display.setVisible(visible));
  }

  getQingyunQuestTarget() {
    const step = this.questService.getStep(QINGYUN_INVESTIGATION_ID);
    if (step === QINGYUN_QUEST_STEPS.GATHER_HERB) return this.herbPosition;
    if ([QINGYUN_QUEST_STEPS.CHOOSE_PATH, QINGYUN_QUEST_STEPS.DEFEAT_GUARDIAN].includes(step)) return this.pathPosition;
    return this.jadePosition;
  }

  /**
   * 第一章地图上的可玩循环。
   * 碰撞、输入和对话交给场景；“阶段能否前进”交给 ChapterQuestService，避免玩家通过重复按键跳过奖励或战斗。
   */
  updateQingyunAdventureInteraction() {
    if (this.dialog?.visible || this.npcProfilePanel?.visible) return;
    const step = this.questService.getStep(QINGYUN_INVESTIGATION_ID);
    const active = this.questService.isActive(QINGYUN_INVESTIGATION_ID);
    const justInteract = Phaser.Input.Keyboard.JustDown(this.keys.E);

    if (active && step === QINGYUN_QUEST_STEPS.GATHER_HERB) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.herbPosition.x, this.herbPosition.y);
      if (distance < 190) this.operationHint.setText(distance < 86
        ? "异光灵草：按 E 采集聚气草，追踪异光来源。"
        : "感应到微弱灵息，继续靠近山道旁的异光灵草。");
      if (distance < 86 && justInteract) this.collectQingyunHerb();
      return;
    }

    if (active && step === QINGYUN_QUEST_STEPS.CHOOSE_PATH) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.pathPosition.x, this.pathPosition.y);
      if (distance < 210) this.operationHint.setText(distance < 96
        ? "雾岚岔路：按 E 决定绕路，或进入浓雾挑战妖兽。"
        : "雾气中的两道灵息在前方交汇，继续靠近雾岚岔路。");
      if (distance < 96 && justInteract) this.openQingyunPathChoice();
      return;
    }

    if (active && step === QINGYUN_QUEST_STEPS.DEFEAT_GUARDIAN) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.pathPosition.x, this.pathPosition.y);
      if (distance < 210) this.operationHint.setText(distance < 96
        ? "浓雾妖气未散：按 E 再次挑战雾隐山魈。"
        : "雾隐山魈仍守在雾岚岔路，继续靠近后挑战它。");
      if (distance < 96 && justInteract) this.scene.start(SceneKeys.BATTLE, { adventureBattle: "qingyun-mist-guardian" });
      return;
    }

    const jadeDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.jadePosition.x, this.jadePosition.y);
    if (this.questService.canDiscoverAncientJade() && jadeDistance < 210) {
      this.operationHint.setText(jadeDistance < 110
        ? "古潭问道台：按 E 查看古玉。"
        : "古潭问道台就在附近，继续靠近中央玉光。");
      if (jadeDistance < 110 && justInteract) this.startJadeStory();
    } else if (this.questService.canRepeatJadeInteraction() && jadeDistance < 75) {
      this.operationHint.setText("奇异玉光：按 E 查看玉光（可在对话中选择战斗或返回）。");
      if (justInteract) {
        this.rememberPlayerPosition();
        this.openJadeRepeatDialogue();
      }
    }
  }

  collectQingyunHerb() {
    if (this.questService.getStep() !== QINGYUN_QUEST_STEPS.GATHER_HERB) return;
    const result = this.questService.advanceQuest(QINGYUN_INVESTIGATION_ID, QUEST_EVENTS.HERB_GATHERED);
    if (!result.ok) return;
    this.inventoryService.grant("juqicao", 1);
    this.chapterMapHud?.updateQuestPanel();
    this.updateQingyunQuestMarker();
    this.updateQuestGuide();
    this.openDialogue([
      "你从岩缝中采下一株聚气草。叶脉中残留的异光忽明忽灭，指向前方的雾岚岔路。",
      "获得：聚气草 × 1。接下来可以选择绕开浓雾，或追入雾中寻找更强的线索。",
    ]);
  }

  openQingyunPathChoice() {
    if (this.questService.getStep() !== QINGYUN_QUEST_STEPS.CHOOSE_PATH) return;
    this.dialogNameText.setText("雾岚岔路");
    this.openDialogue([], null, "", {
      nodes: [{
        id: "qingyun-path-choice",
        text: "左边的灵息平稳，却会错过浓雾中更强的机缘；右边妖气翻涌，显然有守卫盘踞。你准备怎么做？",
        choices: [
          { id: "qingyun-safe-route", text: "沿稳妥山道绕行（获得灵石 × 4，跳过战斗）", action: "qingyun-safe-route" },
          { id: "qingyun-risk-route", text: "循异光进入浓雾（挑战雾隐山魈，奖励更丰厚）", action: "qingyun-risk-route" },
        ],
      }],
      startId: "qingyun-path-choice",
    });
  }

  chooseQingyunPath(eventId) {
    const result = this.questService.advanceQuest(QINGYUN_INVESTIGATION_ID, eventId);
    if (!result.ok) return;
    this.chapterMapHud?.updateQuestPanel();
    this.updateQingyunQuestMarker();
    this.updateQuestGuide();
    if (eventId === QUEST_EVENTS.RISK_PATH_CHOSEN) {
      this.openDialogue([
        "浓雾骤然收拢，一只雾隐山魈从岩壁跃下。击败它后，才能继续追踪古潭的异光！",
        "提示：胜利后会得到灵石与星萤果，并自动回到此处继续主线。",
      ], () => this.scene.start(SceneKeys.BATTLE, { adventureBattle: "qingyun-mist-guardian" }));
      return;
    }
    this.openDialogue([
      "你避开了妖气最重的山路，在碎石间找到几枚遗落灵石。",
      "获得：灵石 × 4。灵息再次汇向山脚古潭，前往问道台寻找古玉吧。",
    ]);
  }

  /** 接取任务后的顶部提示。 */
  createQuestAcceptedNotice() {
    this.questAcceptedNotice = this.add.container(960, 360)
      .setScrollFactor(0)
      // 放在对话遮罩之上，接任务时玩家一定能看到。
      .setDepth(1700)
      .setVisible(false);
    const panel = this.add.graphics();
    // 任务提示严格按效果稿：550 × 200、10px 圆角、没有额外描边或连线。
    panel.fillStyle(0x151d25, 0.97);
    panel.fillRoundedRect(-275, -100, 550, 200, 10);
    const title = addText(this, 0, -27, "主线任务已接取", 28, "#F1C35C", { strokeThickness: 0 })
      .setOrigin(0.5)
      .setAlign("center");
    const detail = addText(this, 0, 33, "调查青云山异光 · 前往古潭问道台", 20, "#747665", { strokeThickness: 0 })
      .setOrigin(0.5)
      .setAlign("center");
    this.questAcceptedNotice.add([panel, title, detail]);
  }

  showQuestAcceptedNotice() {
    const notice = this.questAcceptedNotice;
    if (!notice) return;
    this.tweens.killTweensOf(notice);
    notice.setVisible(true).setPosition(960, 330).setAlpha(0);
    this.tweens.add({
      targets: notice,
      y: 360,
      alpha: 1,
      duration: 260,
      ease: "Cubic.Out",
      hold: 2100,
      yoyo: true,
      onComplete: () => notice.setVisible(false),
    });
  }

  /** 任务进行中始终显示方向箭头，让玩家随时知道古潭方向。 */
  createQuestGuide() {
    // 箭头与文字必须是独立的屏幕 UI。不要放进容器，避免容器被其它界面遮住时一起丢失。
    this.questGuideArrow = this.add.image(960, 540, "quest-direction-arrow")
      .setScrollFactor(0)
      .setDepth(1300)
      .setOrigin(0.5)
      .setDisplaySize(180, 30)
      .setVisible(false);
    this.questGuideLabel = addText(this, 960, 578, "前往：古潭问道台", 16, "#fff4cf", { strokeThickness: 3 })
      .setScrollFactor(0)
      .setDepth(1301)
      .setOrigin(0.5)
      .setVisible(false);
  }

  setQuestGuideVisible(visible) {
    this.questGuideArrow?.setVisible(visible);
    this.questGuideLabel?.setVisible(visible);
  }

  updateQuestGuide() {
    const active = this.questService.shouldShowGuide(QINGYUN_INVESTIGATION_ID);
    if (!active || !this.questGuideArrow || !this.player) {
      this.setQuestGuideVisible(false);
      return;
    }
    if (this.dialog?.visible || this.npcProfilePanel?.visible) {
      this.setQuestGuideVisible(false);
      return;
    }
    // 贴在屏幕中央附近，不会被右侧任务栏挡住；目标随当前主线步骤切换，
    // 这样玩家不会看到“采集灵草”却被箭头直接带到古玉的矛盾导航。
    const target = this.getQingyunQuestTarget();
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    const x = 960 + Math.cos(angle) * 250;
    const y = 540 + Math.sin(angle) * 190;
    this.questGuideArrow
      .setDisplaySize(100, 29)
      .setPosition(x, y)
      .setRotation(angle)
      .setAlpha(1)
      .setVisible(true);
    // 导航只显示箭头，不显示文字，避免遮住地图和主角。
    this.questGuideLabel.setVisible(false);
  }

  movePlayer(dx, dy) {
    const nextX = Phaser.Math.Clamp(this.player.x + dx, 50, this.worldSize.width - 50);
    const nextY = Phaser.Math.Clamp(this.player.y + dy, 110, this.worldSize.height - 80);
    // 建筑模板的碰撞顶点由编辑器按“图片相对坐标”保存。地图实例只带模板 ID，
    // 因此更新模板后，已摆放建筑无需重放也会立即使用新的碰撞范围。
    if (this.isMovementBlockedByBuilding(this.player.x, this.player.y, nextX, nextY)) {
      this.target = null;
      return;
    }
    this.player.x = nextX;
    this.player.y = nextY;
    // 实时更新内存位置；真正写入浏览器存档由手动保存、进入战斗和退出时完成。
    this.rememberPlayerPosition();
    this.updatePlayerDirection(dx, dy);
  }

  /** 判断本次脚底移动线段是否进入或穿过任一建筑碰撞多边形。 */
  isMovementBlockedByBuilding(fromX, fromY, toX, toY) {
    if (!this.editorActors) return false;
    const objects = Array.from(this.editorActors.values(), ({ object }) => object);
    return isMovementBlockedByBuildings({ x: fromX, y: fromY }, { x: toX, y: toY }, objects);
  }

  /** 把当前角色脚下坐标记录到全局状态，供战斗返回和存档恢复使用。 */
  rememberPlayerPosition() {
    if (!this.player) return;
    gameState.world.playerPosition = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
  }

  /** 根据移动方向选择五方向原图的哪一行，以及是否需要水平镜像。 */
  updatePlayerDirection(dx, dy) {
    const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    let row = 0;
    let flipX = false;

    // 画面坐标中 y 向下为正，因此 90° 对应“下”。
    if (angle >= 67.5 && angle < 112.5) row = 0; // 下
    else if (angle >= 22.5 && angle < 67.5) { row = 1; flipX = true; } // 右下 = 镜像左下
    else if (angle >= 112.5 && angle < 157.5) row = 1; // 左下
    else if (angle >= -22.5 && angle < 22.5) { row = 2; flipX = true; } // 右 = 镜像左
    else if (angle >= 157.5 || angle < -157.5) row = 2; // 左
    else if (angle >= -67.5 && angle < -22.5) { row = 3; flipX = true; } // 右上 = 镜像左上
    else if (angle >= -157.5 && angle < -112.5) row = 3; // 左上
    else row = 4; // 上

    this.playerDirection = { row, flipX };
    this.player.setFlipX(flipX);
  }

  /** 移动时播放 8 帧走路动画；停下时改回同方向的 1 帧待机图。 */
  updatePlayerAnimation(isMoving) {
    const animationKey = isMoving
      ? `player-walk-row-${this.playerDirection.row}`
      : `player-idle-row-${this.playerDirection.row}`;

    if (this.player.anims.currentAnim?.key !== animationKey || !this.player.anims.isPlaying) {
      this.player.play(animationKey);
    }
    this.player.setFlipX(this.playerDirection.flipX);
  }

  startJadeStory() {
    this.rememberPlayerPosition();
    // 地图只报告“找到古玉”；能否推进、完成与发奖全部由任务领域服务判断。
    const result = this.questService.advanceQuest(
      QINGYUN_INVESTIGATION_ID,
      QUEST_EVENTS.ANCIENT_JADE_FOUND,
    );
    if (!result.ok) return;
    this.chapterMapHud?.updateQuestPanel();
    this.updateQingyunQuestMarker();
    this.updateQuestGuide();
    this.openDialogue([
      "你在山脚拾起一枚温润古玉。古玉忽然发出微光，远处传来劫修的脚步声……",
      "提示：第一章原型中，可用鼠标点击普通攻击、术法或防御。",
      "劫修已逼近，准备迎战！",
    ], () => this.showJadeBattleChoice());
  }

  /** 古玉剧情读完后，由玩家自己决定是否进入测试战斗。 */
  showJadeBattleChoice() {
    this.dialogNameText.setText("劫修来袭");
    this.openDialogue([], null, "", {
      nodes: [{
        id: "qingyun-jade-battle-choice",
        text: "劫修已经逼近。现在迎战，还是先退回山道整备？",
        choices: [
          { id: "qingyun-jade-fight", text: "立即迎战（点击此项，或按 E / 空格）", action: "qingyun-jade-battle" },
          { id: "qingyun-jade-leave", text: "暂时离开，稍后再回来", action: "qingyun-jade-leave" },
        ],
      }],
      startId: "qingyun-jade-battle-choice",
    });
  }

  /** 已发现古玉后的重复交互对话，方便随时测试战斗但不强制进入。 */
  openJadeRepeatDialogue() {
    this.dialogNameText.setText("古玉异动");
    this.openDialogue([], null, "", {
      nodes: [{
        id: "qingyun-jade-repeat-choice",
        text: "古玉仍在微微发烫，附近再次出现劫修气息。要进入战斗吗？",
        choices: [
          { id: "qingyun-jade-repeat-fight", text: "进入战斗（点击此项，或按 E / 空格）", action: "qingyun-jade-battle" },
          { id: "qingyun-jade-repeat-leave", text: "不再触碰古玉，返回地图", action: "qingyun-jade-leave" },
        ],
      }],
      startId: "qingyun-jade-repeat-choice",
    });
  }
}

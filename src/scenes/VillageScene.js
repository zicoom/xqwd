import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { getMapObjects, MAP_OBJECT_TYPES } from "../core/MapContentStore.js";
import { getMonsterTemplate } from "../core/MonsterStore.js";
import { getItemTemplates } from "../core/ItemStore.js";
import { getBuildingTemplate, getNpcTemplate } from "../core/WorldTemplateStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addButton, addText, playUiClickSound, startCultivationBackgroundMusic, stopCultivationBackgroundMusic } from "../utils/UiHelpers.js";
import { ChapterMapHud } from "../ui/ChapterMapHud.js";
import { StorageBagPanel } from "../ui/StorageBagPanel.js";
import { XianxiaDialog } from "../ui/XianxiaDialog.js";
import { configureFullHdScene, SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/DisplayConfig.js";
import { clearEditorRoute } from "../core/EditorRoute.js";
import { exportLocalGameData, importLocalGameDataFromFile } from "../core/LocalDataTransfer.js";

/**
 * 栖霞村探索场景。
 * 演示 WASD/方向键移动与鼠标点击移动。正式项目会替换为地图编辑器导出的地图数据。
 */
export class VillageScene extends Phaser.Scene {
  constructor() { super(SceneKeys.VILLAGE); }

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
    // 物品编辑器上传的自定义图标会随场景预加载；刷新或重新进入地图后，商店与储物袋立即显示新图。
    getItemTemplates().filter((item) => item.imageData).forEach((item) => {
      this.load.image(`item-custom-${item.id}`, item.imageData);
    });
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
    // 游戏设置弹窗使用用户提供的新版深棕面板底图。
    this.load.image("game-settings-panel", "./public/assets/images/ui/chapter-map/settings-panel.png");
    // 编辑器放置的 NPC 和怪物暂时复用现有角色立绘。
    // 日后加入 NPC/怪物图片库后，只需要把这两个纹理键替换成对应模板图片。
    this.load.image("map-monster-portrait", "./public/assets/images/battle/swordsman.png");

    // 以下资源来自 Pixso 的“第一章地图”页面。它们分别是六个顶部功能入口的原始图标，
    // 单独加载后可以和真实游戏功能绑定，而不是把整张 UI 截图当成无法操作的背景图。
    const pixsoUiPath = "./public/assets/images/ui/pixso-chapter-map";
    this.load.image("pixso-ui-store", `${pixsoUiPath}/0194d4d1ee34c44b6a04712c9f468fa9982d0290.png`);
    this.load.image("pixso-ui-settings", `${pixsoUiPath}/0e70e010a1c8c666f042837d2de57d9feae7a301.png`);
    this.load.image("pixso-ui-gongfa", `${pixsoUiPath}/54732a7e111d65ebb274da026c2ce3ad132c3ade.png`);
    this.load.image("pixso-ui-artifact", `${pixsoUiPath}/894c57b186cfffcff537eced68f536e5c7591e92.png`);
    this.load.image("pixso-ui-spell", `${pixsoUiPath}/c9427f9152ab80ec524392a3d337d95ecc751bdb.png`);
    this.load.image("pixso-ui-save", `${pixsoUiPath}/e2f4c5f9c8119a7ab11969c3487683b7f5f820d1.png`);
    this.load.image("pixso-ui-brush", `${pixsoUiPath}/ce7168bd479ed095592186e3fa86566b2c5bebb0.png`);
    this.load.image("pixso-ui-player-panel", `${pixsoUiPath}/990bba43cda098fe5d0d39b00aa396ab83511e38.png`);
    this.load.image("pixso-ui-portrait", `${pixsoUiPath}/fca607c9608fc640f54b1a8605fa55470315f20d.png`);
    this.load.image("pixso-ui-mini-map", `${pixsoUiPath}/ff4ac10e8a30b9eb4a08decec415289cdefdb87f.png`);
    // 用户放在项目根目录的新版左上资料栏素材。
    // 大地图左上角角色资料框：水墨底板与透明头像。
    this.load.image("chapter-hud-profile-brush", "./public/assets/images/ui/chapter-map/profile-brush.png");
    this.load.image("chapter-hud-profile-avatar", "./public/assets/images/ui/chapter-map/profile-avatar.png");
    // 主线任务方向箭头：素材本身默认朝右，运行时根据古潭位置旋转。
    this.load.image("quest-direction-arrow", "./public/assets/images/ui/chapter-map/quest-direction-arrow.png");
    // NPC 尚未制作地图立绘时使用的任务问号。
    this.load.image("npc-map-question-mark", "./public/assets/images/ui/chapter-map/npc-question-mark.png");
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
    configureFullHdScene(this);
    // 大地图常驻一段轻柔的修仙纯音乐。浏览器若刚刷新而尚未允许播放，
    // 会在玩家第一次点击或按键时自动开始。
    startCultivationBackgroundMusic(this);
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
    this.storageBagPanel = null;
    this.storageBag = null;

    // 青云山原图每块是 2000×2000 像素。显示时按 60% 缩小，
    // 既能让一屏看到更多地形，也能让水墨线条在缩小后更清楚。
    // 以后新增其他大地图时，只要换成对应配置即可复用同一套按需加载逻辑。
    this.mapConfig = { id: "qingyun-mountain", columns: 5, rows: 5, tileSize: 1200, displayScale: 0.6 };
    this.worldSize = { width: 6000, height: 6000 };
    this.mapTileObjects = new Map();
    this.mapTilesLoading = new Set();
    this.mapStreamElapsed = 0;
    this.drawQingyunMountain();
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
      .setDepth(1);

    // 半透明椭圆模拟人物脚下的投影。它比人物层级低，移动时会同步更新位置，
    // 因此人物能稳定“站”在地面上，而不是看起来悬浮。
    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 17, 74, 22, 0x14221e, 0.32)
      .setDepth(0);
    this.playerDirection = { row: 0, flipX: false };
    this.player.play("player-idle-row-0");
    // 地图角色头顶只保留姓名；文字底部贴近头顶并以角色 X 坐标为中心。
    this.playerName = addText(this, spawnX, spawnY - 160, gameState.player.name, 16, "#fff9df", { align: "center" }).setOrigin(0.5, 1);

    // 设置世界边界并让镜头平滑追随主角；UI 会在下方单独固定，不随镜头移动。
    this.cameras.main.setBounds(0, 0, this.worldSize.width, this.worldSize.height);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);

    this.target = null;
    this.jadePosition = new Phaser.Math.Vector2(2440, 760);
    this.jadeMarker = [];
    this.jadeMarker.push(this.add.circle(this.jadePosition.x, this.jadePosition.y, 28, 0x7ddfcf, 0.92).setStrokeStyle(3, 0xfff0ad).setDepth(30));
    // 两层光圈模拟古玉微光；正式项目中可替换为粒子特效贴图。
    this.jadeMarker.push(this.add.circle(this.jadePosition.x, this.jadePosition.y, 52, 0x9cf2de, 0.2).setStrokeStyle(2, 0xeef4bd, 0.8).setDepth(29));
    this.jadeMarker.push(addText(this, this.jadePosition.x, this.jadePosition.y - 78, "任务地点：古潭问道台", 18, "#fff2a7", { origin: 0.5 }).setDepth(31));
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

    // “附近修士”卡片点击后出现的个人资料弹窗。
    this.createNearbyNpcProfilePanel();

    this.createHud();
    // 旧版本曾出现“任务仍在进行中，但古玉已找到”的矛盾存档。
    // 这种情况下玩家已经重新接到委托，因此自动恢复古潭事件，避免到达地点却没有任何反应。
    if (gameState.chapter.qingyunInvestigation === "active" && gameState.chapter.ancientJadeFound) {
      gameState.chapter.ancientJadeFound = false;
      gameState.player.hasJade = false;
      saveFirstChapterProgress();
    }
    this.updateQingyunQuestMarker();
    // 每两秒自动保存一次位置。比每一帧写本地存储更省性能，也能避免刷新网页回到旧坐标。
    this.autoSaveElapsed = 0;
    this.refreshNearbyMapTiles();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,E,ESC,ONE,TWO,THREE,FOUR");
    // 清除离开旧场景时可能残留的按键按下状态，保证重新进入地图后立即可移动。
    this.input.keyboard.resetKeys();
    this.input.on("pointerdown", (pointer) => {
      // 游戏界面始终按 1920×1080 的逻辑坐标排版；getUiPointer 会统一取用
      // Phaser 已换算好的坐标，避免浏览器缩放后再次换算而导致按钮点偏。
      const uiPointer = this.getUiPointer(pointer);
      // 打开任务日志时，所有地图点击都由日志界面接管，不能触发寻路。
      if (this.chapterMapHud?.isTaskLogOpen()) return;
      // 储物袋和商店一样是独立的最上层界面，绝不允许点击穿透到大地图。
      if (this.storageBagPanel?.visible) {
        this.handleStorageBagPointer(uiPointer);
        return;
      }
      // 商店是最高层全屏界面，打开时绝不能把点击穿透到大地图寻路。
      if (this.merchantShopPanel?.visible) {
        this.handleMerchantShopPointer(uiPointer);
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
      if (!this.dialog.visible && !this.npcProfilePanel?.visible && !this.settingsPanel && !this.featurePanel && !this.storageBagPanel?.visible && !this.chapterMapHud?.isPointerOverHud(uiPointer) && uiPointer.y < 915) {
        // 镜头开始滚动后，pointer.x/y 只是屏幕坐标；worldX/worldY 才是地图上的真实位置。
        this.target = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      }
    });
    this.input.on("pointermove", (pointer) => {
      if (this.storageBagPanel?.visible) this.handleStorageBagPointerMove(this.getUiPointer(pointer));
      if (this.merchantShopPanel?.visible) this.handleMerchantShopPointerMove(this.getUiPointer(pointer));
    });
    this.input.on("pointerup", () => {
      // 商品列表滚动条拖动结束后立刻解除状态，避免后续点击仍被当成拖动。
      this.merchantProductScrollDragging = false;
    });
    // 储物袋只显示两行格子。超过 24 件时可以在袋子区域滚轮翻到下一行。
    this.input.on("wheel", (pointer, _objects, _deltaX, deltaY) => {
      if (this.storageBagPanel?.visible && this.isStorageBagGridPointer(this.getUiPointer(pointer))) {
        this.changeStorageBagScroll(deltaY > 0 ? 1 : -1);
        return;
      }
      if (!this.merchantShopPanel?.visible) return;
      const uiPointer = this.getUiPointer(pointer);
      if (this.isMerchantProductPointer(uiPointer)) {
        this.changeMerchantProductScroll(deltaY > 0 ? 1 : -1);
        return;
      }
      if (this.isMerchantCartPointer(uiPointer)) this.changeMerchantCartScroll(deltaY > 0 ? 1 : -1);
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
    this.chapterMapHud = new ChapterMapHud(this);
    this.chapterMapHud.create();
    // 保留以下引用，兼容地图场景已有的附近对象检测逻辑。
    this.nearbyNameText = this.chapterMapHud.nearbyNameText;
    this.nearbyRealmText = this.chapterMapHud.nearbyRealmText;
    this.operationHint = this.chapterMapHud.operationHint;
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

  activateNpcProfileAction() {
    const object = this.npcProfileObject;
    if (!object) return;
    if (this.npcProfileIsMerchant) {
      this.closeNearbyNpcProfile();
      this.openMerchantShop(object);
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

  /** 商店中出售的第一批基础灵草。以后装备、丹方只需在这里增加同样格式的数据。 */
  getMerchantItems() {
    // 这是商店首次测试用的补货版本：已有旧存档只会在首次打开商店时补到 50 个，
    // 之后购买、关闭、刷新页面都会继续使用扣减后的真实库存。
    const stockVersion = "merchant-stock-50-test-v1";
    if (gameState.world.merchantStockVersion !== stockVersion) {
      gameState.world.merchantStock = {};
      gameState.world.merchantStockVersion = stockVersion;
      saveFirstChapterProgress();
    }
    const stock = gameState.world.merchantStock || {};
    return getItemTemplates()
      .filter((item) => item.sellable)
      .map((item) => {
        const customTexture = `item-custom-${item.id}`;
        return {
          ...item,
          // 自定义图标在本场景已经预加载时优先使用；尚未重新进入地图时先安全使用原图标。
          texture: item.imageData && this.textures.exists(customTexture) ? customTexture : item.texture,
          stock: Number.isFinite(Number(stock[item.id])) ? Math.max(0, Number(stock[item.id])) : item.stock,
        };
      })
      .filter((item) => item.texture && this.textures.exists(item.texture));
  }

  /** 按 Pixso「商人 Ui 界面」建立固定 1678 × 920 的商店，并保留可实际购买的功能。 */
  createMerchantShopPanel() {
    const panel = this.add.container(0, 0).setScrollFactor(0).setDepth(1800).setVisible(false);
    const shade = this.add.rectangle(0, 0, 1920, 1080, 0x071009, 0.64).setOrigin(0).setInteractive();
    const background = this.add.graphics();
    background.fillStyle(0x322115, 1);
    background.fillRoundedRect(121, 80, 1678, 920, 16);
    background.lineStyle(3, 0xb6773c, 1);
    background.strokeRoundedRect(121, 80, 1678, 920, 16);
    background.fillStyle(0x201208, 1);
    background.fillRect(124, 80, 1672, 88);
    background.lineStyle(2, 0xb6773c, 1);
    background.lineBetween(124, 168, 1796, 168);
    panel.add([shade, background]);

    const headerCenterY = 124;
    const merchantStoneMark = this.add.image(151, headerCenterY, "merchant-spirit-stone").setDisplaySize(12, 20);
    this.merchantMerchantCurrencyText = addText(this, 165, headerCenterY, "", 26, "#f2d1ab", { strokeThickness: 1 }).setOrigin(0, 0.5);
    const playerStoneMark = this.add.image(1450, headerCenterY, "merchant-spirit-stone").setDisplaySize(12, 20);
    this.merchantPlayerCurrencyText = addText(this, 1464, headerCenterY, "", 26, "#f2d1ab", { strokeThickness: 1 }).setOrigin(0, 0.5);
    const title = addText(this, 900, headerCenterY, "商人", 38, "#f3d797", { strokeThickness: 2 }).setOrigin(0.5);
    this.merchantBuyTab = this.add.rectangle(1050, 124, 112, 44, 0x80532c, 1).setStrokeStyle(1, 0xb98548).setInteractive({ useHandCursor: true });
    this.merchantSellTab = this.add.rectangle(1175, 124, 112, 44, 0x392719, 1).setStrokeStyle(1, 0x765438).setInteractive({ useHandCursor: true });
    this.merchantBuyTabText = addText(this, 1050, headerCenterY, "买入", 18, "#ffe284", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantSellTabText = addText(this, 1175, headerCenterY, "卖出", 18, "#b9a794", { strokeThickness: 0 }).setOrigin(0.5);
    const close = this.add.rectangle(1754, 124, 40, 40, 0x6a4b2e, 1).setStrokeStyle(1, 0x936c42).setInteractive({ useHandCursor: true });
    const closeText = addText(this, 1754, headerCenterY, "×", 28, "#f1d7aa", { strokeThickness: 0 }).setOrigin(0.5);
    panel.add([merchantStoneMark, this.merchantMerchantCurrencyText, playerStoneMark, this.merchantPlayerCurrencyText, title, this.merchantBuyTab, this.merchantSellTab, this.merchantBuyTabText, this.merchantSellTabText, close, closeText]);

    const categoryBox = this.add.graphics();
    categoryBox.fillStyle(0x24170f, 0.96);
    categoryBox.fillRoundedRect(143, 201, 135, 458, 14);
    categoryBox.lineStyle(3, 0x775c3f, 1);
    categoryBox.strokeRoundedRect(143, 201, 135, 458, 14);
    panel.add(categoryBox);
    this.merchantCategoryButtons = [];
    ["全部", "灵草", "丹药", "丹方", "装备", "法宝", "材料", "丹炉"].forEach((name, index) => {
      // 原图为 95×45，保持一对一尺寸；上、下留白与 Pixso 效果图一致。
      const y = 243 + index * 53;
      const bg = this.add.image(211, y, "merchant-category-normal").setDisplaySize(95, 45).setInteractive({ useHandCursor: true });
      const text = addText(this, 211, y - 1, name, 21, "#f2dfbf", {
        stroke: "#2a170d",
        strokeThickness: 1,
      }).setOrigin(0.5);
      panel.add([bg, text]);
      this.merchantCategoryButtons.push({ name, bg, text, y });
    });

    const detail = this.add.graphics();
    detail.fillStyle(0x24170f, 0.96);
    detail.fillRoundedRect(1336, 201, 438, 515, 18);
    panel.add(detail);
    // 标签为暖金色，具体类型与品阶为灰米色，和设计稿的层级一致。
    const merchantDetailTypeLabel = addText(this, 1370, 228, "类型：", 20, "#e6c07f", { strokeThickness: 0 });
    this.merchantDetailType = addText(this, 1432, 228, "", 20, "#b8ada0", { strokeThickness: 0 });
    const merchantDetailGradeLabel = addText(this, 1635, 228, "品阶：", 20, "#e6c07f", { strokeThickness: 0 });
    this.merchantDetailGrade = addText(this, 1740, 228, "", 20, "#b8ada0", { strokeThickness: 0 }).setOrigin(1, 0);
    this.merchantDetailImageFrame = this.add.rectangle(1555, 318, 104, 104, 0x3a2a1b).setStrokeStyle(2, 0x674a31).setOrigin(0.5);
    this.merchantDetailImage = this.add.image(1555, 318, "merchant-herb-baixiangye").setDisplaySize(92, 92);
    this.merchantDetailName = addText(this, 1555, 405, "", 25, "#ffe000", { strokeThickness: 1 }).setOrigin(0.5);
    this.merchantDetailDesc = addText(this, 1375, 435, "", 17, "#a89c8e", { strokeThickness: 0, wordWrap: { width: 352 }, lineSpacing: 8 });
    this.merchantDetailPriceLabel = addText(this, 1430, 535, "单价", 20, "#ead3b4", { strokeThickness: 0 }).setOrigin(0, 0.5);
    const detailPriceBg = this.add.graphics();
    detailPriceBg.fillStyle(0x4a2f1a, 1);
    detailPriceBg.fillRoundedRect(1510, 513, 124, 44, 6);
    this.merchantDetailPriceIcon = this.add.image(1532, 535, "merchant-spirit-stone").setDisplaySize(10, 17);
    this.merchantDetailPrice = addText(this, 1544, 535, "", 20, "#ead3b4", { strokeThickness: 0 }).setOrigin(0, 0.5);
    this.merchantDetailQuantity = addText(this, 1370, 610, "购买数量", 20, "#d4ae7f", { strokeThickness: 0 });
    const makeQuantityControl = (centerX, width, fillColor, strokeColor) => {
      const control = this.add.graphics();
      control.fillStyle(fillColor, 1);
      control.fillRoundedRect(centerX - width / 2, 643, width, 50, 4);
      control.lineStyle(2, strokeColor, 1);
      control.strokeRoundedRect(centerX - width / 2, 643, width, 50, 4);
      control.setInteractive(new Phaser.Geom.Rectangle(centerX - width / 2, 643, width, 50), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
      return control;
    };
    // 四个按钮之间统一保留 10px，不重叠也不挤在一起。
    const minus = makeQuantityControl(1397, 54, 0x3a281b, 0x604226);
    const quantityInput = makeQuantityControl(1512, 156, 0x1b1510, 0xb58234);
    const plus = makeQuantityControl(1627, 54, 0x3a281b, 0x604226);
    const max = makeQuantityControl(1728, 74, 0x50341f, 0x805e35);
    this.merchantQuantityText = addText(this, 1512, 668, "1", 22, "#f8e8d3", { strokeThickness: 0 }).setOrigin(0.5);
    const minusText = addText(this, 1397, 668, "−", 28, "#f5e7d5", { strokeThickness: 0 }).setOrigin(0.5);
    const plusText = addText(this, 1627, 668, "+", 28, "#f5e7d5", { strokeThickness: 0 }).setOrigin(0.5);
    const maxText = addText(this, 1728, 668, "最大", 18, "#f5e7d5", { strokeThickness: 0 }).setOrigin(0.5);
    // 选中商品后，按 1 / 10 / 全部就直接加入清单。
    // 实际点击统一交给 handleMerchantShopPointer，防止缩放画面时重复加入。
    panel.add([merchantDetailTypeLabel, this.merchantDetailType, merchantDetailGradeLabel, this.merchantDetailGrade, this.merchantDetailImageFrame, this.merchantDetailImage, this.merchantDetailName, this.merchantDetailDesc, this.merchantDetailPriceLabel, detailPriceBg, this.merchantDetailPriceIcon, this.merchantDetailPrice, this.merchantDetailQuantity, minus, quantityInput, plus, max, minusText, this.merchantQuantityText, plusText, maxText]);

    const bag = this.add.graphics();
    bag.fillStyle(0x24170f, 0.98);
    bag.fillRoundedRect(298, 730, 1476, 246, 18);
    panel.add(bag);
    // 储物袋名称使用横向文字，和右侧物品格的阅读方向一致。
    panel.add(addText(this, 211, 780, "储物袋", 28, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5));
    // 明确的购买入口，避免玩家必须靠“双击商品”才知道怎么购买。
    const buyAll = this.add.graphics();
    buyAll.fillStyle(0x315d42, 1);
    buyAll.fillRoundedRect(147, 830, 128, 40, 4);
    buyAll.lineStyle(1, 0x6d9d74, 1);
    buyAll.strokeRoundedRect(147, 830, 128, 40, 4);
    buyAll.setInteractive(new Phaser.Geom.Rectangle(147, 830, 128, 40), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
    const buyAllText = addText(this, 211, 850, "购买全部", 16, "#edf4da", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantActionButtonText = buyAllText;
    this.merchantProductsLayer = this.add.container(0, 0);
    this.merchantCartLayer = this.add.container(0, 0);
    this.merchantShopNotice = addText(this, 960, 710, "点击已选商品购买", 15, "#b8a387", { origin: 0.5, strokeThickness: 0 });
    this.merchantCancelButton = this.add.container(0, 0).setVisible(false);
    // 使用用户提供的 117×60 按钮图，文字严格锚定在背景正中。
    const cancelBg = this.add.image(0, 0, "merchant-cart-cancel").setDisplaySize(117, 60).setInteractive({ useHandCursor: true });
    const cancelText = addText(this, 0, 0, "取消购物", 15, "#f6e4cc", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantCancelButton.add([cancelBg, cancelText]);
    this.merchantPurchaseConfirm = this.add.container(0, 0).setVisible(false);
    const confirmShade = this.add.rectangle(0, 0, 1920, 1080, 0x050302, 0.54).setOrigin(0).setInteractive();
    // 购买确认弹窗按效果图固定为 810×439：不再使用原本过窄的基础矩形。
    const confirmCard = this.add.graphics();
    confirmCard.fillStyle(0x24170f, 1);
    confirmCard.fillRoundedRect(555, 320, 810, 439, 10);
    confirmCard.lineStyle(2, 0xc1863d, 1);
    confirmCard.strokeRoundedRect(555, 320, 810, 439, 10);
    this.merchantPurchaseTitle = addText(this, 960, 373, "确认购买", 29, "#f1c35c", { strokeThickness: 1 }).setOrigin(0.5);
    this.merchantPurchaseCostPrefix = addText(this, 916, 424, "将花费", 20, "#baac9d", { strokeThickness: 0 }).setOrigin(1, 0.5);
    this.merchantPurchaseCostIcon = this.add.image(938, 424, "merchant-spirit-stone").setDisplaySize(10, 17);
    this.merchantPurchaseCostText = addText(this, 952, 424, "", 20, "#d9c7ae", { strokeThickness: 0 }).setOrigin(0, 0.5);
    this.merchantPurchaseItemsLayer = this.add.container(0, 0);
    // 购买失败等提示显示在按钮上方，不会挤乱物品卡片。
    this.merchantPurchaseSummary = addText(this, 960, 702, "", 16, "#e6b98c", { strokeThickness: 0 }).setOrigin(0.5);
    const makeConfirmButton = (x, fill, border) => {
      const button = this.add.graphics();
      button.fillStyle(fill, 1);
      button.fillRoundedRect(x, 650, 128, 40, 4);
      button.lineStyle(1, border, 1);
      button.strokeRoundedRect(x, 650, 128, 40, 4);
      button.setInteractive(new Phaser.Geom.Rectangle(x, 650, 128, 40), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
      return button;
    };
    // 效果图的顺序是：左侧“确认购买”，右侧“暂不购买”。
    const confirmButton = makeConfirmButton(824, 0x315f42, 0x71a177);
    const cancelButton = makeConfirmButton(971, 0x5a3434, 0x925b5b);
    const confirmText = addText(this, 888, 670, "确认购买", 16, "#f4e8d4", { strokeThickness: 0 }).setOrigin(0.5);
    const cancelConfirmText = addText(this, 1035, 670, "暂不购买", 16, "#f4e8d4", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantPurchaseConfirm.add([confirmShade, confirmCard, this.merchantPurchaseTitle, this.merchantPurchaseCostPrefix, this.merchantPurchaseCostIcon, this.merchantPurchaseCostText, this.merchantPurchaseItemsLayer, this.merchantPurchaseSummary, confirmButton, cancelButton, confirmText, cancelConfirmText]);
    panel.add([buyAll, buyAllText, this.merchantProductsLayer, this.merchantCartLayer, this.merchantShopNotice, this.merchantCancelButton, this.merchantPurchaseConfirm]);
    this.merchantShopPanel = panel;
  }

  openMerchantShop(object) {
    if (!this.merchantShopPanel) this.createMerchantShopPanel();
    // 上一次关闭时可能仍有淡入动画在运行；重新进入前先完全停止它，
    // 防止旧动画把新打开的商店重新设为透明，造成“点了没反应”的假象。
    this.tweens.killTweensOf(this.merchantShopPanel);
    this.closeMerchantQuantityInput(false);
    this.merchantProductScrollDragging = false;
    this.merchantCancelButton?.setVisible(false);
    this.merchantPurchaseConfirm?.setVisible(false);
    this.merchantShopObject = object;
    this.target = null;
    this.merchantItems = this.getMerchantItems();
    this.merchantCategory = "全部";
    this.merchantBuyQuantity = 1;
    this.merchantMode = "buy";
    this.merchantCarts = { buy: [], sell: [] };
    this.merchantCart = this.merchantCarts.buy;
    this.merchantCartScrollRow = 0;
    this.merchantProductScrollRow = 0;
    this.merchantProductScrollDragging = false;
    this.refreshMerchantCurrencies();
    this.merchantShopPanel.setAlpha(0).setVisible(true);
    this.selectMerchantItem(this.merchantItems.find((item) => item.stock > 0) || this.merchantItems[0], true);
    this.selectMerchantCategory("全部");
    this.setMerchantMode("buy", true);
    this.renderMerchantCart();
    this.tweens.add({ targets: this.merchantShopPanel, alpha: 1, duration: 180, ease: "Sine.Out" });
  }

  closeMerchantShop() {
    if (!this.merchantShopPanel?.visible) return;
    playUiClickSound(this);
    this.tweens.killTweensOf(this.merchantShopPanel);
    this.closeMerchantQuantityInput(false);
    this.merchantProductScrollDragging = false;
    this.merchantCancelButton?.setVisible(false);
    this.merchantPurchaseConfirm?.setVisible(false);
    this.merchantShopPanel.setAlpha(1).setVisible(false);
    this.merchantShopObject = null;
    saveFirstChapterProgress();
  }

  /** 商人和玩家的钱各自显示、各自保存，买卖时立即刷新。 */
  refreshMerchantCurrencies() {
    const merchantStones = Number(gameState.world.merchantSpiritStones);
    if (!Number.isFinite(merchantStones)) gameState.world.merchantSpiritStones = 125850;
    // 加入待购清单时先预览扣除后的灵石，让玩家在结算前就能看清花费。
    const reservedCost = (this.merchantCarts?.buy || []).reduce((total, entry) => total + entry.item.price * entry.quantity, 0);
    const shownPlayerStones = Math.max(0, (Number(gameState.player.spiritStones) || 0) - reservedCost);
    this.merchantMerchantCurrencyText?.setText(`商人灵石 ${(Number(gameState.world.merchantSpiritStones) || 0).toLocaleString("zh-CN")}`);
    this.merchantPlayerCurrencyText?.setText(`我的灵石 ${shownPlayerStones.toLocaleString("zh-CN")}`);
  }

  selectMerchantCategory(category) {
    this.merchantCategory = category;
    this.merchantProductScrollRow = 0;
    this.merchantCategoryButtons.forEach((button) => {
      const active = button.name === category;
      button.bg.setTexture(active ? "merchant-category-selected" : "merchant-category-normal");
      button.text.setColor(active ? "#fff2c6" : "#f2dfbf");
    });
    const visibleItems = this.getMerchantVisibleItems();
    this.renderMerchantProductCards(visibleItems);
    const action = this.merchantMode === "sell" ? "加入出售清单" : "加入储物袋";
    this.merchantShopNotice.setText(visibleItems.some((item) => item.stock > 0) ? `点击商品查看；再次点击同一商品即可${action}` : this.merchantMode === "sell" ? "背包没有可出售的该类物品" : `${category} 暂未上架`);
  }

  /** 卖出页只读取玩家真实拥有的物品，价格为商人售价的一半。 */
  getSellableMerchantItems() {
    const inventory = gameState.player.inventory || {};
    return this.merchantItems
      .map((item) => ({ ...item, stock: Math.max(0, Number(inventory[item.id]) || 0), price: Math.max(1, Math.floor(item.price * 0.5)), sellPrice: true }))
      .filter((item) => item.stock > 0);
  }

  getMerchantVisibleItems() {
    const source = this.merchantMode === "sell" ? this.getSellableMerchantItems() : this.merchantItems;
    if (this.merchantCategory === "全部") return source;

    // 左侧“丹药、装备、材料”与物品管理编辑器的类型一一对应。
    // “器材”是旧版本材料的兼容名称，仍归到材料里显示。
    const categoryTypes = {
      "灵草": ["灵草"],
      "丹药": ["丹药"],
      "装备": ["装备"],
      "材料": ["材料", "器材"],
    };
    const allowedTypes = categoryTypes[this.merchantCategory];
    return allowedTypes ? source.filter((item) => allowedTypes.includes(item.type)) : [];
  }

  /** 买入清单中的数量会临时占用商人库存，直到取消或确认购买。 */
  getMerchantAvailableStock(item) {
    const reserved = (this.merchantCarts?.[this.merchantMode] || [])
      .filter((entry) => entry.item.id === item.id)
      .reduce((total, entry) => total + entry.quantity, 0);
    return Math.max(0, (Number(item.stock) || 0) - reserved);
  }

  /** 切换买入/卖出；两个页签保留各自尚未结算的清单。 */
  setMerchantMode(mode, silent = false) {
    this.merchantMode = mode;
    this.merchantCart = this.merchantCarts?.[mode] || [];
    if (this.merchantCarts) this.merchantCarts[mode] = this.merchantCart;
    this.merchantCartScrollRow = 0;
    this.merchantProductScrollRow = 0;
    this.merchantProductScrollDragging = false;
    const buying = mode === "buy";
    this.merchantBuyTab?.setFillStyle(buying ? 0x80532c : 0x392719).setStrokeStyle(1, buying ? 0xb98548 : 0x765438);
    this.merchantSellTab?.setFillStyle(buying ? 0x392719 : 0x80532c).setStrokeStyle(1, buying ? 0x765438 : 0xb98548);
    this.merchantBuyTabText?.setColor(buying ? "#ffe284" : "#b9a794");
    this.merchantSellTabText?.setColor(buying ? "#b9a794" : "#ffe284");
    this.merchantActionButtonText?.setText(buying ? "购买全部" : "出售全部");
    const visibleItems = this.getMerchantVisibleItems();
    const next = visibleItems.find((item) => item.stock > 0);
    if (next) this.selectMerchantItem(next, true);
    this.renderMerchantProductCards(visibleItems);
    this.renderMerchantCart();
    this.refreshMerchantCurrencies();
    if (!silent) this.merchantShopNotice.setText(buying ? "买入：选择商人物品加入储物袋" : "卖出：选择背包物品加入出售清单");
  }

  getMerchantGradeColor(grade) {
    return ({ "凡品": 0x414040, "灵品": 0x285c45, "玄品": 0x294e71, "地品": 0x70471d, "天品": 0x653962, "仙品": 0x9a6920, "神器": 0x8b3b37 })[grade] || 0x414040;
  }

  /** 中文说明按固定字符数换行，避免没有空格的药材描述超出右侧详情框。 */
  formatMerchantDescription(description) {
    const characters = Array.from(`药材作用： ${description || "暂无说明"}`);
    const lineLength = 19;
    const lines = [];
    for (let index = 0; index < characters.length; index += lineLength) {
      lines.push(characters.slice(index, index + lineLength).join(""));
    }
    return lines.join("\n");
  }

  /** 商人商品区固定显示四列四行，超过十六件后通过右侧滚动条查看后续商品。 */
  getMerchantProductScrollMetrics(items = []) {
    const columns = 4;
    const visibleRows = 4;
    const totalRows = Math.ceil(items.length / columns);
    return {
      columns,
      visibleRows,
      totalRows,
      maxScrollRow: Math.max(0, totalRows - visibleRows),
    };
  }

  getMerchantScrollableProducts() {
    return this.getMerchantVisibleItems().filter((item) => item.stock > 0);
  }

  /** 商品区域与滚动条都支持鼠标滚轮，不会影响下方储物袋。 */
  isMerchantProductPointer(pointer) {
    return pointer.x >= 280 && pointer.x <= 1328 && pointer.y >= 195 && pointer.y <= 724;
  }

  changeMerchantProductScroll(change) {
    const items = this.getMerchantScrollableProducts();
    const { maxScrollRow } = this.getMerchantProductScrollMetrics(items);
    const next = Phaser.Math.Clamp((this.merchantProductScrollRow || 0) + change, 0, maxScrollRow);
    if (next === this.merchantProductScrollRow) return;
    this.merchantProductScrollRow = next;
    this.renderMerchantProductCards(items);
  }

  /** 将拖动位置转换为对应的商品行，并立即重绘当前商品页。 */
  updateMerchantProductScrollFromPointer(pointerY) {
    const items = this.getMerchantScrollableProducts();
    const { totalRows, visibleRows, maxScrollRow } = this.getMerchantProductScrollMetrics(items);
    if (maxScrollRow <= 0) return;
    const trackTop = 210;
    const trackHeight = 508;
    const thumbHeight = Math.max(42, trackHeight * (visibleRows / totalRows));
    const usableHeight = trackHeight - thumbHeight;
    const ratio = Phaser.Math.Clamp((pointerY - trackTop - thumbHeight / 2) / usableHeight, 0, 1);
    const next = Phaser.Math.Clamp(Math.round(ratio * maxScrollRow), 0, maxScrollRow);
    if (next === this.merchantProductScrollRow) return;
    this.merchantProductScrollRow = next;
    this.renderMerchantProductCards(items);
  }

  renderMerchantProductCards(items) {
    this.merchantProductsLayer.removeAll(true);
    const availableItems = items.filter((item) => item.stock > 0);
    const { columns, visibleRows, totalRows, maxScrollRow } = this.getMerchantProductScrollMetrics(availableItems);
    this.merchantProductScrollRow = Phaser.Math.Clamp(this.merchantProductScrollRow || 0, 0, maxScrollRow);
    const startIndex = this.merchantProductScrollRow * columns;
    const shownItems = availableItems.slice(startIndex, startIndex + columns * visibleRows);
    shownItems.forEach((item, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 300 + column * 255;
      const y = 210 + row * 130;
      const card = this.add.container(x, y);
      // 草药卡片统一为 240×118：只保留一层深棕圆角底，
      // 不再使用品阶彩色外边线或额外的内层背景。
      const bg = this.add.graphics();
      const drawCardBackground = (hovered = false) => {
        bg.clear();
        bg.fillStyle(hovered ? 0x2a1b10 : 0x24170f, 1);
        bg.fillRoundedRect(0, 0, 240, 118, 6);
      };
      drawCardBackground();
      bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, 240, 118), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
      // 草药图由三层组成：105×98 棕色圆角外框 → 品阶色内底 + #2E2117 内阴影 → 80×80 草药图。
      const frame = this.add.graphics();
      const gradeColor = this.getMerchantGradeColor(item.grade);
      frame.fillStyle(0x5b3b25, 1);
      frame.fillRoundedRect(12, 10, 105, 98, 6);
      // 第二层是 101×94 的品阶纯色面，不使用描边。
      frame.fillStyle(gradeColor, 1);
      frame.fillRoundedRect(14, 12, 101, 94, 5);
      // 用数层半透明 #2E2117 做柔和内阴影，避免出现一圈生硬的边线。
      frame.fillStyle(0x2e2117, 0.6);
      frame.fillRoundedRect(14, 12, 101, 94, 5);
      frame.fillStyle(gradeColor, 0.18);
      frame.fillRoundedRect(18, 16, 93, 86, 4);
      frame.fillStyle(gradeColor, 0.12);
      frame.fillRoundedRect(22, 20, 85, 78, 3);
      const image = this.add.image(64.5, 59, item.texture).setDisplaySize(80, 80);
      // 商店与储物袋保持同一套交互反馈：悬浮或选中时显示金色高亮框。
      const highlight = this.add.graphics();
      const drawHighlight = (active) => {
        highlight.clear();
        if (!active) return;
        highlight.lineStyle(2, 0xfcc01f, 1);
        highlight.strokeRoundedRect(13, 11, 103, 96, 6);
      };
      drawHighlight(this.merchantSelectedItem?.id === item.id);
      const shownStock = this.getMerchantAvailableStock(item);
      const stock = addText(this, 108, 14, String(shownStock), 14, shownStock > 0 ? "#c4c0b8" : "#a07870", { strokeThickness: 1 }).setOrigin(1, 0);
      const name = addText(this, 126, 18, item.name, 20, "#f2d1ab", { strokeThickness: 0 });
      // 每个价格底框统一为 4px 圆角，并使用实际灵石图片，不再用文字菱形代替。
      const priceBg = this.add.graphics();
      priceBg.fillStyle(0x4a2f1a, 1);
      priceBg.fillRoundedRect(129, 69, 98, 36, 4);
      const priceLabel = item.sellPrice ? `回收 ${item.price}` : String(item.price);
      const price = addText(this, 0, 87, priceLabel, 17, item.sellPrice ? "#9be0b1" : "#d8dfbf", { strokeThickness: 0 }).setOrigin(0, 0.5);
      const priceIcon = this.add.image(0, 87, "merchant-spirit-stone").setDisplaySize(10, 17);
      const priceContentWidth = 10 + 6 + price.width;
      const priceStartX = 178 - priceContentWidth / 2;
      priceIcon.setX(priceStartX + 5);
      price.setX(priceStartX + 16);
      bg.on("pointerover", () => {
        drawCardBackground(true);
        drawHighlight(true);
      });
      bg.on("pointerout", () => {
        drawCardBackground(false);
        drawHighlight(this.merchantSelectedItem?.id === item.id);
      });
      // 商品点击也由 handleMerchantShopPointer 统一接收，避免缩放或重开商店时
      // 同一次点击被商品本身和全局界面各执行一次。
      card.add([bg, frame, image, stock, name, priceBg, priceIcon, price, highlight]);
      this.merchantProductsLayer.add(card);
    });
    // 商品超过当前四行时，显示可拖动的细滚动条。它放在商品区与右侧详情之间，
    // 不会遮住商品卡或详情文字。
    if (maxScrollRow > 0) {
      const trackTop = 210;
      const trackHeight = 508;
      const track = this.add.rectangle(1320, trackTop + trackHeight / 2, 12, trackHeight, 0x170f0a, 0.94)
        .setStrokeStyle(1, 0x6f4c2d);
      const thumbHeight = Math.max(42, trackHeight * (visibleRows / totalRows));
      const thumbY = trackTop + thumbHeight / 2
        + (trackHeight - thumbHeight) * (this.merchantProductScrollRow / maxScrollRow);
      const thumb = this.add.rectangle(1320, thumbY, 8, thumbHeight, 0xb7833f, 1)
        .setStrokeStyle(1, 0xf1ca72);
      this.merchantProductsLayer.add([track, thumb]);
    }
  }

  selectMerchantItem(item, silent = false) {
    const selectingDifferentItem = this.merchantSelectedItem?.id !== item?.id;
    this.merchantSelectedItem = item;
    const available = this.getMerchantAvailableStock(item);

    // 新选商品默认购买 1 个；加入购物清单后则保留玩家手动填写的数量。
    if (selectingDifferentItem || !Number.isFinite(this.merchantBuyQuantity)) {
      this.merchantBuyQuantity = available > 0 ? 1 : 0;
    } else {
      this.merchantBuyQuantity = Phaser.Math.Clamp(
        this.merchantBuyQuantity,
        available > 0 ? 1 : 0,
        available,
      );
    }
    this.merchantDetailType.setText(item.type);
    this.merchantDetailGrade.setText(item.grade).setColor("#b8ada0");
    this.merchantDetailImage.setTexture(item.texture).setDisplaySize(92, 92);
    this.merchantDetailImageFrame.setFillStyle(this.getMerchantGradeColor(item.grade));
    this.merchantDetailName.setText(item.name);
    this.merchantDetailDesc.setText(this.formatMerchantDescription(item.description));
    this.merchantDetailPriceLabel.setText(item.sellPrice ? "回收单价" : "单价");
    this.merchantDetailPrice.setText(String(item.price));
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    if (!silent) {
      this.merchantShopNotice.setText(`已选择 ${item.name}，再点同一商品即可${this.merchantMode === "sell" ? "加入出售清单" : "加入储物袋"}`);
      this.renderMerchantProductCards(this.getMerchantVisibleItems());
    }
  }

  changeMerchantQuantity(change) {
    if (!this.merchantSelectedItem) return;
    const available = this.getMerchantAvailableStock(this.merchantSelectedItem);
    this.merchantBuyQuantity = Phaser.Math.Clamp(this.merchantBuyQuantity + change, available > 0 ? 1 : 0, available);
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    if (this.merchantQuantityInputElement) this.merchantQuantityInputElement.value = String(this.merchantBuyQuantity);
  }

  setMerchantQuantityToMax() {
    if (!this.merchantSelectedItem) return;
    this.merchantBuyQuantity = this.getMerchantAvailableStock(this.merchantSelectedItem);
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    if (this.merchantQuantityInputElement) this.merchantQuantityInputElement.value = String(this.merchantBuyQuantity);
  }

  /** 点击数量框后，直接在原位置输入数字；不再弹出浏览器白色输入框。 */
  openMerchantQuantityInput() {
    if (!this.merchantSelectedItem || this.merchantQuantityInputElement) return;
    const canvas = this.game.canvas;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / 1920;
    const scaleY = canvasRect.height / 1080;
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.value = String(this.merchantBuyQuantity);
    input.setAttribute("aria-label", "购买数量");
    // 输入框覆盖在画布原有数量框上，坐标会随 1920×1080 的等比缩放自动换算。
    Object.assign(input.style, {
      position: "fixed",
      left: `${canvasRect.left + 1434 * scaleX}px`,
      top: `${canvasRect.top + 643 * scaleY}px`,
      width: `${156 * scaleX}px`,
      height: `${50 * scaleY}px`,
      boxSizing: "border-box",
      zIndex: "9999",
      background: "#1b1510",
      border: `${Math.max(1, scaleX)}px solid #b58234`,
      borderRadius: `${4 * scaleX}px`,
      color: "#f8e8d3",
      textAlign: "center",
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: `${22 * scaleY}px`,
      outline: "none",
      padding: "0",
    });
    const onlyNumbers = () => { input.value = input.value.replace(/[^0-9]/g, ""); };
    input.addEventListener("input", onlyNumbers);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        // 回车不仅确认数字，还会立刻把当前商品按该数量加入下方储物袋。
        this.closeMerchantQuantityInput(true, true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeMerchantQuantityInput(false);
      }
    });
    input.addEventListener("blur", () => this.closeMerchantQuantityInput(true));
    document.body.appendChild(input);
    this.merchantQuantityInputElement = input;
    this.input.keyboard.enabled = false;
    input.focus();
    input.select();
  }

  /** 提交数量时自动限制在当前剩余库存内，避免输入 999 后出现超买。 */
  closeMerchantQuantityInput(commit = true, addToCart = false) {
    const input = this.merchantQuantityInputElement;
    if (!input) return;
    this.merchantQuantityInputElement = null;
    if (commit && this.merchantSelectedItem) {
      const available = this.getMerchantAvailableStock(this.merchantSelectedItem);
      const entered = Number.parseInt(input.value, 10);
      this.merchantBuyQuantity = Phaser.Math.Clamp(Number.isFinite(entered) ? entered : 1, available > 0 ? 1 : 0, available);
      this.merchantQuantityText?.setText(String(this.merchantBuyQuantity));
    }
    input.remove();
    this.input.keyboard.enabled = true;
    if (commit && addToCart && this.merchantBuyQuantity > 0) this.purchaseMerchantItem();
  }

  /** 数量快捷键：1、10、全部都会立即把当前选中商品放入对应清单。 */
  addSelectedMerchantQuantity(amount) {
    if (!this.merchantSelectedItem) return;
    const available = this.getMerchantAvailableStock(this.merchantSelectedItem);
    if (available <= 0) {
      this.merchantShopNotice.setText(this.merchantMode === "sell" ? "背包中没有足够的该物品" : "该商品已经售罄");
      return;
    }
    this.merchantBuyQuantity = amount === "all" ? available : Math.min(Number(amount) || 1, available);
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    this.purchaseMerchantItem();
  }

  /** 左侧减号：从当前物品的购物清单中取消 1 个，不影响已经确认买下的物品。 */
  removeSelectedMerchantQuantity() {
    const item = this.merchantSelectedItem;
    if (!item) return;
    const cartEntry = this.merchantCart?.find((entry) => entry.item.id === item.id);
    if (!cartEntry) {
      this.merchantShopNotice.setText(`购物清单中没有 ${item.name}`);
      return;
    }
    cartEntry.quantity -= 1;
    if (cartEntry.quantity <= 0) this.merchantCart.splice(this.merchantCart.indexOf(cartEntry), 1);
    this.merchantBuyQuantity = 1;
    this.merchantQuantityText.setText("1");
    this.merchantShopNotice.setText(`已从购物清单移除 ${item.name} × 1`);
    playUiClickSound(this);
    this.refreshMerchantCurrencies();
    this.renderMerchantProductCards(this.getMerchantVisibleItems());
    this.renderMerchantCart();
  }

  purchaseMerchantItem() {
    const item = this.merchantSelectedItem;
    if (!item) return;
    const quantity = this.merchantBuyQuantity;
    if (item.stock <= 0 || quantity <= 0) { this.merchantShopNotice.setText(this.merchantMode === "sell" ? "背包中没有足够的该物品" : "该商品已经售罄"); return; }
    const cartEntry = this.merchantCart.find((entry) => entry.item.id === item.id);
    const alreadyAdded = cartEntry?.quantity || 0;
    if (alreadyAdded + quantity > item.stock) { this.merchantShopNotice.setText(this.merchantMode === "sell" ? "加入数量超过背包拥有数量" : "加入数量超过商人库存"); return; }
    // 同一种物品只占一个格子；这里仅加入待购清单，还没有扣灵石或库存。
    if (cartEntry) {
      cartEntry.quantity += quantity;
    } else {
      this.merchantCart.push({ item: { ...item }, quantity });
    }
    this.merchantShopNotice.setText(`已加入 ${item.name} × ${quantity}，可在储物袋悬浮${this.merchantMode === "sell" ? "取消出售" : "取消购物"}`);
    playUiClickSound(this);
    this.selectMerchantItem(item, true);
    this.refreshMerchantCurrencies();
    this.renderMerchantProductCards(this.getMerchantVisibleItems());
    this.renderMerchantCart();
  }

  getMerchantCartTotal() {
    return (this.merchantCart || []).reduce((total, entry) => total + entry.item.price * entry.quantity, 0);
  }

  /** 点击“购买全部”先核对价格与获得物品，不会直接扣灵石。 */
  openMerchantPurchaseConfirm() {
    if (!this.merchantCart?.length) {
      this.merchantShopNotice.setText("储物袋为空，请先把商品加入储物袋");
      return;
    }
    const total = this.getMerchantCartTotal();
    const selling = this.merchantMode === "sell";
    this.merchantPurchaseTitle.setText(selling ? "确认出售" : "确认购买");
    this.merchantPurchaseCostPrefix.setText(selling ? "将获得" : "将花费");
    this.merchantPurchaseCostText.setText(`${total.toLocaleString("zh-CN")} 灵石`);
    this.merchantPurchaseSummary.setText("");
    this.renderMerchantPurchasePreview(this.merchantCart);
    this.merchantPurchaseConfirm.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.merchantPurchaseConfirm, alpha: 1, duration: 130, ease: "Sine.Out" });
  }

  /** 确认框里的物品以卡片展示，内容随购物清单实时变化，而不是写死在背景图片中。 */
  renderMerchantPurchasePreview(entries) {
    if (!this.merchantPurchaseItemsLayer) return;
    this.merchantPurchaseItemsLayer.removeAll(true);
    const shown = entries.slice(0, 4);
    const gap = 144;
    const startCenterX = 960 - ((shown.length - 1) * gap) / 2;
    shown.forEach((entry, index) => {
      const centerX = startCenterX + index * gap;
      const x = centerX - 52;
      const y = 467;
      const gradeColor = this.getMerchantGradeColor(entry.item.grade);
      const frame = this.add.graphics();
      frame.fillStyle(0x5b3b25, 1);
      frame.fillRoundedRect(x, y, 105, 98, 6);
      frame.fillStyle(gradeColor, 1);
      frame.fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      frame.fillStyle(0x2e2117, 0.38);
      frame.fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      frame.fillStyle(gradeColor, 0.18);
      frame.fillRoundedRect(x + 6, y + 6, 93, 86, 4);
      const icon = this.add.image(centerX, y + 49, entry.item.texture).setDisplaySize(80, 80);
      const quantity = addText(this, x + 94, y + 8, String(entry.quantity), 14, "#d6d5ca", { strokeThickness: 1 }).setOrigin(1, 0);
      const name = addText(this, centerX, y + 118, entry.item.name, 19, "#e7c88c", { strokeThickness: 0 }).setOrigin(0.5);
      this.merchantPurchaseItemsLayer.add([frame, icon, quantity, name]);
    });
    if (entries.length > shown.length) {
      const extra = addText(this, 960, 624, `另有 ${entries.length - shown.length} 种物品`, 15, "#b8a387", { strokeThickness: 0 }).setOrigin(0.5);
      this.merchantPurchaseItemsLayer.add(extra);
    }
  }

  closeMerchantPurchaseConfirm() {
    this.merchantPurchaseConfirm?.setVisible(false);
  }

  /** 在确认弹窗中真正完成扣款、入背包与商人库存刷新。 */
  confirmMerchantCartPurchase() {
    const total = this.getMerchantCartTotal();
    if (!this.merchantCart?.length) { this.closeMerchantPurchaseConfirm(); return; }
    if (this.merchantMode === "buy" && (Number(gameState.player.spiritStones) || 0) < total) {
      this.merchantPurchaseSummary.setText(`灵石不足：需要 ${total.toLocaleString("zh-CN")}，当前 ${(Number(gameState.player.spiritStones) || 0).toLocaleString("zh-CN")}`);
      return;
    }
    for (const entry of this.merchantCart) {
      const item = this.merchantItems.find((candidate) => candidate.id === entry.item.id);
      const available = this.merchantMode === "sell" ? Number(gameState.player.inventory?.[entry.item.id]) || 0 : item?.stock;
      if (!item || available < entry.quantity) {
        this.merchantPurchaseSummary.setText(`${entry.item.name} 数量已经变化，请关闭弹窗后重新选择。`);
        return;
      }
    }
    if (this.merchantMode === "buy") gameState.player.spiritStones -= total;
    else gameState.player.spiritStones += total;
    gameState.world.merchantSpiritStones = this.merchantMode === "buy"
      ? (Number(gameState.world.merchantSpiritStones) || 0) + total
      : Math.max(0, (Number(gameState.world.merchantSpiritStones) || 0) - total);
    gameState.world.merchantStock = gameState.world.merchantStock || {};
    gameState.player.inventory = gameState.player.inventory || {};
    this.merchantCart.forEach((entry) => {
      const item = this.merchantItems.find((candidate) => candidate.id === entry.item.id);
      item.stock += this.merchantMode === "buy" ? -entry.quantity : entry.quantity;
      gameState.world.merchantStock[item.id] = item.stock;
      gameState.player.inventory[item.id] = Math.max(0, (Number(gameState.player.inventory[item.id]) || 0) + (this.merchantMode === "buy" ? entry.quantity : -entry.quantity));
    });
    this.merchantCart = [];
    this.merchantCarts[this.merchantMode] = this.merchantCart;
    this.merchantCartScrollRow = 0;
    this.merchantCancelButton?.setVisible(false);
    this.closeMerchantPurchaseConfirm();
    this.refreshMerchantCurrencies();
    this.merchantShopNotice.setText(this.merchantMode === "buy"
      ? `购买完成，花费 ◆ ${total.toLocaleString("zh-CN")}；售罄物品已从商人列表移除`
      : `出售完成，获得 ◆ ${total.toLocaleString("zh-CN")} 灵石`);
    const available = this.getMerchantVisibleItems().filter((item) => item.stock > 0);
    if (available.length) this.selectMerchantItem(available[0], true);
    this.renderMerchantProductCards(this.getMerchantVisibleItems());
    this.renderMerchantCart();
    playUiClickSound(this);
    saveFirstChapterProgress();
  }

  renderMerchantCart() {
    if (!this.merchantCartLayer) return;
    this.merchantCartLayer.removeAll(true);
    const totalRows = Math.ceil((this.merchantCart.length || 0) / 12);
    const maxScrollRow = Math.max(0, totalRows - 2);
    this.merchantCartScrollRow = Phaser.Math.Clamp(this.merchantCartScrollRow || 0, 0, maxScrollRow);
    const startIndex = this.merchantCartScrollRow * 12;
    for (let visibleIndex = 0; visibleIndex < 24; visibleIndex += 1) {
      const column = visibleIndex % 12;
      const row = Math.floor(visibleIndex / 12);
      const x = 321 + column * 117;
      const y = 752 + row * 108;
      const index = startIndex + visibleIndex;
      const entry = this.merchantCart[index];
      // 储物袋和上方草药共用同一套物品框：深棕圆角底 → 棕色外框
      // → 品阶色内底 + 内阴影。这样不会再出现两种不同的格子样式。
      const slot = this.add.graphics();
      // 空格也必须看得见：与储物袋大底分开一层深棕格，并保留细边线。
      slot.fillStyle(0x36261c, 1);
      slot.fillRoundedRect(x, y, 105, 98, 4);
      slot.lineStyle(1, 0x5a402b, 1);
      slot.strokeRoundedRect(x, y, 105, 98, 4);
      if (entry) {
        const gradeColor = this.getMerchantGradeColor(entry.item.grade);
        slot.fillStyle(0x5b3b25, 1);
        slot.fillRoundedRect(x, y, 105, 98, 6);
        slot.fillStyle(gradeColor, 1);
        slot.fillRoundedRect(x + 2, y + 2, 101, 94, 5);
        // 与草药列表一致的柔和内阴影，保留品阶颜色但避免出现彩色描边。
        slot.fillStyle(0x2e2117, 0.38);
        slot.fillRoundedRect(x + 2, y + 2, 101, 94, 5);
        slot.fillStyle(gradeColor, 0.18);
        slot.fillRoundedRect(x + 6, y + 6, 93, 86, 4);
        slot.fillStyle(gradeColor, 0.12);
        slot.fillRoundedRect(x + 10, y + 10, 85, 78, 3);
      }
      const pieces = [slot];
      if (entry) {
        const icon = this.add.image(x + 52, y + 49, entry.item.texture).setDisplaySize(80, 80);
        const count = addText(this, x + 94, y + 8, String(entry.quantity), 14, "#d6d5ca", { strokeThickness: 1 }).setOrigin(1, 0);
        slot.setInteractive(new Phaser.Geom.Rectangle(x, y, 105, 98), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        slot.on("pointerover", () => this.showMerchantCancelButton(index, x, y));
        slot.on("pointerout", () => this.time.delayedCall(80, () => {
          if (!this.merchantCancelHovered) this.merchantCancelButton?.setVisible(false);
        }));
        pieces.push(icon, count);
      }
      this.merchantCartLayer.add(pieces);
    }
    // 只有超过两行时才显示滚动条；它始终位于储物袋内，不会挤到右侧外框。
    if (maxScrollRow > 0) {
      const track = this.add.rectangle(1742, 855, 18, 206, 0x160f0b, 0.9).setStrokeStyle(1, 0x765538);
      const thumbHeight = Math.max(42, 206 * (2 / totalRows));
      const thumbY = 752 + thumbHeight / 2 + (206 - thumbHeight) * (this.merchantCartScrollRow / maxScrollRow);
      const thumb = this.add.rectangle(1742, thumbY, 12, thumbHeight, 0xb7833f, 1).setStrokeStyle(1, 0xf4cf7d);
      this.merchantCartLayer.add([track, thumb]);
    }
  }

  /** 储物袋滚动区：位置固定在袋子内部，超过 24 格后才会生效。 */
  isMerchantCartPointer(pointer) {
    return pointer.x >= 298 && pointer.x <= 1774 && pointer.y >= 730 && pointer.y <= 976;
  }

  changeMerchantCartScroll(change) {
    const totalRows = Math.ceil((this.merchantCart?.length || 0) / 12);
    const maxScrollRow = Math.max(0, totalRows - 2);
    const next = Phaser.Math.Clamp((this.merchantCartScrollRow || 0) + change, 0, maxScrollRow);
    if (next === this.merchantCartScrollRow) return;
    this.merchantCartScrollRow = next;
    this.merchantCancelButton?.setVisible(false);
    this.renderMerchantCart();
  }

  showMerchantCancelButton(index, x, y) {
    this.merchantCancelIndex = index;
    this.merchantCancelHovered = false;
    const buttonX = x > 1500 ? x - 64 : x + 110;
    this.merchantCancelButton.setPosition(buttonX, y + 49).setVisible(true);
    this.merchantCancelButton.list[0].once("pointerover", () => { this.merchantCancelHovered = true; });
    this.merchantCancelButton.list[0].once("pointerout", () => { this.merchantCancelHovered = false; this.merchantCancelButton.setVisible(false); });
  }

  cancelMerchantCartItem() {
    const entry = this.merchantCart?.[this.merchantCancelIndex];
    if (!entry) return;
    this.merchantCart.splice(this.merchantCancelIndex, 1);
    this.merchantShopNotice.setText(`已从${this.merchantMode === "sell" ? "出售" : "待购"}清单移除 ${entry.item.name} × ${entry.quantity}`);
    this.merchantCancelButton.setVisible(false);
    this.refreshMerchantCurrencies();
    this.renderMerchantProductCards(this.getMerchantVisibleItems());
    this.renderMerchantCart();
  }

  /** 商店的子容器层级较多，统一用固定 1920 坐标判断点击，避免点击被底层地图接走。 */
  handleMerchantShopPointer(pointer) {
    const { x, y } = pointer;
    if (this.merchantPurchaseConfirm?.visible) {
      this.handleMerchantPurchaseConfirmPointer(pointer);
      return;
    }
    if (x >= 1732 && x <= 1776 && y >= 102 && y <= 146) { this.closeMerchantShop(); return; }
    if (x >= 994 && x <= 1106 && y >= 102 && y <= 146) { this.setMerchantMode("buy"); return; }
    if (x >= 1119 && x <= 1231 && y >= 102 && y <= 146) { this.setMerchantMode("sell"); return; }
    const categoryButton = this.merchantCategoryButtons?.find((button) => (
      x >= button.bg.x - 48 && x <= button.bg.x + 48
      && y >= button.y - 23 && y <= button.y + 23
    ));
    if (categoryButton) {
      this.selectMerchantCategory(categoryButton.name);
      return;
    }
    if (this.merchantCancelButton?.visible && Math.abs(x - this.merchantCancelButton.x) <= 59 && Math.abs(y - this.merchantCancelButton.y) <= 30) {
      this.cancelMerchantCartItem();
      return;
    }
    if (x >= 147 && x <= 275 && y >= 830 && y <= 870) { this.openMerchantPurchaseConfirm(); return; }
    // 商品区右侧的滚动条：点击轨道可跳转，按住后可上下拖动。
    if (x >= 1308 && x <= 1332 && y >= 210 && y <= 718) {
      const items = this.getMerchantScrollableProducts();
      const { maxScrollRow } = this.getMerchantProductScrollMetrics(items);
      if (maxScrollRow > 0) {
        this.merchantProductScrollDragging = true;
        this.updateMerchantProductScrollFromPointer(y);
      }
      return;
    }
    // 点击储物袋最右侧的滚动条，可以直接跳到对应的下拉行。
    if (x >= 1727 && x <= 1757 && y >= 752 && y <= 958) {
      const totalRows = Math.ceil((this.merchantCart?.length || 0) / 12);
      const maxScrollRow = Math.max(0, totalRows - 2);
      if (maxScrollRow > 0) {
        this.merchantCartScrollRow = Phaser.Math.Clamp(Math.round(((y - 752) / 206) * maxScrollRow), 0, maxScrollRow);
        this.merchantCancelButton?.setVisible(false);
        this.renderMerchantCart();
      }
      return;
    }
    // 选中商品后：左侧减 1，右侧加 1；“全部”一次加入剩余库存。
    if (x >= 1370 && x <= 1424 && y >= 643 && y <= 693) { this.removeSelectedMerchantQuantity(); return; }
    if (x >= 1434 && x <= 1590 && y >= 643 && y <= 693) { this.openMerchantQuantityInput(); return; }
    if (x >= 1600 && x <= 1654 && y >= 643 && y <= 693) { this.addSelectedMerchantQuantity(1); return; }
    if (x >= 1691 && x <= 1765 && y >= 643 && y <= 693) { this.addSelectedMerchantQuantity("all"); return; }
    const visibleItems = this.getMerchantScrollableProducts();
    const { columns, visibleRows } = this.getMerchantProductScrollMetrics(visibleItems);
    const startIndex = (this.merchantProductScrollRow || 0) * columns;
    const shownItems = visibleItems.slice(startIndex, startIndex + columns * visibleRows);
    for (let index = 0; index < shownItems.length; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cardX = 300 + column * 255;
      const cardY = 210 + row * 130;
      if (x >= cardX && x <= cardX + 240 && y >= cardY && y <= cardY + 118) {
        const item = shownItems[index];
        if (this.merchantSelectedItem?.id === item.id) this.purchaseMerchantItem();
        else this.selectMerchantItem(item);
        return;
      }
    }
  }

  /** 确认层是最高层：点击确认或取消绝不会穿透到商店和大地图。 */
  handleMerchantPurchaseConfirmPointer(pointer) {
    const { x, y } = pointer;
    if (x >= 971 && x <= 1099 && y >= 650 && y <= 690) { this.closeMerchantPurchaseConfirm(); return; }
    if (x >= 824 && x <= 952 && y >= 650 && y <= 690) this.confirmMerchantCartPurchase();
  }

  /** 只有悬浮在储物袋内的实际物品上，才在该物品旁显示“取消购物”。 */
  handleMerchantShopPointerMove(pointer) {
    const { x, y } = pointer;
    if (this.merchantProductScrollDragging) {
      this.updateMerchantProductScrollFromPointer(y);
      return;
    }
    const startIndex = (this.merchantCartScrollRow || 0) * 12;
    for (let visibleIndex = 0; visibleIndex < 24; visibleIndex += 1) {
      const index = startIndex + visibleIndex;
      if (!this.merchantCart[index]) continue;
      const column = visibleIndex % 12;
      const row = Math.floor(visibleIndex / 12);
      const slotX = 321 + column * 117;
      const slotY = 752 + row * 108;
      if (x >= slotX && x <= slotX + 105 && y >= slotY && y <= slotY + 98) {
        this.showMerchantCancelButton(index, slotX, slotY);
        return;
      }
    }
    const overCancel = this.merchantCancelButton?.visible
      && Math.abs(x - this.merchantCancelButton.x) <= 59
      && Math.abs(y - this.merchantCancelButton.y) <= 30;
    if (!overCancel) this.merchantCancelButton?.setVisible(false);
  }

  /** 读取玩家实际拥有的物品；商店购买后会立即在这里出现。 */
  getStorageBagItems() {
    const inventory = gameState.player.inventory || {};
    return this.getMerchantItems()
      .map((item) => ({ ...item, quantity: Math.max(0, Number(inventory[item.id]) || 0) }))
      .filter((item) => item.quantity > 0);
  }

  getStorageBagVisibleItems() {
    let items = this.getStorageBagItems();
    if (this.storageBagCategory !== "全部") items = items.filter((item) => item.type === this.storageBagCategory);
    if (this.storageBagGrade !== "全部") items = items.filter((item) => item.grade === this.storageBagGrade);
    return items;
  }

  /**
   * Pixso「储物袋」主界面：固定 1920 × 1080 坐标。
   * 左侧是悬浮详情，右侧固定为 5 × 5 个 105 × 98 的物品格；超过五行才允许滚动。
   */
  createStorageBagPanel() {
    const panel = this.add.container(0, 0).setScrollFactor(0).setDepth(2050).setVisible(false);
    // 容器自身接收所有点击。Phaser 在缩放画布时会把 pointer.x/y 自动换算为
    // 1920 × 1080 的游戏坐标，避免再次手动换算后造成关闭键和栏目点不到。
    panel.setSize(SCREEN_WIDTH, SCREEN_HEIGHT).setInteractive({ useHandCursor: false });
    panel.on("pointerdown", (pointer) => this.handleStorageBagPointer({ x: pointer.x, y: pointer.y }));
    panel.on("pointermove", (pointer) => this.handleStorageBagPointerMove({ x: pointer.x, y: pointer.y }));
    // 遮罩只负责变暗，不设为可交互对象；否则会盖住关闭键、分类按钮和物品悬浮区。
    const shade = this.add.rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x071009, 0.72).setOrigin(0);
    const top = this.add.graphics();
    top.fillStyle(0x0d0d0b, 0.94);
    top.fillRect(0, 0, SCREEN_WIDTH, 145);
    top.lineStyle(1, 0x4b4534, 0.9);
    top.lineBetween(0, 144, SCREEN_WIDTH, 144);
    panel.add([shade, top]);

    // 顶部一级栏目：储物袋为选中态，其余栏目保留设计稿的可扩展入口。
    const navLabels = ["储物袋", "属性", "法宝", "法术", "功法", "社交", "存档"];
    const navStart = 304;
    navLabels.forEach((label, index) => {
      const x = navStart + index * 155;
      if (index === 0) {
        const selected = this.add.graphics();
        selected.fillStyle(0x343727, 1);
        selected.fillRoundedRect(x, 28, 144, 88, 8);
        selected.fillStyle(0x383627, 0.72);
        selected.fillRoundedRect(x + 2, 31, 140, 82, 7);
        panel.add(selected);
      }
      const text = addText(this, x + 72, 72, label, 34, index === 0 ? "#ded1b1" : "#857f5a", {
        stroke: "#252a1e",
        strokeThickness: index === 0 ? 2 : 1,
      }).setOrigin(0.5);
      panel.add(text);
    });
    const close = this.add.graphics();
    close.fillStyle(0x2a251d, 1);
    close.fillRoundedRect(1760, 32, 80, 80, 8);
    close.lineStyle(1, 0x746246, 1);
    close.strokeRoundedRect(1760, 32, 80, 80, 8);
    close.setInteractive(new Phaser.Geom.Rectangle(1760, 32, 80, 80), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
    close.on("pointerdown", () => this.closeStorageBag());
    const closeText = addText(this, 1800, 72, "×", 36, "#ded1b1", { strokeThickness: 1 }).setOrigin(0.5);
    panel.add([close, closeText]);

    const title = addText(this, 960, 218, "储物袋", 38, "#f3d797", { strokeThickness: 1 }).setOrigin(0.5);
    const subtitle = addText(this, 960, 260, "收纳途中所得的草药、书籍与装备", 17, "#8d7b70", { strokeThickness: 0 }).setOrigin(0.5);
    panel.add([title, subtitle]);

    // 二级栏目：物品类型；右端“品级”打开按凡、灵、玄、地、天、仙、神器筛选的下拉栏。
    this.storageBagCategoryButtons = [];
    ["全部", "灵草", "书籍", "装备", "器材", "其他", "丹药"].forEach((name, index) => {
      const x = 558 + index * 105;
      const bg = this.add.image(x, 326, "merchant-category-normal").setDisplaySize(95, 45);
      const text = addText(this, x, 325, name, 20, "#f2d1ab", { stroke: "#2a170d", strokeThickness: 1 }).setOrigin(0.5);
      panel.add([bg, text]);
      bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectStorageBagCategory(name));
      this.storageBagCategoryButtons.push({ name, x, bg, text });
    });
    const gradeButton = this.add.graphics();
    gradeButton.fillStyle(0x4b3723, 1);
    gradeButton.fillRoundedRect(1338, 304, 150, 45, 7);
    gradeButton.lineStyle(1, 0x765438, 1);
    gradeButton.strokeRoundedRect(1338, 304, 150, 45, 7);
    gradeButton.setInteractive(new Phaser.Geom.Rectangle(1338, 304, 150, 45), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
    gradeButton.on("pointerdown", () => this.storageBagGradeMenu.setVisible(!this.storageBagGradeMenu.visible));
    this.storageBagGradeButtonText = addText(this, 1413, 326, "品级：全部  ▾", 20, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    panel.add([gradeButton, this.storageBagGradeButtonText]);

    const infoBase = this.add.graphics();
    infoBase.fillStyle(0x24170f, 0.98);
    infoBase.fillRoundedRect(210, 390, 650, 485, 15);
    const gridBase = this.add.graphics();
    gridBase.fillStyle(0x1d120c, 0.92);
    gridBase.fillRoundedRect(958, 390, 635, 570, 15);
    panel.add([infoBase, gridBase]);

    this.storageBagInfoLayer = this.add.container(0, 0).setVisible(false);
    this.storageBagGridLayer = this.add.container(0, 0);
    this.storageBagEmptyText = addText(this, 1275, 675, "储物袋中还没有物品", 22, "#8d7b70", { strokeThickness: 0 }).setOrigin(0.5).setVisible(false);
    this.storageBagCapacityText = addText(this, 996, 992, "容量 0 / 100", 25, "#a98c70", { strokeThickness: 0 });
    const stoneIcon = this.add.image(1430, 1004, "merchant-spirit-stone").setDisplaySize(12, 20);
    this.storageBagStoneText = addText(this, 1447, 1004, "灵石 0", 25, "#ffbb7c", { strokeThickness: 0 }).setOrigin(0, 0.5);
    const hint = addText(this, 1275, 938, "鼠标悬浮物品可查看详情", 15, "#8d7b70", { strokeThickness: 0 }).setOrigin(0.5);
    panel.add([this.storageBagInfoLayer, this.storageBagGridLayer, this.storageBagEmptyText, this.storageBagCapacityText, stoneIcon, this.storageBagStoneText, hint]);

    this.storageBagGradeMenu = this.add.container(0, 0).setVisible(false);
    const menuBg = this.add.graphics();
    menuBg.fillStyle(0x24170f, 0.98);
    menuBg.fillRoundedRect(1338, 356, 150, 334, 14);
    menuBg.lineStyle(1, 0x5f472d, 1);
    menuBg.strokeRoundedRect(1338, 356, 150, 334, 14);
    this.storageBagGradeMenu.add(menuBg);
    this.storageBagGradeOptions = [];
    ["全部", "凡品", "灵品", "玄品", "地品", "天品", "仙品", "神器"].forEach((name, index) => {
      const y = 379 + index * 40;
      const option = this.add.graphics();
      option.fillStyle(0x4b3723, 0.84);
      option.fillRoundedRect(1348, y - 16, 130, 32, 5);
      const label = addText(this, 1413, y, name, 18, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      this.storageBagGradeMenu.add([option, label]);
      option.setInteractive(new Phaser.Geom.Rectangle(1348, y - 16, 130, 32), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
      option.on("pointerdown", () => this.selectStorageBagGrade(name));
      this.storageBagGradeOptions.push({ name, y, option, label });
    });
    panel.add(this.storageBagGradeMenu);
    this.storageBagPanel = panel;
  }

  openStorageBag() {
    if (!this.storageBagPanel) this.createStorageBagPanel();
    playUiClickSound(this);
    this.target = null;
    this.storageBagCategory = "全部";
    this.storageBagGrade = "全部";
    this.storageBagScrollRow = 0;
    this.storageBagHoveredItemId = null;
    this.storageBagGradeMenu.setVisible(false);
    this.storageBagPanel.setAlpha(0).setVisible(true);
    this.renderStorageBag();
    this.tweens.add({ targets: this.storageBagPanel, alpha: 1, duration: 180, ease: "Sine.Out" });
  }

  closeStorageBag() {
    if (!this.storageBagPanel?.visible) return;
    playUiClickSound(this);
    this.storageBagPanel.setVisible(false);
    this.storageBagInfoLayer?.setVisible(false);
    this.storageBagGradeMenu?.setVisible(false);
    this.storageBagHoveredItemId = null;
  }

  selectStorageBagCategory(category) {
    this.storageBagCategory = category;
    this.storageBagScrollRow = 0;
    this.storageBagCategoryButtons.forEach((button) => {
      const active = button.name === category;
      button.bg.setTexture(active ? "merchant-category-selected" : "merchant-category-normal");
      button.text.setColor(active ? "#fff2c6" : "#f2d1ab");
    });
    this.storageBagInfoLayer.setVisible(false);
    this.storageBagHoveredItemId = null;
    this.renderStorageBag();
  }

  selectStorageBagGrade(grade) {
    this.storageBagGrade = grade;
    this.storageBagScrollRow = 0;
    this.storageBagGradeButtonText.setText(`品级：${grade}  ▾`);
    this.storageBagGradeMenu.setVisible(false);
    this.storageBagInfoLayer.setVisible(false);
    this.storageBagHoveredItemId = null;
    this.renderStorageBag();
  }

  /** 重新绘制 25 个固定格位；格位保持 105 × 98，物品图片保持 80 × 80。 */
  renderStorageBag() {
    if (!this.storageBagGridLayer) return;
    const items = this.getStorageBagVisibleItems();
    const rows = Math.ceil(items.length / 5);
    const maxScroll = Math.max(0, rows - 5);
    this.storageBagScrollRow = Phaser.Math.Clamp(this.storageBagScrollRow || 0, 0, maxScroll);
    const first = this.storageBagScrollRow * 5;
    this.storageBagGridLayer.removeAll(true);
    this.storageBagSlotItems = [];
    for (let slotIndex = 0; slotIndex < 25; slotIndex += 1) {
      const column = slotIndex % 5;
      const row = Math.floor(slotIndex / 5);
      const x = 978 + column * 117;
      const y = 412 + row * 110;
      const item = items[first + slotIndex];
      const slot = this.add.graphics();
      slot.fillStyle(0x36261c, 1);
      slot.fillRoundedRect(x, y, 105, 98, 5);
      slot.lineStyle(1, 0x4e3727, 1);
      slot.strokeRoundedRect(x, y, 105, 98, 5);
      // 用三层半透明深色模拟 Pixso 的 #2E2117、25px 模糊内阴影。
      slot.fillStyle(0x2e2117, 0.55);
      slot.fillRoundedRect(x + 3, y + 3, 99, 92, 4);
      this.storageBagGridLayer.add(slot);
      if (!item) continue;
      const grade = this.add.graphics();
      grade.fillStyle(this.getMerchantGradeColor(item.grade), 1);
      grade.fillRoundedRect(x + 7, y + 7, 91, 84, 4);
      grade.fillStyle(0x2e2117, 0.22);
      grade.fillRoundedRect(x + 10, y + 10, 85, 78, 3);
      const image = this.add.image(x + 52.5, y + 49, item.texture).setDisplaySize(80, 80);
      const amount = addText(this, x + 94, y + 8, String(item.quantity), 14, "#c4c0b8", { stroke: "#2e2117", strokeThickness: 2 }).setOrigin(1, 0);
      // 透明点击层只覆盖有物品的格子：悬浮显示详情，且不会让空格误触。
      const hitArea = this.add.rectangle(x + 52.5, y + 49, 105, 98, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hitArea.on("pointerover", () => this.showStorageBagItemInfo(item));
      hitArea.on("pointerout", () => {
        this.storageBagHoveredItemId = null;
        this.storageBagInfoLayer?.setVisible(false);
      });
      hitArea.on("pointerdown", () => {
        playUiClickSound(this);
        this.showStorageBagItemInfo(item);
      });
      this.storageBagGridLayer.add([grade, image, amount, hitArea]);
      this.storageBagSlotItems.push({ item, x, y });
    }
    if (maxScroll > 0) {
      const track = this.add.graphics();
      track.fillStyle(0x17100b, 0.9);
      track.fillRoundedRect(1568, 420, 10, 520, 5);
      const thumbHeight = Math.max(72, 520 * (5 / rows));
      const thumbY = 420 + (520 - thumbHeight) * (this.storageBagScrollRow / maxScroll);
      track.fillGradientStyle(0x936e44, 0x936e44, 0x795738, 0x795738, 1);
      track.fillRoundedRect(1568, thumbY, 10, thumbHeight, 5);
      this.storageBagGridLayer.add(track);
    }
    this.storageBagEmptyText.setVisible(items.length === 0);
    this.storageBagCapacityText.setText(`容量 ${items.length} / 100`);
    this.storageBagStoneText.setText(`灵石 ${(Number(gameState.player.spiritStones) || 0).toLocaleString("zh-CN")}`);
  }

  showStorageBagItemInfo(item) {
    if (!item || this.storageBagHoveredItemId === item.id) return;
    this.storageBagHoveredItemId = item.id;
    this.storageBagInfoLayer.removeAll(true).setVisible(true);
    const card = this.add.graphics();
    card.fillStyle(0x2c2418, 1);
    card.fillRoundedRect(235, 415, 600, 435, 15);
    const type = addText(this, 274, 452, `类型：${item.type}`, 20, "#d4ae7f", { strokeThickness: 0 });
    const grade = addText(this, 795, 452, `品阶：${item.grade}`, 20, "#919090", { strokeThickness: 0 }).setOrigin(1, 0);
    const frame = this.add.graphics();
    frame.fillStyle(this.getMerchantGradeColor(item.grade), 1);
    frame.fillRoundedRect(465, 492, 105, 98, 5);
    frame.fillStyle(0x2e2117, 0.25);
    frame.fillRoundedRect(469, 496, 97, 90, 4);
    const image = this.add.image(517, 541, item.texture).setDisplaySize(80, 80);
    const name = addText(this, 535, 626, item.name, 27, "#f8cf14", { strokeThickness: 1 }).setOrigin(0.5);
    const description = addText(this, 286, 670, `物品说明：${item.description || "暂无说明"}`, 17, "#8d7b70", {
      strokeThickness: 0,
      wordWrap: { width: 500 },
      lineSpacing: 8,
    });
    const quantity = addText(this, 535, 784, `持有数量：${item.quantity}`, 20, "#baa18c", { strokeThickness: 0 }).setOrigin(0.5);
    const hint = addText(this, 535, 821, "左键选中  |  右键使用", 14, "#8d7b70", { strokeThickness: 0 }).setOrigin(0.5);
    this.storageBagInfoLayer.add([card, type, grade, frame, image, name, description, quantity, hint]);
  }

  isStorageBagGridPointer(pointer) {
    return pointer.x >= 958 && pointer.x <= 1593 && pointer.y >= 390 && pointer.y <= 960;
  }

  changeStorageBagScroll(change) {
    const rows = Math.ceil(this.getStorageBagVisibleItems().length / 5);
    const maxScroll = Math.max(0, rows - 5);
    const next = Phaser.Math.Clamp((this.storageBagScrollRow || 0) + change, 0, maxScroll);
    if (next === this.storageBagScrollRow) return;
    this.storageBagScrollRow = next;
    this.storageBagInfoLayer.setVisible(false);
    this.storageBagHoveredItemId = null;
    this.renderStorageBag();
  }

  handleStorageBagPointerMove(pointer) {
    const points = this.getStorageBagPointerCandidates(pointer);
    const hit = points.map((point) => this.storageBagSlotItems?.find((slot) => (
      point.x >= slot.x && point.x <= slot.x + 105 && point.y >= slot.y && point.y <= slot.y + 98
    ))).find(Boolean);
    if (hit) this.showStorageBagItemInfo(hit.item);
    else if (this.storageBagHoveredItemId) {
      this.storageBagHoveredItemId = null;
      this.storageBagInfoLayer.setVisible(false);
    }
  }

  handleStorageBagPointer(pointer) {
    // 不同浏览器会把 Phaser Pointer 保留成 CSS 像素或游戏设计像素；
    // 同时检查两种坐标，保证缩放窗口时关闭键、分类和物品格都能点到。
    const points = this.getStorageBagPointerCandidates(pointer);
    const matches = (predicate) => points.some(predicate);
    if (matches(({ x, y }) => x >= 1760 && x <= 1840 && y >= 32 && y <= 112)) { this.closeStorageBag(); return; }
    const category = this.storageBagCategoryButtons?.find((button) => matches(({ x, y }) => x >= button.x - 48 && x <= button.x + 48 && y >= 303 && y <= 349));
    if (category) { this.selectStorageBagCategory(category.name); return; }
    if (matches(({ x, y }) => x >= 1338 && x <= 1488 && y >= 304 && y <= 349)) {
      this.storageBagGradeMenu.setVisible(!this.storageBagGradeMenu.visible);
      return;
    }
    if (this.storageBagGradeMenu?.visible) {
      const option = this.storageBagGradeOptions.find((entry) => matches(({ x, y }) => x >= 1348 && x <= 1478 && y >= entry.y - 18 && y <= entry.y + 18));
      if (option) { this.selectStorageBagGrade(option.name); return; }
      this.storageBagGradeMenu.setVisible(false);
    }
    const hit = points.map((point) => this.storageBagSlotItems?.find((slot) => point.x >= slot.x && point.x <= slot.x + 105 && point.y >= slot.y && point.y <= slot.y + 98)).find(Boolean);
    if (hit) {
      playUiClickSound(this);
      this.showStorageBagItemInfo(hit.item);
    }
  }

  getStorageBagPointerCandidates(pointer) {
    const raw = { x: Number(pointer?.x) || 0, y: Number(pointer?.y) || 0 };
    const scaled = this.getUiPointer(raw);
    const same = Math.abs(raw.x - scaled.x) < 0.5 && Math.abs(raw.y - scaled.y) < 0.5;
    return same ? [raw] : [raw, scaled];
  }

  // 储物袋界面单独放在 ui/StorageBagPanel.js；场景这里只负责打开与转发输入。
  openStorageBag() {
    if (!this.storageBag) {
      this.storageBag = new StorageBagPanel(this);
    }
    this.storageBag.open();
    this.storageBagPanel = this.storageBag.panel;
  }

  /**
   * 从地图顶部“法宝”图标直接进入法宝页。
   * 法宝页仍属于背包系统，因此不复制一套场景代码，只切换 StorageBagPanel 的标签状态。
   */
  openArtifactBag() {
    if (!this.storageBag) {
      this.storageBag = new StorageBagPanel(this);
    }
    this.storageBag.open("法宝");
    this.storageBagPanel = this.storageBag.panel;
  }

  closeStorageBag() {
    if (!this.storageBag) return;
    this.storageBag.close();
    this.storageBagPanel = this.storageBag.panel;
  }

  handleStorageBagPointer(pointer) {
    this.storageBag?.handlePointer(pointer);
  }

  handleStorageBagPointerMove(pointer) {
    this.storageBag?.handlePointerMove(pointer);
  }

  isStorageBagGridPointer(pointer) {
    return this.storageBag?.isGridPointer(pointer) ?? false;
  }

  changeStorageBagScroll(change) {
    this.storageBag?.scroll(change);
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
      buttons: [
        { label: "进入全屏", variant: "secondary", y: -160, onClick: () => this.enterFullscreen() },
        { label: "窗口化", variant: "secondary", y: -99, onClick: () => this.exitFullscreen() },
        { label: "导出游戏数据", variant: "utility", y: -38, onClick: () => this.exportGameData() },
        { label: "导入游戏数据", variant: "utility", y: 23, onClick: () => this.importGameData() },
        { label: "保存并退出到封面", variant: "primary", y: 84, onClick: () => this.exitToCover() },
        { label: "关闭", variant: "danger", y: 145, onClick: () => this.closeGameSettings() },
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
      // 已被这个角色击败的怪物，不会再次出现在地图中。
      if (object.type === "monster" && gameState.world.defeatedMonsterIds.includes(object.id)) return;
      const info = MAP_OBJECT_TYPES[object.type] || MAP_OBJECT_TYPES.npc;
      const marker = this.add.container(object.x, object.y).setDepth(6);
      const shadow = this.add.ellipse(0, 4, 50, 13, 0x17221e, 0.32);
      let portrait;
      let questionMark = null;
      let markerNumber = null;
      const isMerchant = object.type === "npc" && this.isMerchantNpc(object);
      // 商人与普通修士一样：没有专用“大地图立绘”时只显示问号交互标记，
      // 不直接把对话立绘摆到地图上。
      const npcNeedsMapPortrait = object.type === "npc" && !object.npcTemplate?.mapPortraitData;
      if (object.type === "npc") {
        if (npcNeedsMapPortrait) {
          // 还没有游戏地图立绘：显示「问号 + 圆牌」，避免把对话头像误当作地图角色。
          shadow.setVisible(false);
          portrait = this.add.circle(0, 20, 23, 0xd1c5af, 1).setStrokeStyle(2, 0x5b4d40);
          questionMark = this.add.image(0, -37, "npc-map-question-mark").setDisplaySize(43, 56).setOrigin(0.5);
          markerNumber = addText(this, 0, 20, isMerchant ? "商" : "1", isMerchant ? 21 : 19, "#30271f", { strokeThickness: 0 }).setOrigin(0.5);
        } else {
          // 已上传专用地图立绘时，按原比例放到角色站立点。
          portrait = this.add.image(0, 0, "player-idle-5dir", 0).setOrigin(0.5, 0.86).setScale(0.32);
        }
        if (!npcNeedsMapPortrait && object.npcTemplate?.mapPortraitData) {
          const textureKey = `map-npc-custom-${object.npcTemplate.id}`;
          const applyNpcPortrait = () => {
            const source = this.textures.get(textureKey).getSourceImage();
            const scale = Math.min(120 / source.width, 135 / source.height);
            if (portrait.active) portrait.setTexture(textureKey).setDisplaySize(source.width * scale, source.height * scale);
          };
          if (this.textures.exists(textureKey)) applyNpcPortrait();
          else this.textures.addBase64(textureKey, object.npcTemplate.mapPortraitData, applyNpcPortrait);
        }
      } else if (object.type === "monster") {
        portrait = this.add.image(0, 0, "map-monster-portrait").setOrigin(0.5, 0.87).setScale(0.34).setTint(0xe9b4b4);
        // 怪物编辑器上传的是 Base64 图片数据。首次进入地图时异步注册纹理，
        // 注册完成后直接替换当前立绘，不需要玩家重新进入场景。
        if (object.battle?.imageData) {
          const textureKey = `map-monster-custom-${object.battle.id}`;
          if (this.textures.exists(textureKey)) {
            portrait.setTexture(textureKey).clearTint().setDisplaySize(105, 130);
          } else {
            this.textures.addBase64(textureKey, object.battle.imageData, () => {
              if (portrait.active) portrait.setTexture(textureKey).clearTint().setDisplaySize(105, 130);
            });
          }
        }
      } else {
        portrait = this.add.circle(0, -6, 22, info.color, 0.92).setStrokeStyle(3, 0xfff0bd);
      }
      // 问号标记严格保持图 2 的简洁样式；姓名与交互提示在靠近后的左下信息卡显示。
      const label = npcNeedsMapPortrait ? null : addText(this, 0, -58, object.name, 14, "#fff8de", { origin: 0.5 });
      const typeLabel = npcNeedsMapPortrait ? null : addText(this, 0, -39, object.type === "monster" ? "怪物 · 按 E 战斗" : isMerchant ? "商人 · 按 E 购物" : object.type === "npc" ? "NPC · 按 E 对话" : info.name, 11, "#e2efcf", { origin: 0.5, strokeThickness: 2 });
      marker.add([shadow, portrait, questionMark, markerNumber, label, typeLabel].filter(Boolean));
      if (questionMark) {
        // 问号持续轻轻上下浮动，提示这里有尚未制作地图立绘的可交互 NPC。
        this.tweens.add({
          targets: questionMark,
          y: -43,
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
    this.autoSaveElapsed += delta;
    if (this.autoSaveElapsed >= 2000) {
      this.autoSaveElapsed = 0;
      this.rememberPlayerPosition();
      saveFirstChapterProgress();
    }
    if (this.npcProfilePanel?.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.closeNearbyNpcProfile();
      return;
    }
    if (this.storageBagPanel?.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.closeStorageBag();
      return;
    }
    if (this.merchantShopPanel?.visible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.closeMerchantShop();
      return;
    }
    if (this.dialog.visible) {
      if (this.dialogTree && this.currentDialogueChoices?.length) {
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
    this.playerName.setPosition(this.player.x, this.player.y - this.player.displayHeight * this.player.originY - 8);
    this.playerShadow.setPosition(this.player.x, this.player.y + 17);
    // 同步小地图的蓝色主角点，并记录走过的区域来逐步揭开探索迷雾。
    this.chapterMapHud?.updateMiniMap(this.player.x, this.player.y, this.worldSize);
    this.updateQuestGuide();
    this.updateNearbyInteraction();
    const jadeDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.jadePosition.x, this.jadePosition.y);
    const questActive = gameState.chapter.qingyunInvestigation === "active";
    if (questActive && !gameState.chapter.ancientJadeFound && jadeDistance < 300) {
      this.operationHint.setText("古潭问道台就在附近，继续靠近中央玉光。 ");
    }
    if (questActive && !gameState.chapter.ancientJadeFound && jadeDistance < 150) {
      this.startJadeStory();
    } else if (gameState.chapter.qingyunInvestigation === "completed" && gameState.chapter.ancientJadeFound && jadeDistance < 75) {
      // 古玉剧情完成后，它仍是永久测试入口，但不能直接强制开战：
      // 每次按 E 都先打开对话，由玩家自行选择战斗或返回地图。
      this.operationHint.setText("奇异玉光：按 E 查看玉光（可在对话中选择战斗或返回）。");
      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
        this.rememberPlayerPosition();
        this.openJadeRepeatDialogue();
      }
    }
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
      this.dialogNameText.setText((object.name || "修士").replace(/^栖霞村/, ""));
      this.openDialogue(object.dialogue, null, object.npcTemplate?.portraitData, object.npcTemplate?.dialogueTree);
    } else if (object.type === "monster") {
      this.scene.start(SceneKeys.BATTLE, { mapMonster: object });
    } else if (object.type === "building") {
      this.dialogNameText.setText(object.name || "建筑");
      this.openDialogue([object.buildingTemplate?.interactionText || `${object.name}：目前是第一章原型建筑。`]);
    } else {
      this.dialogNameText.setText(object.name || "提示");
      this.openDialogue([`${object.name}：传送点已被记录。后续区域地图完成后，可以在这里配置目的地。`]);
    }
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
    // 即使任务已经是进行中，再次确认委托也重新给出提示，避免玩家以为没有接到。
    // 如果玩家之前已完成过测试战斗，再次领取时要恢复古潭事件；否则任务会显示进行中却永远不触发。
    if (gameState.chapter.ancientJadeFound) {
      gameState.chapter.ancientJadeFound = false;
      gameState.player.hasJade = false;
    }
    gameState.chapter.qingyunInvestigation = "active";
    // 接取只写入任务日志；玩家在日志点“开启引路”后才出现地图箭头与任务地点。
    gameState.chapter.qingyunGuideEnabled = false;
    this.chapterMapHud?.updateQuestPanel();
    this.updateQingyunQuestMarker();
    this.showQuestAcceptedNotice();
    this.updateQuestGuide();
    saveFirstChapterProgress();
  }

  updateQingyunQuestMarker() {
    const visible = gameState.chapter.qingyunInvestigation === "active"
      && gameState.chapter.qingyunGuideEnabled
      && !gameState.chapter.ancientJadeFound;
    this.jadeMarker?.forEach((display) => display.setVisible(visible));
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
    // 任务栏显示为进行中，就始终保持导航；避免存档中旧的古玉标记把箭头误判隐藏。
    const active = gameState.chapter.qingyunInvestigation === "active" && gameState.chapter.qingyunGuideEnabled;
    if (!active || !this.questGuideArrow || !this.player) {
      this.setQuestGuideVisible(false);
      return;
    }
    if (this.dialog?.visible || this.npcProfilePanel?.visible) {
      this.setQuestGuideVisible(false);
      return;
    }
    // 贴在屏幕中央附近，不会被右侧任务栏挡住；箭头本身会朝向古潭。
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.jadePosition.x, this.jadePosition.y);
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
    this.player.x = Phaser.Math.Clamp(this.player.x + dx, 50, this.worldSize.width - 50);
    this.player.y = Phaser.Math.Clamp(this.player.y + dy, 110, this.worldSize.height - 80);
    // 实时更新内存位置；真正写入浏览器存档由手动保存、进入战斗和退出时完成。
    this.rememberPlayerPosition();
    this.updatePlayerDirection(dx, dy);
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
    gameState.chapter.ancientJadeFound = true;
    gameState.player.hasJade = true;
    gameState.chapter.qingyunInvestigation = "completed";
    gameState.chapter.qingyunGuideEnabled = false;
    this.chapterMapHud?.updateQuestPanel();
    this.updateQingyunQuestMarker();
    // 发现古玉是第一章的重要节点，立刻保存，刷新页面后不会丢失该进度。
    saveFirstChapterProgress();
    this.openDialogue([
      "你在山脚拾起一枚温润古玉。古玉忽然发出微光，远处传来劫修的脚步声……",
      "提示：第一章原型中，可用鼠标点击普通攻击、术法或防御。",
      "劫修已逼近，准备迎战！",
    ], () => this.showJadeBattleChoice());
  }

  /** 古玉剧情读完后，由玩家自己决定是否进入测试战斗。 */
  showJadeBattleChoice() {
    this.openDialogue([
      "劫修就在附近。是否现在进入战斗测试？",
      "按 E / 空格：进入战斗；点击“返回地图”或按 Esc：暂时离开。",
    ], () => this.scene.start(SceneKeys.BATTLE, { testBattle: true }));
  }

  /** 已发现古玉后的重复交互对话，方便随时测试战斗但不强制进入。 */
  openJadeRepeatDialogue() {
    this.openDialogue([
      "古玉仍在微微发烫，仿佛在回应你的灵气。",
      "附近的劫修气息再度出现。若想测试战斗，可以继续向前。",
      "按 E / 空格：进入战斗；点击“返回地图”或按 Esc：暂时离开。",
    ], () => this.scene.start(SceneKeys.BATTLE, { testBattle: true }));
  }
}

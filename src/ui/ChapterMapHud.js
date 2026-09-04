import { QINGYUN_INVESTIGATION_ID } from "../domain/quests/ChapterQuestService.js";
import { addButton, addText, playUiClickSound } from "../utils/UiHelpers.js";
import { PlayerTopToolbar } from "./PlayerTopToolbar.js";

const CHAPTER_MAP_HUD_PATH = "./public/assets/images/pixso/chapter-map/scene-hud";

export const CHAPTER_MAP_HUD_ASSETS = Object.freeze({
  nearbyPanel: "chapter-map-hud-nearby-panel",
  calendarPanel: "chapter-map-hud-calendar-panel",
  questPanel: "chapter-map-hud-quest-panel",
  minimapFrame: "chapter-map-hud-minimap-frame",
  minimapCaption: "chapter-map-hud-minimap-caption",
});

/** 预加载用户提供的第一章地图固定界面素材。 */
export function preloadChapterMapHudAssets(scene) {
  scene.load.image(CHAPTER_MAP_HUD_ASSETS.nearbyPanel, `${CHAPTER_MAP_HUD_PATH}/nearby-cultivator-panel.png`);
  scene.load.image(CHAPTER_MAP_HUD_ASSETS.calendarPanel, `${CHAPTER_MAP_HUD_PATH}/calendar-panel.png`);
  scene.load.image(CHAPTER_MAP_HUD_ASSETS.questPanel, `${CHAPTER_MAP_HUD_PATH}/quest-panel.png`);
  scene.load.image(CHAPTER_MAP_HUD_ASSETS.minimapFrame, `${CHAPTER_MAP_HUD_PATH}/minimap-frame.png`);
  scene.load.image(CHAPTER_MAP_HUD_ASSETS.minimapCaption, `${CHAPTER_MAP_HUD_PATH}/minimap-caption.png`);
}

/**
 * 第一章地图专用 HUD（界面层）。
 *
 * 这是独立于 VillageScene 的 UI 组件：
 * - VillageScene 只处理地图、角色移动、NPC 与战斗。
 * - 本文件只处理左上资料栏、顶部图标、右侧任务栏等显示与点击。
 *
 * 本文件全部使用 1920×1080 一对一像素坐标；填写 115×115 就显示为 115×115。
 */
export class ChapterMapHud {
  constructor(scene, { questService, explorationService } = {}) {
    this.scene = scene;
    this.questService = questService;
    this.explorationService = explorationService;
  }

  /** 刷新资料栏的生命、修为数值和填充长度（供储物袋使用物品后调用）。 */
  refreshPlayerStatus() {
    this.playerTopToolbar?.refreshPlayerStatus();
  }

  /** 创建第一章地图的所有固定界面。 */
  create() {
    const scene = this.scene;
    // HUD 永远固定在屏幕上，地图镜头移动时不跟随角色滚动。
    // 固定界面创建时就立刻排除世界镜头，不能等地图场景下一次低频镜头同步。
    // 例如小地图足迹会在角色移动中动态新增；若新对象短暂被世界镜头绘制，
    // 它会按世界镜头的缩放出现在小地图左侧，形成一闪而过的绿色残影。
    const fixed = (display) => {
      display.setScrollFactor(0).setDepth(900);
      scene.worldCamera?.ignore(display);
      return display;
    };
    // 大地图与门派内部共用同一套角色状态栏和功能图标，避免两个场景各自维护后逐渐走样。
    this.playerTopToolbar = new PlayerTopToolbar(scene, {
      actions: {
        storage: () => scene.openStorageBag(),
        spells: () => scene.openSpellPanel(),
        techniques: () => scene.openTechniqueBag(),
        artifacts: () => scene.openArtifactBag(),
        save: () => scene.openSavePanel(),
        settings: () => scene.openGameSettings(),
      },
    }).create();

    // ── 右侧：用户提供的墨金卷轴信息栏（日期、任务、小地图） ──────────
    // 六张素材均按原始像素摆放；文字、探索迷雾和交互仍是独立对象，不能把截图当作界面。
    const titleFont = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
    const bodyFont = '"Microsoft YaHei", "Noto Sans SC", sans-serif';
    const rightTextStyle = { fontFamily: bodyFont, strokeThickness: 0 };
    const rightTitleStyle = { fontFamily: titleFont, strokeThickness: 0 };

    // 图2中的五张 HUD 素材都按 PNG 原始尺寸一对一显示，不能再缩到 300px 宽。
    fixed(scene.add.image(1540, 22, CHAPTER_MAP_HUD_ASSETS.calendarPanel).setOrigin(0).setDisplaySize(360, 204));
    fixed(addText(scene, 1720, 72, "修仙历 1 年 1 月 2 日", 22, "#f4ead3", {
      ...rightTextStyle,
      stroke: "#17130e",
      strokeThickness: 2,
    })).setOrigin(0.5);
    fixed(addText(scene, 1720, 109, "寿命: 16/100岁", 19, "#b9dbaf", {
      ...rightTextStyle,
      stroke: "#17130e",
      strokeThickness: 2,
    })).setOrigin(0.5);

    fixed(scene.add.image(1531, 437, CHAPTER_MAP_HUD_ASSETS.questPanel).setOrigin(0).setDisplaySize(378, 205));
    fixed(addText(scene, 1614, 481, "当前任务", 20, "#f1c95a", rightTitleStyle)).setOrigin(0, 0.5);
    this.taskLogButton = fixed(addText(scene, 1850, 481, "日志", 20, "#e9dfbf", rightTitleStyle))
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.taskLogButton.on("pointerdown", () => this.openTaskLog());
    this.taskLogButton.on("pointerover", () => this.taskLogButton.setColor("#f8cf14"));
    this.taskLogButton.on("pointerout", () => this.taskLogButton.setColor("#a0a196"));
    this.questText = fixed(addText(scene, 1720, 558, "", 18, "#f0e6d3", {
      ...rightTextStyle,
      align: "left",
      wordWrap: { width: 250, useAdvancedWrap: true },
      lineSpacing: 8,
    })).setOrigin(0.5);
    this.updateQuestPanel();
    // 观山镜外框最后覆盖在探索图之上，防止足迹圆点压住墨金边缘。
    this.createMiniMapFog();
    fixed(scene.add.image(1548, 679, CHAPTER_MAP_HUD_ASSETS.minimapFrame).setOrigin(0).setDisplaySize(344, 297)).setDepth(905);
    fixed(scene.add.image(1571, 943, CHAPTER_MAP_HUD_ASSETS.minimapCaption).setOrigin(0).setDisplaySize(302, 119)).setDepth(906);
    fixed(addText(scene, 1722, 972, "小地图：栖霞村", 20, "#f1ca5c", rightTitleStyle))
      .setOrigin(0.5)
      .setDepth(907);

    // ── 左下：附近 NPC 信息 ──────────────────────────────────────────
    this.nearbyHud = scene.add.container(25, 437).setScrollFactor(0).setDepth(900).setVisible(false);
    this.nearbyHudBaseX = 25;
    this.nearbyCardTargetVisible = false;
    const nearbyPanel = scene.add.image(0, 0, CHAPTER_MAP_HUD_ASSETS.nearbyPanel).setOrigin(0).setDisplaySize(334, 197);
    const nearbyTitle = addText(scene, 62, 31, "附近修士", 18, "#f1c95a", { fontFamily: titleFont, strokeThickness: 2 });
    // NPC 头像与地图问号分开：即使没有地图立绘，玩家靠近时仍能知道是谁。
    // 效果图中的头像是带一点灰色底的圆角方框，而不是圆形小人图标。
    this.nearbyAvatarFrame = scene.add.graphics()
      .fillStyle(0x6d766c, 1)
      .fillRoundedRect(70, 89, 60, 60, 8)
      .setVisible(false);
    this.nearbyAvatar = scene.add.image(100, 119, "player-idle-5dir", 0).setOrigin(0.5, 0.76).setScale(0.31).setVisible(false);
    // 问号放在头像右上方，但避开「附近修士」标题。
    this.nearbyQuestion = scene.add.image(125, 84, "npc-map-question-mark").setOrigin(0.5).setDisplaySize(29, 38).setVisible(false);
    this.nearbyNameText = addText(scene, 149, 92, "暂未发现", 21, "#fff4dd", { fontFamily: bodyFont, strokeThickness: 2 });
    this.nearbyRealmText = addText(scene, 149, 128, "练气初期", 17, "#d3c8b0", { fontFamily: bodyFont, strokeThickness: 2 });
    // 整张“附近修士”卡可以点击：NPC 在范围内时打开人物资料，而不是直接跳进对话。
    this.nearbyHitArea = scene.add.rectangle(167, 98.5, 334, 197, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.nearbyHitArea.input.enabled = false;
    this.nearbyHitArea.on("pointerdown", () => {
      if (this.nearbyObject?.type === "npc") scene.openNearbyNpcProfile(this.nearbyObject);
    });
    this.nearbyHud.add([nearbyPanel, nearbyTitle, this.nearbyAvatarFrame, this.nearbyAvatar, this.nearbyQuestion, this.nearbyNameText, this.nearbyRealmText, this.nearbyHitArea]);

    // 底部是一行固定操作说明，角色靠近对象时会动态替换为 E 键提示。
    this.operationHint = fixed(scene.add.text(42, 1026, "操作：WASD / 方向键移动；鼠标点击自动前往；靠近人物或怪物按 E 交互。", { fontFamily: "Microsoft YaHei", fontSize: "23px", color: "#f3f1dd", stroke: "#111710", strokeThickness: 6 }));

    // 点击右侧“日志”后打开的完整任务日志，严格采用 Pixso 任务日志画板的 1008 × 590 排版。
    this.createTaskLog();
  }

  /** 更新左下角的附近对象信息。 */
  setNearby(object, canInteract = true) {
    this.nearbyObject = object || null;
    this.nearbyNameText.setText(object ? object.name : "暂未发现");
    const nearbyRealm = object?.npcTemplate?.realm || object?.realm || "练气初期";
    this.nearbyRealmText.setText(object ? nearbyRealm : "练气初期");
    const isNpc = object?.type === "npc";
    this.setNearbyCardVisible(isNpc);
    if (this.nearbyHitArea?.input) this.nearbyHitArea.input.enabled = isNpc;
    this.nearbyAvatarFrame.setVisible(isNpc);
    this.nearbyAvatar.setVisible(isNpc);
    // 尚未制作地图立绘时，在头像右上角给出问号提示；云游商人和村长保持同一交互样式。
    this.nearbyQuestion.setVisible(Boolean(isNpc && !object.npcTemplate?.mapPortraitData));
    if (!isNpc || this.nearbyNpcId === object.id) return;

    this.nearbyNpcId = object.id;
    // NPC 只维护立绘；附近修士头像从立绘上半部自动裁切。
    const avatarData = object.npcTemplate?.portraitData || object.npcTemplate?.avatarData || object.npcTemplate?.imageData || "";
    if (!avatarData) {
      this.nearbyAvatar.setTexture("player-idle-5dir", 0).setCrop().setOrigin(0.5, 0.76).setPosition(100, 119).setScale(0.31);
      return;
    }
    const textureKey = `nearby-npc-avatar-rounded-${object.npcTemplate?.id || object.id}`;
    const applyAvatar = () => {
      if (!this.nearbyAvatar?.active || this.nearbyNpcId !== object.id) return;
      this.nearbyAvatar.setTexture(textureKey).setCrop()
        .setOrigin(0.5).setPosition(100, 119).setDisplaySize(60, 60);
    };
    if (this.scene.textures.exists(textureKey)) applyAvatar();
    else {
      // addBase64 在部分浏览器会延迟回调，导致卡片一直停留在默认小人；
      // 原生 Image 在真正读取完成时再注册纹理，头像会稳定显示。
      const image = new Image();
      image.onload = () => {
        if (this.scene.textures.exists(textureKey)) this.scene.textures.remove(textureKey);
        const canvas = this.createRoundedAvatarCanvas(image, 60, 8);
        this.scene.textures.addCanvas(textureKey, canvas);
        applyAvatar();
      };
      image.onerror = () => {
        if (this.nearbyNpcId === object.id) this.nearbyAvatar.setTexture("player-idle-5dir", 0).setCrop().setOrigin(0.5, 0.76).setScale(0.31);
      };
      image.src = avatarData;
    }
  }

  /**
   * 将立绘等比铺满头像框，再裁成指定圆角矩形。
   * 头像纹理本身就是 60×60，因此 Phaser 后续不会再把人物压扁或拉长。
   */
  createRoundedAvatarCanvas(image, size, radius) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    const r = Math.min(radius, size / 2);
    context.beginPath();
    context.moveTo(r, 0);
    context.lineTo(size - r, 0);
    context.quadraticCurveTo(size, 0, size, r);
    context.lineTo(size, size - r);
    context.quadraticCurveTo(size, size, size - r, size);
    context.lineTo(r, size);
    context.quadraticCurveTo(0, size, 0, size - r);
    context.lineTo(0, r);
    context.quadraticCurveTo(0, 0, r, 0);
    context.closePath();
    context.clip();

    // 从原立绘顶部中央截取较小的正方形，形成只含头部与少量肩膀的大头照。
    const cropSize = Math.min(image.width, image.height) * 0.55;
    const sourceX = Math.max(0, (image.width - cropSize) / 2);
    const sourceY = Math.min(Math.max(0, image.height * 0.04), Math.max(0, image.height - cropSize));
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, size, size);
    return canvas;
  }

  /**
   * 附近修士卡只在发现 NPC 时出现：从左侧轻微滑入并淡入；离开后自然淡出。
   * 不用突然显隐，玩家移动时视觉更连贯。
   */
  setNearbyCardVisible(visible) {
    if (this.nearbyCardTargetVisible === visible) return;
    this.nearbyCardTargetVisible = visible;
    this.scene.tweens.killTweensOf(this.nearbyHud);
    if (visible) {
      this.nearbyHud
        .setVisible(true)
        .setAlpha(0)
        .setX(this.nearbyHudBaseX - 24);
      this.scene.tweens.add({
        targets: this.nearbyHud,
        x: this.nearbyHudBaseX,
        alpha: 1,
        duration: 260,
        ease: "Cubic.Out",
      });
      return;
    }
    // 离开范围时先禁用点击，再淡出，避免看不见的卡片拦截地图操作。
    if (this.nearbyHitArea?.input) this.nearbyHitArea.input.enabled = false;
    this.scene.tweens.add({
      targets: this.nearbyHud,
      x: this.nearbyHudBaseX - 16,
      alpha: 0,
      duration: 180,
      ease: "Cubic.In",
      onComplete: () => {
        if (!this.nearbyCardTargetVisible) this.nearbyHud.setVisible(false).setX(this.nearbyHudBaseX);
      },
    });
  }

  /** 左下附近修士卡片的真实屏幕范围；地图场景会用它统一处理点击。 */
  isPointerOverNearbyCard(pointer) {
    return Boolean(
      this.nearbyObject?.type === "npc"
      && this.nearbyHud.visible
      && this.nearbyHud.alpha > 0.9
      && pointer.x >= 25 && pointer.x <= 359
      && pointer.y >= 437 && pointer.y <= 634,
    );
  }

  /**
   * 建立小地图的探索迷雾。黑色覆盖层会被主角走过的位置逐步擦除，
   * 所以没去过的地方是黑色，走到附近才会显示真实地图。
   */
  createMiniMapFog() {
    const scene = this.scene;
    // 小地图改为圆形“观山镜”。地图坐标仍按正方形换算，世界不会被横向或纵向拉伸；
    // 显示到圆镜外的足迹会被过滤，不再出现截图中不规则的绿色大块。
    this.miniMap = { x: 1720, y: 831, radius: 124, mapSize: 248 };
    // 深墨圆形底层表示未探索区域，外层金圈已在 create() 中绘制。
    this.miniMapFog = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(902);
    scene.worldCamera?.ignore(this.miniMapFog);
    this.miniMapFog.fillStyle(0x000000, 1);
    this.miniMapFog.fillCircle(this.miniMap.x, this.miniMap.y, this.miniMap.radius);
    // 每个足迹是两个原生圆形对象，确保所有设备上都能稳定显示探索亮区。
    this.miniMapExploredDots = [];
    // 蓝点表示主角当前位置；它始终位于迷雾上方，方便辨认自己所在位置。
    this.miniMapPlayerMarker = scene.add.circle(this.miniMap.x, this.miniMap.y, 8, 0x238de0, 1)
      .setStrokeStyle(1, 0xd7f5ff, 0.95)
      .setScrollFactor(0)
      .setDepth(904);
    scene.worldCamera?.ignore(this.miniMapPlayerMarker);
    // 存档中已有的足迹进入地图时先画出来；否则角色没有移动时会只看到蓝点。
    const savedPoints = this.explorationService?.getVisitedPoints?.() || [];
    if (savedPoints.length && scene.worldSize) this.redrawMiniMapFog(savedPoints, scene.worldSize);
  }

  /** 每帧同步主角图标；每走约 120 像素才记录一次足迹，性能稳定且迷雾不会有断层。 */
  updateMiniMap(playerX, playerY, worldSize) {
    if (!this.miniMapExploredDots || !worldSize?.width || !worldSize?.height) return;
    const result = this.explorationService?.recordPosition?.(playerX, playerY);
    if (result?.recorded) {
      // 新足迹只追加一个圆点，不能每走 120 像素就销毁并重建全部足迹。
      // 除了减少绘制开销，也避免新对象在镜头同步间隔内漏到世界画面里闪一下。
      if (result.trimmedCount > 0) {
        // 极长时间游玩达到容量上限后，领域服务会淘汰最旧坐标；此时才同步重画一次。
        this.redrawMiniMapFog(this.explorationService.getVisitedPoints(), worldSize);
      } else {
        this.addMiniMapExploredDot(result.point, worldSize);
      }
    }

    const { x: markerX, y: markerY } = this.toMiniMapPosition(playerX, playerY, worldSize);
    this.miniMapPlayerMarker.setPosition(markerX, markerY);
  }

  /** 将世界坐标换算为圆形观山镜中的屏幕坐标。 */
  toMiniMapPosition(worldX, worldY, worldSize) {
    return {
      x: this.miniMap.x - this.miniMap.mapSize / 2 + (worldX / worldSize.width) * this.miniMap.mapSize,
      y: this.miniMap.y - this.miniMap.mapSize / 2 + (worldY / worldSize.height) * this.miniMap.mapSize,
    };
  }

  /** 将已探索足迹裁成圆形亮区，镜外部分不绘制，保持小地图干净。 */
  redrawMiniMapFog(visitedPoints, worldSize) {
    this.miniMapExploredDots.forEach((dot) => dot.destroy());
    this.miniMapExploredDots = [];
    visitedPoints.forEach((point) => this.addMiniMapExploredDot(point, worldSize));
  }

  /** 新增单个已探索足迹，并在创建同一帧锁定为 UI 专用对象。 */
  addMiniMapExploredDot(point, worldSize) {
    const revealRadius = 23;
    const { x, y } = this.toMiniMapPosition(point.x, point.y, worldSize);
    const distanceToCenter = Phaser.Math.Distance.Between(x, y, this.miniMap.x, this.miniMap.y);
    // 足迹圆边缘也不能越过金圈；留出半径余量后不会遮到外层水墨卷轴。
    // 图2允许探索亮区贴近镜框；外框位于更高层，会自然遮住圆点越过内圈的边缘。
    if (distanceToCenter > this.miniMap.radius - revealRadius * 0.25) return;
    // 外圈是淡墨青绿，内圈是浅青色，表现“已游历的山川”而非原先的大块荧光绿。
    const dots = [
      this.scene.add.circle(x, y, revealRadius, 0xaab982, 0.94).setScrollFactor(0).setDepth(903),
      this.scene.add.circle(x, y, revealRadius * 0.62, 0xc6cf9d, 0.76).setScrollFactor(0).setDepth(903),
    ];
    // 不能依赖 VillageScene 每 250ms 的兜底同步；这一帧就禁止世界镜头绘制。
    this.scene.worldCamera?.ignore(dots);
    this.miniMapExploredDots.push(...dots);
  }

  /** 按 Pixso「任务日志」画板创建完整任务面板。 */
  createTaskLog() {
    const scene = this.scene;
    const panelX = 456;
    const panelY = 245;
    const addLogText = (x, y, text, size, color, extra = {}) => addText(scene, x, y, text, size, color, {
      strokeThickness: 0,
      ...extra,
    });

    this.taskLogShade = scene.add.rectangle(960, 540, 1920, 1080, 0x0b100d, 0.48)
      .setScrollFactor(0)
      .setDepth(1699)
      .setVisible(false);
    // 遮罩只阻止地图点击，不能用来关闭日志；日志只能点右上角关闭按钮或“开启引路”关闭。

    this.taskLog = scene.add.container(panelX, panelY)
      .setScrollFactor(0)
      .setDepth(1700)
      .setVisible(false);

    const frame = scene.add.graphics();
    frame.fillStyle(0x2a1f14, 1);
    frame.fillRoundedRect(0, 0, 1008, 590, 10);
    frame.lineStyle(2, 0x715a40, 1);
    frame.strokeRoundedRect(0, 0, 1008, 590, 10);
    frame.fillStyle(0x50351e, 1);
    frame.fillRoundedRect(2, 2, 1004, 56, { tl: 9, tr: 9, bl: 0, br: 0 });
    frame.lineStyle(1.5, 0x715a40, 1);
    frame.lineBetween(0, 59, 1008, 59);
    frame.fillStyle(0x231a10, 1);
    frame.fillRoundedRect(301, 154, 677, 403, 10);
    frame.lineStyle(1, 0x4b3928, 1);
    frame.lineBetween(282, 59, 282, 588);

    const title = addLogText(20, 16, "任务日志", 20, "#f8cf14");
    const closeBackground = scene.add.circle(974, 30, 15, 0x69482c, 1)
      .setStrokeStyle(1, 0x9a7049)
      .setInteractive({ useHandCursor: true });
    const closeText = addLogText(974, 30, "×", 23, "#f1d6ab").setOrigin(0.5);
    closeBackground.on("pointerdown", () => this.closeTaskLog());
    closeBackground.on("pointerover", () => closeBackground.setFillStyle(0x895d35));
    closeBackground.on("pointerout", () => closeBackground.setFillStyle(0x69482c));

    this.taskLogTabButtons = {};
    const makeTab = (id, x, label) => {
      const background = scene.add.rectangle(x + 40, 88, 80, 35, 0x302416, 1)
        .setStrokeStyle(1, 0x5b4c3d)
        .setInteractive({ useHandCursor: true });
      const text = addLogText(x + 40, 88, label, 14, "#8c7f72").setOrigin(0.5);
      background.on("pointerdown", () => {
        playUiClickSound(scene);
        this.taskLogFilter = id;
        this.renderTaskLog();
      });
      this.taskLogTabButtons[id] = { background, text };
      return [background, text];
    };
    const tabs = [
      ...makeTab("active", 12, "进行中"),
      ...makeTab("all", 100, "全部任务"),
      ...makeTab("completed", 188, "已完成"),
    ];

    this.taskLogCard = scene.add.graphics();
    this.taskLogCard.fillStyle(0x5f3d20, 1);
    this.taskLogCard.fillRoundedRect(12, 116, 256, 83, 4);
    this.taskLogCard.lineStyle(1, 0x8e613a, 1);
    this.taskLogCard.strokeRoundedRect(12, 116, 256, 83, 4);
    this.taskLogCard.setInteractive(new Phaser.Geom.Rectangle(12, 116, 256, 83), Phaser.Geom.Rectangle.Contains);
    this.taskLogCard.on("pointerdown", () => this.renderTaskLog());
    this.taskLogCardTitle = addLogText(26, 129, "主线:调查青云山异光", 16, "#cbb6a3");
    this.taskLogCardBadge = scene.add.rectangle(53, 176, 54, 25, 0x845e15, 1).setOrigin(0.5);
    this.taskLogCardBadgeText = addLogText(53, 176, "进行中", 12, "#f8cf14").setOrigin(0.5);
    this.taskLogEmpty = addLogText(140, 158, "暂无任务", 16, "#8c7f72").setOrigin(0.5).setVisible(false);

    this.taskLogMainTitle = addLogText(303, 76, "主线:调查青云山异光", 20, "#f8cf14");
    this.taskLogType = addLogText(303, 110, "主线任务", 16, "#e18b3b");
    this.taskLogDescriptionLabel = addLogText(335, 177, "任务描述", 20, "#bc9e70");
    this.taskLogDescription = addLogText(335, 211, "调查青云山异光，拿到任务道具", 16, "#9e9e9e");
    this.taskLogGoalLabel = addLogText(335, 247, "任务目标", 20, "#bc9e70");
    this.taskLogGoal = addLogText(335, 281, "前往山脚古潭的问道台", 16, "#9e9e9e");
    this.taskLogRewardLabel = addLogText(335, 317, "任务奖励", 20, "#bc9e70");
    this.taskLogReward = addLogText(335, 351, "暂未显示", 16, "#9e9e9e");
    this.taskLogNpcLabel = addLogText(335, 363, "相关NPC", 20, "#bc9e70");
    this.taskLogIssuer = addLogText(335, 398, "发布者：", 16, "#9e9e9e");
    this.taskLogIssuerName = addLogText(399, 398, "栖霞村村长", 16, "#009ca0");
    this.taskLogRecipient = addLogText(335, 427, "交付者：", 16, "#9e9e9e");
    this.taskLogRecipientName = addLogText(399, 427, "暂未确定", 16, "#009ca0");
    this.taskLogNoDetails = addLogText(640, 350, "暂无此类任务", 20, "#8c7f72").setOrigin(0.5).setVisible(false);

    const makeActionButton = (x, label, fill, border, textColor, onClick) => {
      const background = scene.add.rectangle(x + 64, 507, 128, 38, fill, 1)
        .setStrokeStyle(1, border)
        .setInteractive({ useHandCursor: true });
      const text = addLogText(x + 64, 507, label, 14, textColor).setOrigin(0.5);
      background.on("pointerdown", () => {
        playUiClickSound(scene);
        onClick();
      });
      background.on("pointerover", () => background.setAlpha(0.82));
      background.on("pointerout", () => background.setAlpha(1));
      return { background, text };
    };
    this.taskGuideButton = makeActionButton(333, "开启引路", 0x37523a, 0x485443, "#d6e3cd", () => this.enableTaskGuide());
    this.taskAbandonButton = makeActionButton(481, "放弃任务", 0x523737, 0x544343, "#f3e0c0", () => this.abandonCurrentQuest());

    this.taskLog.add([
      frame, title, closeBackground, closeText, ...tabs,
      this.taskLogCard, this.taskLogCardTitle, this.taskLogCardBadge, this.taskLogCardBadgeText, this.taskLogEmpty,
      this.taskLogMainTitle, this.taskLogType,
      this.taskLogDescriptionLabel, this.taskLogDescription, this.taskLogGoalLabel, this.taskLogGoal,
      this.taskLogRewardLabel, this.taskLogReward, this.taskLogNpcLabel,
      this.taskLogIssuer, this.taskLogIssuerName, this.taskLogRecipient, this.taskLogRecipientName, this.taskLogNoDetails,
      this.taskGuideButton.background, this.taskGuideButton.text, this.taskAbandonButton.background, this.taskAbandonButton.text,
    ]);
    // Container 内部的可点击对象在缩放动画后容易出现点击坐标偏移。
    // 因此用独立、透明、最上层的点击区处理日志操作，保证每个位置都稳定。
    const makeLogHitArea = (x, y, width, height, action) => {
      const area = scene.add.zone(panelX + x, panelY + y, width, height)
        .setScrollFactor(0)
        .setDepth(1702)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });
      area.input.enabled = false;
      area.on("pointerdown", action);
      return area;
    };
    this.taskLogHitAreas = [
      makeLogHitArea(52, 88, 80, 35, () => this.switchTaskLogFilter("active")),
      makeLogHitArea(140, 88, 80, 35, () => this.switchTaskLogFilter("all")),
      makeLogHitArea(228, 88, 80, 35, () => this.switchTaskLogFilter("completed")),
      makeLogHitArea(974, 30, 34, 34, () => this.closeTaskLog()),
      makeLogHitArea(397, 507, 128, 38, () => this.enableTaskGuide()),
      makeLogHitArea(545, 507, 128, 38, () => this.abandonCurrentQuest()),
    ];
    this.taskLogFilter = "active";
    this.renderTaskLog();
  }

  openTaskLog() {
    if (!this.taskLog) return;
    playUiClickSound(this.scene);
    this.taskLogFilter = "active";
    this.renderTaskLog();
    this.setTaskLogHitAreasVisible(true);
    this.taskLogShade.setVisible(true).setAlpha(0);
    this.taskLog.setVisible(true).setAlpha(0).setScale(0.96);
    this.scene.tweens.add({ targets: this.taskLogShade, alpha: 1, duration: 160, ease: "Sine.Out" });
    this.scene.tweens.add({ targets: this.taskLog, alpha: 1, scale: 1, duration: 180, ease: "Cubic.Out" });
  }

  closeTaskLog() {
    if (!this.taskLog?.visible) return;
    playUiClickSound(this.scene);
    this.setTaskLogHitAreasVisible(false);
    this.scene.tweens.add({
      targets: [this.taskLog, this.taskLogShade],
      alpha: 0,
      duration: 130,
      ease: "Sine.In",
      onComplete: () => {
        this.taskLog.setVisible(false).setAlpha(1).setScale(1);
        this.taskLogShade.setVisible(false).setAlpha(1);
      },
    });
  }

  /** 供地图场景判断：日志打开时不能把点击误当作地图寻路。 */
  isTaskLogOpen() {
    return Boolean(this.taskLog?.visible);
  }

  setTaskLogHitAreasVisible(visible) {
    this.taskLogHitAreas?.forEach((area) => {
      area.setVisible(visible);
      if (area.input) area.input.enabled = visible;
    });
  }

  switchTaskLogFilter(filter) {
    playUiClickSound(this.scene);
    this.taskLogFilter = filter;
    this.renderTaskLog();
  }

  enableTaskGuide() {
    const result = this.questService?.setGuideEnabled(QINGYUN_INVESTIGATION_ID, true);
    if (!result?.ok) return;
    playUiClickSound(this.scene);
    this.scene.updateQingyunQuestMarker?.();
    this.closeTaskLog();
    this.scene.updateQuestGuide?.();
  }

  /** 切换“进行中 / 全部任务 / 已完成”时刷新列表与详情。 */
  renderTaskLog() {
    if (!this.taskLog) return;
    const journal = this.questService?.getJournalView(this.taskLogFilter) ?? { hasTask: false, quest: null };
    const { hasTask, quest } = journal;
    const isActive = Boolean(quest?.active);
    const isCompleted = Boolean(quest?.completed);
    Object.entries(this.taskLogTabButtons).forEach(([id, button]) => {
      const selected = id === this.taskLogFilter;
      button.background.setFillStyle(selected ? 0x5f3d20 : 0x302416);
      button.background.setStrokeStyle(1, selected ? 0x8e613a : 0x5b4c3d);
      button.text.setColor(selected ? "#f8cf14" : "#8c7f72");
    });
    this.taskLogCard.setVisible(hasTask);
    this.taskLogCardTitle.setVisible(hasTask);
    this.taskLogCardBadge.setVisible(hasTask);
    this.taskLogCardBadgeText.setVisible(hasTask);
    this.taskLogEmpty.setVisible(!hasTask);
    const details = [
      this.taskLogMainTitle, this.taskLogType, this.taskLogDescriptionLabel, this.taskLogDescription,
      this.taskLogGoalLabel, this.taskLogGoal, this.taskLogRewardLabel, this.taskLogReward,
      this.taskLogNpcLabel, this.taskLogIssuer, this.taskLogIssuerName,
      this.taskLogRecipient, this.taskLogRecipientName,
    ];
    details.forEach((item) => item.setVisible(hasTask));
    this.taskLogNoDetails.setVisible(!hasTask);
    this.taskGuideButton.background.setVisible(isActive && hasTask);
    this.taskGuideButton.text.setVisible(isActive && hasTask);
    // 已完成主线也保留一个“重新体验”入口，方便已有老档直接试玩新冒险循环，
    // 不需要为了验证本轮玩法另建角色。
    const canRestart = isCompleted && hasTask;
    this.taskAbandonButton.background.setVisible((isActive || canRestart) && hasTask);
    this.taskAbandonButton.text.setVisible((isActive || canRestart) && hasTask);
    if (!hasTask) return;
    this.taskLogCardTitle.setText(quest.title);
    this.taskLogMainTitle.setText(quest.title);
    this.taskLogType.setText(quest.typeLabel);
    this.taskLogCardBadgeText.setText(quest.badgeLabel);
    this.taskLogCardBadge.setFillStyle(isCompleted ? 0x37523a : 0x845e15);
    this.taskLogDescription.setText(quest.description);
    this.taskLogGoal.setText(quest.goal);
    this.taskLogReward.setText(quest.rewardLabel);
    this.taskLogIssuerName.setText(quest.issuer);
    this.taskLogRecipientName.setText(quest.recipient);
    this.taskAbandonButton.text.setText(canRestart ? "重新体验" : "放弃任务");
  }

  abandonCurrentQuest() {
    if (this.questService?.isCompleted(QINGYUN_INVESTIGATION_ID)) {
      this.scene.restartQingyunQuest?.();
      return;
    }
    const result = this.questService?.abandonQuest(QINGYUN_INVESTIGATION_ID);
    if (!result?.ok) return;
    playUiClickSound(this.scene);
    this.updateQuestPanel();
    this.scene.updateQingyunQuestMarker?.();
    this.scene.updateQuestGuide?.();
    this.renderTaskLog();
  }

  /** 更新底部操作说明。 */
  setOperationHint(message) {
    this.operationHint.setText(message);
  }

  /** 根据村长委托的进度刷新右侧任务栏。 */
  updateQuestPanel() {
    const view = this.questService?.getHudView() ?? { hasActiveQuest: false, text: "暂无进行中的任务" };
    const { hasActiveQuest, text } = view;
    // 没有进行中任务时，提示文字像效果图一样置于卡片中央；
    // 任务开启后恢复左对齐的任务目标排版。
    this.questText
      ?.setText(text)
      .setColor(hasActiveQuest ? "#ffffff" : "#a8a79a")
      .setFontSize(hasActiveQuest ? "16px" : "18px")
      .setAlign(hasActiveQuest ? "left" : "center")
      .setWordWrapWidth(hasActiveQuest ? 250 : 0, hasActiveQuest)
      .setOrigin(hasActiveQuest ? 0 : 0.5, 0.5)
      // 图2中任务正文位于原尺寸卷轴的下半区；无任务时严格以卷轴中心对齐。
      .setPosition(hasActiveQuest ? 1620 : 1720, 558);
  }

  /** 防止点击顶栏图标时，被地图误判成“鼠标自动寻路”。 */
  isPointerOverTopToolbar(pointer) {
    return pointer.x >= 477 && pointer.x <= 1373 && pointer.y >= 15 && pointer.y <= 168;
  }

  /**
   * HUD 覆盖的区域不应触发地图寻路。
   * 包括左上角色资料、顶部功能、右侧日期/任务/小地图；即使那里没有按钮也一样。
   */
  isPointerOverHud(pointer) {
    const { x, y } = pointer;
    const overProfile = x >= 0 && x <= 465 && y >= 15 && y <= 155;
    const overToolbar = this.isPointerOverTopToolbar(pointer);
    // 右侧“观山镜”改为更高的圆形小地图后，HUD 的不可寻路范围同步延长到底部。
    const overRightColumn = x >= 1530 && x <= 1920 && y >= 15 && y <= 1065;
    return overProfile || overToolbar || overRightColumn;
  }
}

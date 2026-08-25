import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { addButton, addText, playUiClickSound } from "../utils/UiHelpers.js";

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
  constructor(scene) {
    this.scene = scene;
  }

  /** 刷新资料栏的生命、修为数值和填充长度（供储物袋使用物品后调用）。 */
  refreshPlayerStatus() {
    const updateBar = (key, value, maxValue, label) => {
      const ratio = Phaser.Math.Clamp((Number(value) || 0) / Math.max(1, Number(maxValue) || 1), 0, 1);
      const previousRatio = this.statusRatios?.[key] || 0;
      const fill = this.statusBarFills?.[key];
      if (fill && previousRatio > 0) fill.setScale(ratio / previousRatio, 1);
      this.statusRatios[key] = ratio;
      this[label]?.setText(`${value}/${maxValue}`);
    };
    updateBar("hp", gameState.player.hp, gameState.player.maxHp, "hpValueText");
    updateBar("qi", gameState.player.qi, gameState.player.maxQi, "qiValueText");
  }

  /** 创建第一章地图的所有固定界面。 */
  create() {
    const scene = this.scene;
    // HUD 永远固定在屏幕上，地图镜头移动时不跟随角色滚动。
    const fixed = (display) => display.setScrollFactor(0).setDepth(900);
    const panelColor = 0x171d16;
    const panelStroke = 0x765b43;

    // ── 左上：角色资料栏 ───────────────────────────────────────────────
    // 层级从下到上固定为：米色圆底 → 115×115 头像 → s1 黑色笔触底板 → 文字与血条。
    // 这样头像与圆底完全同尺寸、同位置，笔触不会遮挡文字。
    const avatarCenterX = 94;
    const avatarCenterY = 87;
    const avatarSize = 115;
    fixed(scene.add.circle(avatarCenterX - 12, avatarCenterY - 2, avatarSize / 2, 0xd1c5af));
    // 头像 PNG 上方透明边缘较少，直接按图片中心摆放会让人物视觉上略微偏下。
    // 向上补偿 3 像素后，人物可见区域会与圆形底色真正居中。
    fixed(scene.add.image(avatarCenterX  - 12, avatarCenterY - 2, "chapter-hud-profile-avatar")
      .setOrigin(0.5, 0.5)
      .setDisplaySize(avatarSize, avatarSize));
    fixed(scene.add.image(18, 20, "chapter-hud-profile-brush")
      .setOrigin(0, 0)
      // 保持水墨底板原始 442×133 尺寸，绝不拉伸。
      .setDisplaySize(442, 133));
    // 在原图尺寸范围内排版：标签 → 数值条 → 数值居中。
    const playerNameText = fixed(addText(scene, 145, 44, gameState.player.name, 20, "#ffffff", { strokeThickness: 4 }));
    // 角色名可由玩家自由填写，境界文字从名字实际宽度之后开始，绝不会挤在一起。
    fixed(addText(scene, playerNameText.x + playerNameText.width + 6, 49, gameState.player.realm.replace("炼气", "炼气·"), 16, "#d8caae", { strokeThickness: 3 }));
    fixed(addText(scene, 145, 79, "生命:", 16, "#f4ead8", { strokeThickness: 3 }));
    // 这四个数是两条血条的统一尺寸和位置；继续微调时只改这里即可。
    const barX = 195;
    const barWidth = 223;
    const barHeight = 22;
    const barRadius = barHeight / 2;
    this.statusBarFills = {};
    this.statusRatios = {};
    const drawRoundedBar = (barY, ratio, fillStartColor, fillEndColor, borderColor) => {
      const background = fixed(scene.add.graphics());
      background.fillStyle(0x101010, 0.98);
      background.fillRoundedRect(barX, barY - barHeight / 2, barWidth, barHeight, barRadius);
      background.lineStyle(1, borderColor, 1);
      background.strokeRoundedRect(barX, barY - barHeight / 2, barWidth, barHeight, barRadius);

      const fillWidth = barWidth * Phaser.Math.Clamp(ratio, 0, 1);
      if (fillWidth <= 0) return null;

      // Graphics 的渐变圆角在 WebGL 中会用三角形拼接，部分显卡上能看见斜线。
      // 改由浏览器画布生成单张渐变纹理，渐变连续且没有任何三角形痕迹。
      const textureKey = `chapter-hud-bar-gradient-${barY}`;
      if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(fillWidth - 4));
      canvas.height = barHeight - 4;
      const context = canvas.getContext("2d");
      const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
      const colorToCss = (color) => `#${color.toString(16).padStart(6, "0")}`;
      gradient.addColorStop(0, colorToCss(fillStartColor));
      gradient.addColorStop(1, colorToCss(fillEndColor));
      context.fillStyle = gradient;
      const radius = canvas.height / 2;
      context.beginPath();
      context.moveTo(radius, 0);
      context.lineTo(canvas.width - radius, 0);
      context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
      context.lineTo(canvas.width, canvas.height - radius);
      context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
      context.lineTo(radius, canvas.height);
      context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
      context.lineTo(0, radius);
      context.quadraticCurveTo(0, 0, radius, 0);
      context.closePath();
      context.fill();
      scene.textures.addCanvas(textureKey, canvas);
      return fixed(scene.add.image(barX + 2, barY, textureKey).setOrigin(0, 0.5));
    };

    const hpBarY = 92;
    const hpRatio = gameState.player.hp / gameState.player.maxHp;
    this.statusBarFills.hp = drawRoundedBar(hpBarY, hpRatio, 0xb71c08, 0xf45235, 0x613a30);
    this.statusRatios.hp = hpRatio;
    // origin: 0.5 让文字以自身中心点对齐；y 与血条中心相同就是垂直居中。
    // setOrigin(0.5) 必须直接作用在文字对象上，才能让数值横向、纵向都以血条中心对齐。
    // 深度 910 高于圆角底框与颜色填充（900），确保数字永远不会被血条盖住。
    this.hpValueText = fixed(addText(scene, barX + barWidth / 2, hpBarY, `${gameState.player.hp}/${gameState.player.maxHp}`, 16, "#ffffff", { strokeThickness: 3 }))
      .setOrigin(0.5)
      .setDepth(910);
    fixed(addText(scene, 145, 105, "修为:", 16, "#f4ead8", { strokeThickness: 3 }));
    const qiBarY = 117;
    const qiRatio = gameState.player.qi / gameState.player.maxQi;
    this.statusBarFills.qi = drawRoundedBar(qiBarY, qiRatio, 0x164f83, 0x4aa9ef, 0x343439);
    this.statusRatios.qi = qiRatio;
    this.qiValueText = fixed(addText(scene, barX + barWidth / 2, qiBarY, `${gameState.player.qi}/${gameState.player.maxQi}`, 16, "#ffffff", { strokeThickness: 3 }))
      .setOrigin(0.5)
      .setDepth(910);

    // ── 顶部：六个功能入口 ────────────────────────────────────────────
    // 每个图标都是独立 PNG，不使用整张截图，因此保留点击功能并方便以后替换。
    const entries = [
      ["pixso-ui-store", "储物袋", () => scene.openStorageBag()],
      ["pixso-ui-spell", "法术", () => scene.openSpellPanel()],
      // 功法、法术、法宝都是角色菜单的独立子页，顶部入口只指定默认页签。
      ["pixso-ui-gongfa", "功法", () => scene.openTechniqueBag()],
      ["pixso-ui-artifact", "法宝", () => scene.openArtifactBag()],
      ["pixso-ui-save", "存档", () => scene.saveGameFromMenu()],
      ["pixso-ui-settings", "设置", () => scene.openGameSettings()],
    ];
    const iconXs = [537, 690, 849, 1002, 1158, 1313];
    entries.forEach(([textureKey, label, action], index) => {
      const x = iconXs[index];
      fixed(scene.add.image(x, 77, "pixso-ui-brush").setDisplaySize(111, 111));
      const icon = fixed(scene.add.image(x, 77, textureKey).setDisplaySize(100, 100).setInteractive({ useHandCursor: true }));
      const normalScaleX = icon.scaleX;
      const normalScaleY = icon.scaleY;
      // addText 的样式参数不会自动改变文字锚点；这里明确设为 0.5，
      // 让“储物袋、法术、功法……”始终以图标 x 坐标为正中心。
      fixed(addText(scene, x, 138, label, 23, "#fff6dd", { strokeThickness: 5 }))
        .setOrigin(0.5);
      icon.on("pointerdown", action);
      // 只保留放大效果，不改变位置；缓动让放大、缩回都更柔和。
      // 每次进入或离开前先停止旧动画，快速移动鼠标时也不会连续跳动。
      icon.on("pointerover", () => {
        scene.tweens.killTweensOf(icon);
        scene.tweens.add({
          targets: icon,
          scaleX: normalScaleX * 1.08,
          scaleY: normalScaleY * 1.08,
          duration: 180,
          ease: "Sine.easeOut",
        });
      });
      icon.on("pointerout", () => {
        scene.tweens.killTweensOf(icon);
        scene.tweens.add({
          targets: icon,
          scaleX: normalScaleX,
          scaleY: normalScaleY,
          duration: 180,
          ease: "Sine.easeInOut",
        });
      });
    });

    // ── 右侧：水墨卷轴信息栏（日期、任务、小地图） ────────────────────
    // 这一列不再使用普通的黑色圆角卡片，而是统一做成“墨色宣纸卷轴”：
    // 外层是深墨绿，内层有半透明宣纸留白，四角用金线收口；这样既有水墨感，
    // 又不会在明亮的大地图上显得像现代软件的黑色窗口。
    const drawInkScrollPanel = (centerX, centerY, width, height, radius = 13) => {
      const panel = fixed(scene.add.graphics());
      const left = centerX - width / 2;
      const top = centerY - height / 2;
      const right = centerX + width / 2;
      const bottom = centerY + height / 2;
      // 第一层是深墨色外壳，透明度稍低，让地图仍能从纸背隐约透出。
      panel.fillStyle(0x102019, 0.91);
      panel.fillRoundedRect(left, top, width, height, radius);
      panel.lineStyle(2, 0xa98042, 0.94);
      panel.strokeRoundedRect(left, top, width, height, radius);
      // 内层偏灰绿，模拟久经烟火的宣纸，而不是一块纯色的塑料面板。
      panel.fillStyle(0x304037, 0.32);
      panel.fillRoundedRect(left + 7, top + 7, width - 14, height - 14, Math.max(5, radius - 5));
      panel.lineStyle(1, 0x6b7d68, 0.42);
      panel.strokeRoundedRect(left + 7, top + 7, width - 14, height - 14, Math.max(5, radius - 5));
      // 两团非常淡的墨晕打破平面感；颜色透明，不会妨碍任何文字阅读。
      panel.fillStyle(0x06120d, 0.14);
      panel.fillEllipse(left + width * 0.22, top + height * 0.28, width * 0.46, height * 0.44);
      panel.fillEllipse(right - width * 0.16, bottom - height * 0.22, width * 0.38, height * 0.38);
      // 不绘制四角回纹装饰：右侧信息栏保持干净留白，避免抢走日期、任务与小地图的注意力。
      return panel;
    };
    // 右侧文字使用清晰、无粗黑描边的字体；水墨感交给面板和颜色，保证长期阅读舒适。
    const rightTextStyle = { fontFamily: "Microsoft YaHei, SimHei, Noto Sans SC, sans-serif", strokeThickness: 0 };

    // 日期是最短的一张题签：日期在上、寿命在下，均按面板中心严格居中。
    drawInkScrollPanel(1751, 280, 300, 112);
    fixed(addText(scene, 1751, 252, "修仙历 1 年 1 月 2 日", 20, "#f4ead3", rightTextStyle)).setOrigin(0.5);
    fixed(addText(scene, 1751, 292, "寿命 · 16 / 100 岁", 18, "#b9dbaf", rightTextStyle)).setOrigin(0.5);

    // 任务采用较高的主卷轴：标题区有金色题签和一条淡墨分隔线，右侧“日志”保留可点击功能。
    drawInkScrollPanel(1751, 449, 300, 188);
    fixed(addText(scene, 1613, 382, "当前任务", 19, "#f1c95a", { ...rightTextStyle, fontStyle: "bold" })).setOrigin(0, 0.5);
    this.taskLogButton = fixed(addText(scene, 1880, 382, "任务日志", 15, "#c7c6af", rightTextStyle))
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.taskLogButton.on("pointerdown", () => this.openTaskLog());
    this.taskLogButton.on("pointerover", () => this.taskLogButton.setColor("#f8cf14"));
    this.taskLogButton.on("pointerout", () => this.taskLogButton.setColor("#a0a196"));
    fixed(scene.add.rectangle(1751, 414, 254, 1, 0x9c824e, 0.58));
    this.questText = fixed(addText(scene, 1613, 453, "", 16, "#f0e6d3", { ...rightTextStyle, wordWrap: { width: 258 }, lineSpacing: 8 })).setOrigin(0, 0.5);
    this.updateQuestPanel();
    // 小地图被设计成“观山镜”：外层卷轴框、内层金圈、中央墨色圆形探索图。
    drawInkScrollPanel(1751, 695, 300, 274);
    const miniMapRing = fixed(scene.add.graphics());
    miniMapRing.fillStyle(0x060c09, 0.98);
    miniMapRing.fillCircle(1751, 675, 105);
    miniMapRing.lineStyle(3, 0xbf9851, 0.95);
    miniMapRing.strokeCircle(1751, 675, 107);
    miniMapRing.lineStyle(1, 0xefe0a7, 0.68);
    miniMapRing.strokeCircle(1751, 675, 98);
    this.createMiniMapFog();
    fixed(addText(scene, 1751, 810, "观山镜 · 栖霞村", 18, "#f1ca5c", rightTextStyle))
      .setOrigin(0.5)
      .setDepth(905);

    // ── 左下：附近 NPC 信息 ──────────────────────────────────────────
    this.nearbyHud = scene.add.container(33, 530).setScrollFactor(0).setDepth(900).setVisible(false);
    this.nearbyHudBaseX = 33;
    this.nearbyCardTargetVisible = false;
    // 与右侧「当前任务」使用相同的圆角半径、深色底与棕色描边。
    const nearbyPanel = scene.add.graphics();
    nearbyPanel.fillStyle(panelColor, 0.9);
    nearbyPanel.fillRoundedRect(0, 0, 290, 137, 8);
    nearbyPanel.lineStyle(1.5, panelStroke, 1);
    nearbyPanel.strokeRoundedRect(0, 0, 290, 137, 8);
    const nearbyTitle = addText(scene, 20, 17, "附近修士", 18, "#f4d58c", { strokeThickness: 3 });
    // NPC 头像与地图问号分开：即使没有地图立绘，玩家靠近时仍能知道是谁。
    // 效果图中的头像是带一点灰色底的圆角方框，而不是圆形小人图标。
    this.nearbyAvatarFrame = scene.add.graphics()
      .fillStyle(0x6d766c, 1)
      .fillRoundedRect(19, 58, 60, 60, 8)
      .setVisible(false);
    this.nearbyAvatar = scene.add.image(49, 88, "player-idle-5dir", 0).setOrigin(0.5, 0.76).setScale(0.31).setVisible(false);
    // 问号放在头像右上方，但避开「附近修士」标题。
    this.nearbyQuestion = scene.add.image(70, 60, "npc-map-question-mark").setOrigin(0.5).setDisplaySize(29, 38).setVisible(false);
    this.nearbyNameText = addText(scene, 92, 63, "暂未发现", 18, "#ffffff", { strokeThickness: 3 });
    this.nearbyRealmText = addText(scene, 92, 90, "靠近 NPC 可交谈", 16, "#a8a79a", { strokeThickness: 3 });
    // 整张“附近修士”卡可以点击：NPC 在范围内时打开人物资料，而不是直接跳进对话。
    this.nearbyHitArea = scene.add.rectangle(145, 68, 290, 137, 0xffffff, 0)
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
    const isMerchant = Boolean(this.scene.isMerchantNpc?.(object));
    this.nearbyRealmText.setText(object
      ? (canInteract ? (object.type === "monster" ? "妖兽 · 可进入战斗" : isMerchant ? "商人 · 可购物" : "练气初期 · 可交谈") : `在附近 · 靠近后可${isMerchant ? "购物" : "交谈"}`)
      : "靠近 NPC 可交谈");
    const isNpc = object?.type === "npc";
    this.setNearbyCardVisible(isNpc);
    if (this.nearbyHitArea?.input) this.nearbyHitArea.input.enabled = isNpc;
    this.nearbyAvatarFrame.setVisible(isNpc);
    this.nearbyAvatar.setVisible(isNpc);
    // 尚未制作地图立绘时，在头像右上角给出问号提示；云游商人和村长保持同一交互样式。
    this.nearbyQuestion.setVisible(Boolean(isNpc && !object.npcTemplate?.mapPortraitData));
    if (!isNpc || this.nearbyNpcId === object.id) return;

    this.nearbyNpcId = object.id;
    if (isMerchant && this.scene.textures.exists("merchant-avatar")) {
      this.nearbyAvatar.setTexture("merchant-avatar").setOrigin(0.5).setPosition(49, 86).setDisplaySize(60, 60);
      return;
    }
    // NPC 编辑器中的头像优先；还没上传头像时，使用对话立绘作临时头像，
    // 因此村长不会再错误显示为默认的青衣小人。
    const avatarData = object.npcTemplate?.avatarData || object.npcTemplate?.portraitData || object.npcTemplate?.imageData || "";
    if (!avatarData) {
      this.nearbyAvatar.setTexture("player-idle-5dir", 0).setOrigin(0.5, 0.76).setPosition(49, 88).setScale(0.31);
      return;
    }
    const textureKey = `nearby-npc-avatar-${object.npcTemplate?.id || object.id}`;
    const applyAvatar = () => {
      if (!this.nearbyAvatar?.active || this.nearbyNpcId !== object.id) return;
      const source = this.scene.textures.get(textureKey).getSourceImage();
      const scale = Math.min(60 / source.width, 60 / source.height);
      this.nearbyAvatar.setTexture(textureKey).setOrigin(0.5).setPosition(49, 88).setDisplaySize(source.width * scale, source.height * scale);
    };
    if (this.scene.textures.exists(textureKey)) applyAvatar();
    else {
      // addBase64 在部分浏览器会延迟回调，导致卡片一直停留在默认小人；
      // 原生 Image 在真正读取完成时再注册纹理，头像会稳定显示。
      const image = new Image();
      image.onload = () => {
        if (this.scene.textures.exists(textureKey)) this.scene.textures.remove(textureKey);
        this.scene.textures.addImage(textureKey, image);
        applyAvatar();
      };
      image.onerror = () => {
        if (this.nearbyNpcId === object.id) this.nearbyAvatar.setTexture("player-idle-5dir", 0).setOrigin(0.5, 0.76).setScale(0.31);
      };
      image.src = avatarData;
    }
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
      && pointer.x >= 33 && pointer.x <= 323
      && pointer.y >= 530 && pointer.y <= 667,
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
    this.miniMap = { x: 1751, y: 675, radius: 96, mapSize: 192 };
    // 深墨圆形底层表示未探索区域，外层金圈已在 create() 中绘制。
    this.miniMapFog = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(902);
    this.miniMapFog.fillStyle(0x0a1711, 1);
    this.miniMapFog.fillCircle(this.miniMap.x, this.miniMap.y, this.miniMap.radius);
    // 画两道非常淡的山脊弧线，使未探索的“墨底”也像一面山水镜，而不是纯黑圆盘。
    this.miniMapFog.lineStyle(1, 0x62745d, 0.28);
    this.miniMapFog.beginPath();
    this.miniMapFog.moveTo(this.miniMap.x - 82, this.miniMap.y + 28);
    this.miniMapFog.lineTo(this.miniMap.x - 32, this.miniMap.y - 14);
    this.miniMapFog.lineTo(this.miniMap.x + 8, this.miniMap.y + 17);
    this.miniMapFog.lineTo(this.miniMap.x + 64, this.miniMap.y - 38);
    this.miniMapFog.strokePath();
    // 每个足迹是两个原生圆形对象，确保所有设备上都能稳定显示探索亮区。
    this.miniMapExploredDots = [];
    // 蓝点表示主角当前位置；它始终位于迷雾上方，方便辨认自己所在位置。
    this.miniMapPlayerMarker = scene.add.circle(this.miniMap.x, this.miniMap.y, 5, 0x238de0, 1)
      .setStrokeStyle(1, 0xd7f5ff, 0.95)
      .setScrollFactor(0)
      .setDepth(904);
    this.lastMiniMapRecord = null;
    // 存档中已有的足迹进入地图时先画出来；否则角色没有移动时会只看到蓝点。
    const savedPoints = Array.isArray(gameState.world.miniMapVisitedPoints) ? gameState.world.miniMapVisitedPoints : [];
    if (savedPoints.length && scene.worldSize) this.redrawMiniMapFog(savedPoints, scene.worldSize);
  }

  /** 每帧同步主角图标；每走约 120 像素才记录一次足迹，性能稳定且迷雾不会有断层。 */
  updateMiniMap(playerX, playerY, worldSize) {
    if (!this.miniMapExploredDots || !worldSize?.width || !worldSize?.height) return;
    const worldPoint = { x: Math.round(playerX), y: Math.round(playerY) };
    const visitedPoints = Array.isArray(gameState.world.miniMapVisitedPoints)
      ? gameState.world.miniMapVisitedPoints
      : (gameState.world.miniMapVisitedPoints = []);
    const lastPoint = visitedPoints[visitedPoints.length - 1];
    const shouldRecord = !lastPoint || Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, worldPoint.x, worldPoint.y) >= 120;
    if (shouldRecord) {
      visitedPoints.push(worldPoint);
      // 很长时间游玩后也限制足迹数量，避免本地存档不断变大。
      if (visitedPoints.length > 1000) visitedPoints.splice(0, visitedPoints.length - 1000);
      this.redrawMiniMapFog(visitedPoints, worldSize);
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
    const revealRadius = 17;
    visitedPoints.forEach((point) => {
      const { x, y } = this.toMiniMapPosition(point.x, point.y, worldSize);
      const distanceToCenter = Phaser.Math.Distance.Between(x, y, this.miniMap.x, this.miniMap.y);
      // 足迹圆边缘也不能越过金圈；留出半径余量后不会遮到外层水墨卷轴。
      if (distanceToCenter > this.miniMap.radius - revealRadius) return;
      // 外圈是淡墨青绿，内圈是浅青色，表现“已游历的山川”而非原先的大块荧光绿。
      this.miniMapExploredDots.push(
        this.scene.add.circle(x, y, revealRadius, 0x385e50, 0.88).setScrollFactor(0).setDepth(903),
        this.scene.add.circle(x, y, revealRadius * 0.62, 0x8ab59a, 0.66).setScrollFactor(0).setDepth(903),
      );
    });
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
    this.taskGuideButton = makeActionButton(333, "开启引路", 0x37523a, 0x485443, "#d6e3cd", () => {
      gameState.chapter.qingyunGuideEnabled = true;
      saveFirstChapterProgress();
      scene.updateQingyunQuestMarker?.();
      this.closeTaskLog();
      scene.updateQuestGuide?.();
    });
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
    if (gameState.chapter.qingyunInvestigation !== "active") return;
    playUiClickSound(this.scene);
    gameState.chapter.qingyunGuideEnabled = true;
    saveFirstChapterProgress();
    this.scene.updateQingyunQuestMarker?.();
    this.closeTaskLog();
    this.scene.updateQuestGuide?.();
  }

  /** 切换“进行中 / 全部任务 / 已完成”时刷新列表与详情。 */
  renderTaskLog() {
    if (!this.taskLog) return;
    const status = gameState.chapter.qingyunInvestigation;
    const isActive = status === "active";
    const isCompleted = status === "completed";
    const hasTask = this.taskLogFilter === "all"
      ? (isActive || isCompleted)
      : (this.taskLogFilter === "active" ? isActive : isCompleted);
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
    this.taskAbandonButton.background.setVisible(isActive && hasTask);
    this.taskAbandonButton.text.setVisible(isActive && hasTask);
    if (!hasTask) return;
    const badge = isCompleted ? "已完成" : "进行中";
    this.taskLogCardBadgeText.setText(badge);
    this.taskLogCardBadge.setFillStyle(isCompleted ? 0x37523a : 0x845e15);
    this.taskLogDescription.setText(isCompleted ? "已寻得古玉，青云山异光真相初现。" : "调查青云山异光，拿到任务道具");
    this.taskLogGoal.setText(isCompleted ? "任务已完成" : "前往山脚古潭的问道台");
    this.taskLogReward.setText(isCompleted ? "古玉线索" : "暂未显示");
  }

  abandonCurrentQuest() {
    if (gameState.chapter.qingyunInvestigation !== "active") return;
    playUiClickSound(this.scene);
    gameState.chapter.qingyunInvestigation = "not_started";
    gameState.chapter.qingyunGuideEnabled = false;
    saveFirstChapterProgress();
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
    const status = gameState.chapter.qingyunInvestigation;
    const hasActiveQuest = status === "active";
    const text = hasActiveQuest
      ? "主线：调查青云山异光\n目标：前往山脚古潭的问道台"
      : "暂无进行中的任务";
    // 没有进行中任务时，提示文字像效果图一样置于卡片中央；
    // 任务开启后恢复左对齐的任务目标排版。
    this.questText
      ?.setText(text)
      .setColor(hasActiveQuest ? "#ffffff" : "#a8a79a")
      .setFontSize(hasActiveQuest ? "16px" : "18px")
      .setWordWrapWidth(hasActiveQuest ? 262 : 0)
      .setOrigin(hasActiveQuest ? 0 : 0.5, 0.5)
      // 新水墨任务卷轴的正文从分隔线下方开始；无任务时仍保持整齐的居中留白。
      .setPosition(hasActiveQuest ? 1613 : 1751, hasActiveQuest ? 453 : 469);
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
    const overRightColumn = x >= 1595 && x <= 1910 && y >= 220 && y <= 845;
    return overProfile || overToolbar || overRightColumn;
  }
}

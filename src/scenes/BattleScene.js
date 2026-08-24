import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { getItemTemplate } from "../core/ItemStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addButton, addText } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";

/**
 * 第一章基础回合战斗。
 * 本场景使用用户提供 .pix 设计工程提取的背景、角色、五行法盘素材。
 */
export class BattleScene extends Phaser.Scene {
  constructor() { super(SceneKeys.BATTLE); }

  /**
   * VillageScene 会把“是哪一只编辑器怪物”传进来。
   * 没有传入时仍然使用第一章固定劫修，保证原主线战斗不受影响。
   */
  init(data = {}) {
    this.mapMonster = data.mapMonster || null;
    // 从奇异玉光进入的测试战斗允许随时返回，而且返回后恢复状态，方便反复测试。
    this.isTestBattle = Boolean(data.testBattle);
  }

  preload() {
    this.load.image("battle-mountain-background", "./public/assets/images/battle/battle-mountain-background.png");
    this.load.image("battle-swordsman", "./public/assets/images/battle/swordsman.png");
    this.load.image("battle-five-elements-disc", "./public/assets/images/battle/five-elements-disc.png");
    // 用户要求完整播放原始动作，因此双方各加载连续的 153 帧，不再抽帧。
    // 角色已经缩小，显存压力比先前大模型时低；如果未来素材更多，再改为图集优化而不是跳帧。
    this.animationFrameCount = 153;
    for (let frame = 1; frame <= this.animationFrameCount; frame += 1) {
      const number = String(frame).padStart(3, "0");
      this.load.image(`battle-player-${number}`, `./public/assets/images/battle/animations/player-cultivator/player-battle-${number}.webp`);
      this.load.image(`battle-spider-${number}`, `./public/assets/images/battle/animations/soul-devouring-spider/soul-devouring-spider-${number}.webp`);
    }
  }

  create() {
    configureFullHdScene(this);
    const config = this.mapMonster?.battle;
    // 编辑器怪物若上传了图片，就在本场战斗使用该图片；
    // 没上传时继续使用默认噬魂魔蛛的 153 帧动作，保证旧内容不受影响。
    this.usesCustomEnemyPortrait = Boolean(config?.imageData);
    this.enemy = config
      ? {
        name: this.mapMonster.name,
        hp: config.maxHp,
        maxHp: config.maxHp,
        attack: config.attack,
        defense: config.defense,
        qi: config.qi ?? 16,
        maxQi: config.qi ?? 16,
        skills: config.skills || [],
        soundUrl: config.soundUrl || "",
      }
      : { name: "噬魂魔蛛", hp: 52, maxHp: 52, attack: 8, defense: 2, qi: 20, maxQi: 20, skills: [{ name: "噬魂毒刺", damage: 8, qiCost: 0, cooldown: 0 }], soundUrl: "" };
    // 键是技能名称，值是还剩多少回合冷却；每场战斗重新开始计算。
    this.enemySkillCooldowns = {};
    this.defending = false;
    this.battleOver = false;
    // 速度位功法提供“先手速度”。相等时仍优先主角，避免开局角色无操作可做。
    this.playerInitiative = this.getPlayerInitiative();
    this.enemyInitiative = Math.max(0, Number(config?.initiative) || 0);
    this.isPlayerTurn = this.playerInitiative >= this.enemyInitiative;
    this.round = 1;
    this.drawBattlefield();
    this.createStatusBars();
    this.createActionDeck();
    this.createBattleLog();
    this.startBattleFrameAnimations();
    // 快捷栏既可鼠标点击，也可直接按数字键 1、2、3 使用。
    this.input.keyboard.on("keydown-ONE", () => this.normalAttack());
    this.input.keyboard.on("keydown-TWO", () => this.useSkill());
    this.input.keyboard.on("keydown-THREE", () => this.defend());
    // Esc 是返回地图的备用操作，鼠标按钮失效时也能安全离开战斗。
    this.input.keyboard.on("keydown-ESC", () => this.returnToVillage());
    this.updateBattleUi();
    // 只有敌方先手时，才在战场初始化完成后自动开始第一回合。
    if (!this.isPlayerTurn) this.time.delayedCall(650, () => this.enemyTurn());
  }

  /** 读取速度位功法的先手加成；速度位为空时为 0。 */
  getPlayerInitiative() {
    const speedTechniqueId = gameState.player.equippedTechniques?.speed;
    const speedTechnique = speedTechniqueId ? getItemTemplate(speedTechniqueId) : null;
    return Math.max(0, Number(speedTechnique?.techniqueInitiative) || 0);
  }

  /** 绘制战斗背景、双方角色和顶部回合提示。 */
  drawBattlefield() {
    this.add.image(960, 540, "battle-mountain-background").setDisplaySize(1920, 1080);
    this.add.rectangle(960, 540, 1920, 1080, 0x13232b, 0.08);
    // 真实的 153 帧角色与噬魂魔蛛动作。用第一帧建立图片，随后定时器逐帧切换。
    // 新主角战斗帧的原始尺寸是 720×720（正方形）。必须等宽等高显示，
    // 否则会像旧素材一样被纵向拉伸，人物比例就会不自然。
    // 280 是屏幕中的显示大小；以后换角色只要读取素材比例再修改这里即可。
    this.playerAvatar = this.add.image(285, 668, "battle-player-001").setOrigin(0.5, 1).setDisplaySize(420, 420);
    this.enemyAvatar = this.add.image(1620, 668, "battle-spider-001").setOrigin(0.5, 1).setDisplaySize(443, 443);
    this.loadCustomEnemyPortrait();
    this.add.ellipse(285, 675, 255, 33, 0x17221e, 0.27);
    this.add.ellipse(1620, 675, 285, 36, 0x17221e, 0.27);
    this.roundText = addText(this, 960, 63, "第 1 回合", 51, "#fff1c6", { origin: 0.5, strokeThickness: 9 });
    this.turnHint = addText(this, 960, 125, "你的回合 · 请选择行动", 27, "#d9ebdc", { origin: 0.5, strokeThickness: 5 });
    addText(this, 285, 282, gameState.player.name, 29, "#fff6da", { origin: 0.5 });
    addText(this, 1620, 282, this.enemy.name, 29, "#ffe0d7", { origin: 0.5 });
    // 返回按钮额外有一层较大的透明点击范围；全屏缩放时点文字或边缘也能触发。
    this.returnMapButton = addButton(this, 1740, 138, 255, "返回青云山", () => this.returnToVillage(), { height: 57, size: 23 }).setDepth(200);
    this.returnMapHitArea = this.add.zone(1740, 138, 330, 96)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(201);
    this.returnMapHitArea.on("pointerdown", () => this.returnToVillage());
  }

  /**
   * 按原始战斗视频的 24 帧/秒播放，每帧约 41.67 毫秒。
   * 之前按 25 帧/秒播放，会让原视频动作略微加速，造成动作节奏不自然。
   * 这里仍会完整读取 153 张图片，不会丢帧或抽帧。
   */
  startBattleFrameAnimations() {
    this.playerFrame = 1;
    this.spiderFrame = 1;
    this.time.addEvent({
      delay: 1000 / 24,
      loop: true,
      callback: () => {
        this.playerFrame = this.playerFrame % this.animationFrameCount + 1;
        this.spiderFrame = this.spiderFrame % this.animationFrameCount + 1;
        const playerKey = `battle-player-${String(this.playerFrame).padStart(3, "0")}`;
        const spiderKey = `battle-spider-${String(this.spiderFrame).padStart(3, "0")}`;
        if (this.playerAvatar?.active) this.playerAvatar.setTexture(playerKey);
        // 自定义图片是单张立绘，不应该被默认魔蛛的序列帧每 1/24 秒覆盖。
        if (this.enemyAvatar?.active && !this.usesCustomEnemyPortrait) this.enemyAvatar.setTexture(spiderKey);
      },
    });
  }

  /**
   * 把怪物编辑器保存的 Base64 图片注册为 Phaser 纹理。
   * 文件数据保存在浏览器本地，因此不依赖服务器，也能在离线网页游戏里工作。
   */
  loadCustomEnemyPortrait() {
    const imageData = this.mapMonster?.battle?.imageData;
    if (!imageData) return;
    const textureKey = `battle-monster-custom-${this.mapMonster.battle.id}`;
    const applyTexture = () => {
      // 图片可能是方形或竖图；先限制在 280×280 范围内，再按原比例缩放。
      const source = this.textures.get(textureKey).getSourceImage();
      const scale = Math.min(420 / source.width, 420 / source.height);
      if (this.enemyAvatar?.active) this.enemyAvatar.setTexture(textureKey).setDisplaySize(source.width * scale, source.height * scale).clearTint();
    };
    if (this.textures.exists(textureKey)) applyTexture();
    else this.textures.addBase64(textureKey, imageData, applyTexture);
  }

  /** 绘制双方生命、灵气条；长度会随数值实时变化。 */
  createStatusBars() {
    this.playerBars = this.createBars(83, 708, 450, "left");
    this.enemyBars = this.createBars(1388, 708, 450, "right");
  }

  createBars(x, y, width, direction) {
    const isRight = direction === "right";
    const startX = isRight ? x + width : x;
    this.add.rectangle(startX, y, width, 36, 0x2e1a17, 0.9).setOrigin(isRight ? 1 : 0, 0).setStrokeStyle(2, 0xffb078);
    this.add.rectangle(startX, y + 47, width, 30, 0x18334a, 0.9).setOrigin(isRight ? 1 : 0, 0).setStrokeStyle(2, 0x70b8eb);
    const hpFill = this.add.rectangle(startX, y, width, 36, 0xd52a1a, 1).setOrigin(isRight ? 1 : 0, 0);
    const qiFill = this.add.rectangle(startX, y + 47, width, 30, 0x237fca, 1).setOrigin(isRight ? 1 : 0, 0);
    const hpText = addText(this, x + width / 2, y + 3, "", 23, "#ffffff", { origin: 0.5, strokeThickness: 3 });
    const qiText = addText(this, x + width / 2, y + 48, "", 21, "#ffffff", { origin: 0.5, strokeThickness: 3 });
    return { hpFill, qiFill, hpText, qiText, width };
  }

  /** 左下角 1～9 快捷栏的第一版：前三格放入普通攻击、术法、防御。 */
  createActionDeck() {
    this.add.rectangle(323, 924, 615, 281, 0x1b2927, 0.94).setStrokeStyle(5, 0xae8955);
    this.createActionCard(141, 855, "1", "普通攻击", "不耗灵气", () => this.normalAttack());
    this.createActionCard(330, 855, "2", this.getSkillName(), "消耗 8 灵气", () => this.useSkill());
    this.createActionCard(519, 855, "3", "防御", "减伤并回灵气", () => this.defend());
    for (let index = 0; index < 3; index += 1) {
      this.add.rectangle(141 + index * 189, 1007, 162, 102, 0x14201f, 0.62).setStrokeStyle(2, 0x79694e, 0.7);
      addText(this, 141 + index * 189, 1007, "空", 23, "#87918a", { origin: 0.5, strokeThickness: 2 });
    }
    this.add.image(915, 912, "battle-five-elements-disc").setScale(0.3075);
    this.discQiText = addText(this, 915, 912, "", 41, "#5a4324", { origin: 0.5, strokeThickness: 2, align: "center" });
  }

  createActionCard(x, y, key, name, detail, onClick) {
    const background = this.add.rectangle(x, y, 162, 123, 0x20302d, 0.97).setStrokeStyle(3, 0xc59c5c).setInteractive({ useHandCursor: true });
    addText(this, x - 63, y - 47, key, 23, "#c9b989", { origin: 0.5, strokeThickness: 2 });
    addText(this, x, y - 14, name, 24, "#fff0c4", { origin: 0.5, strokeThickness: 3, wordWrap: { width: 150 } });
    addText(this, x, y + 41, detail, 18, "#b8d7c4", { origin: 0.5, strokeThickness: 2, wordWrap: { width: 150 } });
    background.on("pointerover", () => background.setFillStyle(0x3a5148));
    background.on("pointerout", () => background.setFillStyle(0x20302d));
    background.on("pointerdown", onClick);
  }

  /** 右下角记录区域，显示最近的战斗结果。 */
  createBattleLog() {
    this.add.rectangle(1583, 924, 548, 275, 0xf0e5d5, 0.94).setStrokeStyle(5, 0x9a7955);
    this.logText = addText(this, 1328, 822, "", 23, "#553d36", { wordWrap: { width: 495 }, lineSpacing: 11, strokeThickness: 0 });
  }

  getSkillName() {
    return { 金: "金刃术", 木: "青藤术", 水: "水箭术", 火: "火弹术", 土: "岩甲术" }[gameState.player.selectedElement];
  }

  /** 刷新生命、灵气、回合和法盘中央数值。 */
  updateBattleUi() {
    this.updateBars(this.playerBars, gameState.player.hp, gameState.player.maxHp, gameState.player.qi, gameState.player.maxQi);
    this.updateBars(this.enemyBars, this.enemy.hp, this.enemy.maxHp, this.enemy.qi, this.enemy.maxQi);
    this.roundText.setText(`第 ${this.round} 回合`);
    this.turnHint.setText(this.battleOver ? "战斗结束" : this.isPlayerTurn ? "你的回合 · 请选择行动" : "敌方行动中……");
    this.discQiText.setText(`${gameState.player.qi}\n/${gameState.player.maxQi}`);
  }

  updateBars(bars, hp, maxHp, qi, maxQi) {
    bars.hpFill.setDisplaySize(bars.width * Phaser.Math.Clamp(hp / maxHp, 0, 1), 36);
    bars.qiFill.setDisplaySize(bars.width * Phaser.Math.Clamp(qi / maxQi, 0, 1), 30);
    bars.hpText.setText(`${hp}/${maxHp}`);
    bars.qiText.setText(`${qi}/${maxQi}`);
  }

  canPlayerAct() { return !this.battleOver && this.isPlayerTurn; }

  /**
   * 战斗测试需要可随时退出；普通地图怪物也允许退出，但不会获得掉落或标记为击败。
   * 奇异玉光测试返回时恢复状态，玩家可立刻重新进入下一场测试。
   */
  returnToVillage() {
    // 双击按钮或同时点到按钮和透明范围时，只处理一次场景切换。
    if (this.isReturningToVillage) return;
    this.isReturningToVillage = true;
    if (this.isTestBattle) {
      gameState.player.hp = gameState.player.maxHp;
      gameState.player.qi = gameState.player.maxQi;
    }
    // 保存离开战斗时的角色状态与地图坐标，刷新网页后仍会回到战斗前的位置。
    saveFirstChapterProgress();
    this.scene.start(SceneKeys.VILLAGE);
  }

  useSkill() {
    if (!this.canPlayerAct()) return;
    if (gameState.player.qi < 8) return this.setLog("灵气不足，无法施放术法！请防御恢复灵气或普通攻击。", "#b84c3e");
    this.beginPlayerAction();
    gameState.player.qi -= 8;
    const damage = Math.max(1, gameState.player.attack + 8 - this.enemy.defense);
    this.playSkillAnimation(() => {
      this.enemy.hp = Math.max(0, this.enemy.hp - damage);
      this.setLog(`${gameState.player.name}施放${this.getSkillName()}，造成 ${damage} 点伤害！`, "#b84c3e");
    });
  }

  normalAttack() {
    if (!this.beginPlayerAction()) return;
    const damage = Math.max(1, gameState.player.attack - this.enemy.defense + Phaser.Math.Between(0, 3));
    this.playNormalAttackAnimation(() => {
      this.enemy.hp = Math.max(0, this.enemy.hp - damage);
      this.setLog(`${gameState.player.name}使用基础武器攻击，造成 ${damage} 点伤害。`);
    });
  }

  defend() {
    if (!this.beginPlayerAction()) return;
    this.defending = true;
    gameState.player.qi = Math.min(gameState.player.maxQi, gameState.player.qi + 5);
    this.setLog("你选择防御：本回合减伤，并恢复 5 点灵气。", "#3c7666");
    this.afterPlayerAction();
  }

  /** 玩家选择行动后立刻锁定本回合，直到动画播放完毕才允许敌方行动。 */
  beginPlayerAction() {
    if (!this.canPlayerAct()) return false;
    this.isPlayerTurn = false;
    this.updateBattleUi();
    return true;
  }

  /**
   * 普通攻击动画：角色向敌方冲出一小步，命中时出现剑光，再退回原来的站位。
   * 回调函数只在“命中”那一刻执行，因此伤害与视觉效果保持同步。
   */
  playNormalAttackAnimation(onImpact) {
    const originX = this.playerAvatar.x;
    const strikeX = originX + 72;
    this.tweens.add({
      targets: this.playerAvatar,
      x: strikeX,
      duration: 130,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.createHitFlash(910, 326, 0xffe1a3);
        onImpact();
        this.updateBattleUi();
        this.tweens.add({
          targets: this.playerAvatar,
          x: originX,
          duration: 170,
          ease: "Quad.easeIn",
          onComplete: () => this.afterPlayerAction(),
        });
      },
    });
  }

  /**
   * 术法动画：先显示技能名称，再从主角处飞出带灵根颜色的法术光球。
   * 目前是程序绘制的临时特效；日后法术编辑器可以把这里替换成用户提供的序列帧特效。
   */
  playSkillAnimation(onImpact) {
    const elementColor = { 金: 0xf2cf64, 木: 0x65c56c, 水: 0x58b8ee, 火: 0xff6a3d, 土: 0xc89156 }[gameState.player.selectedElement] || 0xffffff;
    const skillName = this.getSkillName();
    const skillTitle = addText(this, 960, 383, skillName, 54, "#fff2ba", { origin: 0.5, strokeThickness: 11 }).setDepth(60).setAlpha(0);
    const aura = this.add.circle(this.playerAvatar.x + 45, 450, 33, elementColor, 0.75).setDepth(55).setAlpha(0);
    this.tweens.add({
      targets: [skillTitle, aura],
      alpha: 1,
      duration: 130,
      onComplete: () => {
        const projectile = this.add.circle(this.playerAvatar.x + 83, 495, 24, elementColor, 1).setDepth(58).setStrokeStyle(5, 0xfff5cc);
        this.tweens.add({
          targets: projectile,
          x: 1433,
          y: 495,
          scale: 1.7,
          duration: 310,
          ease: "Cubic.easeIn",
          onComplete: () => {
            projectile.destroy();
            aura.destroy();
            this.createHitFlash(955, 330, elementColor);
            onImpact();
            this.updateBattleUi();
            this.tweens.add({ targets: skillTitle, alpha: 0, duration: 180, onComplete: () => {
              skillTitle.destroy();
              this.afterPlayerAction();
            } });
          },
        });
      },
    });
  }

  /** 命中瞬间扩散一个光圈，使普通攻击和术法都能看出“打到了”。 */
  createHitFlash(x, y, color) {
    const flash = this.add.circle(x, y, 27, color, 0.85).setDepth(59).setStrokeStyle(5, 0xfff6d0);
    this.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
  }

  afterPlayerAction() {
    this.isPlayerTurn = false;
    this.updateBattleUi();
    if (this.enemy.hp <= 0) return this.winBattle();
    this.time.delayedCall(700, () => this.enemyTurn());
  }

  enemyTurn() {
    if (this.battleOver) return;
    Object.keys(this.enemySkillCooldowns).forEach((name) => {
      this.enemySkillCooldowns[name] = Math.max(0, this.enemySkillCooldowns[name] - 1);
    });
    const usableSkills = this.enemy.skills.filter((skill) =>
      this.enemy.qi >= skill.qiCost && (this.enemySkillCooldowns[skill.name] || 0) === 0,
    );
    const skill = usableSkills.length ? Phaser.Utils.Array.GetRandom(usableSkills) : null;
    if (skill) {
      this.enemy.qi -= skill.qiCost;
      this.enemySkillCooldowns[skill.name] = skill.cooldown;
    }
    const rawDamage = Math.max(1, (skill?.damage ?? this.enemy.attack) - gameState.player.defense + Phaser.Math.Between(0, 3));
    const damage = this.defending ? Math.ceil(rawDamage * 0.5) : rawDamage;
    const onImpact = () => {
      gameState.player.hp = Math.max(0, gameState.player.hp - damage);
      this.defending = false;
      this.playEnemySound();
      this.setLog(`${this.enemy.name}${skill ? `施展${skill.name}` : "发起攻击"}，造成 ${damage} 点伤害。`, "#b84c3e");
      this.updateBattleUi();
    };
    // 有技能时播放施法画面；没有可用技能时则播放向前扑击的普通攻击动作。
    if (skill) this.playEnemySkillAnimation(skill, onImpact);
    else this.playEnemyNormalAttackAnimation(onImpact);
  }

  /** 敌方普通攻击：向左逼近主角、命中、再退回原来位置。 */
  playEnemyNormalAttackAnimation(onImpact) {
    const originX = this.enemyAvatar.x;
    this.tweens.add({
      targets: this.enemyAvatar,
      x: originX - 70,
      duration: 130,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.createHitFlash(320, 326, 0xd96a66);
        onImpact();
        this.tweens.add({ targets: this.enemyAvatar, x: originX, duration: 170, ease: "Quad.easeIn", onComplete: () => this.finishEnemyTurn() });
      },
    });
  }

  /**
   * 敌方技能画面：怪物也会先向主角逼近一步，再施放法术、命中并退回原位。
   * 这样无论是普通攻击还是技能攻击，怪物都会有与主角一致的前冲动作。
   */
  playEnemySkillAnimation(skill, onImpact) {
    const color = 0xb14cc9;
    const originX = this.enemyAvatar.x;
    const strikeX = originX - 54;
    const skillTitle = addText(this, 960, 383, skill.name, 54, "#ffd1e5", { origin: 0.5, strokeThickness: 11 }).setDepth(60).setAlpha(0);
    this.tweens.add({
      // 先向左跨出一小步；这一步和普通攻击的冲刺方向完全相同。
      targets: this.enemyAvatar,
      x: strikeX,
      duration: 130,
      ease: "Quad.easeOut",
      onComplete: () => {
        // 角色到位后才出现魔气和技能名称，技能特效会从当前怪物位置飞出。
        const aura = this.add.circle(this.enemyAvatar.x - 51, 450, 33, color, 0.78).setDepth(55).setAlpha(0);
        this.tweens.add({
          targets: [skillTitle, aura],
          alpha: 1,
          duration: 130,
          onComplete: () => {
            const projectile = this.add.circle(this.enemyAvatar.x - 87, 495, 26, color, 1).setDepth(58).setStrokeStyle(5, 0xffd5f0);
            this.tweens.add({
              targets: projectile,
              x: 488,
              y: 495,
              scale: 1.7,
              duration: 310,
              ease: "Cubic.easeIn",
              onComplete: () => {
                projectile.destroy();
                aura.destroy();
                this.createHitFlash(325, 330, color);
                onImpact();
                // 命中后一定退回初始站位，再把回合交还给主角。
                this.tweens.add({ targets: this.enemyAvatar, x: originX, duration: 170, ease: "Quad.easeIn", onComplete: () => {
                  this.tweens.add({ targets: skillTitle, alpha: 0, duration: 180, onComplete: () => {
                    skillTitle.destroy();
                    this.finishEnemyTurn();
                  } });
                } });
              },
            });
          },
        });
      },
    });
  }

  /** 敌方动作、伤害结算完成后，判断胜负或把回合交还给玩家。 */
  finishEnemyTurn() {
    if (gameState.player.hp <= 0) {
      this.battleOver = true;
      this.setLog("你在第一章原型中败退了。按 R 重试本场战斗。", "#b84c3e");
      this.input.keyboard.once("keydown-R", () => {
        gameState.player.hp = gameState.player.maxHp;
        gameState.player.qi = gameState.player.maxQi;
        this.scene.restart();
      });
      this.updateBattleUi();
      return;
    }
    this.round += 1;
    this.isPlayerTurn = true;
    this.updateBattleUi();
  }

  /**
   * 如果怪物编辑器填写了可访问的音频地址，就在怪物出招时播放。
   * 没填写、地址无效或浏览器拦截自动播放时，战斗仍会正常继续。
   */
  playEnemySound() {
    if (!this.enemy.soundUrl) return;
    const audio = new Audio(this.enemy.soundUrl);
    audio.volume = 0.55;
    audio.play().catch(() => {});
  }

  winBattle() {
    this.battleOver = true;
    // 编辑器怪物胜利后，记入当前角色存档；返回地图时它就不会重复刷新。
    if (this.mapMonster) {
      if (!gameState.world.defeatedMonsterIds.includes(this.mapMonster.id)) {
        gameState.world.defeatedMonsterIds.push(this.mapMonster.id);
      }
      saveFirstChapterProgress();
      const drops = this.mapMonster.drops?.join("、") || "灵石 × 3、低阶材料 × 1";
      this.setLog(`${this.enemy.name}被击败，掉落：${drops}。\n2 秒后返回青云山。`, "#87642d");
      this.updateBattleUi();
      this.time.delayedCall(1800, () => this.scene.start(SceneKeys.VILLAGE));
      return;
    }
    gameState.chapter.eliteDefeated = true;
    saveFirstChapterProgress();
    this.setLog("劫修倒下，掉落：灵石 × 12、低阶回灵丹 × 1、蚀月盟令牌残片 × 1。", "#87642d");
    this.updateBattleUi();
    this.time.delayedCall(1800, () => this.scene.start(SceneKeys.RESULT));
  }

  setLog(text, color = "#553d36") { this.logText.setText(text).setColor(color); }
}

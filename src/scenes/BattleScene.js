import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addText } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { SpellService } from "../domain/spells/SpellService.js";
import { CombatEngine, calculatePlayerInitiative } from "../domain/combat/CombatEngine.js";
import { BattleRewardService } from "../domain/rewards/BattleRewardService.js";
import { getMonsterAppearanceTextureKey, resolveMonsterAppearance } from "../core/MonsterAppearance.js";
import { getMapObjects } from "../core/MapContentStore.js";
import { getMonsterTemplate } from "../core/MonsterStore.js";
import { clearSceneResumeRoute, rememberBattleRoute } from "../core/SceneResumeState.js";
import { XianxiaDialog } from "../ui/XianxiaDialog.js";
import { BattleHud } from "../ui/battle/BattleHud.js";
import { BattleResultDialog, preloadBattleResultDialogAssets } from "../ui/battle/BattleResultDialog.js";
import {
  ChapterQuestService,
  QINGYUN_INVESTIGATION_ID,
  QUEST_EVENTS,
} from "../domain/quests/ChapterQuestService.js";

const CHAPTER_ELITE_REWARDS = ["灵石 × 12", "低阶回灵丹 × 1", "蚀月盟令牌残片 × 1"];
const DEFAULT_MONSTER_REWARDS = ["灵石 × 3", "低阶材料 × 1"];
const ADVENTURE_BATTLES = Object.freeze({
  "qingyun-mist-guardian": {
    name: "雾隐山魈",
    maxHp: 38,
    attack: 7,
    defense: 1,
    qi: 14,
    skills: [{ name: "雾爪扑击", damage: 6, qiCost: 0, cooldown: 0 }],
  },
});

/** 用会话中保存的稳定编号重新装配地图怪物，不把图片和整份模板写入 sessionStorage。 */
function restoreMapMonster({ mapId, mapMonsterId, monsterTemplateId } = {}) {
  if (!mapMonsterId) return null;
  const object = getMapObjects(mapId || "qingyun-mountain")
    .find((candidate) => candidate.id === mapMonsterId);
  const templateId = object?.monsterTemplateId || monsterTemplateId;
  const template = templateId ? getMonsterTemplate(templateId) : null;
  if (object) {
    if (template) Object.assign(object, { name: template.name, battle: template, drops: template.drops });
    return object;
  }
  if (!template) return null;
  return {
    id: mapMonsterId,
    type: "monster",
    name: template.name,
    monsterTemplateId: templateId,
    battle: template,
    drops: template.drops,
  };
}

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
    this.mapId = data.mapId || (data.mapMonster ? "qingyun-mountain" : "");
    this.mapMonster = data.mapMonster || (data.resumeBattle ? restoreMapMonster(data) : null);
    this.adventureBattle = ADVENTURE_BATTLES[data.adventureBattle] ? data.adventureBattle : null;
    // 从奇异玉光进入的测试战斗允许随时返回，而且返回后恢复状态，方便反复测试。
    this.isTestBattle = Boolean(data.testBattle);
    this.battleResumeData = {
      resumeBattle: true,
      testBattle: this.isTestBattle,
      adventureBattle: this.adventureBattle || "",
      mapId: this.mapId,
      mapMonsterId: this.mapMonster?.id || data.mapMonsterId || "",
      monsterTemplateId: this.mapMonster?.monsterTemplateId || data.monsterTemplateId || "",
    };
  }

  preload() {
    this.load.image("battle-mountain-background", "./public/assets/images/battle/battle-mountain-background.png");
    this.load.image("battle-swordsman", "./public/assets/images/battle/swordsman.png");
    this.load.image("battle-five-elements-disc", "./public/assets/images/battle/five-elements-disc.png");
    preloadBattleResultDialogAssets(this);
    // Pixso“新战斗界面”导出的原尺寸 UI 素材。
    const uiRoot = "./public/assets/images/battle/new-ui";
    this.load.image("battle-ui-action-deck", `${uiRoot}/action-deck-panel.png`);
    this.load.image("battle-ui-action-key-label", `${uiRoot}/action-key-label.png`);
    this.load.image("battle-ui-action-slot", `${uiRoot}/action-slot.png`);
    this.load.image("battle-ui-action-slot-selected", `${uiRoot}/action-slot-selected.png`);
    this.load.image("battle-ui-log-scroll", `${uiRoot}/battle-log-scroll.png`);
    this.load.image("battle-ui-button-dark", `${uiRoot}/button-dark.png`);
    this.load.image("battle-ui-button-green", `${uiRoot}/button-green.png`);
    this.load.image("battle-ui-five-elements-frame", `${uiRoot}/five-elements-frame.png`);
    this.load.image("battle-ui-round-header", `${uiRoot}/round-header.png`);
    this.load.image("battle-ui-skill-fireburst", `${uiRoot}/skill-fireburst.png`);
    this.load.image("battle-ui-status-bar", `${uiRoot}/status-bar-frame.png`);
    ["metal", "wood", "water", "fire", "wind", "ice", "dark", "lightning"].forEach((element) => {
      this.load.image(`battle-ui-element-${element}`, `${uiRoot}/element-${element}.png`);
    });
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
    // 战斗进行期间保留来源编号，F5 后由 BootScene 从同一场战斗开头安全重建。
    rememberBattleRoute({
      ...this.battleResumeData,
      saveSlot: gameState.activeSaveSlot,
    });
    this.itemCatalog = new ItemCatalog();
    this.spellService = new SpellService({ player: gameState.player, catalog: this.itemCatalog });
    this.rewardService = new BattleRewardService({
      player: gameState.player,
      world: gameState.world,
      chapter: gameState.chapter,
      catalog: this.itemCatalog,
      save: saveFirstChapterProgress,
    });
    const adventureConfig = this.adventureBattle ? ADVENTURE_BATTLES[this.adventureBattle] : null;
    const config = this.mapMonster?.battle || adventureConfig;
    // 编辑器怪物若上传了图片，就在本场战斗使用该图片；
    // 没上传时继续使用默认噬魂魔蛛的 153 帧动作，保证旧内容不受影响。
    this.usesCustomEnemyPortrait = Boolean(resolveMonsterAppearance(config).staticImageData);
    this.enemy = config
      ? {
        name: this.mapMonster?.name || adventureConfig.name,
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
    this.combat = new CombatEngine({
      player: gameState.player,
      enemy: this.enemy,
      // 速度位功法提供先手；相等时由引擎保证玩家先行动。
      playerInitiative: calculatePlayerInitiative(gameState.player, this.itemCatalog),
      enemyInitiative: Math.max(0, Number(config?.initiative) || 0),
    });
    this.enemy = this.combat.enemy;
    this.drawBattlefield();
    this.battleHud = new BattleHud(this, {
      onNormalAttack: () => this.normalAttack(),
      onSkill: () => this.useSkill(),
      onDefend: () => this.defend(),
      onEscape: () => this.returnToVillage(),
      onEnd: () => this.handleEndButton(),
    }).create({
      playerName: gameState.player.name,
      enemyName: this.enemy.name,
      skillName: this.getSkillName(),
    });
    this.startBattleFrameAnimations();
    // 快捷栏既可鼠标点击，也可直接按数字键 1、2、3 使用。
    this.input.keyboard.on("keydown-ONE", () => this.normalAttack());
    this.input.keyboard.on("keydown-TWO", () => this.useSkill());
    this.input.keyboard.on("keydown-THREE", () => this.defend());
    // Esc 是备用出口；结算弹窗打开时遵循弹窗对应的目标，避免绕过章节结算页。
    this.input.keyboard.on("keydown-ESC", () => {
      if (this.victoryDialog?.isOpen) this.continueAfterVictory();
      else if (this.defeatDialog?.isOpen) this.returnAfterDefeat();
      else this.returnToVillage();
    });
    this.updateBattleUi();
    // 只有敌方先手时，才在战场初始化完成后自动开始第一回合。
    if (this.combat.turn === "enemy") this.time.delayedCall(650, () => this.enemyTurn());
  }

  /** 绘制战斗背景、双方角色和顶部回合提示。 */
  drawBattlefield() {
    this.add.image(960, 540, "battle-mountain-background").setDisplaySize(1920, 1080);
    this.add.rectangle(960, 540, 1920, 1080, 0x13232b, 0.08);
    // 真实的 153 帧角色与噬魂魔蛛动作。用第一帧建立图片，随后定时器逐帧切换。
    // 新主角战斗帧的原始尺寸是 720×720（正方形）。必须等宽等高显示，
    // 否则会像旧素材一样被纵向拉伸，人物比例就会不自然。
    // 280 是屏幕中的显示大小；以后换角色只要读取素材比例再修改这里即可。
    // 坐标和显示框严格对应 Pixso 1920×1080 画板中的“左边角色”和敌方立绘图层。
    this.playerAvatar = this.add.image(84, 211, "battle-player-001").setOrigin(0, 0).setDisplaySize(337, 413.32);
    this.enemyAvatar = this.add.image(1371.89, 231.63, "battle-spider-001").setOrigin(0, 0).setDisplaySize(456.77, 392.69);
    this.loadCustomEnemyPortrait();
    this.add.ellipse(252.5, 631, 280, 30, 0x17221e, 0.24);
    this.add.ellipse(1600, 631, 330, 34, 0x17221e, 0.24);
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
    const appearance = resolveMonsterAppearance(this.mapMonster?.battle);
    const imageData = appearance.staticImageData;
    if (!imageData) return;
    const textureKey = getMonsterAppearanceTextureKey(this.mapMonster.battle, "battle-monster-custom");
    const applyTexture = () => {
      // 自定义图片按 Pixso 敌方角色框等比适配，并与角色脚底对齐。
      const source = this.textures.get(textureKey).getSourceImage();
      const frame = { x: 1371.89, y: 231.63, width: 456.77, height: 392.69 };
      const scale = Math.min(frame.width / source.width, frame.height / source.height);
      const width = source.width * scale;
      const height = source.height * scale;
      if (this.enemyAvatar?.active) {
        this.enemyAvatar
          .setTexture(textureKey)
          .setPosition(frame.x + (frame.width - width) / 2, frame.y + frame.height - height)
          .setDisplaySize(width, height)
          .clearTint();
      }
    };
    if (this.textures.exists(textureKey)) applyTexture();
    else {
      const image = new Image();
      image.onload = () => {
        if (!this.textures.exists(textureKey)) this.textures.addImage(textureKey, image);
        applyTexture();
      };
      image.src = imageData;
    }
  }

  getSkillName() {
    return this.spellService.getInnateSpell().name;
  }

  /** 刷新生命、灵气、回合和法盘中央数值。 */
  updateBattleUi() {
    this.battleHud?.update({
      round: this.combat.round,
      battleOver: this.combat.battleOver,
      turn: this.combat.turn,
      playerHp: gameState.player.hp,
      playerMaxHp: gameState.player.maxHp,
      playerQi: gameState.player.qi,
      playerMaxQi: gameState.player.maxQi,
      enemyHp: this.enemy.hp,
      enemyMaxHp: this.enemy.maxHp,
      enemyQi: this.enemy.qi,
      enemyMaxQi: this.enemy.maxQi,
    });
  }

  /** Pixso 日志栏中的“结束”按钮只处理已经结束的战斗，不改变回合规则。 */
  handleEndButton() {
    if (this.victoryDialog?.isOpen) this.continueAfterVictory();
    else if (this.defeatDialog?.isOpen) this.returnAfterDefeat();
    else this.setLog("战斗尚未结束，请先完成本场战斗。", "#87642d");
  }

  /**
   * 战斗测试需要可随时退出；普通地图怪物也允许退出，但不会获得掉落或标记为击败。
   * 奇异玉光测试返回时恢复状态，玩家可立刻重新进入下一场测试。
   */
  returnToVillage() {
    // 双击按钮或同时点到按钮和透明范围时，只处理一次场景切换。
    if (this.isReturningToVillage) return;
    this.isReturningToVillage = true;
    // 战败后不能把 0 点生命保存到地图；离开战败界面时与重新挑战一样先恢复状态。
    if (this.isTestBattle || this.combat?.winner === "enemy") {
      this.combat.restorePlayer();
    }
    // 保存离开战斗时的角色状态与地图坐标，刷新网页后仍会回到战斗前的位置。
    saveFirstChapterProgress();
    clearSceneResumeRoute();
    this.scene.start(SceneKeys.VILLAGE);
  }

  useSkill() {
    const prepared = this.combat.preparePlayerSkill({ name: this.getSkillName(), qiCost: 8, damageBonus: 8 });
    if (!prepared.ok) return this.setLog(prepared.message, "#b84c3e");
    this.updateBattleUi();
    this.playSkillAnimation(() => {
      const result = this.combat.resolvePlayerAction(prepared.action);
      this.setLog(`${gameState.player.name}施放${this.getSkillName()}，造成 ${result.damage} 点伤害！`, "#b84c3e");
      this.queueVictoryAfterImpact(result);
    });
  }

  normalAttack() {
    const prepared = this.combat.preparePlayerNormalAttack();
    if (!prepared.ok) return;
    this.updateBattleUi();
    this.playNormalAttackAnimation(() => {
      const result = this.combat.resolvePlayerAction(prepared.action);
      this.setLog(`${gameState.player.name}使用基础武器攻击，造成 ${result.damage} 点伤害。`);
      this.queueVictoryAfterImpact(result);
    });
  }

  defend() {
    const prepared = this.combat.preparePlayerDefend({ qiRecovery: 5 });
    if (!prepared.ok) return;
    this.setLog("你选择防御：本回合减伤，并恢复 5 点灵气。", "#3c7666");
    this.updateBattleUi();
    this.afterPlayerAction();
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
    this.updateBattleUi();
    if (this.combat.winner === "player") return this.winBattle();
    this.time.delayedCall(700, () => this.enemyTurn());
  }

  /**
   * 致命伤害发生时立刻进入胜利结算，不再依赖攻击动画最后一帧或场景计时器。
   * 动画正常结束时 afterPlayerAction 仍会调用 winBattle，内部防重复标记会保证只结算一次。
   */
  queueVictoryAfterImpact(result) {
    if (!result?.defeated || this.combat.winner !== "player") return;
    this.winBattle();
  }

  enemyTurn() {
    const prepared = this.combat.prepareEnemyAction();
    if (!prepared.ok) return;
    const { action } = prepared;
    const skill = action.skill;
    this.updateBattleUi();
    const onImpact = () => {
      const result = this.combat.resolveEnemyAction(action);
      this.playEnemySound();
      this.setLog(`${this.enemy.name}${skill ? `施展${skill.name}` : "发起攻击"}，造成 ${result.damage} 点伤害。`, "#b84c3e");
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
    if (this.combat.winner === "enemy") {
      this.setLog("本场战斗失败。请选择重新挑战，或返回青云山休整。", "#b84c3e");
      this.updateBattleUi();
      this.showDefeatDialog();
      return;
    }
    this.combat.finishEnemyTurn();
    this.updateBattleUi();
  }

  /**
   * 战败后的明确出口。
   * 弹窗只负责显示和接收输入；生命、灵气恢复仍调用战斗领域引擎提供的接口。
   */
  showDefeatDialog() {
    if (this.defeatDialog?.isOpen) return;
    const routeHint = this.adventureBattle === "qingyun-mist-guardian"
      ? "返回青云山后，任务仍停留在“击败雾隐山魈”。"
      : "返回青云山后，之后仍可再次进入战斗。";

    this.defeatDialog = new XianxiaDialog(this).open({
      title: "战斗失败",
      subtitle: `气血耗尽 · ${this.enemy.name}仍未被击败`,
      body: `你在本场战斗中力竭。\n\n重新挑战会恢复全部生命与灵气。\n${routeHint}`,
      width: 760,
      height: 430,
      bodyY: -20,
      bodySize: 21,
      buttonGroupY: 120,
      noticeY: 186,
      notice: "快捷键 R：重新挑战",
      closable: false,
      depth: 2500,
      buttons: [
        {
          label: "重新挑战",
          variant: "primary",
          x: -158,
          y: 120,
          width: 270,
          height: 54,
          onClick: () => this.retryBattle(),
        },
        {
          label: "返回青云山",
          variant: "secondary",
          x: 158,
          y: 120,
          width: 270,
          height: 54,
          onClick: () => this.returnAfterDefeat(),
        },
      ],
      onClose: () => {
        this.defeatDialog = null;
      },
    });

    // 保留原有键盘操作，但不再要求玩家必须知道这个隐藏快捷键。
    this.input.keyboard.once("keydown-R", () => this.retryBattle());
  }

  /** 恢复战斗前的完整状态，并重新建立同一场战斗。 */
  retryBattle() {
    if (this.combat?.winner !== "enemy" || this.isResolvingDefeat) return;
    this.isResolvingDefeat = true;
    this.defeatDialog?.close({ immediate: true });
    this.combat.restorePlayer();
    this.scene.restart(this.battleResumeData);
  }

  /** 恢复角色状态后返回地图，避免把 0 点生命写进存档。 */
  returnAfterDefeat() {
    if (this.combat?.winner !== "enemy" || this.isResolvingDefeat) return;
    this.isResolvingDefeat = true;
    this.defeatDialog?.close({ immediate: true });
    this.returnToVillage();
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
    // 动画回调或连续输入都不能重复结算同一场胜利。
    if (this.isVictoryResolved) return;
    this.isVictoryResolved = true;
    // 胜利结算已经开始，之后刷新应回到正常流程，不能再次重建并重复结算同一场战斗。
    clearSceneResumeRoute();

    try {
      this.resolveVictory();
    } catch (error) {
      // 旧存档或奖励数据异常也不能把玩家留在“战斗结束”的死画面。
      console.error("战斗胜利结算失败：", error);
      this.setLog(`${this.enemy.name}已被击败，但奖励结算出现异常。`, "#b84c3e");
      this.updateBattleUi();
      this.showVictoryDialog({
        body: `${this.enemy.name}已被击败。\n\n奖励结算出现异常，但你仍可安全返回青云山。`,
        destination: SceneKeys.VILLAGE,
        buttonLabel: "返回青云山",
        notice: "战斗已经结束，请稍后检查本场奖励",
      });
    }
  }

  /** 根据战斗来源推进任务、发放奖励，并装配对应的胜利弹窗内容。 */
  resolveVictory() {
    // 测试战斗只验证战斗配置，不产生奖励、任务进度或永久生命损失。
    if (this.isTestBattle) {
      this.combat.restorePlayer();
      this.setLog(`${this.enemy.name}被击败；测试战斗不结算奖励。`, "#87642d");
      this.updateBattleUi();
      this.showVictoryDialog({
        body: `${this.enemy.name}已被击败。\n\n本场为测试战斗，不结算奖励。`,
        destination: SceneKeys.VILLAGE,
        buttonLabel: "返回青云山",
        notice: "角色生命与灵气已恢复",
      });
      return;
    }

    // 第一章岔路的风险路线：胜利先由章节领域确认，奖励再通过既有结算服务入账。
    // 使用稳定怪物 ID，刷新或重复进入战斗也不会重复给星萤果与灵石。
    if (this.adventureBattle === "qingyun-mist-guardian") {
      const questService = new ChapterQuestService({
        chapter: gameState.chapter,
        player: gameState.player,
        save: saveFirstChapterProgress,
      });
      const progress = questService.advanceQuest(
        QINGYUN_INVESTIGATION_ID,
        QUEST_EVENTS.MIST_GUARDIAN_DEFEATED,
      );
      const result = progress.ok
        ? this.rewardService.settleVictory({
          monsterId: "chapter-1-mist-guardian",
          rewards: ["灵石 × 12", "星萤果 × 1"],
        })
        : { rewardText: "主线进度未改变" };
      const rewardText = result.rewardText || result.message;
      this.setLog(`雾隐山魈消散，异光重现。获得：${rewardText}。`, "#87642d");
      this.updateBattleUi();
      this.showVictoryDialog({
        body: `雾隐山魈消散，异光重现。\n\n获得：${rewardText}`,
        destination: SceneKeys.VILLAGE,
        buttonLabel: "返回青云山",
      });
      return;
    }

    if (this.mapMonster) {
      const result = this.rewardService.settleVictory({
        monsterId: this.mapMonster.id,
        rewards: this.mapMonster.drops?.length ? this.mapMonster.drops : DEFAULT_MONSTER_REWARDS,
      });
      const rewardText = result.rewardText || result.message;
      this.setLog(`${this.enemy.name}被击败，实际获得：${rewardText}。`, "#87642d");
      this.updateBattleUi();
      this.showVictoryDialog({
        body: `${this.enemy.name}已被击败。\n\n实际获得：${rewardText}`,
        destination: SceneKeys.VILLAGE,
        buttonLabel: "返回青云山",
      });
      return;
    }
    const result = this.rewardService.settleVictory({ rewards: CHAPTER_ELITE_REWARDS, chapterElite: true });
    const rewardText = result.rewardText || result.message;
    this.setLog(`劫修倒下，实际获得：${rewardText}。`, "#87642d");
    this.updateBattleUi();
    this.showVictoryDialog({
      body: `劫修倒下，此战告捷。\n\n实际获得：${rewardText}`,
      destination: SceneKeys.RESULT,
      buttonLabel: "查看结算",
    });
  }

  /** 显示统一胜利结算界面；奖励已由调用它之前的领域服务完成入账。 */
  showVictoryDialog({ body, destination, buttonLabel, notice = "战斗奖励已自动放入储物袋" }) {
    if (this.victoryDialog?.isOpen) return;
    this.victoryDestination = destination;
    const paragraphs = String(body || "")
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    const summary = paragraphs.shift() || `${this.enemy.name}已被击败`;
    const message = paragraphs.join("\n\n");
    this.victoryDialog = new BattleResultDialog(this).open({
      title: "战斗胜利",
      summary,
      message,
      buttonLabel,
      notice: `${notice} · Enter 确认`,
      depth: 2500,
      onConfirm: () => this.continueAfterVictory(),
      onClose: () => {
        this.victoryDialog = null;
      },
    });
    this.input.keyboard.once("keydown-ENTER", () => this.continueAfterVictory());
  }

  /** 关闭胜利弹窗并前往当前战斗类型原本的目标页面。 */
  continueAfterVictory() {
    if (this.combat?.winner !== "player" || this.isLeavingVictory) return;
    this.isLeavingVictory = true;
    const destination = this.victoryDestination || SceneKeys.VILLAGE;
    this.victoryDialog?.close({ immediate: true });
    clearSceneResumeRoute();
    this.scene.start(destination);
  }

  setLog(text, color = "#553d36") { this.battleHud?.setLog(text, color); }
}

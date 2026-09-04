import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { getMapDefinition } from "../core/MapCatalog.js";
import { getMapObjects, getMapRegions } from "../core/MapContentStore.js";
import { getMonsterTemplate } from "../core/MonsterStore.js";
import { getMonsterAppearanceTextureKey, resolveMonsterAppearance } from "../core/MonsterAppearance.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { rememberSceneRoute } from "../core/SceneResumeState.js";
import { DungeonRunService } from "../domain/world/DungeonRunService.js";
import { DungeonMonsterAiService } from "../domain/world/DungeonMonsterAiService.js";
import { MapNavigationService } from "../domain/world/MapNavigationService.js";
import { MonsterCaveHud } from "../ui/cave/MonsterCaveHud.js";
import { addText } from "../utils/UiHelpers.js";

const CAVE_ID = "monster-cave-1";
const DEFAULT_SPAWN = Object.freeze({ x: 960, y: 900 });
const PLAYER_BOUNDS = Object.freeze({ left: 95, right: 1825, top: 135, bottom: 965 });
const CLEAR_REWARD_LABEL = "灵石 × 30 · 修炼经验 +40";

/** 第一座可反复探索的怪物洞穴。 */
export class MonsterCaveScene extends Phaser.Scene {
  constructor() { super(SceneKeys.MONSTER_CAVE); }

  init(data = {}) {
    this.dungeonId = data.dungeonId === CAVE_ID ? data.dungeonId : CAVE_ID;
  }

  preload() {
    const map = getMapDefinition(this.dungeonId);
    this.load.image("monster-cave-floor-1", map.backgroundPath);
    this.load.spritesheet("player-idle-5dir", "./public/assets/images/characters/player-idle-5dir.png", {
      frameWidth: 256, frameHeight: 256,
    });
    this.load.spritesheet("player-walk-5dir", "./public/assets/images/characters/player-walk-5dir.png", {
      frameWidth: 256, frameHeight: 256,
    });
    getMapObjects(this.dungeonId).filter((object) => object.type === "monster").forEach((object) => {
      const template = getMonsterTemplate(object.monsterTemplateId);
      const appearance = resolveMonsterAppearance(template);
      if (!template || !appearance.staticImageData) return;
      this.load.image(getMonsterAppearanceTextureKey(template, "cave-monster"), appearance.staticImageData);
    });
  }

  create() {
    // Phaser 会复用 Scene 实例；从战斗返回时必须清掉上一次切场留下的锁。
    this.isLeaving = false;
    configureFullHdScene(this);
    this.cameras.main.setBackgroundColor("#10191a");
    const map = getMapDefinition(this.dungeonId);
    this.add.image(0, 0, "monster-cave-floor-1")
      .setOrigin(0)
      .setDisplaySize(map.worldWidth, map.worldHeight)
      .setDepth(-20);
    // 加一层很轻的冷色罩，使角色和怪物在复杂洞穴背景上更清楚。
    this.add.rectangle(0, 0, map.worldWidth, map.worldHeight, 0x081416, 0.11).setOrigin(0).setDepth(-19);

    this.runService = new DungeonRunService({ world: gameState.world, save: saveFirstChapterProgress });
    this.monsterAiService = new DungeonMonsterAiService();
    this.mapRegions = getMapRegions(this.dungeonId);
    this.navigationService = new MapNavigationService({ regions: this.mapRegions, bounds: PLAYER_BOUNDS });
    const runResult = this.runService.resumeRun(this.dungeonId, DEFAULT_SPAWN);
    this.run = runResult.run;
    rememberSceneRoute({ sceneKey: SceneKeys.MONSTER_CAVE, saveSlot: gameState.activeSaveSlot });

    this.createPlayerAnimations();
    this.createPlayer(this.run.playerPosition);
    this.renderCaveObjects();
    this.hud = new MonsterCaveHud(this, { onExit: () => this.exitCave() }).create({
      player: gameState.player,
      runNumber: this.run.runNumber,
      remaining: this.monsterActors.size,
      total: this.totalMonsters,
      clearRewardLabel: CLEAR_REWARD_LABEL,
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,E,ESC");
    this.input.keyboard.resetKeys();
    this.input.on("pointerdown", (pointer, overObjects) => {
      if (this.isLeaving || overObjects?.some((object) => object.input)) return;
      if (pointer.y < 130 || pointer.y > 985) return;
      const destination = this.navigationService.findNearestWalkable({ x: pointer.worldX, y: pointer.worldY });
      if (!this.navigationService.isWalkable(destination)) {
        this.hud.setHint("那里无法通行，请点击洞穴道路。", "#ffc067");
        return;
      }
      this.target = new Phaser.Math.Vector2(destination.x, destination.y);
    });
    this.positionPersistElapsed = 0;
    this.nearbyActor = null;
  }

  createPlayer(position) {
    const saved = {
      x: Phaser.Math.Clamp(Number(position?.x) || DEFAULT_SPAWN.x, PLAYER_BOUNDS.left, PLAYER_BOUNDS.right),
      y: Phaser.Math.Clamp(Number(position?.y) || DEFAULT_SPAWN.y, PLAYER_BOUNDS.top, PLAYER_BOUNDS.bottom),
    };
    const safePosition = this.navigationService.findNearestWalkable(saved, 1200);
    const x = safePosition.x;
    const y = safePosition.y;
    this.playerShadow = this.add.ellipse(x, y + 18, 76, 23, 0x05090a, 0.5).setDepth(19 + y / 10000);
    this.player = this.add.sprite(x, y, "player-idle-5dir", 4)
      .setOrigin(0.5, 0.86).setScale(0.48).setDepth(20 + y / 10000);
    this.playerName = addText(this, x, y - 150, gameState.player.name, 16, "#fff3d0", {
      origin: 0.5, strokeThickness: 3,
    }).setDepth(21 + y / 10000);
    this.playerDirection = { row: 4, flipX: false };
    this.player.play("player-idle-row-4");
    this.target = null;
  }

  createPlayerAnimations() {
    for (let row = 0; row < 5; row += 1) {
      const walkKey = `player-walk-row-${row}`;
      const idleKey = `player-idle-row-${row}`;
      if (!this.anims.exists(walkKey)) this.anims.create({
        key: walkKey,
        frames: this.anims.generateFrameNumbers("player-walk-5dir", { start: row * 8, end: row * 8 + 7 }),
        frameRate: 10,
        repeat: -1,
      });
      if (!this.anims.exists(idleKey)) this.anims.create({
        key: idleKey,
        frames: [{ key: "player-idle-5dir", frame: row }],
        frameRate: 1,
        repeat: -1,
      });
    }
  }

  renderCaveObjects() {
    const objects = getMapObjects(this.dungeonId);
    const defeated = new Set(this.run.defeatedSpawnIds);
    this.monsterActors = new Map();
    this.totalMonsters = objects.filter((object) => object.type === "monster").length;
    objects.forEach((object) => {
      if (object.type === "monster" && !defeated.has(object.id)) this.createMonsterActor(object);
      if (object.type === "portal") this.createExitPortal(object);
    });
  }

  createMonsterActor(object) {
    const template = getMonsterTemplate(object.monsterTemplateId);
    if (!template) return;
    const scale = Number(object.scale) || 1;
    const safeSpawn = this.navigationService.findNearestWalkable({ x: object.x, y: object.y }, 1200);
    const container = this.add.container(safeSpawn.x, safeSpawn.y).setDepth(14 + safeSpawn.y / 10000);
    const auraColor = template.id === "monster-stone-spirit" ? 0x59d7df : 0x8fc98c;
    const aura = this.add.circle(0, -2, 54 * scale, auraColor, 0.11).setStrokeStyle(2, auraColor, 0.75);
    const shadow = this.add.ellipse(0, 23 * scale, 86 * scale, 26 * scale, 0x020707, 0.52);
    const appearance = resolveMonsterAppearance(template);
    let portrait;
    if (appearance.staticImageData) {
      const textureKey = getMonsterAppearanceTextureKey(template, "cave-monster");
      portrait = this.add.image(0, 18 * scale, textureKey).setOrigin(0.5, 0.86);
      const source = this.textures.get(textureKey).getSourceImage();
      const fit = Math.min(125 / source.width, 145 / source.height) * scale;
      portrait.setDisplaySize(source.width * fit, source.height * fit);
    } else {
      portrait = this.createStoneSpiritDrawing(scale);
    }
    const name = addText(this, 0, -88 * scale, template.name, 17, template.grade === "精英" ? "#ffd06d" : "#e6f2dc", {
      origin: 0.5, strokeThickness: 3,
    });
    const realm = addText(this, 0, -65 * scale, `${template.grade} · ${template.realm}`, 12, "#a8c9c2", {
      origin: 0.5, strokeThickness: 2,
    });
    const alert = addText(this, 0, -122 * scale, "!", 36, "#ffbe55", {
      origin: 0.5, fontFamily: "KaiTi, STKaiti, serif", strokeThickness: 5,
    }).setVisible(false);
    const zone = this.add.zone(0, -10, 135 * scale, 170 * scale).setInteractive({ useHandCursor: true });
    container.add([aura, shadow, portrait, name, realm, alert, zone]);
    const actor = {
      object: { ...object, name: template.name, battle: template, drops: template.drops },
      template,
      container,
      alert,
      aiState: this.monsterAiService.createState({
        spawnId: object.id,
        origin: safeSpawn,
        config: template.ai,
      }),
    };
    zone.on("pointerdown", (_pointer, _x, _y, event) => {
      event?.stopPropagation?.();
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, container.x, container.y);
      if (distance <= 105) this.enterBattle({ ...actor.object, x: container.x, y: container.y }, template);
      else this.target = new Phaser.Math.Vector2(container.x, container.y + 70);
    });
    this.tweens.add({ targets: aura, alpha: { from: 0.45, to: 1 }, duration: 1100, yoyo: true, repeat: -1 });
    this.monsterActors.set(object.id, actor);
  }

  createStoneSpiritDrawing(scale) {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x53666a, 1).lineStyle(4, 0x10191b, 1);
    graphics.fillPoints([
      new Phaser.Geom.Point(-47 * scale, 30 * scale), new Phaser.Geom.Point(-42 * scale, -25 * scale),
      new Phaser.Geom.Point(-20 * scale, -58 * scale), new Phaser.Geom.Point(2 * scale, -70 * scale),
      new Phaser.Geom.Point(34 * scale, -48 * scale), new Phaser.Geom.Point(52 * scale, -8 * scale),
      new Phaser.Geom.Point(44 * scale, 32 * scale), new Phaser.Geom.Point(18 * scale, 48 * scale),
      new Phaser.Geom.Point(-22 * scale, 47 * scale),
    ], true, true);
    graphics.fillStyle(0x738287, 1).lineStyle(3, 0x243437, 1);
    graphics.fillTriangle(-42 * scale, -21 * scale, -18 * scale, -58 * scale, -8 * scale, -12 * scale);
    graphics.fillTriangle(8 * scale, -15 * scale, 31 * scale, -49 * scale, 45 * scale, -6 * scale);
    graphics.fillTriangle(-38 * scale, 23 * scale, -8 * scale, -8 * scale, -3 * scale, 41 * scale);
    graphics.fillTriangle(3 * scale, 39 * scale, 8 * scale, -7 * scale, 40 * scale, 24 * scale);
    graphics.fillStyle(0x35484c, 1).lineStyle(3, 0x152326, 1);
    graphics.fillCircle(0, -23 * scale, 27 * scale);
    graphics.fillStyle(0x65dce2, 1);
    graphics.fillTriangle(-24 * scale, -12 * scale, -9 * scale, -18 * scale, -16 * scale, 1 * scale);
    graphics.fillTriangle(11 * scale, -18 * scale, 27 * scale, -10 * scale, 16 * scale, 1 * scale);
    graphics.fillStyle(0x83e7e5, 0.9);
    graphics.fillTriangle(-30 * scale, -46 * scale, -17 * scale, -82 * scale, -6 * scale, -42 * scale);
    graphics.fillTriangle(20 * scale, -48 * scale, 35 * scale, -78 * scale, 42 * scale, -36 * scale);
    return graphics;
  }

  createExitPortal(object) {
    this.exitPortal = { object };
    const root = this.add.container(object.x, object.y).setDepth(12 + object.y / 10000);
    const glow = this.add.circle(0, 0, 54, 0xe0af55, 0.12).setStrokeStyle(3, 0xe7c16e, 0.8);
    const core = this.add.circle(0, 0, 28, 0x64d5cc, 0.35).setStrokeStyle(2, 0xf0d98d, 0.95);
    const label = addText(this, 0, -74, "洞穴出口", 17, "#f1d58d", { origin: 0.5, strokeThickness: 3 });
    const zone = this.add.zone(0, 0, 130, 130).setInteractive({ useHandCursor: true });
    root.add([glow, core, label, zone]);
    zone.on("pointerdown", (_pointer, _x, _y, event) => {
      event?.stopPropagation?.();
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, object.x, object.y);
      if (distance <= 115) this.exitCave();
      else this.target = new Phaser.Math.Vector2(object.x, object.y - 65);
    });
    this.tweens.add({ targets: core, scale: { from: 0.82, to: 1.12 }, alpha: { from: 0.5, to: 1 }, duration: 850, yoyo: true, repeat: -1 });
  }

  update(_time, delta) {
    if (this.isLeaving || !this.player) return;
    this.positionPersistElapsed += delta;
    if (this.positionPersistElapsed >= 5000) {
      this.positionPersistElapsed = 0;
      this.rememberPosition(true);
    }

    const speed = 215;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;
    let moving = false;
    if (dx || dy) {
      this.target = null;
      const length = Math.hypot(dx, dy) || 1;
      moving = this.movePlayer((dx / length) * speed * delta / 1000, (dy / length) * speed * delta / 1000);
    } else if (this.target) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
      if (distance < 6) this.target = null;
      else {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.target.x, this.target.y);
        moving = this.movePlayer(Math.cos(angle) * speed * delta / 1000, Math.sin(angle) * speed * delta / 1000);
        if (!moving) this.target = null;
      }
    }
    this.updatePlayerAnimation(moving);
    this.updateMonsterActors(delta);
    if (this.isLeaving) return;
    this.updateNearbyInteraction();
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this.exitCave();
  }

  movePlayer(dx, dy) {
    const movement = this.navigationService.resolveMovement(
      { x: this.player.x, y: this.player.y },
      { x: this.player.x + dx, y: this.player.y + dy },
    );
    if (!movement.moved) return false;
    this.player.setPosition(movement.position.x, movement.position.y);
    this.updatePlayerDirection(dx, dy);
    const depth = 20 + this.player.y / 10000;
    this.player.setDepth(depth);
    this.playerShadow.setPosition(this.player.x, this.player.y + 18).setDepth(depth - 0.01);
    this.playerName.setPosition(this.player.x, this.player.y - 150).setDepth(depth + 0.01);
    this.rememberPosition(false);
    return true;
  }

  updatePlayerDirection(dx, dy) {
    const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    let row = 0;
    let flipX = false;
    if (angle >= 67.5 && angle < 112.5) row = 0;
    else if (angle >= 22.5 && angle < 67.5) { row = 1; flipX = true; }
    else if (angle >= 112.5 && angle < 157.5) row = 1;
    else if (angle >= -22.5 && angle < 22.5) { row = 2; flipX = true; }
    else if (angle >= 157.5 || angle < -157.5) row = 2;
    else if (angle >= -67.5 && angle < -22.5) { row = 3; flipX = true; }
    else if (angle >= -157.5 && angle < -112.5) row = 3;
    else row = 4;
    this.playerDirection = { row, flipX };
  }

  updatePlayerAnimation(moving) {
    const key = `${moving ? "player-walk" : "player-idle"}-row-${this.playerDirection.row}`;
    if (this.player.anims.currentAnim?.key !== key || !this.player.anims.isPlaying) this.player.play(key);
    this.player.setFlipX(this.playerDirection.flipX);
  }

  /** 领域服务决定妖兽状态与下一坐标；场景只同步显示对象并在接触时切入战斗。 */
  updateMonsterActors(delta) {
    this.monsterActors.forEach((actor) => {
      const result = this.monsterAiService.update({
        state: actor.aiState,
        position: { x: actor.container.x, y: actor.container.y },
        playerPosition: { x: this.player.x, y: this.player.y },
        deltaMs: delta,
      });
      if (!result.ok) return;
      const movement = this.navigationService.resolveMovement(
        { x: actor.container.x, y: actor.container.y },
        result.position,
      );
      actor.aiState = movement.blocked && !movement.moved && result.state.mode === "patrol"
        ? { ...result.state, mode: "idle", waitMs: 350, target: { x: actor.container.x, y: actor.container.y } }
        : result.state;
      actor.container
        .setPosition(movement.position.x, movement.position.y)
        .setDepth(14 + movement.position.y / 10000);
      actor.alert.setVisible(result.state.mode === "chase");
      const canReachPlayer = this.navigationService.canTraverse(
        movement.position,
        { x: this.player.x, y: this.player.y },
      );
      if (result.engage && canReachPlayer) {
        this.enterBattle({ ...actor.object, x: movement.position.x, y: movement.position.y }, actor.template);
      }
    });
  }

  updateNearbyInteraction() {
    let nearest = null;
    let nearestDistance = 260;
    this.monsterActors.forEach((actor) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, actor.container.x, actor.container.y);
      if (distance < nearestDistance) { nearest = actor; nearestDistance = distance; }
    });
    const exitDistance = this.exitPortal
      ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitPortal.object.x, this.exitPortal.object.y)
      : Infinity;
    if (exitDistance < nearestDistance) {
      this.nearbyActor = null;
      this.hud.setHint(exitDistance <= 115 ? "按 E 返回青云山（再次进入会刷新全部妖兽）" : "前方是洞穴出口");
      if (exitDistance <= 115 && Phaser.Input.Keyboard.JustDown(this.keys.E)) this.exitCave();
      return;
    }
    this.nearbyActor = nearest;
    if (nearest) {
      const canFight = nearestDistance <= 105;
      if (nearest.aiState.mode === "chase") {
        this.hud.setHint(canFight
          ? `${nearest.template.name}已逼近！接触后自动开战，按 E 可立即迎战`
          : `被${nearest.template.name}发现！拉开距离或准备战斗`, "#ffc067");
      } else {
        this.hud.setHint(canFight ? `按 E 挑战 ${nearest.template.name}` : `发现 ${nearest.template.name}，继续靠近即可挑战`);
      }
      if (canFight && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
        this.enterBattle({ ...nearest.object, x: nearest.container.x, y: nearest.container.y }, nearest.template);
      }
    } else if (this.monsterActors.size === 0) {
      this.hud.setHint("本轮妖兽已全部清剿，可以从下方出口离开", "#f1ca75");
    } else {
      this.hud.setHint("WASD / 方向键移动 · 点击地面自动前往");
    }
  }

  rememberPosition(persist) {
    if (!this.player || !this.runService) return;
    this.runService.recordPosition(this.dungeonId, { x: this.player.x, y: this.player.y }, { persist });
  }

  enterBattle(object, template) {
    if (this.isLeaving) return;
    this.isLeaving = true;
    this.rememberPosition(true);
    this.scene.start(SceneKeys.BATTLE, {
      mapId: this.dungeonId,
      mapMonster: { ...object, name: template.name, battle: template, drops: template.drops },
      returnSceneKey: SceneKeys.MONSTER_CAVE,
      dungeonId: this.dungeonId,
      dungeonRunNumber: this.run.runNumber,
      dungeonSpawnId: object.id,
    });
  }

  exitCave() {
    if (this.isLeaving) return;
    this.isLeaving = true;
    this.runService.leaveRun(this.dungeonId, { x: this.player.x, y: this.player.y });
    this.scene.start(SceneKeys.VILLAGE);
  }
}

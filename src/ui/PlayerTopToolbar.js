import { gameState } from "../core/GameState.js";
import { getPlayerPortrait } from "../core/PortraitCatalog.js";
import { getCultivationProgress } from "../domain/character/CharacterProfileService.js";
import { addText } from "../utils/UiHelpers.js";

const PIXSO_UI_PATH = "./public/assets/images/ui/pixso-chapter-map";

/**
 * 预加载角色顶栏共用素材。
 * 大地图、门派内部等场景都调用这一处，避免同一套图标在不同场景使用不同路径。
 */
export function preloadPlayerTopToolbarAssets(scene) {
  scene.load.image("pixso-ui-store", `${PIXSO_UI_PATH}/0194d4d1ee34c44b6a04712c9f468fa9982d0290.png`);
  scene.load.image("pixso-ui-settings", `${PIXSO_UI_PATH}/0e70e010a1c8c666f042837d2de57d9feae7a301.png`);
  scene.load.image("pixso-ui-gongfa", `${PIXSO_UI_PATH}/54732a7e111d65ebb274da026c2ce3ad132c3ade.png`);
  scene.load.image("pixso-ui-artifact", `${PIXSO_UI_PATH}/894c57b186cfffcff537eced68f536e5c7591e92.png`);
  scene.load.image("pixso-ui-spell", `${PIXSO_UI_PATH}/c9427f9152ab80ec524392a3d337d95ecc751bdb.png`);
  scene.load.image("pixso-ui-save", `${PIXSO_UI_PATH}/e2f4c5f9c8119a7ab11969c3487683b7f5f820d1.png`);
  scene.load.image("pixso-ui-brush", `${PIXSO_UI_PATH}/ce7168bd479ed095592186e3fa86566b2c5bebb0.png`);
  scene.load.image("chapter-hud-profile-brush", "./public/assets/images/ui/chapter-map/profile-brush.png");
  scene.load.image("chapter-hud-profile-avatar", "./public/assets/images/ui/chapter-map/profile-avatar.png");
}

/**
 * 大地图与独立玩法场景共用的角色状态栏和六功能入口。
 * 组件只处理绘制与输入反馈；每个场景通过 actions 注入实际入口行为。
 */
export class PlayerTopToolbar {
  constructor(scene, { actions = {}, depth = 900 } = {}) {
    this.scene = scene;
    this.actions = actions;
    this.depth = depth;
    this.statusBarFills = {};
    this.statusRatios = {};
  }

  fixed(display, extraDepth = 0) {
    return display.setScrollFactor(0).setDepth(this.depth + extraDepth);
  }

  create() {
    this.drawPlayerStatus();
    this.drawFeatureEntries();
    return this;
  }

  /** 刷新生命、修为数值和填充长度，供物品使用或数值变化后调用。 */
  refreshPlayerStatus() {
    const updateBar = (key, value, maxValue, textObject) => {
      const ratio = Phaser.Math.Clamp((Number(value) || 0) / Math.max(1, Number(maxValue) || 1), 0, 1);
      const fill = this.statusBarFills[key];
      // 填充图始终按完整宽度创建，因此即使初始修为为 0，后续获得修为时也能正常增长。
      if (fill) fill.setScale(ratio, 1);
      this.statusRatios[key] = ratio;
      textObject?.setText(`${value}/${maxValue}`);
    };
    const cultivation = getCultivationProgress(gameState.player);
    updateBar("hp", gameState.player.hp, gameState.player.maxHp, this.hpValueText);
    updateBar("cultivation", cultivation.experience, cultivation.target, this.cultivationValueText);
  }

  drawPlayerStatus() {
    const scene = this.scene;
    const avatarCenterX = 82;
    const avatarCenterY = 85;
    const avatarSize = 115;

    this.fixed(scene.add.circle(avatarCenterX, avatarCenterY, avatarSize / 2, 0xd1c5af));
    const playerAvatar = this.fixed(scene.add.image(avatarCenterX, avatarCenterY, this.createPlayerAvatarTexture())
      .setOrigin(0.5)
      .setDisplaySize(avatarSize, avatarSize));
    const avatarMaskGraphic = this.fixed(scene.add.graphics());
    avatarMaskGraphic.fillStyle(0xffffff, 1);
    avatarMaskGraphic.fillCircle(avatarCenterX, avatarCenterY, avatarSize / 2);
    playerAvatar.setMask(avatarMaskGraphic.createGeometryMask());
    avatarMaskGraphic.setVisible(false);

    this.fixed(scene.add.image(18, 20, "chapter-hud-profile-brush")
      .setOrigin(0)
      .setDisplaySize(442, 133));
    const playerNameText = this.fixed(addText(scene, 145, 44, gameState.player.name, 20, "#ffffff", { strokeThickness: 4 }));
    this.fixed(addText(scene, playerNameText.x + playerNameText.width + 6, 49, gameState.player.realm.replace("炼气", "炼气·"), 16, "#d8caae", { strokeThickness: 3 }));
    this.fixed(addText(scene, 145, 79, "生命:", 16, "#f4ead8", { strokeThickness: 3 }));

    const barX = 195;
    const barWidth = 223;
    const barHeight = 22;
    const drawRoundedBar = (barY, ratio, fillStartColor, fillEndColor, borderColor) => {
      const background = this.fixed(scene.add.graphics());
      background.fillStyle(0x101010, 0.98);
      background.fillRoundedRect(barX, barY - barHeight / 2, barWidth, barHeight, barHeight / 2);
      background.lineStyle(1, borderColor, 1);
      background.strokeRoundedRect(barX, barY - barHeight / 2, barWidth, barHeight, barHeight / 2);

      const textureKey = `player-top-toolbar-gradient-${barY}`;
      if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
      const canvas = document.createElement("canvas");
      // 使用完整宽度生成渐变，再通过 scaleX 表示进度；这样 0 进度也保留可刷新的填充对象。
      canvas.width = Math.max(2, Math.round(barWidth - 4));
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
      return this.fixed(scene.add.image(barX + 2, barY, textureKey)
        .setOrigin(0, 0.5)
        .setScale(Phaser.Math.Clamp(ratio, 0, 1), 1));
    };

    const hpBarY = 92;
    const hpRatio = gameState.player.hp / gameState.player.maxHp;
    this.statusBarFills.hp = drawRoundedBar(hpBarY, hpRatio, 0xb71c08, 0xf45235, 0x613a30);
    this.statusRatios.hp = hpRatio;
    this.hpValueText = this.fixed(addText(scene, barX + barWidth / 2, hpBarY, `${gameState.player.hp}/${gameState.player.maxHp}`, 16, "#ffffff", { strokeThickness: 3 }), 10)
      .setOrigin(0.5);

    this.fixed(addText(scene, 145, 105, "修为:", 16, "#f4ead8", { strokeThickness: 3 }));
    // 修为是角色成长经验，和战斗中施法消耗的灵气（qi / maxQi）不是同一种数值。
    // 这里复用角色领域服务的统一读取规则，确保地图顶栏和属性页永远显示同一进度。
    const cultivationBarY = 117;
    const cultivation = getCultivationProgress(gameState.player);
    const cultivationRatio = cultivation.experience / cultivation.target;
    this.statusBarFills.cultivation = drawRoundedBar(cultivationBarY, cultivationRatio, 0x164f83, 0x4aa9ef, 0x343439);
    this.statusRatios.cultivation = cultivationRatio;
    this.cultivationValueText = this.fixed(addText(scene, barX + barWidth / 2, cultivationBarY, `${cultivation.experience}/${cultivation.target}`, 16, "#ffffff", { strokeThickness: 3 }), 10)
      .setOrigin(0.5);
  }

  drawFeatureEntries() {
    const scene = this.scene;
    const entries = [
      ["storage", "pixso-ui-store", "储物袋"],
      ["spells", "pixso-ui-spell", "法术"],
      ["techniques", "pixso-ui-gongfa", "功法"],
      ["artifacts", "pixso-ui-artifact", "法宝"],
      ["save", "pixso-ui-save", "存档"],
      ["settings", "pixso-ui-settings", "设置"],
    ];
    const iconXs = [537, 690, 849, 1002, 1158, 1313];
    entries.forEach(([id, textureKey, label], index) => {
      const x = iconXs[index];
      this.fixed(scene.add.image(x, 77, "pixso-ui-brush").setDisplaySize(111, 111));
      const icon = this.fixed(scene.add.image(x, 77, textureKey).setDisplaySize(100, 100));
      const action = this.actions[id];
      if (typeof action === "function") {
        icon.setInteractive({ useHandCursor: true });
        icon.on("pointerdown", (_pointer, _localX, _localY, event) => {
          if (scene.characterMenu?.visible) return;
          event?.stopPropagation?.();
          action();
        });
      }
      this.fixed(addText(scene, x, 138, label, 23, "#fff6dd", { strokeThickness: 5 }))
        .setOrigin(0.5);

      const normalScaleX = icon.scaleX;
      const normalScaleY = icon.scaleY;
      icon.on("pointerover", () => {
        scene.tweens.killTweensOf(icon);
        scene.tweens.add({ targets: icon, scaleX: normalScaleX * 1.08, scaleY: normalScaleY * 1.08, duration: 180, ease: "Sine.easeOut" });
      });
      icon.on("pointerout", () => {
        scene.tweens.killTweensOf(icon);
        scene.tweens.add({ targets: icon, scaleX: normalScaleX, scaleY: normalScaleY, duration: 180, ease: "Sine.easeInOut" });
      });
    });
  }

  /** 从完整人物立绘的顶部中央裁出大头照，不写入角色存档。 */
  createPlayerAvatarTexture() {
    const scene = this.scene;
    const selectedPortrait = getPlayerPortrait(gameState.player.portraitId);
    const sourceTexture = scene.textures.exists(selectedPortrait.textureKey)
      ? scene.textures.get(selectedPortrait.textureKey)
      : scene.textures.get("chapter-hud-profile-avatar");
    const source = sourceTexture.getSourceImage();
    const key = "player-top-toolbar-avatar-cropped";
    if (scene.textures.exists(key)) scene.textures.remove(key);

    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    const cropSize = Math.min(source.width * 0.82, source.height * 0.72);
    const cropX = Math.max(0, (source.width - cropSize) / 2);
    const cropY = Math.max(0, source.height * 0.04);
    context.drawImage(source, cropX, cropY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
    scene.textures.addCanvas(key, canvas);
    return key;
  }
}

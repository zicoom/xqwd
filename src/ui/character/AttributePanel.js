import { addText } from "../../utils/UiHelpers.js";

const ROOT_COLORS = Object.freeze({
  金: 0xb69b52, 木: 0x5f9a62, 水: 0x4d93ab, 火: 0xb15d42, 土: 0x9b7a45,
});

/** 属性页仅负责展示；数值和配装摘要全部由 CharacterProfileService 提供。 */
export class AttributePanel {
  constructor({ scene, parent, profileService }) {
    this.scene = scene;
    this.parent = parent;
    this.profileService = profileService;
    this.root = null;
  }

  create() {
    const { scene, parent } = this;
    this.root = scene.add.container(0, 0).setVisible(false);
    parent.add(this.root);

    if (scene.textures.exists("player-dialogue-portrait")) {
      // 立绘从导航下方开始，避免遮挡“属性”标签和顶部关闭按钮。
      const portrait = scene.add.image(365, 920, "player-dialogue-portrait").setOrigin(0.5, 1);
      portrait.setDisplaySize(500, 668);
      this.root.add(portrait);
    }

    const cloud = scene.add.graphics();
    cloud.fillStyle(0x113a32, 0.88);
    cloud.fillRoundedRect(675, 182, 1060, 738, 40);
    cloud.lineStyle(2, 0xa89b62, 0.72);
    cloud.strokeRoundedRect(675, 182, 1060, 738, 40);
    cloud.lineStyle(1, 0x6d815d, 0.8);
    cloud.strokeRoundedRect(691, 198, 1028, 706, 30);
    this.root.add(cloud);

    this.content = scene.add.container(0, 0);
    this.root.add(this.content);
  }

  setVisible(visible) {
    if (!this.root) this.create();
    if (visible) this.refresh();
    this.root.setVisible(visible);
  }

  refresh() {
    this.content.removeAll(true);
    const profile = this.profileService.getProfile();
    const { scene, content } = this;
    const text = (x, y, value, size = 20, color = "#f1e5b7", extra = {}) => {
      const node = addText(scene, x, y, value, size, color, { strokeThickness: 0, ...extra });
      content.add(node);
      return node;
    };
    const title = (x, y, value) => text(x, y, `──  ${value}  ──`, 22, "#e7ce86", { origin: 0.5 });
    const stat = (centerX, y, label, value, options = {}) => {
      text(centerX, y, label, options.labelSize || 17, "#c4c99d", { origin: 0.5 });
      text(centerX, y + 29, String(value), options.valueSize || 20, "#fff1c8", { origin: 0.5 });
    };
    const separator = (y) => {
      const graphics = scene.add.graphics();
      graphics.lineStyle(1, 0xa89b62, 0.42);
      graphics.lineBetween(745, y, 1665, y);
      content.add(graphics);
    };

    text(775, 252, profile.identity.name, 38, "#fff1c8");
    const realm = text(1580, 256, profile.identity.realm, 20, "#ffe4a0", { origin: 0.5 });
    const realmBg = scene.add.graphics();
    realmBg.fillStyle(0x294c3d, 0.94);
    realmBg.lineStyle(1, 0xa89b62, 0.9);
    realmBg.fillRoundedRect(1470, 234, 220, 46, 20);
    realmBg.strokeRoundedRect(1470, 234, 220, 46, 20);
    content.addAt(realmBg, Math.max(0, content.getIndex(realm) - 1));

    text(775, 307, `主灵根：${profile.identity.primaryRoots.join("、")}`, 19, "#d7d8a0");
    text(1035, 307, `灵石：${profile.identity.spiritStones}`, 19, "#d7d8a0");
    this.addBar(775, 348, "生命", profile.battle.hp, profile.battle.maxHp, 0xc6403c, content);
    this.addBar(775, 397, "灵气", profile.battle.qi, profile.battle.maxQi, 0x3589bf, content);

    separator(450);
    title(1205, 477, "人物属性");
    stat(835, 505, "攻击", profile.battle.attack);
    stat(1055, 505, "防御", profile.battle.defense);
    stat(1275, 505, "抗性", profile.battle.resistance);
    stat(1495, 505, "修为经验", profile.cultivation.experience);
    text(1205, 571, `抗性类型：${profile.battle.resistanceTypes.length ? profile.battle.resistanceTypes.join("、") : "未获得"}`, 17, "#c4c99d", { origin: 0.5 });
    text(1205, 599, `特殊灵根：${profile.cultivation.specialRoots.map((root) => `${root.element}·${root.state}`).join("　")}`, 16, "#aebd96", { origin: 0.5 });

    separator(632);
    title(1205, 658, "灵根属性");
    profile.cultivation.roots.forEach((root, index) => this.addRoot(840 + index * 180, 730, root, content));

    separator(796);
    title(1205, 821, "当前配装");
    stat(860, 844, "主功法", profile.loadout.mainTechnique, { valueSize: 18 });
    stat(1080, 844, "身法", profile.loadout.speedTechnique, { valueSize: 18 });
    stat(1300, 844, "法术数量", profile.loadout.spellCount);
    stat(1490, 844, "法宝", profile.loadout.artifactCount);
    stat(1635, 844, "临时效果", profile.loadout.activeEffectCount, { labelSize: 15 });
  }

  addBar(x, y, label, current, maximum, color, content) {
    const { scene } = this;
    const width = 600;
    const ratio = Phaser.Math.Clamp(current / maximum, 0, 1);
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x0b1614, 0.92);
    graphics.fillRoundedRect(x + 85, y, width, 18, 9);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(x + 85, y + 3, Math.max(8, (width - 6) * ratio), 12, 6);
    graphics.lineStyle(1, 0xbaaa70, 0.8);
    graphics.strokeRoundedRect(x + 85, y, width, 18, 9);
    content.add(graphics);
    const labelText = addText(scene, x, y - 3, label, 19, "#dcd4ad", { strokeThickness: 0 });
    const valueText = addText(scene, x + 710, y - 3, `${current} / ${maximum}`, 19, "#fff0c2", { strokeThickness: 0 });
    content.add([labelText, valueText]);
  }

  addRoot(x, y, root, content) {
    const { scene } = this;
    const graphics = scene.add.graphics();
    graphics.fillStyle(ROOT_COLORS[root.element] || 0x777777, 0.32);
    graphics.fillCircle(x, y, 52);
    graphics.lineStyle(2, ROOT_COLORS[root.element] || 0x999999, 0.9);
    graphics.strokeCircle(x, y, 52);
    content.add(graphics);
    const element = addText(scene, x, y - 13, root.element, 31, "#fff0c2", { origin: 0.5, strokeThickness: 1 });
    const value = addText(scene, x, y + 19, String(root.value), 18, "#fff0c2", { origin: 0.5, strokeThickness: 0 });
    content.add([element, value]);
  }
}

import { addText } from "../../utils/UiHelpers.js";

// 每一种灵根都有独立的主色与纹样，避免特殊灵根沿用五行颜色而难以辨认。
// 这些配置只负责视觉表现，不参与属性克制、伤害或修炼等领域规则。
const ROOT_THEMES = Object.freeze({
  金: Object.freeze({ color: 0xd8b84e, light: 0xffeaa0, motif: "metal" }),
  木: Object.freeze({ color: 0x58a96d, light: 0xbce6a5, motif: "wood" }),
  水: Object.freeze({ color: 0x3c9fd0, light: 0xb8ecff, motif: "water" }),
  火: Object.freeze({ color: 0xdc6440, light: 0xffc094, motif: "fire" }),
  土: Object.freeze({ color: 0xb58a48, light: 0xecd09a, motif: "earth" }),
  风: Object.freeze({ color: 0x55c8b8, light: 0xb9fff0, motif: "wind" }),
  雷: Object.freeze({ color: 0x8f70de, light: 0xd7c8ff, motif: "thunder" }),
  冰: Object.freeze({ color: 0x72cfe9, light: 0xd8f7ff, motif: "ice" }),
  神: Object.freeze({ color: 0xe2a7c9, light: 0xffe0f3, motif: "divine" }),
  魔: Object.freeze({ color: 0x9654aa, light: 0xe9b9ff, motif: "demonic" }),
});

const DEFAULT_ROOT_THEME = Object.freeze({ color: 0x888888, light: 0xeeeeee, motif: "unknown" });

// 属性页严格使用 1920×1080 效果图坐标。集中管理关键分区，后续微调时无需逐个找魔法数字。
const PANEL = Object.freeze({ x: 813, y: 254, width: 1058, height: 736 });
const CONTENT_LEFT = 882;
const CONTENT_RIGHT = 1803;

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
      const portrait = scene.add.image(430, 1080, "player-dialogue-portrait").setOrigin(0.5, 1);
      // 与储物袋等角色页共用同一立绘规格，保持原始 3:4 比例，不拉伸。
      portrait.setDisplaySize(660, 880);
      this.root.add(portrait);
    }

    const cloud = scene.add.graphics();
    cloud.fillStyle(0x113a32, 0.88);
    cloud.fillRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 40);
    cloud.lineStyle(2, 0xa89b62, 0.72);
    cloud.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 40);
    cloud.lineStyle(1, 0x6d815d, 0.8);
    cloud.strokeRoundedRect(PANEL.x + 16, PANEL.y + 16, PANEL.width - 32, PANEL.height - 32, 30);
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
      // origin 是 Phaser 游戏对象的位置属性，不是 TextStyle 字体样式。
      // 若直接把 origin 塞进 addText 的样式对象，文字仍会从左上角开始绘制，
      // 表面上写了 0.5，实际标题和属性值都不会真正以坐标为中心。
      const { origin, ...textStyle } = extra;
      const node = addText(scene, x, y, value, size, color, { strokeThickness: 0, ...textStyle });
      if (origin !== undefined) node.setOrigin(origin);
      content.add(node);
      return node;
    };
    const title = (x, y, value) => text(x, y, `──  ${value}  ──`, 22, "#e7ce86", { origin: 0.5 });
    const stat = (centerX, y, label, value, options = {}) => {
      text(centerX, y, label, options.labelSize || 17, "#c4c99d", { origin: 0.5 });
      text(centerX, y + 29, String(value), options.valueSize || 20, "#fff1c8", { origin: 0.5 });
    };
    const horizontalSeparator = (y) => {
      const graphics = scene.add.graphics();
      graphics.lineStyle(1, 0xa89b62, 0.42);
      graphics.lineBetween(CONTENT_LEFT, y, CONTENT_RIGHT, y);
      content.add(graphics);
    };
    const verticalSeparator = (x, top, bottom) => {
      const graphics = scene.add.graphics();
      graphics.lineStyle(1, 0xa89b62, 0.42);
      graphics.lineBetween(x, top, x, bottom);
      content.add(graphics);
    };

    text(881, 316, profile.identity.name, 38, "#fff1c8");
    const realmBg = scene.add.graphics();
    realmBg.fillStyle(0x294c3d, 0.94);
    realmBg.lineStyle(1, 0xa89b62, 0.9);
    realmBg.fillRoundedRect(1650, 307, 141, 43, 20);
    realmBg.strokeRoundedRect(1650, 307, 141, 43, 20);
    content.add(realmBg);
    text(1720.5, 328.5, profile.identity.realm, 19, "#ffe4a0", { origin: 0.5 });

    this.addBar(881, 382, "生命", profile.battle.hp, profile.battle.maxHp, 0xc6403c, content);
    // 顶部蓝条表示角色成长所需的修为经验；战斗灵气仍在下方“灵力”属性中单独显示。
    this.addBar(881, 431, "修为", profile.cultivation.experience, profile.cultivation.target, 0x3589bf, content);

    // 效果图中“人物属性”和“当前配装”为左右并列区域，不能再上下堆叠。
    horizontalSeparator(482);
    title(1068, 526, "人物属性");
    title(1530, 526, "当前配装");
    verticalSeparator(1256, 518, 636);

    stat(928, 578, "生命", profile.battle.maxHp);
    stat(1020, 578, "防御", profile.battle.defense);
    stat(1112, 578, "抗性", profile.battle.resistance);
    stat(1204, 578, "灵力", `${profile.battle.qi}/${profile.battle.maxQi}`);

    stat(1354, 578, "主功法", profile.loadout.mainTechnique, { valueSize: 17 });
    stat(1458, 578, "身法", profile.loadout.speedTechnique, { valueSize: 17 });
    stat(1562, 578, "法术数量", profile.loadout.spellCount);
    stat(1666, 578, "法宝", profile.loadout.artifactCount);
    stat(1770, 578, "临时效果", profile.loadout.activeEffectCount, { labelSize: 15 });

    horizontalSeparator(675);
    title(1342, 708, "灵根属性");

    // 五行与五种特殊灵根统一使用两行五列。特殊灵根尚未觉醒时显示 0，
    // 后续领域数据出现真实数值后会自动刷新，不在 UI 中写死玩法规则。
    const allRoots = [...profile.cultivation.roots, ...profile.cultivation.specialRoots];
    const rootXs = [932, 1138, 1343, 1548, 1753];
    allRoots.forEach((root, index) => {
      this.addRoot(rootXs[index % 5], index < 5 ? 786 : 899, root, content);
    });
  }

  addBar(x, y, label, current, maximum, color, content) {
    const { scene } = this;
    const width = 702;
    const ratio = Phaser.Math.Clamp(current / maximum, 0, 1);
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x0b1614, 0.92);
    graphics.fillRoundedRect(x + 58, y, width, 18, 9);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(x + 58, y + 3, Math.max(8, (width - 6) * ratio), 12, 6);
    graphics.lineStyle(1, 0xbaaa70, 0.8);
    graphics.strokeRoundedRect(x + 58, y, width, 18, 9);
    content.add(graphics);
    const labelText = addText(scene, x, y - 3, label, 19, "#dcd4ad", { strokeThickness: 0 });
    const valueText = addText(scene, x + 843, y - 3, `${current} / ${maximum}`, 19, "#fff0c2", { strokeThickness: 0 });
    content.add([labelText, valueText]);
  }

  addRoot(x, y, root, content) {
    const { scene } = this;
    const theme = ROOT_THEMES[root.element] || DEFAULT_ROOT_THEME;
    const graphics = scene.add.graphics();

    // 外层柔光、深色底和双层描边共同组成“元素灵珠”，既保留水墨界面的克制感，
    // 又让十种灵根在扫视时能立刻通过颜色和轮廓区分。
    graphics.fillStyle(theme.color, 0.09);
    graphics.fillCircle(x, y, 58);
    graphics.fillStyle(0x081b18, 0.36);
    graphics.fillCircle(x, y, 51);
    graphics.fillStyle(theme.color, 0.36);
    graphics.fillCircle(x, y, 48);
    graphics.lineStyle(2, theme.color, 0.96);
    graphics.strokeCircle(x, y, 50);
    graphics.lineStyle(1, theme.light, 0.34);
    graphics.strokeCircle(x, y, 42);

    this.drawRootMotif(graphics, theme.motif, x, y, theme.light);

    // 左上角的一点高光用于强化灵珠的通透感，不使用贴图即可保持全屏下的清晰度。
    graphics.fillStyle(theme.light, 0.65);
    graphics.fillCircle(x - 26, y - 28, 3);
    content.add(graphics);
    // 名称和数值都显式以自身中心为锚点，再围绕同一个圆心上下排列。
    // 这样单字、两位数和不同中文字体宽度都不会把文字推向圆圈右侧。
    const element = addText(scene, x, y - 12, root.element, 31, "#fff0c2", { strokeThickness: 1 })
      .setOrigin(0.5);
    const value = addText(scene, x, y + 20, String(root.value), 18, "#fff0c2", { strokeThickness: 0 })
      .setOrigin(0.5);
    content.add([element, value]);
  }

  /**
   * 在灵珠底层绘制与属性相关的简化纹样。
   * 纹样使用 Phaser Graphics 原生线条，不引入额外图片和显存开销。
   */
  drawRootMotif(graphics, motif, x, y, color) {
    graphics.lineStyle(2, color, 0.34);

    switch (motif) {
      case "metal":
        // 金：八方金芒。
        for (let index = 0; index < 8; index += 1) {
          const angle = (Math.PI * 2 * index) / 8;
          graphics.lineBetween(
            x + Math.cos(angle) * 32,
            y + Math.sin(angle) * 32,
            x + Math.cos(angle) * 41,
            y + Math.sin(angle) * 41,
          );
        }
        break;
      case "wood":
        // 木：向上生长的枝干与嫩芽。
        graphics.lineBetween(x, y + 39, x, y - 34);
        graphics.lineBetween(x, y - 10, x - 22, y - 25);
        graphics.lineBetween(x, y + 7, x + 23, y - 8);
        graphics.fillStyle(color, 0.22);
        graphics.fillCircle(x - 24, y - 27, 7);
        graphics.fillCircle(x + 25, y - 10, 7);
        break;
      case "water":
        // 水：三层起伏水纹。
        this.drawWave(graphics, x, y - 23, 28);
        this.drawWave(graphics, x, y, 34);
        this.drawWave(graphics, x, y + 25, 27);
        break;
      case "fire":
        // 火：层叠焰尖。
        graphics.beginPath();
        graphics.moveTo(x - 28, y + 34);
        graphics.lineTo(x - 18, y - 9);
        graphics.lineTo(x - 4, y + 4);
        graphics.lineTo(x + 4, y - 34);
        graphics.lineTo(x + 17, y - 6);
        graphics.lineTo(x + 28, y + 34);
        graphics.strokePath();
        break;
      case "earth":
        // 土：远山和地脉。
        graphics.lineBetween(x - 38, y + 25, x - 14, y - 17);
        graphics.lineBetween(x - 14, y - 17, x, y + 5);
        graphics.lineBetween(x, y + 5, x + 15, y - 27);
        graphics.lineBetween(x + 15, y - 27, x + 39, y + 25);
        graphics.lineBetween(x - 38, y + 29, x + 38, y + 29);
        break;
      case "wind":
        // 风：三道流动风痕。
        this.drawWindLine(graphics, x, y - 24, 32);
        this.drawWindLine(graphics, x - 6, y, 38);
        this.drawWindLine(graphics, x + 4, y + 25, 29);
        break;
      case "thunder":
        // 雷：贯穿灵珠的折线雷纹。
        graphics.beginPath();
        graphics.moveTo(x + 9, y - 39);
        graphics.lineTo(x - 14, y - 5);
        graphics.lineTo(x + 2, y - 5);
        graphics.lineTo(x - 12, y + 38);
        graphics.lineTo(x + 24, y - 12);
        graphics.lineTo(x + 7, y - 12);
        graphics.closePath();
        graphics.strokePath();
        break;
      case "ice":
        // 冰：六向冰晶。
        for (let index = 0; index < 3; index += 1) {
          const angle = (Math.PI * index) / 3;
          const dx = Math.cos(angle) * 37;
          const dy = Math.sin(angle) * 37;
          graphics.lineBetween(x - dx, y - dy, x + dx, y + dy);
        }
        graphics.strokeCircle(x, y, 12);
        break;
      case "divine":
        // 神：日轮与放射神光。
        graphics.strokeCircle(x, y, 22);
        for (let index = 0; index < 8; index += 1) {
          const angle = (Math.PI * 2 * index) / 8;
          graphics.lineBetween(
            x + Math.cos(angle) * 29,
            y + Math.sin(angle) * 29,
            x + Math.cos(angle) * 40,
            y + Math.sin(angle) * 40,
          );
        }
        break;
      case "demonic":
        // 魔：双角与幽焰般的下垂纹路。
        graphics.beginPath();
        graphics.moveTo(x - 35, y - 27);
        graphics.lineTo(x - 18, y - 35);
        graphics.lineTo(x - 8, y - 12);
        graphics.lineTo(x, y + 34);
        graphics.lineTo(x + 8, y - 12);
        graphics.lineTo(x + 18, y - 35);
        graphics.lineTo(x + 35, y - 27);
        graphics.strokePath();
        break;
      default:
        graphics.strokeCircle(x, y, 24);
    }
  }

  drawWave(graphics, x, y, halfWidth) {
    graphics.beginPath();
    graphics.moveTo(x - halfWidth, y);
    graphics.lineTo(x - halfWidth / 2, y - 5);
    graphics.lineTo(x, y);
    graphics.lineTo(x + halfWidth / 2, y + 5);
    graphics.lineTo(x + halfWidth, y);
    graphics.strokePath();
  }

  drawWindLine(graphics, x, y, halfWidth) {
    graphics.beginPath();
    graphics.moveTo(x - halfWidth, y);
    graphics.lineTo(x - 8, y - 5);
    graphics.lineTo(x + 12, y + 4);
    graphics.lineTo(x + halfWidth, y - 2);
    graphics.strokePath();
  }
}

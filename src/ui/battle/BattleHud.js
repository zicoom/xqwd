import { addText } from "../../utils/UiHelpers.js";

// 八个属性球的位置统一放在这里，x / y 都是相对五行圆盘左上角的坐标。
// 后续想自己微调时只改对应项的 x、y；labelX、labelY 只调整文字在球内的位置。
const ELEMENT_LAYOUT = [
  { key: "metal", label: "金", x: 181, y: 69, labelX: -1, labelY: 0 },
  { key: "wood", label: "木", x: 260, y: 102, labelX: -1, labelY: -1 },
  { key: "water", label: "水", x: 298, y: 174, labelX: 0, labelY: 1 },
  { key: "fire", label: "火", x: 274, y: 252, labelX: -1, labelY: -1 },
  { key: "wind", label: "风", x: 180, y: 300, labelX: 0, labelY: -1 },
  { key: "ice", label: "冰", x: 86, y: 252, labelX: -1, labelY: -2 },
  { key: "dark", label: "阴", x: 63, y: 174, labelX: 0, labelY: 1 },
  { key: "lightning", label: "雷", x: 101, y: 102, labelX: -2, labelY: -3 },
];

/**
 * Pixso“新战斗界面”的纯表现层。
 *
 * 这里仅负责把已经切好的 UI 素材按 1920×1080 画板坐标绘制出来，
 * 并把点击转交给 BattleScene。伤害、灵气、回合和胜负仍全部由
 * CombatEngine 处理，避免战斗规则重新耦合到页面。
 */
export class BattleHud {
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  create({ playerName, enemyName, skillName }) {
    this.createRoundHeader();
    this.playerBars = this.createStatusBar({ x: 83, y: 623, name: playerName });
    this.enemyBars = this.createStatusBar({ x: 1465, y: 623, name: enemyName });
    this.createActionDeck(skillName);
    this.createFiveElementsDisc();
    this.createBattleLog();
    return this;
  }

  createRoundHeader() {
    this.scene.add.image(720, 52, "battle-ui-round-header").setOrigin(0, 0);
    this.roundText = addText(this.scene, 960, 103, "第 1 回合", 39, "#fff0c5", {
      origin: 0.5,
      stroke: "#17130f",
      strokeThickness: 4,
    });
    this.turnHint = addText(this.scene, 960, 147, "你的回合 · 请选择行动", 19, "#ead9ad", {
      origin: 0.5,
      stroke: "#17130f",
      strokeThickness: 2,
    });
  }

  createStatusBar({ x, y, name }) {
    const innerX = x + 10;
    const innerWidth = 295;
    addText(this.scene, x, y - 29, name, 22, "#f5e7c5", {
      stroke: "#241a13",
      strokeThickness: 3,
    });

    this.scene.add.image(x, y, "battle-ui-status-bar").setOrigin(0, 0);
    const hpFill = this.scene.add.graphics();
    const hpText = addText(this.scene, x + 157.5, y + 20, "", 16, "#fff7df", {
      origin: 0.5,
      stroke: "#2b1712",
      strokeThickness: 2,
    });

    const qiY = y + 42;
    this.scene.add.image(x, qiY, "battle-ui-status-bar").setOrigin(0, 0);
    const qiFill = this.scene.add.graphics();
    const qiText = addText(this.scene, x + 157.5, qiY + 20, "", 16, "#f5fbff", {
      origin: 0.5,
      stroke: "#102333",
      strokeThickness: 2,
    });

    return {
      hpFill,
      hpText,
      qiFill,
      qiText,
      width: innerWidth,
      hpX: innerX,
      hpY: y + 9,
      qiX: innerX,
      qiY: qiY + 9,
    };
  }

  createActionDeck(skillName) {
    const panelX = 126;
    const panelY = 773.5;
    this.scene.add.image(panelX, panelY, "battle-ui-action-deck").setOrigin(0, 0);

    const actions = [
      { key: "1", name: "普通攻击", glyph: "斩", onClick: this.callbacks.onNormalAttack },
      { key: "2", name: skillName, texture: "battle-ui-skill-fireburst", onClick: this.callbacks.onSkill },
      { key: "3", name: "防御", glyph: "御", onClick: this.callbacks.onDefend },
    ];

    for (let index = 0; index < 10; index += 1) {
      const column = index % 5;
      const row = Math.floor(index / 5);
      // 单格素材为 105×115；设计稿要求横向间隔 5px、纵向间隔 1px。
      const x = 162 + column * 110;
      const y = 799 + row * 116;
      this.createActionSlot(x, y, index, actions[index] || null);
    }
  }

  createActionSlot(x, y, index, action) {
    const frame = this.scene.add.image(x, y, "battle-ui-action-slot").setOrigin(0, 0);
    if (action) {
      frame.setInteractive({ useHandCursor: true });
      frame.on("pointerover", () => frame.setTexture("battle-ui-action-slot-selected"));
      frame.on("pointerout", () => frame.setTexture("battle-ui-action-slot"));
      frame.on("pointerdown", () => action.onClick?.());
    }

    addText(this.scene, x + 14, y + 9, index === 9 ? "0" : String(index + 1), 16, "#e7d9b6", {
      origin: 0.5,
      stroke: "#111111",
      strokeThickness: 2,
    });
    this.scene.add.image(x + 9.5, y + 81, "battle-ui-action-key-label").setOrigin(0, 0).setAlpha(0.96);

    if (!action) return;
    if (action.texture) {
      this.scene.add.image(x + 52.5, y + 50, action.texture).setDisplaySize(74, 74);
    } else {
      addText(this.scene, x + 52.5, y + 48, action.glyph, 38, "#d8c08b", {
        origin: 0.5,
        stroke: "#18130f",
        strokeThickness: 3,
      });
    }
    addText(this.scene, x + 52.5, y + 92.5, action.name, 16, "#f1e4c2", {
      origin: 0.5,
      stroke: "#15110e",
      strokeThickness: 2,
      wordWrap: { width: 96 },
      align: "center",
    });
  }

  createFiveElementsDisc() {
    const x = 780;
    const y = 701.5;
    this.scene.add.image(x, y, "battle-ui-five-elements-frame").setOrigin(0, 0);
    ELEMENT_LAYOUT.forEach(({ key, label, x: centerX, y: centerY, labelX, labelY }) => {
      this.scene.add.image(x + centerX, y + centerY, `battle-ui-element-${key}`);
      addText(this.scene, x + centerX + labelX, y + centerY + labelY, label, 28, "#f8f0d8", {
        origin: 0.5,
        stroke: "#15120f",
        strokeThickness: 3,
      });
    });
    this.discQiText = addText(this.scene, x + 180, y + 181, "", 31, "#4f432f", {
      origin: 0.5,
      stroke: "#dce9cc",
      strokeThickness: 1,
      align: "center",
    });
  }

  createBattleLog() {
    const x = 1178;
    const y = 742.5;
    this.scene.add.image(x, y, "battle-ui-log-scroll").setOrigin(0, 0);
    this.createLogButton(1239, 750, "battle-ui-button-dark", "逃走", this.callbacks.onEscape);
    this.createLogButton(1339, 750, "battle-ui-button-green", "结束", this.callbacks.onEnd);
    this.logText = addText(this.scene, 1218, 803, "", 20, "#5b4032", {
      wordWrap: { width: 525 },
      lineSpacing: 9,
      strokeThickness: 0,
    });
  }

  createLogButton(x, y, texture, label, onClick) {
    const image = this.scene.add.image(x, y, texture).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    addText(this.scene, x + 45, y + 17, label, 17, "#f4e4bd", {
      origin: 0.5,
      stroke: "#1a1612",
      strokeThickness: 2,
    });
    image.on("pointerdown", () => onClick?.());
    image.on("pointerover", () => image.setTint(0xfff1c4));
    image.on("pointerout", () => image.clearTint());
  }

  update({ round, battleOver, turn, playerHp, playerMaxHp, playerQi, playerMaxQi, enemyHp, enemyMaxHp, enemyQi, enemyMaxQi }) {
    this.updateBar(this.playerBars, playerHp, playerMaxHp, playerQi, playerMaxQi);
    this.updateBar(this.enemyBars, enemyHp, enemyMaxHp, enemyQi, enemyMaxQi);
    this.roundText.setText(`第 ${round} 回合`);
    this.turnHint.setText(battleOver ? "战斗结束" : turn === "player" ? "你的回合 · 请选择行动" : "敌方行动中……");
    this.discQiText.setText(`${playerQi}\n/${playerMaxQi}`);
  }

  updateBar(bars, hp, maxHp, qi, maxQi) {
    const hpRatio = Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1);
    const qiRatio = Phaser.Math.Clamp(qi / Math.max(1, maxQi), 0, 1);
    this.drawRoundedBar(bars.hpFill, bars.hpX, bars.hpY, bars.width, hpRatio, 0xc53829);
    this.drawRoundedBar(bars.qiFill, bars.qiX, bars.qiY, bars.width, qiRatio, 0x2b7ec4);
    bars.hpText.setText(`${hp}/${maxHp}`);
    bars.qiText.setText(`${qi}/${maxQi}`);
  }

  drawRoundedBar(graphics, x, y, fullWidth, ratio, color) {
    const width = fullWidth * ratio;
    graphics.clear();
    if (width <= 0) return;
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(x, y, width, 22, Math.min(11, width / 2));
  }

  setLog(text, color = "#5b4032") {
    this.logText?.setText(text).setColor(color);
  }
}

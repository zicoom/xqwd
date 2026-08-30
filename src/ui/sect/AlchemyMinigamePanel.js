import { addText } from "../../utils/UiHelpers.js";
import { AlchemyResultPanel } from "./AlchemyResultPanel.js";

const TITLE_FONT = '"SJ yuantijian-C", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const LABEL_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const BODY_FONT = '"Noto Sans SC Battle Popup", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const CAPTION_FONT = '"SJ yuantijian-Z", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';

const ASSET_ROOT = "./public/assets/images/pixso/alchemy/minigame";
const ASSETS = Object.freeze({
  background: ["pixso-alchemy-minigame-background", "background.jpg"],
  phaseSeal: ["pixso-alchemy-minigame-phase-seal", "phase-seal.png"],
  phaseCard: ["pixso-alchemy-minigame-phase-card", "phase-card.png"],
  stabilityWarm: ["pixso-alchemy-minigame-stability-warm", "stability-row-warm.png"],
  stabilityInfuse: ["pixso-alchemy-minigame-stability-infuse", "stability-row-infuse.png"],
  stabilityCondense: ["pixso-alchemy-minigame-stability-condense", "stability-row-condense.png"],
  temperatureTrack: ["pixso-alchemy-minigame-temperature-track", "temperature-track.png"],
  stabilityRing: ["pixso-alchemy-minigame-stability-ring", "stability-ring.png"],
  stabilityPanel: ["pixso-alchemy-minigame-stability-panel", "stability-panel.png"],
  cauldronStage: ["pixso-alchemy-minigame-cauldron-stage", "cauldron-stage.png"],
  stagePanel: ["pixso-alchemy-minigame-stage-panel", "stage-panel.png"],
  condenseButton: ["pixso-alchemy-minigame-condense-button", "condense-button-disabled.png"],
  heatButton: ["pixso-alchemy-minigame-heat-button", "heat-button.png"],
  abortButton: ["pixso-alchemy-minigame-abort-button", "abort-button.png"],
  temperatureNeedle: ["pixso-alchemy-minigame-temperature-needle", "temperature-needle.png"],
});

const PHASE_CARD_POSITIONS = Object.freeze([
  Object.freeze({ x: 558.2338, y: 157.05 }),
  Object.freeze({ x: 833.0001, y: 157.05 }),
  Object.freeze({ x: 1107.7665, y: 157.05 }),
]);
const STABILITY_ROWS = Object.freeze([
  Object.freeze({ texture: ASSETS.stabilityWarm[0], x: 226.91, y: 636.057, labelY: 661.057 }),
  Object.freeze({ texture: ASSETS.stabilityInfuse[0], x: 226.91, y: 689.477, labelY: 713.977 }),
  Object.freeze({ texture: ASSETS.stabilityCondense[0], x: 226.91, y: 743.897, labelY: 767.897 }),
]);

const GAUGE_LEFT = 534.96;
const GAUGE_RIGHT = 1385.04;
const GAUGE_WIDTH = GAUGE_RIGHT - GAUGE_LEFT;
const TARGET_TOP = 843.043;
const TARGET_HEIGHT = 76;

export function preloadAlchemyMinigameAssets(scene) {
  Object.values(ASSETS).forEach(([key, filename]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, `${ASSET_ROOT}/${filename}`);
  });
}

const text = (scene, x, y, content, size, color, options = {}) => addText(
  scene,
  x,
  y,
  content,
  size,
  color,
  { strokeThickness: 0, fontFamily: BODY_FONT, ...options },
);

/**
 * 炼丹控火小游戏表现层：严格复现 Pixso「炼丹房-小游戏」画板，只负责绘制、输入与即时反馈。
 * 温度、阶段、评分、凝丹条件和奖励修正全部来自 AlchemyMinigameService / AlchemyService。
 */
export class AlchemyMinigamePanel {
  constructor(scene, { rules, attempt, onResolve, onAbort, onClose }) {
    this.scene = scene;
    this.rules = rules;
    this.attempt = attempt;
    this.onResolve = onResolve;
    this.onAbort = onAbort;
    this.onClose = onClose;
    this.session = rules.createSession({ difficulty: attempt.difficulty });
    this.heating = false;
    this.resolved = false;
    this.root = scene.add.container(0, 0).setDepth(1200);
    this.drawGame();
    this.bindInput();
    this.updateDisplay();
  }

  drawGame() {
    const scene = this.scene;
    this.gameLayer = scene.add.container(0, 0);
    this.root.add(this.gameLayer);

    this.gameLayer.add(scene.add.image(0, 0, ASSETS.background[0]).setOrigin(0).setInteractive());
    this.gameLayer.add(text(scene, 960, 44.8, "炼丹·控火", 49, "#ddac4f", {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      stroke: "#21160c",
      strokeThickness: 2,
    }));

    this.abortButton = scene.add.image(1662.392, 20.012, ASSETS.abortButton[0])
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.abortButton.on("pointerover", () => this.abortButton.setTint(0xffe0a0));
    this.abortButton.on("pointerout", () => this.abortButton.clearTint());
    this.abortButton.on("pointerdown", () => this.abort());
    this.gameLayer.add([
      this.abortButton,
      text(scene, 1760.892, 49.617, "放弃本炉", 22, "#ddac4f", {
        origin: 0.5,
        fontFamily: TITLE_FONT,
        stroke: "#21160c",
        strokeThickness: 1,
      }),
    ]);

    this.drawPhaseCards();
    this.drawStabilityPanel();
    this.drawStagePanel();

    this.cauldronImage = scene.add.image(668.967, 267.084, ASSETS.cauldronStage[0]).setOrigin(0);
    this.gameLayer.add(this.cauldronImage);

    this.drawTemperatureGauge();
    this.drawControls();
  }

  drawPhaseCards() {
    const scene = this.scene;
    this.phaseCards = this.session.stages.map((stage, index) => {
      const position = PHASE_CARD_POSITIONS[index];
      const card = scene.add.image(position.x, position.y, ASSETS.phaseCard[0]).setOrigin(0);
      const seal = scene.add.image(position.x + 58.367, position.y + 9, ASSETS.phaseSeal[0]).setOrigin(0);
      const sealText = text(scene, position.x + 83.367, position.y + 34.5, stage.seal, 26, "#ddac4f", {
        origin: 0.5,
        fontFamily: LABEL_FONT,
        stroke: "#25170c",
        strokeThickness: 1,
      });
      const label = text(scene, position.x + 159.5, position.y + 34.5, `${index + 1}、${stage.label}`, 20, "#ddac4f", {
        origin: 0.5,
        fontFamily: TITLE_FONT,
        stroke: "#25170c",
        strokeThickness: 1,
      });
      this.gameLayer.add([card, seal, sealText, label]);
      return { card, seal, sealText, label };
    });
  }

  drawStabilityPanel() {
    const scene = this.scene;
    this.gameLayer.add(scene.add.image(133.675, 252, ASSETS.stabilityPanel[0]).setOrigin(0));
    this.gameLayer.add(scene.add.image(236.41, 340.584, ASSETS.stabilityRing[0]).setOrigin(0));
    this.gameLayer.add(text(scene, 211.33, 301.151, "药性稳定", 24, "#ddac4f", {
      fontFamily: TITLE_FONT,
      stroke: "#21160c",
      strokeThickness: 1,
    }));

    this.stabilityProgress = scene.add.graphics();
    this.gameLayer.add(this.stabilityProgress);
    this.accuracyText = text(scene, 363.83, 443.964, "0%", 49, "#62a985", {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      stroke: "#0a0807",
      strokeThickness: 2,
    });
    this.gameLayer.add([
      this.accuracyText,
      text(scene, 363.83, 497.204, "控火评分", 16, "#f8f0d9", { origin: 0.5 }),
      text(scene, 359.41, 609.517, "高分会提升成丹率，并增加额外成丹机会", 14, "#a09e85", {
        origin: 0.5,
        fontFamily: CAPTION_FONT,
      }),
    ]);

    const labels = ["温炉", "融药", "凝丹"];
    this.stageRatioTexts = STABILITY_ROWS.map((row, index) => {
      this.gameLayer.add(scene.add.image(row.x, row.y, row.texture).setOrigin(0));
      const label = text(scene, 293.523, row.labelY, labels[index], 18, "#f8f0d9", { origin: [0, 0.5] });
      const ratio = text(scene, 467.533, row.labelY, "0%", 18, "#f8f0d9", {
        origin: [1, 0.5],
        fontStyle: "600",
      });
      this.gameLayer.add([label, ratio]);
      return ratio;
    });
  }

  drawStagePanel() {
    const scene = this.scene;
    this.gameLayer.add(scene.add.image(1370.161, 251, ASSETS.stagePanel[0]).setOrigin(0));
    this.stageTitle = text(scene, 1558.058, 330.659, "", 30, "#ddac4f", {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      stroke: "#4a361d",
      strokeThickness: 2,
    });
    this.stageInstruction = text(scene, 1558.058, 382.637, "", 16, "#443509", {
      origin: 0.5,
      align: "center",
      wordWrap: { width: 288 },
    });
    this.timeText = text(scene, 1558.058, 503.327, "", 80, "#4a361d", {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      stroke: "#d9b66d",
      strokeThickness: 1,
    });
    this.stageTemperatureLabel = text(scene, 1558.058, 606.017, "当前温度", 16, "#443509", { origin: 0.5 });
    this.stageTargetText = text(scene, 1558.058, 637.017, "", 26, "#364c22", {
      origin: 0.5,
      fontFamily: BODY_FONT,
    });
    this.controlHint = text(scene, 1558.058, 771.321, "空格键/鼠标长按催火", 16, "#443509", { origin: 0.5 });
    this.gameLayer.add([
      this.stageTitle,
      this.stageInstruction,
      this.timeText,
      this.stageTemperatureLabel,
      this.stageTargetText,
      this.controlHint,
    ]);
  }

  drawTemperatureGauge() {
    const scene = this.scene;
    this.gameLayer.add(scene.add.image(519, 851.052, ASSETS.temperatureTrack[0]).setOrigin(0));

    const zones = scene.add.graphics();
    zones.fillGradientStyle(0x40759e, 0x162635, 0x40759e, 0x162635, 1);
    zones.fillRect(GAUGE_LEFT, 861.043, 295.04, 40);
    zones.fillGradientStyle(0x39492e, 0x9fc68c, 0x39492e, 0x9fc68c, 1);
    zones.fillRect(830, 861.043, 130, 40);
    zones.fillGradientStyle(0x9fc68c, 0x39492e, 0x9fc68c, 0x39492e, 1);
    zones.fillRect(960, 861.043, 130, 40);
    zones.fillGradientStyle(0xac743c, 0x552720, 0xac743c, 0x552720, 1);
    zones.fillRect(1090, 861.043, 295.04, 40);
    this.gameLayer.add(zones);

    this.targetBand = scene.add.rectangle(GAUGE_LEFT, TARGET_TOP, 100, TARGET_HEIGHT, 0xbb976c, 0.1)
      .setOrigin(0)
      .setStrokeStyle(2, 0xbb976c, 1);
    this.temperatureNeedle = scene.add.image(GAUGE_LEFT, 835, ASSETS.temperatureNeedle[0]).setOrigin(0.5, 0);
    this.temperatureText = text(scene, 977.266, 798, "20", 26, "#ddac4f", {
      fontFamily: LABEL_FONT,
      stroke: "#21160c",
      strokeThickness: 1,
    });
    this.gameLayer.add([
      this.targetBand,
      this.temperatureNeedle,
      text(scene, 913.799, 798, "温度", 26, "#ddac4f", {
        fontFamily: LABEL_FONT,
        stroke: "#21160c",
        strokeThickness: 1,
      }),
      this.temperatureText,
      text(scene, 547.675, 866.052, "寒", 26, "#93b1bd", {
        fontFamily: LABEL_FONT,
        stroke: "#172026",
        strokeThickness: 1,
      }),
      text(scene, 1344.161, 866.052, "烈", 26, "#d78b61", {
        fontFamily: LABEL_FONT,
        stroke: "#2b1710",
        strokeThickness: 1,
      }),
    ]);
  }

  drawControls() {
    const scene = this.scene;
    this.heatButton = scene.add.image(596.934, 949.405, ASSETS.heatButton[0])
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.condenseButton = scene.add.image(985, 949.405, ASSETS.condenseButton[0])
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.heatButtonText = text(scene, 770, 978.905, "长按催火[空格]", 20, "#442109", {
      origin: 0.5,
      fontStyle: "600",
    });
    this.condenseButtonText = text(scene, 1127.5, 978.905, "凝丹诀未就绪", 20, "#64513c", {
      origin: 0.5,
      fontStyle: "600",
    });
    this.statusText = text(scene, 960, 1042.5, "控火开始:先将炉温升入目标区域。", 14, "#a09e85", {
      origin: 0.5,
      fontFamily: CAPTION_FONT,
    });
    this.gameLayer.add([
      this.heatButton,
      this.condenseButton,
      this.heatButtonText,
      this.condenseButtonText,
      this.statusText,
    ]);
    this.heatButton.on("pointerdown", () => { this.heating = true; });
    this.heatButton.on("pointerover", () => { if (!this.heating) this.heatButton.setTint(0xffedca); });
    this.heatButton.on("pointerout", () => { if (!this.heating) this.heatButton.clearTint(); });
    this.condenseButton.on("pointerdown", () => this.tryCondense());
  }

  bindInput() {
    this.pointerUpHandler = () => { this.heating = false; };
    this.spaceDownHandler = () => { if (!this.resolved) this.heating = true; };
    this.spaceUpHandler = () => { this.heating = false; };
    this.scene.input.on("pointerup", this.pointerUpHandler);
    this.scene.input.keyboard.on("keydown-SPACE", this.spaceDownHandler);
    this.scene.input.keyboard.on("keyup-SPACE", this.spaceUpHandler);
    this.tickEvent = this.scene.time.addEvent({ delay: 50, loop: true, callback: () => this.tick() });
  }

  stopRuntime() {
    this.heating = false;
    this.tickEvent?.remove(false);
    this.tickEvent = null;
    this.scene.input.off("pointerup", this.pointerUpHandler);
    this.scene.input.keyboard.off("keydown-SPACE", this.spaceDownHandler);
    this.scene.input.keyboard.off("keyup-SPACE", this.spaceUpHandler);
  }

  tick() {
    if (this.resolved) return;
    const result = this.rules.tick(this.session, { deltaMs: 50, heating: this.heating });
    if (result.stageChanged) {
      const stage = this.rules.getStage(this.session);
      this.statusText.setText(`进入${stage.label}阶段:${stage.instruction}`);
      this.scene.tweens.add({ targets: this.stageTitle, scale: { from: 1.15, to: 1 }, duration: 260, ease: "Back.easeOut" });
    }
    this.updateDisplay();
    if (result.expired) this.resolve(this.rules.finish(this.session, { manual: false }));
  }

  updateStabilityProgress(accuracy) {
    const progress = Math.max(0, Math.min(100, accuracy)) / 100;
    const centerX = 359.099;
    const centerY = 463.513;
    const radius = 96;
    this.stabilityProgress.clear();
    this.stabilityProgress.lineStyle(12, 0x0a0807, 1);
    this.stabilityProgress.strokeCircle(centerX, centerY, radius);
    if (progress <= 0) return;
    this.stabilityProgress.lineStyle(12, 0x62a985, 1);
    this.stabilityProgress.beginPath();
    this.stabilityProgress.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
    this.stabilityProgress.strokePath();
  }

  updateDisplay() {
    const stage = this.rules.getStage(this.session);
    if (!stage) return;
    const inTarget = this.session.temperature >= stage.targetMin && this.session.temperature <= stage.targetMax;
    const targetX = GAUGE_LEFT + (stage.targetMin / 100) * GAUGE_WIDTH;
    const targetWidth = ((stage.targetMax - stage.targetMin) / 100) * GAUGE_WIDTH;
    this.targetBand.setPosition(targetX, TARGET_TOP).setDisplaySize(targetWidth, TARGET_HEIGHT)
      .setFillStyle(inTarget ? 0x83b36d : 0xbb976c, inTarget ? 0.2 : 0.1)
      .setStrokeStyle(2, inTarget ? 0xc5dd82 : 0xbb976c, 1);
    this.temperatureNeedle.setX(GAUGE_LEFT + (this.session.temperature / 100) * GAUGE_WIDTH);
    this.temperatureText.setText(`${Math.round(this.session.temperature)}`);
    this.stageTitle.setText(`${stage.seal}·${stage.label}`);
    this.stageInstruction.setText(stage.instruction);
    this.timeText.setText(`${Math.max(0, Math.ceil((stage.durationMs - this.session.stageElapsedMs) / 1000))}`);
    this.stageTargetText.setText(`${stage.targetMin} / ${stage.targetMax}`);

    const accuracy = this.rules.getLiveAccuracy(this.session);
    this.updateStabilityProgress(accuracy);
    this.accuracyText.setText(`${accuracy}%`).setColor(accuracy >= 72 ? "#8ed9a5" : accuracy >= 40 ? "#ddac4f" : "#62a985");
    const ratios = this.session.stages.map((_entry, index) => Math.round(
      (this.session.targetMs[index] || 0) / Math.max(1, this.session.observedMs[index] || 0) * 100,
    ));
    this.stageRatioTexts.forEach((ratioText, index) => {
      ratioText.setText(`${ratios[index]}%`).setColor(index === this.session.stageIndex ? "#62a985" : "#f8f0d9");
    });

    this.phaseCards.forEach((card, index) => {
      const active = index === this.session.stageIndex;
      const done = index < this.session.stageIndex;
      const color = active ? "#ddac4f" : done ? "#62a985" : "#9c9682";
      card.card.setAlpha(active ? 1 : done ? 0.92 : 0.78);
      card.seal.setAlpha(active ? 1 : 0.78);
      if (active) card.seal.clearTint();
      else card.seal.setTint(done ? 0x87b89a : 0xa19b8d);
      card.sealText.setColor(color);
      card.label.setColor(color).setFontSize(active ? 20 : 18);
    });

    if (this.heating) this.heatButton.setTint(0xffd49a);
    else this.heatButton.clearTint();
    const ready = this.rules.canCondense(this.session);
    if (ready) this.condenseButton.setTint(0xffd16b);
    else this.condenseButton.clearTint();
    this.condenseButtonText
      .setText(ready ? "收诀凝丹" : "凝丹诀未就绪")
      .setColor(ready ? "#f0c45f" : "#64513c");

    if (ready) this.statusText.setText("凝丹诀已就绪，立即收诀凝丹。");
    else if (inTarget) this.statusText.setText("药性稳定，保持当前控火节奏。");
    else if (this.session.temperature < stage.targetMin) this.statusText.setText("炉温偏低，长按催火升入目标区域。");
    else this.statusText.setText("炉温偏高，松开催火让温度缓慢下降。");
  }

  tryCondense() {
    if (this.resolved) return;
    const outcome = this.rules.finish(this.session, { manual: true });
    if (!outcome.ok) { this.statusText.setText(outcome.message); return; }
    this.resolve(outcome);
  }

  resolve(outcome) {
    if (this.resolved) return;
    this.resolved = true;
    this.stopRuntime();
    const result = this.onResolve?.(outcome) || { ok: false, message: "炼丹结算失败。" };
    this.showResult(outcome, result);
  }

  showResult(outcome, result) {
    this.gameLayer.destroy(true);
    this.resultMessage = result.message || "";
    this.resultPanel = new AlchemyResultPanel(this.scene, {
      outcome,
      result,
      onClose: () => this.close(this.resultMessage),
    });
    this.root.add(this.resultPanel.root);
  }

  abort() {
    if (this.resolved) {
      if (this.resultPanel) this.resultPanel.handleEscape();
      else this.close(this.resultMessage || "");
      return;
    }
    this.stopRuntime();
    const result = this.onAbort?.() || { message: "已放弃本炉炼制。" };
    this.resolved = true;
    this.close(result.message);
  }

  handleEscape() { this.abort(); return true; }

  close(message = "") {
    this.stopRuntime();
    this.resultPanel?.destroy();
    this.resultPanel = null;
    this.root?.destroy(true);
    this.root = null;
    this.onClose?.(message);
  }
}

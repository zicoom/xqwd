import { addButton, addText } from "../../utils/UiHelpers.js";

const GAUGE_LEFT = 470;
const GAUGE_WIDTH = 980;
const GAUGE_Y = 830;

/**
 * 炼丹控火小游戏表现层：负责按键、动画和倒计时。
 * 温度、阶段、评分和奖励修正全部来自 AlchemyMinigameService / AlchemyService。
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
    this.gameLayer.add(scene.add.rectangle(0, 0, 1920, 1080, 0x100706, 1).setOrigin(0).setInteractive());
    this.gameLayer.add(scene.add.rectangle(960, 58, 1920, 116, 0x25100b, 1));
    this.gameLayer.add(addText(scene, 960, 42, "炼丹 · 控火", 34, "#f3c66c", { origin: 0.5, strokeThickness: 3 }));
    this.gameLayer.add(addText(scene, 960, 82, `${this.attempt.recipe.name} · ${this.attempt.furnace.name}`, 16, "#c69a75", { origin: 0.5, strokeThickness: 0 }));
    this.gameLayer.add(addButton(scene, 1775, 58, 190, "放弃本炉", () => this.abort(), { height: 46, size: 17 }));

    this.phaseCards = this.session.stages.map((stage, index) => {
      const x = 650 + index * 310;
      const bg = scene.add.rectangle(x, 164, 250, 70, 0x241813, 1).setStrokeStyle(2, 0x5d4535);
      const seal = scene.add.circle(x - 77, 164, 23, 0x6a4625, 1).setStrokeStyle(2, 0xbd8843);
      const sealText = addText(scene, x - 77, 164, stage.seal, 16, "#ffe1a4", { origin: 0.5, strokeThickness: 1 });
      const label = addText(scene, x - 37, 164, `${index + 1}. ${stage.label}`, 19, "#c5af99", { origin: [0, 0.5], strokeThickness: 1 });
      this.gameLayer.add([bg, seal, sealText, label]);
      return { bg, seal, sealText, label };
    });

    this.gameLayer.add(scene.add.rectangle(280, 505, 360, 500, 0x1b1110, 0.96).setStrokeStyle(2, 0x70442b));
    this.gameLayer.add(addText(scene, 280, 290, "药性稳定", 22, "#efbd68", { origin: 0.5, strokeThickness: 2 }));
    this.stabilityRing = scene.add.circle(280, 445, 105, 0x281713, 1).setStrokeStyle(10, 0x60452f);
    this.gameLayer.add(this.stabilityRing);
    this.accuracyText = addText(scene, 280, 430, "0%", 46, "#f1c463", { origin: 0.5, strokeThickness: 2 });
    this.gameLayer.add(this.accuracyText);
    this.gameLayer.add(addText(scene, 280, 485, "控火评分", 15, "#aa9381", { origin: 0.5, strokeThickness: 0 }));
    this.stageRatiosText = addText(scene, 280, 575, "温炉 0%\n融药 0%\n凝丹 0%", 17, "#cbb6a2", {
      origin: 0.5, align: "center", lineSpacing: 13, strokeThickness: 0,
    });
    this.gameLayer.add(this.stageRatiosText);
    this.gameLayer.add(addText(scene, 280, 690, "高分会提升成丹率，\n并增加额外成丹机会。", 14, "#907e70", {
      origin: 0.5, align: "center", lineSpacing: 6, strokeThickness: 0,
    }));

    this.gameLayer.add(scene.add.rectangle(1640, 505, 360, 500, 0x1b1110, 0.96).setStrokeStyle(2, 0x70442b));
    this.stageTitle = addText(scene, 1640, 330, "", 30, "#f2c166", { origin: 0.5, strokeThickness: 2 });
    this.stageInstruction = addText(scene, 1640, 410, "", 16, "#d1c0ae", {
      origin: 0.5, align: "center", wordWrap: { width: 295 }, lineSpacing: 8, strokeThickness: 0,
    });
    this.timeText = addText(scene, 1640, 520, "", 52, "#ffffff", { origin: 0.5, strokeThickness: 2 });
    this.stageTargetText = addText(scene, 1640, 600, "", 17, "#dda956", { origin: 0.5, strokeThickness: 1 });
    this.controlHint = addText(scene, 1640, 675, "空格键 / 鼠标长按催火", 14, "#9f8b78", { origin: 0.5, strokeThickness: 0 });
    this.gameLayer.add([this.stageTitle, this.stageInstruction, this.timeText, this.stageTargetText, this.controlHint]);

    this.drawCauldron();
    this.drawTemperatureGauge();
    this.drawControls();
  }

  drawCauldron() {
    const scene = this.scene;
    this.fireGlow = scene.add.ellipse(960, 704, 300, 120, 0xf05b20, 0.24);
    this.flameOuter = scene.add.triangle(960, 700, -80, 55, 0, -115, 80, 55, 0xe35d1b, 0.92);
    this.flameInner = scene.add.triangle(960, 705, -42, 35, 0, -76, 42, 35, 0xffc33d, 0.95);
    const pot = scene.add.graphics();
    pot.lineStyle(8, 0x70401f, 1);
    pot.fillStyle(this.attempt.furnace.color, 1);
    pot.fillEllipse(960, 520, 330, 245);
    pot.strokeEllipse(960, 520, 330, 245);
    pot.fillStyle(0x1c0d09, 1);
    pot.fillEllipse(960, 415, 295, 58);
    pot.lineStyle(7, 0xba7b32, 1);
    pot.strokeEllipse(960, 415, 295, 58);
    pot.lineStyle(18, 0x70401f, 1);
    pot.beginPath(); pot.arc(780, 505, 76, 1.45, 4.8); pot.strokePath();
    pot.beginPath(); pot.arc(1140, 505, 76, -1.65, 1.7); pot.strokePath();
    pot.lineStyle(16, 0x5a3119, 1);
    pot.lineBetween(885, 620, 855, 695);
    pot.lineBetween(1035, 620, 1065, 695);
    const seal = scene.add.circle(960, 520, 54, 0xc9892d, 1).setStrokeStyle(4, 0xffdc6b);
    const sealText = addText(scene, 960, 520, "丹", 39, "#fff2c1", { origin: 0.5, strokeThickness: 2 });
    this.gameLayer.add([this.fireGlow, this.flameOuter, this.flameInner, pot, seal, sealText]);
    this.scene.tweens.add({ targets: [this.flameOuter, this.flameInner], scaleX: 1.08, duration: 180, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  drawTemperatureGauge() {
    const scene = this.scene;
    this.gameLayer.add(addText(scene, GAUGE_LEFT, GAUGE_Y - 66, "炉温", 19, "#e9c27b", { strokeThickness: 1 }));
    const track = scene.add.graphics();
    track.fillStyle(0x1b2438, 1); track.fillRoundedRect(GAUGE_LEFT, GAUGE_Y - 20, GAUGE_WIDTH * 0.35, 40, 12);
    track.fillStyle(0x9a6829, 1); track.fillRect(GAUGE_LEFT + GAUGE_WIDTH * 0.35, GAUGE_Y - 20, GAUGE_WIDTH * 0.35, 40);
    track.fillStyle(0x8e2b21, 1); track.fillRoundedRect(GAUGE_LEFT + GAUGE_WIDTH * 0.7, GAUGE_Y - 20, GAUGE_WIDTH * 0.3, 40, 12);
    track.lineStyle(3, 0xd6aa61, 1); track.strokeRoundedRect(GAUGE_LEFT, GAUGE_Y - 20, GAUGE_WIDTH, 40, 12);
    this.gameLayer.add(track);
    this.targetBand = scene.add.rectangle(GAUGE_LEFT, GAUGE_Y, 100, 54, 0x74d68e, 0.35)
      .setOrigin(0, 0.5).setStrokeStyle(3, 0xb9f18b, 0.95);
    this.needle = scene.add.rectangle(GAUGE_LEFT, GAUGE_Y, 6, 76, 0xfff0a1, 1).setStrokeStyle(2, 0x6b3e1f);
    this.temperatureText = addText(scene, GAUGE_LEFT + GAUGE_WIDTH, GAUGE_Y - 66, "20", 25, "#fff0b1", { origin: [1, 0], strokeThickness: 2 });
    this.gameLayer.add([this.targetBand, this.needle, this.temperatureText]);
    this.gameLayer.add(addText(scene, GAUGE_LEFT, GAUGE_Y + 35, "寒", 14, "#849fca", { strokeThickness: 0 }));
    this.gameLayer.add(addText(scene, GAUGE_LEFT + GAUGE_WIDTH, GAUGE_Y + 35, "烈", 14, "#e18268", { origin: [1, 0], strokeThickness: 0 }));
  }

  drawControls() {
    const scene = this.scene;
    this.heatButtonBg = scene.add.rectangle(800, 960, 330, 72, 0x65301d, 1)
      .setStrokeStyle(3, 0xe09842)
      .setInteractive({ useHandCursor: true });
    this.heatButtonText = addText(scene, 800, 960, "长按催火  [空格]", 23, "#ffe4a3", { origin: 0.5, strokeThickness: 2 });
    this.condenseButtonBg = scene.add.rectangle(1140, 960, 260, 72, 0x312720, 1)
      .setStrokeStyle(3, 0x6d5a48)
      .setInteractive({ useHandCursor: true });
    this.condenseButtonText = addText(scene, 1140, 960, "凝丹诀未就绪", 21, "#82776c", { origin: 0.5, strokeThickness: 2 });
    this.statusText = addText(scene, 960, 1040, "控火开始：先将炉温升入目标区域。", 16, "#d8bd83", { origin: 0.5, strokeThickness: 1 });
    this.gameLayer.add([this.heatButtonBg, this.heatButtonText, this.condenseButtonBg, this.condenseButtonText, this.statusText]);
    this.heatButtonBg.on("pointerdown", () => { this.heating = true; });
    this.condenseButtonBg.on("pointerdown", () => this.tryCondense());
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
      this.statusText.setText(`进入${stage.label}阶段：${stage.instruction}`);
      this.scene.tweens.add({ targets: this.stageTitle, scale: { from: 1.25, to: 1 }, duration: 260, ease: "Back.easeOut" });
    }
    this.updateDisplay();
    if (result.expired) this.resolve(this.rules.finish(this.session, { manual: false }));
  }

  updateDisplay() {
    const stage = this.rules.getStage(this.session);
    if (!stage) return;
    const inTarget = this.session.temperature >= stage.targetMin && this.session.temperature <= stage.targetMax;
    const targetX = GAUGE_LEFT + (stage.targetMin / 100) * GAUGE_WIDTH;
    const targetWidth = ((stage.targetMax - stage.targetMin) / 100) * GAUGE_WIDTH;
    this.targetBand.setPosition(targetX, GAUGE_Y).setDisplaySize(targetWidth, 54)
      .setFillStyle(inTarget ? 0x77d58d : 0xc3a04b, inTarget ? 0.55 : 0.32);
    this.needle.setPosition(GAUGE_LEFT + (this.session.temperature / 100) * GAUGE_WIDTH, GAUGE_Y);
    this.temperatureText.setText(`${Math.round(this.session.temperature)} 火`);
    this.stageTitle.setText(`${stage.seal} · ${stage.label}`);
    this.stageInstruction.setText(stage.instruction);
    this.timeText.setText(`${Math.max(0, Math.ceil((stage.durationMs - this.session.stageElapsedMs) / 1000))}`);
    this.stageTargetText.setText(`目标炉温 ${stage.targetMin}～${stage.targetMax}`);
    const accuracy = this.rules.getLiveAccuracy(this.session);
    this.accuracyText.setText(`${accuracy}%`).setColor(accuracy >= 72 ? "#8fe0a4" : accuracy >= 40 ? "#f1c463" : "#d47c67");
    const ratios = this.session.stages.map((_entry, index) => Math.round(
      (this.session.targetMs[index] || 0) / Math.max(1, this.session.observedMs[index] || 0) * 100,
    ));
    this.stageRatiosText.setText(`温炉 ${ratios[0]}%\n融药 ${ratios[1]}%\n凝丹 ${ratios[2]}%`);
    this.phaseCards.forEach((card, index) => {
      const active = index === this.session.stageIndex;
      const done = index < this.session.stageIndex;
      card.bg.setFillStyle(active ? 0x5d351a : done ? 0x213725 : 0x241813);
      card.bg.setStrokeStyle(2, active ? 0xe0a64c : done ? 0x69a273 : 0x5d4535);
      card.label.setColor(active ? "#ffe2a4" : done ? "#8fd0a0" : "#9f8d7c");
    });
    const heatScale = 0.72 + this.session.temperature / 120;
    this.fireGlow.setScale(heatScale, 0.8 + this.session.temperature / 180).setAlpha(0.18 + this.session.temperature / 180);
    this.flameOuter.setScale(heatScale).setAlpha(0.55 + this.session.temperature / 230);
    this.flameInner.setScale(Math.max(0.65, heatScale * 0.78));
    this.heatButtonBg.setFillStyle(this.heating ? 0xa7481f : 0x65301d);
    const ready = this.rules.canCondense(this.session);
    this.condenseButtonBg.setFillStyle(ready ? 0x8b5a22 : 0x312720).setStrokeStyle(3, ready ? 0xf1bd58 : 0x6d5a48);
    this.condenseButtonText.setText(ready ? "收诀凝丹" : "凝丹诀未就绪").setColor(ready ? "#fff0b0" : "#82776c");
    if (inTarget && !this.heating) this.statusText.setText("药性稳定，保持当前控火节奏。");
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
    const scene = this.scene;
    this.resultLayer = scene.add.container(0, 0);
    this.root.add(this.resultLayer);
    this.resultLayer.add(scene.add.rectangle(0, 0, 1920, 1080, 0x100706, 1).setOrigin(0).setInteractive());
    const visualSuccess = result.practice ? result.successful : result.ok;
    const glowColor = visualSuccess ? 0xd4932e : 0x8c3428;
    const outer = scene.add.circle(960, 500, 250, glowColor, 0.14).setStrokeStyle(4, glowColor, 0.75);
    const inner = scene.add.circle(960, 500, 175, 0x2a1710, 1).setStrokeStyle(3, visualSuccess ? 0xf0be59 : 0xb95c4f);
    const sealLabel = result.practice ? "习" : visualSuccess ? "丹" : "散";
    const titleLabel = result.practice ? "控 火 演 练" : visualSuccess ? "丹 成" : "炼 制 失 败";
    const seal = addText(scene, 960, 430, sealLabel, 86, visualSuccess ? "#f7d375" : "#db8171", { origin: 0.5, strokeThickness: 3 });
    const title = addText(scene, 960, 555, titleLabel, 38, visualSuccess ? "#f5cf72" : "#df8b79", { origin: 0.5, strokeThickness: 3 });
    const grade = addText(scene, 960, 615, `${outcome.grade}火候 · 控火评分 ${outcome.score}`, 22, "#e7bd71", { origin: 0.5, strokeThickness: 1 });
    const ratios = addText(scene, 960, 670, `温炉 ${outcome.stageRatios[0]}%   融药 ${outcome.stageRatios[1]}%   凝丹 ${outcome.stageRatios[2]}%`, 16, "#c8b39d", { origin: 0.5, strokeThickness: 0 });
    const message = addText(scene, 960, 730, result.message, 19, result.ok ? "#d9e3c5" : "#d7b1a8", {
      origin: 0.5, align: "center", wordWrap: { width: 700 }, lineSpacing: 8, strokeThickness: 1,
    });
    const close = addButton(scene, 960, 850, 250, result.practice ? "返回丹房" : result.ok ? "收取丹药" : "返回丹房", () => this.close(result.message), { height: 56, size: 20 });
    this.resultLayer.add([outer, inner, seal, title, grade, ratios, message, close]);
    scene.tweens.add({ targets: outer, scale: { from: 0.78, to: 1.08 }, alpha: { from: 0.2, to: 0.75 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  abort() {
    if (this.resolved) { this.close(); return; }
    this.stopRuntime();
    const result = this.onAbort?.() || { message: "已放弃本炉炼制。" };
    this.resolved = true;
    this.close(result.message);
  }

  handleEscape() { this.abort(); return true; }

  close(message = "") {
    this.stopRuntime();
    this.root?.destroy(true);
    this.root = null;
    this.onClose?.(message);
  }
}

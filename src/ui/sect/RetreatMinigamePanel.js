import { addButton, addText } from "../../utils/UiHelpers.js";

const GRADE_COLORS = Object.freeze({
  澄明: "#f4d66e", 入定: "#8fd4ff", 凝神: "#91d9b2", 心乱: "#d4a36b", 走火: "#d87973",
});

/** 闭关心境小游戏表现层：绘制三段试炼并把操作结果交给领域服务结算。 */
export class RetreatMinigamePanel {
  constructor(scene, { rules, attempt, onResolve, onAbort, onClose }) {
    this.scene = scene;
    this.rules = rules;
    this.attempt = attempt;
    this.onResolve = onResolve;
    this.onAbort = onAbort;
    this.onClose = onClose;
    this.session = rules.createSession({ months: attempt.duration.months });
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
    this.gameLayer.add(scene.add.rectangle(0, 0, 1920, 1080, 0x040817, 1).setOrigin(0).setInteractive());
    this.gameLayer.add(scene.add.rectangle(960, 58, 1920, 116, 0x0a1530, 1));
    this.gameLayer.add(addText(scene, 960, 40, this.attempt.practice ? "闭关 · 静心演练" : "闭关 · 心境试炼", 34, "#cfe3ff", { origin: 0.5, strokeThickness: 3 }));
    this.gameLayer.add(addText(scene, 960, 82, `${this.attempt.study.name} · 闭关 ${this.attempt.duration.label} · ${this.session.memory.sequence.length} 道符序`, 16, "#91a9d2", { origin: 0.5, strokeThickness: 0 }));
    this.gameLayer.add(addButton(scene, 1775, 58, 190, this.attempt.practice ? "结束演练" : "提前出关", () => this.abort(), { height: 46, size: 17 }));

    this.phaseCards = this.session.stages.map((stage, index) => {
      const x = 650 + index * 310;
      const bg = scene.add.rectangle(x, 160, 250, 70, 0x101a32, 1).setStrokeStyle(2, 0x405274);
      const seal = scene.add.circle(x - 78, 160, 23, 0x294a7d, 1).setStrokeStyle(2, 0x7ba9e8);
      const sealText = addText(scene, x - 78, 160, stage.seal, 16, "#e4efff", { origin: 0.5, strokeThickness: 1 });
      const label = addText(scene, x - 37, 160, `${index + 1}. ${stage.label}`, 19, "#a9bad5", { origin: [0, 0.5], strokeThickness: 1 });
      this.gameLayer.add([bg, seal, sealText, label]);
      return { bg, seal, label };
    });

    this.drawSidePanels();
    this.drawStage();
  }

  drawSidePanels() {
    const scene = this.scene;
    this.gameLayer.add(scene.add.rectangle(260, 560, 360, 610, 0x0b1428, 0.97).setStrokeStyle(2, 0x385b91));
    this.gameLayer.add(addText(scene, 260, 292, "心境记录", 22, "#bad7ff", { origin: 0.5, strokeThickness: 2 }));
    this.progressText = addText(scene, 260, 390, "", 18, "#d2e2fa", { origin: 0.5, align: "center", lineSpacing: 16, strokeThickness: 0 });
    this.gameLayer.add(this.progressText);
    this.gameLayer.add(addText(scene, 260, 660, "三境均会影响最终评分\n55 分以上方可领悟秘籍", 15, "#8299bf", { origin: 0.5, align: "center", lineSpacing: 9, strokeThickness: 0 }));
    this.liveHint = addText(scene, 260, 780, "", 15, "#e2bd68", { origin: 0.5, align: "center", wordWrap: { width: 290 }, lineSpacing: 7, strokeThickness: 1 });
    this.gameLayer.add(this.liveHint);

    this.gameLayer.add(scene.add.rectangle(1660, 560, 360, 610, 0x0b1428, 0.97).setStrokeStyle(2, 0x385b91));
    this.stageTitle = addText(scene, 1660, 320, "", 31, "#cce3ff", { origin: 0.5, strokeThickness: 2 });
    this.stageInstruction = addText(scene, 1660, 415, "", 16, "#aebfdb", { origin: 0.5, align: "center", wordWrap: { width: 290 }, lineSpacing: 8, strokeThickness: 0 });
    this.timeText = addText(scene, 1660, 535, "", 54, "#ffffff", { origin: 0.5, strokeThickness: 2 });
    this.stageDetail = addText(scene, 1660, 630, "", 16, "#7eacd9", { origin: 0.5, align: "center", wordWrap: { width: 290 }, lineSpacing: 8, strokeThickness: 1 });
    this.gameLayer.add([this.stageTitle, this.stageInstruction, this.timeText, this.stageDetail]);
  }

  drawStage() {
    this.stageLayer?.destroy(true);
    this.stageLayer = this.scene.add.container(0, 0);
    this.gameLayer.add(this.stageLayer);
    const stage = this.rules.getStage(this.session);
    if (stage.id === "breath") this.drawBreathStage();
    else if (stage.id === "focus") this.drawFocusStage();
    else this.drawMemoryStage();
  }

  drawBreathStage() {
    const scene = this.scene;
    this.stageLayer.add(addText(scene, 960, 300, "顺 息 吐 纳", 28, "#c7ddff", { origin: 0.5, strokeThickness: 2 }));
    this.breathGlow = scene.add.circle(960, 560, 205, 0x1f5390, 0.12).setStrokeStyle(4, 0x6ba5ef, 0.62);
    this.breathRing = scene.add.circle(960, 560, 155, 0x162d59, 0.22).setStrokeStyle(6, 0x72b2ff, 0.86);
    const target = scene.add.circle(960, 560, 116, 0x20355a, 0.28).setStrokeStyle(4, 0xe9c75c, 0.95);
    const seal = addText(scene, 960, 535, "息", 72, "#dcecff", { origin: 0.5, strokeThickness: 3 });
    this.breathCountText = addText(scene, 960, 620, "吐纳 0 / 3", 20, "#9cbce7", { origin: 0.5, strokeThickness: 1 });
    this.stageLayer.add([this.breathGlow, this.breathRing, target, seal, this.breathCountText]);
    const button = scene.add.rectangle(960, 860, 290, 68, 0x284e7b, 1).setStrokeStyle(3, 0x8bbcff).setInteractive({ useHandCursor: true });
    const buttonText = addText(scene, 960, 860, "吐 纳  [空格]", 23, "#eaf3ff", { origin: 0.5, strokeThickness: 2 });
    this.stageLayer.add([button, buttonText]);
    button.on("pointerdown", () => this.tapBreath());
  }

  drawFocusStage() {
    const scene = this.scene;
    const round = this.rules.getFocusRound(this.session);
    if (!round) return;
    this.stageLayer.add(addText(scene, 960, 310, "守住心诀中的真意", 23, "#b8d5ff", { origin: 0.5, strokeThickness: 1 }));
    this.stageLayer.add(scene.add.circle(960, 485, 92, 0x173765, 0.75).setStrokeStyle(4, 0x7cb0ef));
    this.stageLayer.add(addText(scene, 960, 465, round.target, 68, "#f0d16d", { origin: 0.5, strokeThickness: 3 }));
    this.stageLayer.add(addText(scene, 960, 545, round.hint, 17, "#aabedc", { origin: 0.5, strokeThickness: 0 }));
    round.options.forEach((option, index) => {
      const x = 720 + index * 240;
      const bg = scene.add.circle(x, 745, 72, 0x172743, 1).setStrokeStyle(3, 0x5279ad).setInteractive({ useHandCursor: true });
      const label = addText(scene, x, 745, option, 42, "#deebff", { origin: 0.5, strokeThickness: 2 });
      this.stageLayer.add([bg, label]);
      bg.on("pointerdown", () => this.chooseFocus(index, bg));
    });
  }

  drawMemoryStage() {
    const scene = this.scene;
    this.stageLayer.add(addText(scene, 960, 300, "记住符文显现的先后顺序", 23, "#b8d5ff", { origin: 0.5, strokeThickness: 1 }));
    this.memoryHalo = scene.add.circle(960, 535, 165, 0x173765, 0.32).setStrokeStyle(4, 0x6a9ee2, 0.8);
    this.memoryRuneText = addText(scene, 960, 520, "凝神", 70, "#efd06a", { origin: 0.5, strokeThickness: 3 });
    this.memoryModeText = addText(scene, 960, 620, "符文即将显现", 18, "#9fb9df", { origin: 0.5, strokeThickness: 1 });
    this.stageLayer.add([this.memoryHalo, this.memoryRuneText, this.memoryModeText]);
    this.memoryButtons = this.session.memory.runes.map((rune, index) => {
      const x = 660 + index * 200;
      const bg = scene.add.circle(x, 820, 62, 0x15233e, 1).setStrokeStyle(3, 0x425f89).setInteractive({ useHandCursor: true });
      const label = addText(scene, x, 820, rune, 34, "#8999b3", { origin: 0.5, strokeThickness: 2 });
      this.stageLayer.add([bg, label]);
      bg.on("pointerdown", () => this.chooseMemory(index, bg));
      return { bg, label };
    });
  }

  bindInput() {
    this.spaceHandler = () => {
      if (!this.resolved && this.rules.getStage(this.session)?.id === "breath") this.tapBreath();
    };
    this.scene.input.keyboard.on("keydown-SPACE", this.spaceHandler);
    this.tickEvent = this.scene.time.addEvent({ delay: 50, loop: true, callback: () => this.tick() });
  }

  stopRuntime() {
    this.tickEvent?.remove(false);
    this.tickEvent = null;
    this.scene.input.keyboard.off("keydown-SPACE", this.spaceHandler);
  }

  tick() {
    if (this.resolved) return;
    const result = this.rules.tick(this.session, { deltaMs: 50 });
    if (result.stageChanged) this.drawStage();
    this.updateDisplay();
    if (result.expired) this.resolve(this.rules.finish(this.session, { manual: false }));
  }

  tapBreath() {
    if (this.resolved) return;
    const result = this.rules.tapBreath(this.session);
    if (!result.ok) { this.liveHint.setText(result.message); return; }
    this.liveHint.setText(`${result.message}  时机 ${result.quality}%`);
    if (result.stageChanged) this.drawStage();
    this.updateDisplay();
  }

  chooseFocus(index, bg) {
    if (this.resolved) return;
    const result = this.rules.chooseFocus(this.session, index);
    if (!result.ok) return;
    bg.setFillStyle(result.correct ? 0x2c6b57 : 0x773b45).setStrokeStyle(3, result.correct ? 0x88dcad : 0xe28182);
    this.liveHint.setText(result.message);
    this.scene.time.delayedCall(260, () => {
      if (this.resolved) return;
      this.drawStage();
      this.updateDisplay();
    });
  }

  chooseMemory(index, bg) {
    if (this.resolved) return;
    const result = this.rules.chooseMemoryRune(this.session, index);
    if (!result.ok) { this.liveHint.setText(result.message); return; }
    bg.setFillStyle(result.correct ? 0x2c6b57 : 0x773b45).setStrokeStyle(3, result.correct ? 0x88dcad : 0xe28182);
    this.liveHint.setText(result.message);
    this.updateDisplay();
    if (result.complete) this.scene.time.delayedCall(280, () => this.resolve(this.rules.finish(this.session, { manual: true })));
  }

  updateDisplay() {
    const stage = this.rules.getStage(this.session);
    if (!stage) return;
    this.stageTitle.setText(`${stage.seal} · ${stage.label}`);
    this.stageInstruction.setText(stage.instruction);
    this.timeText.setText(`${Math.max(0, Math.ceil((stage.durationMs - this.session.stageElapsedMs) / 1000))}`);
    this.phaseCards.forEach((card, index) => {
      const active = index === this.session.stageIndex;
      const done = index < this.session.stageIndex;
      card.bg.setFillStyle(active ? 0x274f85 : done ? 0x203f35 : 0x101a32).setStrokeStyle(2, active ? 0x8bbcff : done ? 0x72b98b : 0x405274);
      card.label.setColor(active ? "#eaf4ff" : done ? "#91d4a7" : "#8fa0ba");
    });
    const breathSum = this.session.breath.taps.reduce((sum, value) => sum + value, 0);
    const breathAccuracy = Math.round(breathSum / 3 * 100);
    const focusCorrect = this.session.focus.answers.filter(Boolean).length;
    const memoryCorrect = this.session.memory.answers.filter(Boolean).length;
    this.progressText.setText(
      `调息契合  ${breathAccuracy}%\n\n守心真念  ${focusCorrect} / 4\n\n铭法符序  ${memoryCorrect} / ${this.session.memory.sequence.length}`,
    );
    if (stage.id === "breath") {
      const phase = this.rules.getBreathPhase(this.session);
      const nearTarget = Math.abs(phase - 0.5) <= 0.13;
      this.breathRing?.setScale(0.72 + phase * 0.72).setStrokeStyle(6, nearTarget ? 0xf1d467 : 0x72b2ff, 0.9);
      this.breathGlow?.setScale(0.88 + phase * 0.28).setAlpha(0.12 + phase * 0.18);
      this.breathCountText?.setText(`吐纳 ${this.session.breath.taps.length} / 3`);
      this.stageDetail.setText("观察蓝色呼吸环\n与金色心环重合时吐纳");
    } else if (stage.id === "focus") {
      this.stageDetail.setText(`第 ${Math.min(4, this.session.focus.roundIndex + 1)} / 4 念\n选错仍会继续，但会降低心境评分`);
    } else {
      const ready = this.rules.isMemoryInputReady(this.session);
      const visibleRune = this.rules.getVisibleMemoryRune(this.session);
      this.memoryRuneText?.setText(ready ? "铭" : visibleRune || "凝神").setColor(visibleRune ? "#f2d167" : ready ? "#dceaff" : "#8299bd");
      this.memoryModeText?.setText(ready ? "请按原顺序复现" : visibleRune ? "记住这一符" : "符文即将显现");
      this.memoryButtons?.forEach(({ bg, label }) => {
        bg.setAlpha(ready ? 1 : 0.35);
        label.setColor(ready ? "#e0edff" : "#687995");
      });
      this.stageDetail.setText(ready
        ? `已铭 ${this.session.memory.answers.length} / ${this.session.memory.sequence.length}\n闭关越久，符序越长`
        : `正在显现 ${this.session.memory.sequence.length} 道符文\n此时点击不会生效`);
    }
  }

  resolve(outcome) {
    if (this.resolved || !outcome?.ok) return;
    this.resolved = true;
    this.stopRuntime();
    const result = this.onResolve?.(outcome) || { ok: false, message: "闭关结算失败。" };
    this.showResult(outcome, result);
  }

  showResult(outcome, result) {
    this.gameLayer.destroy(true);
    const scene = this.scene;
    const success = result.practice ? result.successful : result.learned;
    const color = success ? 0x568dd4 : 0x81404b;
    const textColor = GRADE_COLORS[outcome.grade] || "#dceaff";
    this.resultLayer = scene.add.container(0, 0);
    this.root.add(this.resultLayer);
    this.resultLayer.add(scene.add.rectangle(0, 0, 1920, 1080, 0x040817, 1).setOrigin(0).setInteractive());
    const outer = scene.add.circle(960, 505, 255, color, 0.16).setStrokeStyle(4, color, 0.86);
    const inner = scene.add.circle(960, 505, 176, 0x10254a, 0.92).setStrokeStyle(3, success ? 0x89baf2 : 0xc16d77);
    const seal = addText(scene, 960, 430, this.attempt.study.seal, 86, textColor, { origin: 0.5, strokeThickness: 3 });
    const title = addText(scene, 960, 555, result.practice ? "静 心 演 练" : success ? `${this.attempt.study.name}铭刻于心` : "心 境 未 稳", 35, textColor, { origin: 0.5, strokeThickness: 3 });
    const grade = addText(scene, 960, 620, `${outcome.grade} · 心境评分 ${outcome.score}`, 23, "#d6e6ff", { origin: 0.5, strokeThickness: 1 });
    const stats = addText(scene, 960, 674, `调息 ${outcome.breathAccuracy}%   守心 ${outcome.focusAccuracy}%   铭法 ${outcome.memoryAccuracy}%`, 16, "#9db2d2", { origin: 0.5, strokeThickness: 0 });
    const message = addText(scene, 960, 738, result.message, 18, success ? "#cce5d4" : "#d9b6ba", { origin: 0.5, align: "center", wordWrap: { width: 760 }, lineSpacing: 8, strokeThickness: 1 });
    const close = addButton(scene, 960, 855, 260, "返回闭关室", () => this.close(result.message), { height: 58, size: 20 });
    this.resultLayer.add([outer, inner, seal, title, grade, stats, message, close]);
    scene.tweens.add({ targets: outer, scale: { from: 0.78, to: 1.08 }, alpha: { from: 0.22, to: 0.82 }, duration: 950, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  abort() {
    if (this.resolved) { this.close(); return; }
    this.stopRuntime();
    const result = this.onAbort?.() || { message: "已提前结束闭关。" };
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

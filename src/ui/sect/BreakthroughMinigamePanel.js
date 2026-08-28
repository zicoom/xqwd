import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const UI_FONT = '"SJ yuantijian-C-Regular", "Microsoft YaHei", sans-serif';
const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const TWO_PI = Math.PI * 2;

const text = (scene, x, y, value, size, color, extra = {}) => addText(scene, x, y, value, size, color, {
  origin: 0.5,
  fontFamily: UI_FONT,
  strokeThickness: 1,
  ...extra,
});

/**
 * 炼气突破的“灵息凝旋”表现层。
 * 规则由 BreakthroughTrialService 保存：此处只根据当前回合绘制转盘并提交玩家点击时的位置。
 */
export class BreakthroughMinigamePanel {
  constructor(scene, { rules, player, onResolve, onAbort, onClose }) {
    this.scene = scene;
    this.rules = rules;
    this.player = player;
    this.onResolve = onResolve;
    this.onAbort = onAbort;
    this.onClose = onClose;
    this.attempt = rules.createTrial(player);
    this.root = scene.add.container(0, 0).setDepth(1400);
    this.resolved = false;
    this.lastTickAt = scene.time.now;
    if (!this.attempt.ok) {
      this.onAbort?.(this.attempt.message);
      return;
    }
    this.draw();
    this.bindInput();
    this.refresh();
  }

  draw() {
    const scene = this.scene;
    this.root.add(scene.add.rectangle(0, 0, 1920, 1080, 0x050918, 0.96).setOrigin(0).setInteractive());
    const haze = scene.add.graphics();
    haze.fillStyle(0x294c85, 0.12);
    haze.fillCircle(960, 535, 410);
    haze.fillStyle(0xd39a35, 0.08);
    haze.fillCircle(960, 535, 270);
    this.root.add(haze);

    this.root.add(text(scene, 960, 116, "破 境 · 灵 息 凝 旋", 40, "#f0ce7f", { fontFamily: TITLE_FONT, strokeThickness: 3 }));
    this.root.add(text(scene, 960, 163, "让旋转的灵机落入金色气穴，再按 空格 或点击中央法印。", 18, "#9eb5d8", { strokeThickness: 0 }));

    this.root.add(scene.add.rectangle(320, 540, 340, 570, 0x0d1730, 0.96).setStrokeStyle(2, 0x4d6798));
    this.root.add(text(scene, 320, 314, "凝神要诀", 25, "#c5dafb", { strokeThickness: 2 }));
    this.instructionText = text(scene, 320, 405, "", 19, "#d8e6fa", { align: "center", wordWrap: { width: 268 }, lineSpacing: 12, strokeThickness: 0 });
    this.scoreText = text(scene, 320, 605, "", 22, "#edcf83", { strokeThickness: 1 });
    this.historyText = text(scene, 320, 732, "", 16, "#8da5c8", { align: "center", lineSpacing: 10, strokeThickness: 0 });
    this.root.add([this.instructionText, this.scoreText, this.historyText]);

    this.root.add(scene.add.rectangle(1600, 540, 340, 570, 0x0d1730, 0.96).setStrokeStyle(2, 0x4d6798));
    this.roundText = text(scene, 1600, 350, "", 28, "#dbeaff", { fontFamily: TITLE_FONT, strokeThickness: 2 });
    this.timeText = text(scene, 1600, 455, "", 60, "#f6df9e", { fontFamily: TITLE_FONT, strokeThickness: 2 });
    this.hintText = text(scene, 1600, 610, "", 18, "#a8c1e7", { align: "center", wordWrap: { width: 270 }, lineSpacing: 10, strokeThickness: 0 });
    this.root.add([this.roundText, this.timeText, this.hintText]);

    this.wheel = scene.add.graphics();
    this.needle = scene.add.graphics();
    this.root.add([this.wheel, this.needle]);
    this.root.add(scene.add.circle(960, 535, 63, 0x233961, 1).setStrokeStyle(4, 0xd9a746));
    this.root.add(text(scene, 960, 521, "凝", 38, "#fff4c9", { fontFamily: TITLE_FONT, strokeThickness: 2 }));
    this.root.add(text(scene, 960, 566, "空格", 14, "#aac4ea", { strokeThickness: 0 }));
    const hit = scene.add.circle(960, 535, 63, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.root.add(hit);
    hit.on("pointerdown", () => this.hit());

    this.resultLayer = null;
    this.tickEvent = scene.time.addEvent({ delay: 50, loop: true, callback: () => this.tick() });
  }

  bindInput() {
    this.spaceHandler = () => this.hit();
    this.scene.input.keyboard.on("keydown-SPACE", this.spaceHandler);
    this.abortButton = this.makeButton(960, 958, 190, 52, "放弃突破", () => this.abort(), {
      fill: 0x482830, hoverFill: 0x663641, stroke: 0xa6686a,
    });
  }

  makeButton(x, y, width, height, label, callback, { fill = 0x4d3720, hoverFill = 0x72512d, stroke = 0xd0a54f } = {}) {
    const scene = this.scene;
    const box = scene.add.container(x, y);
    const graphics = scene.add.graphics();
    const paint = (color) => {
      graphics.clear();
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
      graphics.lineStyle(2, stroke, 1);
      graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
    };
    paint(fill);
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    box.add([graphics, hit, text(scene, 0, 0, label, 19, "#fff0bd", { fontFamily: UI_FONT, strokeThickness: 1 })]);
    this.root.add(box);
    hit.on("pointerover", () => paint(hoverFill));
    hit.on("pointerout", () => paint(fill));
    hit.on("pointerdown", () => { playUiClickSound(scene); callback(); });
    return box;
  }

  tick() {
    if (this.resolved) return;
    const now = this.scene.time.now;
    const result = this.rules.advanceTrial(this.attempt, now - this.lastTickAt);
    this.lastTickAt = now;
    this.refresh();
    if (result.finished) this.resolve(result);
  }

  hit() {
    if (this.resolved) return;
    const round = this.rules.getCurrentRound(this.attempt);
    if (!round) return;
    const position = round.elapsedMs / this.attempt.trial.roundDurationMs;
    const result = this.rules.recordHit(this.attempt, position);
    if (result.finished) this.resolve(result);
    else {
      this.hintText.setText(result.hit.score === 2 ? "灵机与气穴完全重合！" : result.hit.score === 1 ? "灵息已纳入经脉。" : "灵息偏离，下一次更稳一些。\n不要着急，观察金色气穴。 ");
      this.refresh();
    }
  }

  refresh() {
    const round = this.rules.getCurrentRound(this.attempt);
    if (!round) return;
    const { trial } = this.attempt;
    const phase = round.elapsedMs / trial.roundDurationMs;
    const angle = phase * TWO_PI - Math.PI / 2;
    const targetAngle = round.target * TWO_PI - Math.PI / 2;
    const radius = 235;
    this.wheel.clear();
    this.wheel.lineStyle(12, 0x2f5a91, 0.72);
    this.wheel.strokeCircle(960, 535, radius);
    this.wheel.lineStyle(20, 0xd3a448, 0.95);
    this.wheel.beginPath();
    this.wheel.arc(960, 535, radius, targetAngle - trial.goodWindow * TWO_PI, targetAngle + trial.goodWindow * TWO_PI, false);
    this.wheel.strokePath();
    this.wheel.lineStyle(6, 0xffed9e, 1);
    this.wheel.beginPath();
    this.wheel.arc(960, 535, radius, targetAngle - trial.perfectWindow * TWO_PI, targetAngle + trial.perfectWindow * TWO_PI, false);
    this.wheel.strokePath();
    this.needle.clear();
    this.needle.lineStyle(7, 0xe7f1ff, 1);
    this.needle.lineBetween(960, 535, 960 + Math.cos(angle) * 214, 535 + Math.sin(angle) * 214);
    this.needle.fillStyle(0x6db7ff, 1);
    this.needle.fillCircle(960 + Math.cos(angle) * 214, 535 + Math.sin(angle) * 214, 13);

    const score = this.attempt.results.reduce((sum, entry) => sum + entry.score, 0);
    this.roundText.setText(`第 ${round.index + 1} / ${trial.rounds} 次凝息`);
    this.timeText.setText(`${Math.max(0, Math.ceil(round.remainingMs / 1000))}`);
    this.instructionText.setText(`${trial.description}\n\n金色粗环：命中\n中心亮线：完美命中\n\n按空格或点击中央“凝”字。`);
    this.scoreText.setText(`当前灵息：${score} / ${trial.passScore}`);
    this.historyText.setText(this.attempt.results.length
      ? this.attempt.results.map((entry) => `第${entry.round}息 · ${entry.quality} +${entry.score}`).join("\n")
      : "尚未凝聚灵息");
    if (!this.hintText.text) this.hintText.setText("等待灵机进入金色气穴。\n太早或太晚都会失去本次机会。");
  }

  resolve(outcome) {
    if (this.resolved) return;
    this.resolved = true;
    this.stopRuntime();
    const result = this.onResolve?.(outcome) || { ok: false, message: "突破结算失败。" };
    this.showResult(outcome, result);
  }

  showResult(outcome, result) {
    const scene = this.scene;
    const success = result.success === true;
    const layer = scene.add.container(0, 0);
    this.resultLayer = layer;
    this.root.add(layer);
    layer.add(scene.add.rectangle(960, 540, 1920, 1080, 0x02040b, 0.88).setInteractive());
    layer.add(scene.add.circle(960, 465, 216, success ? 0x347c66 : 0x7b3542, 0.2).setStrokeStyle(4, success ? 0x83d9ab : 0xe08588));
    layer.add(text(scene, 960, 390, success ? "破 境 成 功" : "冲 关 未 成", 42, success ? "#baf0cd" : "#f0a2a2", { fontFamily: TITLE_FONT, strokeThickness: 3 }));
    layer.add(text(scene, 960, 470, `灵息评分 ${outcome.score} / ${outcome.maxScore}`, 24, "#f4db94", { strokeThickness: 1 }));
    layer.add(text(scene, 960, 546, result.message, 19, "#d9e4f7", { align: "center", wordWrap: { width: 620 }, lineSpacing: 10, strokeThickness: 0 }));
    this.resultCloseButton = this.makeButton(960, 750, 220, 58, "返回闭关室", () => this.close(), {
      fill: success ? 0x2d694c : 0x573136,
      hoverFill: success ? 0x3c825d : 0x713e46,
      stroke: success ? 0x91d1a8 : 0xda8c8c,
    });
  }

  abort() {
    if (this.resolved) return;
    this.resolved = true;
    this.stopRuntime();
    this.root?.destroy(true);
    this.root = null;
    this.onAbort?.("已放弃本次突破，修为没有变化。");
  }

  handleEscape() {
    if (this.resolved) this.close();
    else this.abort();
    return true;
  }

  stopRuntime() {
    this.tickEvent?.remove(false);
    this.tickEvent = null;
    this.scene.input.keyboard.off("keydown-SPACE", this.spaceHandler);
    this.abortButton?.setVisible(false);
  }

  close() {
    this.stopRuntime();
    this.root?.destroy(true);
    this.root = null;
    this.onClose?.();
  }
}

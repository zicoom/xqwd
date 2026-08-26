import { getRetreatBookPreviews } from "../../core/RetreatCatalog.js";
import { gameState } from "../../core/GameState.js";
import { getCultivationProgress } from "../../domain/character/CharacterProfileService.js";
import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const UI_FONT = '"SJ yuantijian-C-Regular", "Microsoft YaHei", sans-serif';
const COLORS = Object.freeze({
  navy: 0x070916,
  panel: 0x161d30,
  panelCard: 0x222738,
  blue: 0x426ba7,
  brown: 0x574131,
  paleBlue: 0xaec8ff,
  gold: 0xfebc00,
  button: 0x3b2a1e,
  buttonHover: 0x5b3c26,
});

const KIND_META = Object.freeze({
  spell: { label: "法术", seal: "术", color: COLORS.blue },
  technique: { label: "功法", seal: "功", color: COLORS.brown },
});

const GRADE_COLORS = Object.freeze({
  凡品: "#b9c0ce",
  灵品: "#55cf93",
  地品: "#64a9ff",
  天品: "#bf79ff",
  仙品: "#ff6969",
});

const textStyle = (origin = 0.5, extra = {}) => ({
  origin,
  fontFamily: UI_FONT,
  strokeThickness: 0,
  ...extra,
});

/** 严格按 Pixso 页面 2 复刻的闭关室界面；规则和存档仍由领域服务负责。 */
export class RetreatRoomPanel {
  constructor(scene, { service, cultivationService, sectName, onBack, onProgressChanged }) {
    this.scene = scene;
    this.service = service;
    this.cultivationService = cultivationService;
    this.sectName = sectName;
    this.onBack = onBack;
    this.onProgressChanged = onProgressChanged;
    this.selectedMonths = this.service.listDurations()[0]?.months || 12;
    this.meditationTimer = null;
    this.studyTimer = null;
    this.successTimer = null;
    this.overlay = null;
    this.overlayMasks = [];
    this.overlayMode = "";
    this.lastMessage = "";
    this.root = scene.add.container(0, 0).setDepth(500);
    this.drawBackground();
    this.renderMain();
  }

  drawBackground() {
    const scene = this.scene;
    const hitArea = scene.add.rectangle(960, 540, 1920, 1080, COLORS.navy, 1).setInteractive();
    const background = scene.add.image(960, 540, "pixso-retreat-background").setDisplaySize(1920, 1080);
    const shade = scene.add.graphics();
    shade.fillGradientStyle(0x192141, 0x192141, 0x070916, 0x070916, 0.84, 0.84, 0.96, 0.96);
    shade.fillRect(0, 0, 1920, 1080);
    this.root.add([hitArea, background, shade]);
  }

  renderMain(message = this.lastMessage) {
    this.lastMessage = message || "";
    this.content?.destroy(true);
    this.content = this.scene.add.container(0, 0);
    this.root.add(this.content);
    this.cultivationFill = null;
    this.cultivationValue = null;
    this.meditationFill = null;
    this.meditationCaption = null;

    const scene = this.scene;
    const cultivation = getCultivationProgress(gameState.player);
    const progress = Math.min(1, cultivation.experience / Math.max(1, cultivation.target));
    const active = this.cultivationService.getActiveMeditation();
    const plan = active?.plan || this.cultivationService.getPlan(this.selectedMonths);

    this.addMainText(960, 207, gameState.player.name, 30, "#eff2f7", { fontFamily: TITLE_FONT });
    this.addMainText(960, 248, gameState.player.realm, 18, "#d9a942");
    this.content.add(scene.add.rectangle(960, 281, 315, 16, 0x02050c, 0.9).setStrokeStyle(1, 0x445474));
    this.cultivationFill = scene.add.rectangle(804, 281, 311, 12, 0x5389ee, 1).setOrigin(0, 0.5).setScale(progress, 1);
    this.content.add(this.cultivationFill);
    this.cultivationValue = this.addMainText(960, 303, `${cultivation.experience} / ${cultivation.target}`, 14, "#858da2");

    this.content.add(scene.add.image(960, 540, "pixso-retreat-meditation").setDisplaySize(500, 500));
    this.drawKindButton(602, 546, "spell");
    this.drawKindButton(1318, 546, "technique");

    this.addMainText(960, 781, `闭关 ${plan?.years || 1} 年`, 26, "#e8edf7", { fontFamily: TITLE_FONT });
    this.addMainText(960, 822, active
      ? `已获得：+${active.gainedExp} / ${active.totalExp} 修为`
      : `获得：+${plan?.totalExp || 0} 修为`, 17, "#e6bd54");
    this.drawDurationControl(plan, active);

    const state = this.cultivationService.getState();
    this.addMainText(960, 942, active
      ? `吐纳进行中 · 剩余约 ${Math.ceil(active.remainingMs / 1000)} 秒`
      : `★ 累计闭关 ${this.formatMonths(state.totalMonths)}，闭关越久修为越丰厚`, 14, "#b7a05f");
    this.makeButton(this.content, 960, 990, 200, 55, active ? "提前出关" : "开始闭关", () => {
      if (active) this.abortCultivationRetreat();
      else this.startCultivationRetreat();
    }, { fontSize: 21 });

    this.makeButton(this.content, 1762, 991, 185, 55, "离开闭关室", () => this.close(), { fontSize: 19 });
    this.makeButton(this.content, 1804, 80, 120, 64, "闭关室", () => {}, {
      fontSize: 20,
      fill: 0x35291f,
      hoverFill: 0x35291f,
    });

    if (message) this.showToast(message, 960, 1038, this.content, 2500);
    if (active) this.ensureMeditationTimer();
  }

  drawDurationControl(plan, active) {
    const scene = this.scene;
    const durations = this.service.listDurations();
    const selectedIndex = Math.max(0, durations.findIndex((entry) => entry.months === (plan?.months || this.selectedMonths)));
    const barX = 802;
    const barWidth = 315;
    this.content.add(scene.add.rectangle(960, 851, barWidth, 12, 0x11182a, 1).setStrokeStyle(1, 0x45577c));
    const ratio = active?.progress ?? (selectedIndex / Math.max(1, durations.length - 1));
    this.meditationFill = scene.add.rectangle(barX, 851, barWidth, 12, 0x5389ee, 1).setOrigin(0, 0.5).setScale(ratio, 1);
    this.content.add(this.meditationFill);
    this.content.add(scene.add.circle(barX + barWidth * ratio, 851, 12, 0xf5f7ff, 1).setStrokeStyle(3, 0x72a1f1));

    const xs = [863, 930, 1002, 1074];
    durations.forEach((duration, index) => {
      const selected = duration.months === (plan?.months || this.selectedMonths);
      this.makeButton(this.content, xs[index], 900, 58, 42, duration.label, () => {
        if (active) return;
        this.selectedMonths = duration.months;
        this.renderMain("");
      }, {
        fontSize: 15,
        fill: selected ? 0x426ba7 : 0x182238,
        hoverFill: selected ? 0x426ba7 : 0x263553,
        stroke: selected ? 0x8db8ff : 0x435573,
      });
    });
  }

  drawKindButton(x, y, kind) {
    const meta = KIND_META[kind];
    const scene = this.scene;
    const circle = scene.add.circle(x, y, 67.5, meta.color, 0.96)
      .setStrokeStyle(3, 0x8fb4ed, 0.85)
      .setInteractive({ useHandCursor: true });
    this.content.add(circle);
    this.addMainText(x, y - 14, meta.seal, 42, "#eef3fb", { fontFamily: TITLE_FONT });
    this.addMainText(x, y + 43, meta.label, 20, "#aeb7ca");
    circle.on("pointerover", () => circle.setFillStyle(meta.color, 1).setScale(1.04));
    circle.on("pointerout", () => circle.setFillStyle(meta.color, 0.96).setScale(1));
    circle.on("pointerdown", () => {
      playUiClickSound(scene);
      if (this.cultivationService.getActiveMeditation()) {
        this.renderMain("请先结束正在进行的清修闭关。");
        return;
      }
      this.openBookModal(kind);
    });
  }

  openBookModal(kind = "spell") {
    this.destroyOverlay();
    this.overlayMode = "books";
    const scene = this.scene;
    const overlay = scene.add.container(0, 0).setDepth(1200);
    this.overlay = overlay;
    overlay.add(scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.8).setInteractive());
    this.addRoundedPanel(overlay, 960, 540, 565, 764, 20, COLORS.panel, 1, 0x363b55, 2);
    this.addOverlayText(710, 200, `${KIND_META[kind].label}秘籍`, 26, COLORS.paleBlue, { origin: [0, 0.5] });
    overlay.add(scene.add.rectangle(960, 236, 500, 1, 0x626a82, 0.72));
    const close = this.addOverlayText(1197, 207, "×", 35, "#9299aa").setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => {
      playUiClickSound(scene);
      this.destroyOverlay();
    });

    const previews = getRetreatBookPreviews(kind);
    const studies = new Map(this.service.listStudies(kind).map((study) => [study.id, study]));
    const positions = [[830, 356], [1091, 356], [830, 571], [1091, 571], [830, 786], [1091, 786]];
    previews.forEach((preview, index) => {
      const [x, y] = positions[index] || [830 + (index % 2) * 261, 356 + Math.floor(index / 2) * 215];
      this.drawBookCard(overlay, preview, studies.get(preview.studyId), x, y, index === 0);
    });
    if (kind === "technique" && previews.length < 6) {
      this.addOverlayText(960, 638, "其余功法秘籍将在后续门派内容中开放", 17, "#7f879c");
    }
  }

  drawBookCard(parent, preview, study, x, y, highlighted) {
    const scene = this.scene;
    const card = scene.add.container(x, y);
    parent.add(card);
    const frame = scene.add.graphics();
    const redraw = (hovered = false) => {
      frame.clear();
      frame.fillStyle(COLORS.panelCard, 1);
      frame.fillRoundedRect(-120, -97.5, 240, 195, 10);
      frame.lineStyle(2, highlighted || hovered ? COLORS.gold : 0x454b65, highlighted || hovered ? 1 : 0.9);
      frame.strokeRoundedRect(-120, -97.5, 240, 195, 10);
    };
    redraw();
    card.add(frame);
    const hit = scene.add.rectangle(0, 0, 240, 195, 0xffffff, 0).setInteractive({ useHandCursor: true });
    card.add(hit);
    if (scene.textures.exists(preview.artKey)) card.add(scene.add.image(0, -45, preview.artKey).setDisplaySize(60, 60));
    card.add(this.makeTextObject(0, 7, preview.name, 18, "#f0f1f5"));
    card.add(this.makeTextObject(0, 37, `${preview.grade} · ${preview.element}系`, 14, GRADE_COLORS[preview.grade] || "#b9c0ce"));
    const requirement = study?.learned ? "已领悟" : study?.owned ? "秘籍已备" : preview.requirement;
    card.add(this.makeTextObject(0, 67, `◉ ${requirement}`, 14, study?.owned ? "#6bd39d" : "#c5a967"));
    hit.on("pointerover", () => redraw(true));
    hit.on("pointerout", () => redraw(false));
    hit.on("pointerdown", () => {
      playUiClickSound(scene);
      if (!preview.studyId) {
        this.showToast(preview.lockedMessage || "该秘籍尚未开放。", 960, 957, parent, 2200);
        return;
      }
      const started = this.service.beginTimedStudy(preview.studyId, this.selectedMonths, scene.time.now);
      if (!started.ok) {
        this.showToast(started.message, 960, 957, parent, 2400);
        return;
      }
      this.openLearningOverlay(started);
    });
  }

  openLearningOverlay(started) {
    this.destroyOverlay({ keepStudy: true });
    this.overlayMode = "learning";
    const scene = this.scene;
    const overlay = scene.add.container(0, 0).setDepth(1200);
    this.overlay = overlay;
    overlay.add(scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.8).setInteractive());
    const outer = scene.add.circle(957, 482, 122, 0x162a50, 0.2).setStrokeStyle(4, 0x6194e8, 0.88);
    const inner = scene.add.circle(957, 482, 87, 0x142341, 0.14).setStrokeStyle(2, 0x94bcff, 0.9);
    overlay.add([outer, inner]);
    overlay.add(scene.add.image(957, 478, "pixso-retreat-meditation").setDisplaySize(210, 210));
    this.learningTitle = this.addOverlayText(960, 638, "引气入体，凝神铭法...", 35, "#bbc8f1", { fontFamily: TITLE_FONT });
    this.addRoundedPanel(overlay, 960, 706, 533, 35, 17, 0x05070d, 0.66, 0x2d3b58, 1);
    this.learningFill = scene.add.rectangle(696, 706, 525, 27, 0x5389ee, 1).setOrigin(0, 0.5).setScale(0, 1);
    overlay.add(this.learningFill);
    this.learningCaption = this.addOverlayText(960, 752, this.learningProgressText(started), 20, "#86899c");
    scene.tweens.add({ targets: outer, alpha: { from: 0.58, to: 1 }, scale: { from: 0.96, to: 1.05 }, duration: 1150, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    scene.tweens.add({ targets: inner, angle: 360, duration: 6000, repeat: -1 });
    this.studyTimer = scene.time.addEvent({ delay: 100, loop: true, callback: () => this.advanceTimedStudy() });
  }

  advanceTimedStudy() {
    const status = this.service.advanceTimedStudy(this.scene.time.now);
    if (!status.ok) {
      this.destroyOverlay();
      this.renderMain(status.message);
      return;
    }
    this.learningFill?.setScale(status.progress, 1);
    this.learningCaption?.setText(this.learningProgressText(status));
    if (!status.completed) return;
    this.stopStudyTimer();
    const result = this.service.completeTimedStudy();
    this.onProgressChanged?.();
    if (!result.ok) {
      this.destroyOverlay({ keepStudy: true });
      this.renderMain(result.message);
      return;
    }
    this.openSuccessOverlay(result);
  }

  learningProgressText(status) {
    const totalYears = Math.max(1, Number(status.duration?.years) || 1);
    const elapsedYears = Math.min(totalYears, Math.floor(totalYears * (Number(status.progress) || 0)));
    return `闭关进度:${elapsedYears}/${totalYears}年`;
  }

  openSuccessOverlay(result) {
    this.destroyOverlay({ keepStudy: true });
    this.overlayMode = "success";
    const scene = this.scene;
    const overlay = scene.add.container(0, 0).setDepth(1200);
    this.overlay = overlay;
    overlay.add(scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.8).setInteractive());
    const successKey = result.study.id === "study-huoqiu"
      ? "pixso-retreat-success-huoqiu"
      : "pixso-retreat-book-bengshan";
    const successImage = scene.add.image(960, 398, successKey).setDisplaySize(139, 139);
    const successMaskShape = scene.make.graphics({ x: 0, y: 0, add: false });
    successMaskShape.fillStyle(0xffffff, 1);
    successMaskShape.fillRoundedRect(890.5, 328.5, 139, 139, 20);
    successImage.setMask(successMaskShape.createGeometryMask());
    this.overlayMasks.push(successMaskShape);
    overlay.add(successImage);
    this.addOverlayText(960, 528, "参悟成功！", 52, "#ffd10c", { fontFamily: TITLE_FONT });
    this.addOverlayText(960, 613, `领悟了[${result.study.name}]第一层`, 30, "#bca877");
    this.successTimer = scene.time.delayedCall(3000, () => {
      this.successTimer = null;
      this.destroyOverlay({ keepStudy: true });
      this.renderMain(`${result.study.name}已铭刻于心，修为 +${result.gainedExp}。`);
    });
  }

  startCultivationRetreat() {
    if (this.overlay) return;
    const started = this.cultivationService.beginMeditation(this.selectedMonths, this.scene.time.now);
    if (!started.ok) {
      this.renderMain(started.message);
      return;
    }
    this.renderMain("");
  }

  ensureMeditationTimer() {
    if (this.meditationTimer) return;
    this.meditationTimer = this.scene.time.addEvent({ delay: 100, loop: true, callback: () => this.advanceCultivationRetreat() });
  }

  advanceCultivationRetreat() {
    const result = this.cultivationService.advanceMeditation(this.scene.time.now);
    if (!result.ok) {
      this.stopMeditationTimer();
      this.renderMain(result.message);
      return;
    }
    this.onProgressChanged?.();
    const cultivation = getCultivationProgress(gameState.player);
    this.cultivationFill?.setScale(Math.min(1, cultivation.experience / Math.max(1, cultivation.target)), 1);
    this.cultivationValue?.setText(`${cultivation.experience} / ${cultivation.target}`);
    if (result.completed) {
      this.stopMeditationTimer();
      this.renderMain(result.message);
      return;
    }
    this.meditationFill?.setScale(result.progress, 1);
    this.meditationCaption?.setText?.(`已获得：+${result.gainedExp} / ${result.totalExp} 修为`);
  }

  abortCultivationRetreat({ render = true } = {}) {
    const result = this.cultivationService.abortMeditation();
    this.stopMeditationTimer();
    this.onProgressChanged?.();
    if (render) this.renderMain(result.message);
    return result;
  }

  addMainText(x, y, value, size, color, extra = {}) {
    const object = this.makeTextObject(x, y, value, size, color, extra);
    this.content.add(object);
    if (y === 822) this.meditationCaption = object;
    return object;
  }

  addOverlayText(x, y, value, size, color, extra = {}) {
    const object = this.makeTextObject(x, y, value, size, color, extra);
    this.overlay.add(object);
    return object;
  }

  makeTextObject(x, y, value, size, color, extra = {}) {
    return addText(this.scene, x, y, value, size, color, textStyle(extra.origin ?? 0.5, extra));
  }

  addRoundedPanel(parent, x, y, width, height, radius, fill, alpha = 1, stroke = null, strokeWidth = 0) {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(fill, alpha);
    graphics.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    if (stroke !== null && strokeWidth > 0) {
      graphics.lineStyle(strokeWidth, stroke, 1);
      graphics.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    }
    parent.add(graphics);
    return graphics;
  }

  makeButton(parent, x, y, width, height, label, callback, options = {}) {
    const scene = this.scene;
    const container = scene.add.container(x, y);
    const visual = scene.add.graphics();
    const fill = options.fill ?? COLORS.button;
    const hoverFill = options.hoverFill ?? COLORS.buttonHover;
    const stroke = options.stroke ?? 0xd4a64b;
    const redraw = (color) => {
      visual.clear();
      visual.fillStyle(color, 1);
      visual.fillRoundedRect(-width / 2, -height / 2, width, height, options.radius ?? 4);
      visual.lineStyle(options.strokeWidth ?? 2, stroke, 1);
      visual.strokeRoundedRect(-width / 2, -height / 2, width, height, options.radius ?? 4);
    };
    redraw(fill);
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const title = this.makeTextObject(0, 0, label, options.fontSize ?? 18, options.textColor ?? "#f4d889");
    container.add([visual, hit, title]);
    parent.add(container);
    hit.on("pointerover", () => redraw(hoverFill));
    hit.on("pointerout", () => redraw(fill));
    hit.on("pointerdown", () => {
      playUiClickSound(scene);
      callback();
    });
    return container;
  }

  showToast(message, x, y, parent, duration = 2200) {
    if (!message || !parent?.active) return null;
    const toast = this.scene.add.container(x, y);
    const width = Math.min(720, Math.max(260, String(message).length * 18 + 56));
    const visual = this.scene.add.graphics();
    visual.fillStyle(0x131a2b, 0.96);
    visual.fillRoundedRect(-width / 2, -22, width, 44, 8);
    visual.lineStyle(1, 0xb8974e, 0.85);
    visual.strokeRoundedRect(-width / 2, -22, width, 44, 8);
    toast.add([visual, this.makeTextObject(0, 0, message, 16, "#efd58a")]);
    parent.add(toast);
    this.scene.time.delayedCall(duration, () => toast?.active && toast.destroy(true));
    return toast;
  }

  formatMonths(months) {
    const value = Math.max(0, Math.floor(Number(months) || 0));
    if (value >= 12 && value % 12 === 0) return `${value / 12}年`;
    return `${value}个月`;
  }

  stopMeditationTimer() {
    this.meditationTimer?.remove(false);
    this.meditationTimer = null;
  }

  stopStudyTimer() {
    this.studyTimer?.remove(false);
    this.studyTimer = null;
  }

  destroyOverlay({ keepStudy = false } = {}) {
    this.stopStudyTimer();
    this.successTimer?.remove(false);
    this.successTimer = null;
    this.overlay?.destroy(true);
    this.overlayMasks.forEach((mask) => mask.destroy());
    this.overlayMasks = [];
    this.overlay = null;
    this.overlayMode = "";
    if (!keepStudy && this.service.activeAttempt) this.service.abortStudy();
  }

  handleEscape() {
    if (this.overlayMode === "success") return true;
    if (this.overlay) {
      this.destroyOverlay();
      return true;
    }
    this.close();
    return true;
  }

  close() {
    this.destroyOverlay();
    if (this.cultivationService.getActiveMeditation()) this.abortCultivationRetreat({ render: false });
    else this.stopMeditationTimer();
    this.root?.destroy(true);
    this.root = null;
    this.onBack?.();
  }
}

import { getRetreatBookPreviews } from "../../core/RetreatCatalog.js";
import { gameState } from "../../core/GameState.js";
import { getCultivationProgress } from "../../domain/character/CharacterProfileService.js";
import { addText, playUiClickSound } from "../../utils/UiHelpers.js";
import { BreakthroughMinigamePanel } from "./BreakthroughMinigamePanel.js";

const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const UI_FONT = '"SJ yuantijian-C-Regular", "Microsoft YaHei", sans-serif';
const BUTTON_FONT = '"SJ yuantijian-Z-Regular", "Microsoft YaHei", sans-serif';
const RETREAT_ROOM_ASSET_ROOT = "./public/assets/images/pixso/retreat-room";
const RETREAT_SUCCESS_ASSET_ROOT = `${RETREAT_ROOM_ASSET_ROOT}/study-success`;
const RETREAT_ROOM_ASSETS = Object.freeze({
  background: "pixso-retreat-room-background",
  meditation: "pixso-retreat-room-meditation",
  spellEntry: "pixso-retreat-room-spell-entry",
  techniqueEntry: "pixso-retreat-room-technique-entry",
  durationOption: "pixso-retreat-room-duration-option",
  durationPanel: "pixso-retreat-room-duration-panel",
  startButton: "pixso-retreat-room-start-button",
  returnButton: "pixso-retreat-room-return-button",
  roomPlaque: "pixso-retreat-room-plaque",
  successDisc: "pixso-retreat-study-success-disc",
  successSkillFrame: "pixso-retreat-study-success-skill-frame",
  successDivider: "pixso-retreat-study-success-divider",
  successDiamond: "pixso-retreat-study-success-diamond",
});
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
  spell: { label: "法术", assetKey: RETREAT_ROOM_ASSETS.spellEntry, width: 244, height: 292 },
  technique: { label: "功法", assetKey: RETREAT_ROOM_ASSETS.techniqueEntry, width: 243, height: 292 },
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

const formatRealm = (realm) => String(realm || "炼气初期").replace(/^炼气[·・]?/, "炼气·");

/** 预加载 Pixso“改版 / 闭关室”画板的语义化素材。 */
export function preloadRetreatRoomAssets(scene) {
  scene.load.image(RETREAT_ROOM_ASSETS.background, `${RETREAT_ROOM_ASSET_ROOT}/background.jpg`);
  scene.load.image(RETREAT_ROOM_ASSETS.meditation, `${RETREAT_ROOM_ASSET_ROOT}/meditating-cultivator.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.spellEntry, `${RETREAT_ROOM_ASSET_ROOT}/spell-entry.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.techniqueEntry, `${RETREAT_ROOM_ASSET_ROOT}/technique-entry.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.durationOption, `${RETREAT_ROOM_ASSET_ROOT}/duration-option.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.durationPanel, `${RETREAT_ROOM_ASSET_ROOT}/duration-panel.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.startButton, `${RETREAT_ROOM_ASSET_ROOT}/start-retreat-button.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.returnButton, `${RETREAT_ROOM_ASSET_ROOT}/return-sect-button.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.roomPlaque, `${RETREAT_ROOM_ASSET_ROOT}/room-plaque.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.successDisc, `${RETREAT_SUCCESS_ASSET_ROOT}/success-disc.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.successSkillFrame, `${RETREAT_SUCCESS_ASSET_ROOT}/skill-frame.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.successDivider, `${RETREAT_SUCCESS_ASSET_ROOT}/divider.png`);
  scene.load.image(RETREAT_ROOM_ASSETS.successDiamond, `${RETREAT_SUCCESS_ASSET_ROOT}/continue-diamond.png`);
}

/** 严格按 Pixso“改版 / 闭关室”(70:1601)复刻；规则和存档仍由领域服务负责。 */
export class RetreatRoomPanel {
  constructor(scene, { service, cultivationService, breakthroughService, breakthroughRules, sectName, onBack, onProgressChanged }) {
    this.scene = scene;
    this.service = service;
    this.cultivationService = cultivationService;
    this.breakthroughService = breakthroughService;
    this.breakthroughRules = breakthroughRules;
    this.breakthroughPanel = null;
    this.sectName = sectName;
    this.onBack = onBack;
    this.onProgressChanged = onProgressChanged;
    this.selectedMonths = this.service.listDurations()[0]?.months || 12;
    this.meditationTimer = null;
    this.studyTimer = null;
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
    const hitArea = scene.add.rectangle(960, 540, 1920, 1080, COLORS.navy, 0).setInteractive();
    const background = scene.add.image(0, -0.5, RETREAT_ROOM_ASSETS.background)
      .setOrigin(0)
      .setDisplaySize(1920, 1081);
    this.root.add([background, hitArea]);
  }

  renderMain(message = this.lastMessage) {
    this.lastMessage = message || "";
    this.content?.destroy(true);
    this.content = this.scene.add.container(0, 0);
    this.root.add(this.content);
    this.cultivationFill = null;
    this.cultivationProgressBar = null;
    this.cultivationValue = null;
    this.meditationFill = null;
    this.meditationProgressBar = null;
    this.meditationKnob = null;
    this.meditationCaption = null;

    const scene = this.scene;
    const cultivation = getCultivationProgress(gameState.player);
    const progress = Math.min(1, cultivation.experience / Math.max(1, cultivation.target));
    const active = this.cultivationService.getActiveMeditation();
    const plan = active?.plan || this.cultivationService.getPlan(this.selectedMonths);
    const atBottleneck = !active && cultivation.isFull;
    const breakthrough = atBottleneck ? this.breakthroughService?.getInfo?.() : null;

    this.content.add(scene.add.image(1671.25, 37, RETREAT_ROOM_ASSETS.roomPlaque)
      .setOrigin(0)
      .setDisplaySize(201, 156));
    this.addMainText(1761.98, 70.5, "闭关室", 28, "#ddac4f", { fontFamily: BUTTON_FONT });

    this.addMainText(957, 225.05, gameState.player.name, 38, "#ffffff", {
      fontFamily: TITLE_FONT,
      stroke: "#19130e",
      strokeThickness: 3,
    });
    this.addMainText(959, 266.2, formatRealm(gameState.player.realm), 22, "#e1ba5b");
    this.cultivationProgressBar = this.createRoundedProgressBar(this.content, {
      x: 788.39,
      y: 299.69,
      width: 340,
      height: 16,
      progress,
      trackColor: 0x0d1013,
      trackAlpha: 0.96,
      fillColor: 0xd7a13b,
      borderColor: 0xc59846,
      borderAlpha: 0.92,
    });
    this.cultivationFill = this.cultivationProgressBar.fill;
    this.cultivationValue = this.addMainText(960, 321.45, `${cultivation.experience}/${cultivation.target}(${Math.round(progress * 100)}%)`, 18, "#c2bebb");

    this.content.add(scene.add.image(708, 311.5, RETREAT_ROOM_ASSETS.meditation)
      .setOrigin(0)
      .setDisplaySize(500, 500));
    this.drawKindButton(574, 598.25, "spell");
    this.drawKindButton(1343.73, 598.25, "technique");

    this.content.add(scene.add.image(630.5, 750.8, RETREAT_ROOM_ASSETS.durationPanel)
      .setOrigin(0)
      .setDisplaySize(640, 167));

    this.addMainText(954.5, 781.4, atBottleneck ? "修 为 圆 满" : `闭关  ${plan?.years || 1}  年`, 26, atBottleneck ? "#f2cc74" : "#ffffff", { fontFamily: TITLE_FONT });
    this.meditationCaption = this.addMainText(951.5, 815.77, atBottleneck
      ? `当前瓶颈：${breakthrough?.realm || gameState.player.realm} · 可冲击 ${breakthrough?.nextRealm || "下一境界"}`
      : active
        ? `已获得：+${active.gainedExp} / ${active.totalExp} 修为`
        : `获得:+${plan?.totalExp || 0}修为`, 18, "#efc666");
    if (atBottleneck) this.drawBreakthroughHint(breakthrough);
    else this.drawDurationControl(plan, active);

    const state = this.cultivationService.getState();
    this.addMainText(960, 935.21, atBottleneck
      ? "修为已至瓶颈，突破后将重新积累下一阶段修为。"
      : active
      ? `吐纳进行中 · 剩余约 ${Math.ceil(active.remainingMs / 1000)} 秒`
      : `闭关${plan?.years || 1}年后即可积累修为 · 累计闭关${this.formatMonths(state.totalMonths)}`, 16, "#d8a963");

    const startButton = this.makeTextureButton(this.content, 952.51, 1018.86, RETREAT_ROOM_ASSETS.startButton, 350, 134,
      active ? "提前出关" : atBottleneck ? "突破修为" : "开始闭关", () => {
      if (active) this.abortCultivationRetreat();
      else if (atBottleneck) this.startBreakthrough();
      else this.startCultivationRetreat();
    }, {
      labelY: -29.36,
      fontSize: 24,
      fontFamily: BUTTON_FONT,
      textColor: "#4d3214",
      stroke: "#e8cc85",
      strokeThickness: 1,
      hitHeight: 70,
      hitY: -31,
    });
    if (active) startButton.setAlpha(0.94);

    this.makeTextureButton(this.content, 1734.25, 985.21, RETREAT_ROOM_ASSETS.returnButton, 276, 81, "返回门派", () => this.close(), {
      labelX: -6,
      labelY: -5,
      fontSize: 22,
      fontFamily: BUTTON_FONT,
      textColor: "#ddac4f",
    });

    if (message) this.showToast(message, 960, 1038, this.content, 2500);
    if (active) this.ensureMeditationTimer();
  }

  drawDurationControl(plan, active) {
    const scene = this.scene;
    const durations = this.service.listDurations();
    const selectedIndex = Math.max(0, durations.findIndex((entry) => entry.months === (plan?.months || this.selectedMonths)));
    const barX = 690.26;
    const barY = 845.9;
    const barWidth = 525;
    const ratio = active?.progress ?? (selectedIndex / Math.max(1, durations.length - 1));
    this.meditationBarX = barX;
    this.meditationBarWidth = barWidth;
    this.meditationProgressBar = this.createRoundedProgressBar(this.content, {
      x: barX,
      y: barY,
      width: barWidth,
      height: 14,
      progress: ratio,
      trackColor: 0x101214,
      trackAlpha: 0.96,
      fillColor: 0x4b7eb4,
      borderColor: 0xc49a52,
      borderAlpha: 0.9,
    });
    this.meditationFill = this.meditationProgressBar.fill;
    this.meditationKnob = scene.add.circle(barX + barWidth * ratio, barY, 10, 0xf5f7ff, 1).setStrokeStyle(3, 0x72a1f1);
    this.content.add(this.meditationKnob);

    const xs = [777.51, 900.51, 1023.51, 1146.52];
    durations.forEach((duration, index) => {
      const selected = duration.months === (plan?.months || this.selectedMonths);
      const option = this.makeTextureButton(this.content, xs[index], 898.41, RETREAT_ROOM_ASSETS.durationOption, 108, 47, duration.label, () => {
        if (active) return;
        this.selectedMonths = duration.months;
        this.renderMain("");
      }, {
        fontSize: 22,
        fontFamily: UI_FONT,
        textColor: selected ? "#f6dda0" : "#ffffff",
        tint: selected ? 0xffe3a0 : null,
      });
      if (active) option.setAlpha(0.64);
    });
  }

  /** 满修为时替代时长控件，避免让玩家误以为还可以继续累积经验。 */
  drawBreakthroughHint(breakthrough) {
    this.addMainText(960, 852, breakthrough?.nextRealm
      ? `冲击 ${breakthrough.nextRealm}`
      : "当前境界后续未开放", 22, "#f0ca71");
    this.addMainText(960, 892, "突破后继续修行", 16, "#c5b59c");
  }

  drawKindButton(x, y, kind) {
    const meta = KIND_META[kind];
    const scene = this.scene;
    const entry = scene.add.container(x, y);
    const image = scene.add.image(0, 0, meta.assetKey).setDisplaySize(meta.width, meta.height);
    const hit = scene.add.rectangle(0, 0, meta.width, meta.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const label = this.makeTextObject(kind === "spell" ? 6 : 3, -22, meta.label, 40,
      kind === "spell" ? "#f6e6d1" : "#eeca8a", { fontFamily: TITLE_FONT });
    entry.add([image, hit, label]);
    this.content.add(entry);
    hit.on("pointerover", () => entry.setScale(1.025));
    hit.on("pointerout", () => entry.setScale(1));
    hit.on("pointerdown", () => {
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
    const blocker = scene.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.5)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    overlay.add(blocker);

    // Pixso“闭关室-参悟成功”(70:1896) 的中央墨金圆环与装饰均使用原始像素尺寸。
    overlay.add(scene.add.image(518, 131, RETREAT_ROOM_ASSETS.successDisc)
      .setOrigin(0)
      .setDisplaySize(874, 771));

    const successKey = result.study.id === "study-huoqiu"
      ? "pixso-retreat-success-huoqiu"
      : "pixso-retreat-book-bengshan";
    const successImage = scene.add.image(963.73, 427.21, successKey).setDisplaySize(170, 170);
    const successMaskShape = scene.make.graphics({ x: 0, y: 0, add: false });
    successMaskShape.fillStyle(0xffffff, 1);
    successMaskShape.fillRoundedRect(878.73, 342.21, 170, 170, 20);
    successImage.setMask(successMaskShape.createGeometryMask());
    this.overlayMasks.push(successMaskShape);
    overlay.add(successImage);

    overlay.add(scene.add.image(865, 335.5, RETREAT_ROOM_ASSETS.successSkillFrame)
      .setOrigin(0)
      .setDisplaySize(190, 181));
    this.addOverlayText(956, 565.25, "参悟成功", 58, "#ddac4f", {
      fontFamily: TITLE_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    this.addOverlayText(960, 625.25, `领悟了《${result.study.name}》第一层`, 30, "#eeca8a", {
      fontFamily: UI_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    overlay.add(scene.add.image(736, 666.36, RETREAT_ROOM_ASSETS.successDivider)
      .setOrigin(0)
      .setDisplaySize(448, 22));
    overlay.add(scene.add.image(827, 722.8, RETREAT_ROOM_ASSETS.successDiamond)
      .setOrigin(0)
      .setDisplaySize(25, 24));
    overlay.add(scene.add.image(1068, 722.8, RETREAT_ROOM_ASSETS.successDiamond)
      .setOrigin(0)
      .setDisplaySize(25, 24));
    this.addOverlayText(960, 732.3, "点击任意位置继续", 24, "#e7c977", {
      fontFamily: BUTTON_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });

    let dismissed = false;
    blocker.on("pointerdown", () => {
      if (dismissed) return;
      dismissed = true;
      playUiClickSound(scene);
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

  startBreakthrough() {
    if (this.breakthroughPanel) return;
    const preview = this.breakthroughRules?.createTrial?.(gameState.player);
    if (!preview?.ok) {
      this.renderMain(preview?.message || "突破试炼未准备好。");
      return;
    }
    this.root.setVisible(false);
    this.breakthroughPanel = new BreakthroughMinigamePanel(this.scene, {
      rules: this.breakthroughRules,
      player: gameState.player,
      onResolve: (outcome) => {
        const result = this.breakthroughService.resolveTrial(outcome);
        this.onProgressChanged?.();
        return result;
      },
      onAbort: (message) => this.closeBreakthroughPanel(message),
      onClose: () => this.closeBreakthroughPanel(),
    });
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
    const cultivationRatio = Math.min(1, cultivation.experience / Math.max(1, cultivation.target));
    this.cultivationProgressBar?.setProgress(cultivationRatio);
    this.cultivationValue?.setText(`${cultivation.experience}/${cultivation.target}(${Math.round(cultivationRatio * 100)}%)`);
    if (result.completed || result.capped) {
      this.stopMeditationTimer();
      this.renderMain(result.message);
      return;
    }
    this.meditationProgressBar?.setProgress(result.progress);
    this.meditationKnob?.setX(this.meditationBarX + this.meditationBarWidth * result.progress);
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

  createRoundedProgressBar(parent, {
    x,
    y,
    width,
    height,
    progress = 0,
    trackColor,
    trackAlpha = 1,
    fillColor,
    fillAlpha = 1,
    borderColor,
    borderAlpha = 1,
    borderWidth = 1,
    inset = 2,
  }) {
    const track = this.scene.add.graphics();
    const radius = height / 2;
    track.fillStyle(trackColor, trackAlpha);
    track.fillRoundedRect(x, y - height / 2, width, height, radius);
    if (borderColor !== undefined && borderWidth > 0) {
      track.lineStyle(borderWidth, borderColor, borderAlpha);
      track.strokeRoundedRect(x, y - height / 2, width, height, radius);
    }

    const fill = this.scene.add.graphics();
    const innerHeight = Math.max(1, height - inset * 2);
    const innerWidth = Math.max(1, width - inset * 2);
    const setProgress = (value) => {
      const ratio = Phaser.Math.Clamp(Number(value) || 0, 0, 1);
      const fillWidth = innerWidth * ratio;
      fill.clear();
      if (fillWidth <= 0) return;
      fill.fillStyle(fillColor, fillAlpha);
      fill.fillRoundedRect(
        x + inset,
        y - innerHeight / 2,
        fillWidth,
        innerHeight,
        Math.min(innerHeight / 2, fillWidth / 2),
      );
    };

    parent.add([track, fill]);
    setProgress(progress);
    return { track, fill, setProgress };
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

  /** 使用 Pixso 原图作为按钮外观，文字和命中区仍保持动态与可测试。 */
  makeTextureButton(parent, x, y, textureKey, width, height, label, callback, options = {}) {
    const scene = this.scene;
    const container = scene.add.container(x, y);
    const image = scene.add.image(0, 0, textureKey).setDisplaySize(width, height);
    if (options.tint !== null && options.tint !== undefined) image.setTint(options.tint);
    const hit = scene.add.rectangle(
      options.hitX ?? 0,
      options.hitY ?? 0,
      options.hitWidth ?? width,
      options.hitHeight ?? height,
      0xffffff,
      0,
    ).setInteractive({ useHandCursor: true });
    const title = this.makeTextObject(
      options.labelX ?? 0,
      options.labelY ?? 0,
      label,
      options.fontSize ?? 18,
      options.textColor ?? "#f4d889",
      {
        fontFamily: options.fontFamily ?? UI_FONT,
        stroke: options.stroke,
        strokeThickness: options.strokeThickness ?? 0,
      },
    );
    container.add([image, hit, title]);
    parent.add(container);
    hit.on("pointerover", () => image.setTint(options.hoverTint ?? 0xffedc5));
    hit.on("pointerout", () => {
      if (options.tint !== null && options.tint !== undefined) image.setTint(options.tint);
      else image.clearTint();
    });
    hit.on("pointerdown", () => {
      playUiClickSound(scene);
      callback();
    });
    return container;
  }

  makeButton(parent, x, y, width, height, label, callback, options = {}) {
    const scene = this.scene;
    const container = scene.add.container(x, y);
    const visual = scene.add.graphics();
    const fill = options.fill ?? COLORS.button;
    const hoverFill = options.hoverFill ?? COLORS.buttonHover;
    const stroke = options.stroke ?? 0xd4a64b;
    const strokeWidth = options.strokeWidth ?? 2;
    const redraw = (color, alpha, gradient = null) => {
      visual.clear();
      if (gradient) visual.fillGradientStyle(gradient[0], gradient[0], gradient[1], gradient[1], 1, 1, 1, 1);
      else visual.fillStyle(color, alpha);
      visual.fillRoundedRect(-width / 2, -height / 2, width, height, options.radius ?? 4);
      if (strokeWidth > 0) {
        visual.lineStyle(strokeWidth, stroke, 1);
        visual.strokeRoundedRect(-width / 2, -height / 2, width, height, options.radius ?? 4);
      }
    };
    redraw(fill, options.fillAlpha ?? 1, options.gradient);
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const title = this.makeTextObject(0, 0, label, options.fontSize ?? 18, options.textColor ?? "#f4d889", {
      fontFamily: options.fontFamily ?? UI_FONT,
    });
    container.add([visual, hit, title]);
    parent.add(container);
    hit.on("pointerover", () => redraw(hoverFill, options.hoverFillAlpha ?? options.fillAlpha ?? 1, options.hoverGradient ?? options.gradient));
    hit.on("pointerout", () => redraw(fill, options.fillAlpha ?? 1, options.gradient));
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
    this.overlay?.destroy(true);
    this.overlayMasks.forEach((mask) => mask.destroy());
    this.overlayMasks = [];
    this.overlay = null;
    this.overlayMode = "";
    if (!keepStudy && this.service.activeAttempt) this.service.abortStudy();
  }

  handleEscape() {
    if (this.breakthroughPanel) return this.breakthroughPanel.handleEscape();
    if (this.overlayMode === "success") return true;
    if (this.overlay) {
      this.destroyOverlay();
      return true;
    }
    this.close();
    return true;
  }

  close() {
    this.breakthroughPanel?.close();
    this.breakthroughPanel = null;
    this.destroyOverlay();
    if (this.cultivationService.getActiveMeditation()) this.abortCultivationRetreat({ render: false });
    else this.stopMeditationTimer();
    this.root?.destroy(true);
    this.root = null;
    this.onBack?.();
  }

  closeBreakthroughPanel(message = this.lastMessage) {
    this.breakthroughPanel = null;
    this.root?.setVisible(true);
    this.renderMain(message);
  }
}

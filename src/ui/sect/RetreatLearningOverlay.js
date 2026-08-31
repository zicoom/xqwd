import { addText } from "../../utils/UiHelpers.js";

const TITLE_FONT = '"Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const UI_FONT = '"SJ yuantijian-C-Regular", "Microsoft YaHei", sans-serif';
const ASSET_ROOT = "./public/assets/images/pixso/retreat-room/learning";

export const RETREAT_LEARNING_ASSETS = Object.freeze({
  aura: "pixso-retreat-learning-aura",
  progressTrack: "pixso-retreat-learning-progress-track",
  progressMarker: "pixso-retreat-learning-progress-marker",
});

const PROGRESS_START_X = 638.29;
const PROGRESS_END_X = 1281.71;
const PROGRESS_WIDTH = PROGRESS_END_X - PROGRESS_START_X;

const BRUSH_TITLE_VARIANTS = Object.freeze([
  { size: 60, dy: -2, angle: -2.4, scaleX: 1.04, scaleY: 1.02, color: "#e2b253" },
  { size: 57, dy: 2, angle: 1.7, scaleX: 0.97, scaleY: 1.06, color: "#d7a446" },
  { size: 61, dy: -1, angle: -1.3, scaleX: 1.02, scaleY: 0.98, color: "#edc268" },
  { size: 58, dy: 1, angle: 2.1, scaleX: 0.99, scaleY: 1.04, color: "#dcaa49" },
  { size: 46, dy: 11, angle: -1.5, scaleX: 0.9, scaleY: 0.94, color: "#d5a143" },
  { size: 50, dy: 8, angle: 1.2, scaleX: 0.88, scaleY: 1.02, color: "#e6b654" },
  { size: 43, dy: 12, angle: -0.8, scaleX: 0.92, scaleY: 0.9, color: "#cf983b" },
]);

/** 预加载 Pixso“改版 / 闭关室-学习中”(73:482)运行素材。 */
export function preloadRetreatLearningAssets(scene) {
  scene.load.image(RETREAT_LEARNING_ASSETS.aura, `${ASSET_ROOT}/qi-circulation-aura.png`);
  scene.load.image(RETREAT_LEARNING_ASSETS.progressTrack, `${ASSET_ROOT}/progress-track.png`);
  scene.load.image(RETREAT_LEARNING_ASSETS.progressMarker, `${ASSET_ROOT}/progress-marker.png`);
}

const createText = (scene, x, y, value, size, color, fontFamily) => addText(scene, x, y, value, size, color, {
  origin: 0.5,
  fontFamily,
  strokeThickness: 0,
});

/**
 * 将标题逐字排成略有顿挫的手写效果，避免整串文字完全共用同一基线和笔重。
 */
const createBrushTitle = (scene, x, y, value) => {
  const root = scene.add.container(x, y);
  const glyphs = Array.from(value || "").map((character, index) => {
    const variant = BRUSH_TITLE_VARIANTS[index % BRUSH_TITLE_VARIANTS.length];
    const punctuation = /[.。…]/.test(character);
    const glyph = addText(scene, 0, variant.dy, character, variant.size, variant.color, {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      stroke: "#5a3514",
      strokeThickness: 1,
    })
      .setAngle(variant.angle)
      .setScale(variant.scaleX, variant.scaleY)
      .setShadow(1.5, 2.5, "#241208", 2, true, true);
    const advance = punctuation
      ? Math.max(15, glyph.width * variant.scaleX * 0.72)
      : Math.max(49, glyph.width * variant.scaleX - 1);
    return { glyph, advance };
  });

  const totalWidth = glyphs.reduce((sum, item) => sum + item.advance, 0);
  let cursor = -totalWidth / 2;
  glyphs.forEach(({ glyph, advance }) => {
    glyph.setX(cursor + advance / 2);
    cursor += advance;
    root.add(glyph);
  });
  return root;
};

/**
 * 闭关学习中的纯视觉层；计时、进度推进、完成和结算继续由领域服务处理。
 */
export class RetreatLearningOverlay {
  constructor(scene, {
    meditationAssetKey,
    progress = 0,
    progressText = "",
    title = "引气入体...",
    description = "静坐凝神，引气归元，气入丹田，根基自固",
  }) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(1200);
    this.draw({ meditationAssetKey, title, description });
    this.setProgress(progress);
    this.setProgressText(progressText);
  }

  draw({ meditationAssetKey, title, description }) {
    const scene = this.scene;
    this.root.add(scene.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.5)
      .setOrigin(0)
      .setInteractive());

    this.root.add(scene.add.image(985, 476, RETREAT_LEARNING_ASSETS.aura)
      .setDisplaySize(840, 576));
    this.root.add(scene.add.image(955, 600.246338, meditationAssetKey)
      .setDisplaySize(500, 500));

    this.root.add(createBrushTitle(scene, 960, 838.195313, title));
    this.root.add(scene.add.image(960, 911.842285, RETREAT_LEARNING_ASSETS.progressTrack)
      .setDisplaySize(807, 67));

    this.progressFill = scene.add.graphics({ x: PROGRESS_START_X, y: 912.797852 });
    // Phaser Graphics 的底部两点顺序与 CSS 渐变不同；这里按实际渲染反转端点，
    // 才能得到 Pixso 稿中的左绿（#277b3c）→右金（#e5a800）。
    this.progressFill.fillGradientStyle(0xe5a800, 0x277b3c, 0xe5a800, 0x277b3c, 1, 1, 1, 1);
    this.progressFill.fillRoundedRect(0, -15, PROGRESS_WIDTH, 30, 15);
    this.root.add(this.progressFill);

    this.progressMarker = scene.add.image(PROGRESS_START_X, 913.842285, RETREAT_LEARNING_ASSETS.progressMarker)
      .setDisplaySize(77, 71);
    this.root.add(this.progressMarker);

    this.progressCaption = createText(scene, 960, 979.489258, "", 30, "#eeca8a", UI_FONT);
    this.root.add(this.progressCaption);
    this.root.add(createText(scene, 955, 1027.63623, description, 18, "#c2bebb", UI_FONT));
  }

  setProgress(progress) {
    const ratio = Math.min(1, Math.max(0, Number(progress) || 0));
    this.progressFill?.setScale(ratio, 1);
    this.progressMarker?.setX(PROGRESS_START_X + PROGRESS_WIDTH * ratio);
  }

  setProgressText(value) {
    this.progressCaption?.setText(value || "");
  }
}

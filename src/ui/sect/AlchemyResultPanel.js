import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const ASSET_ROOT = "./public/assets/images/pixso/alchemy/refinement-success";
const TITLE_FONT = '"SJ yuantijian-C", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const LABEL_FONT = '"SJ yuantijian-Z", "Alimama DongFangDaKai", "Microsoft YaHei", sans-serif';
const BODY_FONT = '"Noto Sans SC Battle Popup", "Noto Sans SC", "Microsoft YaHei", sans-serif';

const ASSETS = Object.freeze({
  background: ["alchemy-success-background", "success-background.jpg"],
  titlePlaque: ["alchemy-success-title-plaque", "success-title-plaque.png"],
  resultDisc: ["alchemy-success-result-disc", "success-result-disc.png"],
  pill: ["alchemy-success-pill", "success-pill.png"],
  stageCard: ["alchemy-success-stage-card", "success-stage-card.png"],
  ratingBadge: ["alchemy-success-rating-badge", "success-rating-badge.png"],
  returnButton: ["alchemy-success-return-button", "success-return-button.png"],
});

/** SectScene 统一管理资源生命周期；结果层只消费这些稳定纹理键。 */
export function preloadAlchemyResultAssets(scene) {
  Object.values(ASSETS).forEach(([textureKey, fileName]) => {
    scene.load.image(textureKey, `${ASSET_ROOT}/${fileName}`);
  });
}

/**
 * 根据领域服务结果生成纯显示配置，统一覆盖真实炼制与控火演练的成功、失败四条路径。
 * 显示配置不参与成功判定，也不会修改结算结果。
 */
export function createAlchemyResultPresentation(result = {}) {
  const practice = Boolean(result.practice);
  const successful = practice ? Boolean(result.successful) : Boolean(result.ok);

  if (!practice && successful) {
    const productName = String(result.result?.name || "丹药");
    const quantity = Math.max(1, Math.round(Number(result.quantity) || 1));
    return {
      successful: true,
      showPill: true,
      title: "炼丹成功",
      seal: "丹",
      resultText: `${productName} X${quantity}`,
      description: "炉火既熄，丹香凝成",
    };
  }

  if (!practice) {
    return {
      successful: false,
      showPill: false,
      title: "炼丹失败",
      seal: "散",
      resultText: "丹药未成",
      description: "药性散尽，本炉未能成丹",
    };
  }

  if (successful) {
    return {
      successful: true,
      showPill: false,
      title: "控火演练完成",
      seal: "习",
      resultText: "演练完成",
      description: "本次不消耗药材，也不会获得丹药",
    };
  }

  return {
    successful: false,
    showPill: false,
    title: "控火演练失败",
    seal: "失",
    resultText: "未能凝丹",
    description: "凝丹阶段需要稳定炉温并主动收诀",
  };
}

/**
 * Pixso“炼丹房-炼丹成功”画板扩展出的统一炼丹结果层。
 *
 * 组件只显示 AlchemyMinigameService / AlchemyService 已经完成的普通结算数据，
 * 不计算成功率、不发放丹药，也不修改存档。
 */
export class AlchemyResultPanel {
  constructor(scene, { outcome = {}, result = {}, onClose } = {}) {
    this.scene = scene;
    this.outcome = outcome;
    this.result = result;
    this.onClose = onClose;
    this.closed = false;
    this.root = scene.add.container(0, 0).setScrollFactor(0);
    this.draw();
  }

  draw() {
    const scene = this.scene;
    const ratios = Array.isArray(this.outcome.stageRatios) ? this.outcome.stageRatios : [];
    const score = Math.max(0, Math.min(100, Math.round(Number(this.outcome.score) || 0)));
    const grade = String(this.outcome.grade || "稳定");
    const presentation = createAlchemyResultPresentation(this.result);
    const accentColor = presentation.successful ? "#ddac4f" : "#dc7968";
    const secondaryColor = presentation.successful ? "#e7c977" : "#e59a8c";

    // 所有坐标和显示尺寸均来自 1920×1080 Pixso 画板 70:583。
    const background = scene.add.image(0, 0, ASSETS.background[0])
      .setOrigin(0)
      .setDisplaySize(1920, 1080)
      .setInteractive();
    background.on("pointerdown", () => {});

    const titlePlaque = scene.add.image(545, 41.574, ASSETS.titlePlaque[0])
      .setOrigin(0)
      .setDisplaySize(830, 196);
    const resultDisc = scene.add.image(615, 197.248, ASSETS.resultDisc[0])
      .setOrigin(0)
      .setDisplaySize(680, 535);
    if (!presentation.successful) {
      titlePlaque.setTint(0xc87869);
      resultDisc.setTint(0xb86a61);
    }

    const resultMark = presentation.showPill
      ? scene.add.image(903, 343.26, ASSETS.pill[0]).setOrigin(0).setDisplaySize(118, 117)
      : addText(scene, 960, 401.76, presentation.seal, 82, accentColor, {
        origin: 0.5,
        fontFamily: TITLE_FONT,
        stroke: "#000000",
        strokeThickness: 2,
      });

    const title = addText(scene, 960, 103.574, presentation.title, 50, accentColor, {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    const product = addText(scene, 960, 515.622, presentation.resultText, 44, accentColor, {
      origin: 0.5,
      fontFamily: TITLE_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    const scoreLabel = addText(scene, 872.835, 579.984, "控火评分", 30, secondaryColor, {
      fontFamily: LABEL_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    const scoreValue = addText(scene, 1012.165, 579.984, String(score), 30, secondaryColor, {
      fontFamily: LABEL_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    const description = addText(scene, 960, 636.236, presentation.description, 18, "#f8f0d8", {
      origin: 0.5,
      fontFamily: BODY_FONT,
      stroke: "#000000",
      strokeThickness: 1,
      align: "center",
      wordWrap: { width: 520 },
    });

    this.root.add([
      background,
      titlePlaque,
      resultDisc,
      resultMark,
      title,
      product,
      scoreLabel,
      scoreValue,
      description,
    ]);

    [576.645, 838, 1099.355].forEach((left, index) => {
      const card = scene.add.image(left, 758.392, ASSETS.stageCard[0])
        .setOrigin(0)
        .setDisplaySize(234, 61);
      if (!presentation.successful) card.setTint(0xc87869);
      const stageLabel = addText(scene, left + 42.461, 788.892, ["温炉", "融药", "凝丹"][index], 18, "#f8f0d8", {
        origin: [0, 0.5],
        fontFamily: BODY_FONT,
        stroke: "#000000",
        strokeThickness: 1,
      });
      const stageValue = addText(scene, left + 191.951, 788.892, `${Math.round(Number(ratios[index]) || 0)}%`, 18, secondaryColor, {
        origin: [1, 0.5],
        fontFamily: BODY_FONT,
        stroke: "#000000",
        strokeThickness: 1,
      });
      this.root.add([card, stageLabel, stageValue]);
    });

    const ratingBadge = scene.add.image(845.5, 853.972, ASSETS.ratingBadge[0])
      .setOrigin(0)
      .setDisplaySize(229, 62);
    if (!presentation.successful) ratingBadge.setTint(0xc87869);
    const ratingLabel = addText(scene, 960, 882.972, `火候${grade}`, 24, secondaryColor, {
      origin: 0.5,
      fontFamily: LABEL_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    const returnButton = scene.add.image(750, 946.662, ASSETS.returnButton[0])
      .setOrigin(0)
      .setDisplaySize(420, 76)
      .setInteractive({ useHandCursor: true });
    const returnLabel = addText(scene, 960, 985.662, "返回丹房", 30, "#e7c977", {
      origin: 0.5,
      fontFamily: LABEL_FONT,
      stroke: "#000000",
      strokeThickness: 1,
    });
    returnButton.on("pointerover", () => returnButton.setTint(0xffe7ad));
    returnButton.on("pointerout", () => returnButton.clearTint());
    returnButton.on("pointerdown", () => this.close());
    this.root.add([ratingBadge, ratingLabel, returnButton, returnLabel]);
  }

  handleEscape() {
    this.close();
    return true;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    playUiClickSound(this.scene);
    this.root?.destroy(true);
    this.root = null;
    this.onClose?.();
  }

  destroy() {
    this.closed = true;
    this.root?.destroy(true);
    this.root = null;
  }
}

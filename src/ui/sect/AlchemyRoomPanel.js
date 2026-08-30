import { addText } from "../../utils/UiHelpers.js";
import { AlchemyMinigamePanel } from "./AlchemyMinigamePanel.js";
import { FurnacePickerDialog } from "./FurnacePickerDialog.js";
import { createFurnaceCardView } from "./FurnaceCardView.js";

const PARCHMENT_GRADE_COLORS = Object.freeze({
  凡品: "#694c34", 灵品: "#3d634f", 玄品: "#345b7a", 地品: "#734f70", 天品: "#6c3f8e",
});

const PALETTE = Object.freeze({
  ink: 0x090706,
  panel: 0x17110f,
  panelRaised: 0x211713,
  panelSelected: 0x342016,
  gold: 0xd3a34a,
  goldBright: 0xf0cc78,
  goldDark: 0x6f4b24,
  jade: 0x5da987,
  jadeDark: 0x244e40,
  cinnabar: 0x8e3c2b,
  cinnabarBright: 0xc7643d,
  line: 0x63452f,
});

/** 炼丹房 UI：只负责视觉层级、选择与反馈，炼丹规则仍全部委托给 AlchemyService。 */
export class AlchemyRoomPanel {
  constructor(scene, { service, minigameRules, sectName, onBack }) {
    this.scene = scene;
    this.service = service;
    this.minigameRules = minigameRules;
    this.sectName = sectName;
    this.onBack = onBack;
    this.selectedRecipeId = this.service.listRecipes()[0]?.id || "";
    this.root = scene.add.container(0, 0).setDepth(500);
    this.render();
  }

  add(display) {
    (this.addTarget || this.content).add(display);
    return display;
  }

  render(message = "") {
    this.content?.destroy(true);
    this.content = this.scene.add.container(0, 0);
    this.root.add(this.content);
    this.drawAtmosphere();
    // 顶部公共工具栏和右上返回按钮保持原位；炼丹房标题、三栏主体与反馈整体上移 20px。
    // 使用容器统一位移，确保图片、文字和透明点击区域始终保持一致。
    this.mainContent = this.scene.add.container(0, -20);
    this.content.add(this.mainContent);
    this.addTarget = this.mainContent;
    this.drawHeader();
    this.drawRecipePanel();
    this.drawFurnacePanel();
    this.drawRecipeDetail();
    this.drawFooter(message);
    this.addTarget = null;
  }

  drawAtmosphere() {
    const scene = this.scene;
    this.add(scene.add.image(0, 0, "pixso-alchemy-background")
      .setOrigin(0)
      .setDisplaySize(1920, 1080)
      .setInteractive());
  }

  drawHeader() {
    const scene = this.scene;
    this.add(scene.add.image(655.887, 223.425, "pixso-alchemy-c19").setDisplaySize(400, 40.959));
    this.add(scene.add.image(1264.113, 223.425, "pixso-alchemy-c19").setDisplaySize(400, 40.959).setFlipX(true));
    this.add(addText(scene, 960, 214.905, "炼丹房", 49, "#ddac4f", {
      origin: 0.5,
      fontFamily: '"Alimama DongFangDaKai", "Microsoft YaHei"',
      strokeThickness: 0,
    }));
    const back = scene.add.container(1645.334, 59);
    const background = scene.add.image(0, 0, "sect-overview-back-button")
      .setOrigin(0)
      .setDisplaySize(251, 58)
      .setInteractive({ useHandCursor: true });
    const label = addText(scene, 125.5, 29, "返回门派", 22, "#ddac4f", { origin: 0.5, strokeThickness: 0 });
    back.add([background, label]);
    this.content.add(back);
    background.on("pointerover", () => background.setAlpha(0.9));
    background.on("pointerout", () => background.setAlpha(1));
    background.on("pointerdown", (_pointer, _x, _y, event) => {
      event?.stopPropagation?.();
      this.close();
    });
  }

  drawFooter(message) {
    if (!message) return;
    const scene = this.scene;
    const toast = this.add(scene.add.image(960, 1051, "pixso-alchemy-c5").setDisplaySize(490, 50));
    toast.setAlpha(0.98);
    this.statusText = this.add(addText(scene, 960, 1051, message, 15, "#e7c977", {
      origin: 0.5,
      wordWrap: { width: 440, useAdvancedWrap: true },
      align: "center",
      strokeThickness: 0,
    }));
  }

  drawFrame(x, y, width, height, { raised = false, accent = PALETTE.goldDark } = {}) {
    const graphics = this.scene.add.graphics();
    const left = x - width / 2;
    const top = y - height / 2;
    graphics.fillStyle(raised ? PALETTE.panelRaised : PALETTE.panel, 0.97);
    graphics.fillRoundedRect(left, top, width, height, 12);
    graphics.lineStyle(2, accent, 0.72);
    graphics.strokeRoundedRect(left, top, width, height, 12);
    graphics.lineStyle(1, PALETTE.goldBright, 0.16);
    graphics.strokeRoundedRect(left + 7, top + 7, width - 14, height - 14, 8);
    graphics.lineStyle(3, accent, 0.9);
    graphics.lineBetween(left + 20, top, left + 84, top);
    graphics.lineBetween(left + width - 84, top, left + width - 20, top);
    this.add(graphics);
    return graphics;
  }

  drawSectionTitle(x, y, title, subtitle = "", width = 390) {
    const scene = this.scene;
    this.add(addText(scene, x, y, title, 22, "#e4bd63", { origin: [0, 0.5], strokeThickness: 1 }));
    if (subtitle) this.add(addText(scene, x + width, y, subtitle, 12, "#887665", { origin: [1, 0.5], strokeThickness: 0 }));
    const line = this.add(scene.add.graphics());
    line.lineStyle(1, PALETTE.goldDark, 0.7);
    line.lineBetween(x, y + 27, x + width, y + 27);
    line.fillStyle(PALETTE.gold, 0.9);
    line.fillCircle(x, y + 27, 3);
  }

  drawRecipePanel() {
    const scene = this.scene;
    const recipes = this.service.listRecipes();
    this.add(scene.add.image(23.666, 282.41, "pixso-alchemy-c18")
      .setOrigin(0)
      .setDisplaySize(556.938, 782.01));
    this.add(addText(scene, 65.154, 320.686, "丹方录", 24, "#ddac4f", { strokeThickness: 0 }));
    this.add(addText(scene, 531.5, 323.186, `收录 ${recipes.length} 卷`, 18, "#f8f0d8", {
      origin: [1, 0],
      strokeThickness: 0,
    }));
    recipes.forEach((recipe, index) => {
      const top = 372.33 + index * 168.073;
      const selected = recipe.id === this.selectedRecipeId;
      const card = this.add(scene.add.image(65.154, top, "pixso-alchemy-c4")
        .setOrigin(0)
        .setDisplaySize(471.962, 149.282));
      if (selected) card.setTint(0xfff4cf);
      const hit = scene.add.rectangle(301.135, top + 74.641, 471.962, 149.282, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      this.add(hit);
      this.add(scene.add.image(95.364, top + 31.005, "pixso-alchemy-c3")
        .setOrigin(0)
        .setDisplaySize(88, 88));
      this.add(addText(scene, 139.364, top + 75.005, recipe.name.slice(0, 1), 25, "#f4d892", {
        origin: 0.5,
        strokeThickness: 1,
      }));
      this.add(addText(scene, 216, top + 35.005, recipe.name, 24, "#11100e", {
        strokeThickness: 0,
        fontFamily: '"Alimama DongFangDaKai", "Microsoft YaHei"',
      }));
      const stateText = recipe.learned ? "已掌握" : recipe.canLearn ? "可参悟" : "缺少丹方书";
      const stateColor = recipe.learned ? "#2a5d4c" : recipe.canLearn ? "#0d2caa" : "#765144";
      this.add(addText(scene, 218, top + 68.141, stateText, 16, stateColor, { strokeThickness: 0 }));
      this.add(scene.add.image(460, top + 40.005, "pixso-alchemy-b7")
        .setOrigin(0)
        .setDisplaySize(55, 25));
      this.add(addText(scene, 487.5, top + 52.505, recipe.grade, 16,
        PARCHMENT_GRADE_COLORS[recipe.grade] || "#694c34", { origin: 0.5, strokeThickness: 0 }));
      this.add(scene.add.rectangle(219.5, top + 102.825, 218.956, 8, 0x554330, 0.5).setOrigin(0));
      this.add(scene.add.rectangle(220.505, top + 103.812, 216.946 * recipe.baseSuccessRate / 100, 6.281,
        selected ? 0xb59048 : 0x5f7c62, 1).setOrigin(0));
      this.add(addText(scene, 500, top + 92.325, `${recipe.baseSuccessRate}%`, 17, "#11100e", {
        origin: [1, 0],
        strokeThickness: 0,
      }));
      hit.on("pointerover", () => card.setAlpha(0.9));
      hit.on("pointerout", () => card.setAlpha(1));
      hit.on("pointerdown", () => {
        this.selectedRecipeId = recipe.id;
        this.render();
      });
    });
  }

  drawFurnacePanel() {
    const scene = this.scene;
    const furnace = this.service.getSelectedFurnace();
    const recipe = this.service.listRecipes().find((entry) => entry.id === this.selectedRecipeId);
    this.add(scene.add.image(600.574, 282.41, "pixso-alchemy-c16")
      .setOrigin(0)
      .setDisplaySize(718.852, 782.01));
    const furnaceCard = createFurnaceCardView(scene, furnace, {
      x: 822.411,
      y: 347.186,
      interactive: !furnace,
      onSelect: !furnace ? () => this.openFurnacePicker() : null,
    });
    this.add(furnaceCard.root);

    this.add(scene.add.image(676.69, 790.318, "pixso-alchemy-c2")
      .setOrigin(0)
      .setDisplaySize(256.077, 55.12));
    this.add(scene.add.image(974.372, 790.318, "pixso-alchemy-c2")
      .setOrigin(0)
      .setDisplaySize(256.077, 55.12));
    this.add(addText(scene, 696.614, 805.241, "成丹增益", 20, "#c8ab7d", { strokeThickness: 0 }));
    this.add(addText(scene, 903.614, 805.241, `+${furnace?.successBonus || 0}%`, 20, "#63a98c", {
      origin: [1, 0],
      strokeThickness: 0,
    }));
    this.add(addText(scene, 995.803, 804.241, "额外成丹", 20, "#c8ab7d", { strokeThickness: 0 }));
    this.add(addText(scene, 1215.803, 804.241, `+${furnace?.yieldBonus || 0}%`, 20, "#ddac4f", {
      origin: [1, 0],
      strokeThickness: 0,
    }));

    const mainButton = this.add(scene.add.image(838, 887.744, "pixso-alchemy-c20")
      .setOrigin(0)
      .setDisplaySize(244, 60)
      .setInteractive({ useHandCursor: true }));
    const mainLabel = !furnace ? "安置丹炉" : recipe?.learned ? "开炉炼丹" : "参悟丹方";
    this.add(addText(scene, 960, 917.744, mainLabel, 24, "#e7c977", {
      origin: 0.5,
      strokeThickness: 0,
    }));
    mainButton.on("pointerover", () => mainButton.setAlpha(0.9));
    mainButton.on("pointerout", () => mainButton.setAlpha(1));
    mainButton.on("pointerdown", () => furnace ? this.useSelectedRecipe() : this.openFurnacePicker());
    const state = this.service.getState();
    this.add(addText(scene, 960, 972.69,
      `累计开炉 ${state.refinementCount} 次·成丹 ${state.successCount} 次·最佳控火 ${state.bestControlScore || 0}`,
      14, "#a09e85", { origin: 0.5, strokeThickness: 0 }));
  }

  drawCauldron(x, y, color, scale = 1) {
    const scene = this.scene;
    const glow = scene.add.ellipse(x, y + 102 * scale, 270 * scale, 92 * scale, 0xc44a20, 0.22);
    const flameOuter = scene.add.triangle(x, y + 98 * scale, -58, 38, 0, -72, 58, 38, 0xb84721, 0.9).setScale(scale);
    const flameInner = scene.add.triangle(x, y + 105 * scale, -30, 25, 0, -44, 30, 25, 0xe6a636, 0.92).setScale(scale * 0.82);
    this.add(glow); this.add(flameOuter); this.add(flameInner);
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x050403, 0.75);
    graphics.fillEllipse(x, y + 76 * scale, 215 * scale, 52 * scale);
    graphics.lineStyle(7 * scale, 0x4b2e1d, 1);
    graphics.fillStyle(color, 1);
    graphics.fillEllipse(x, y + 16 * scale, 188 * scale, 145 * scale);
    graphics.strokeEllipse(x, y + 16 * scale, 188 * scale, 145 * scale);
    graphics.fillStyle(0x15100d, 1);
    graphics.fillEllipse(x, y - 50 * scale, 172 * scale, 36 * scale);
    graphics.lineStyle(5 * scale, 0xb98744, 1);
    graphics.strokeEllipse(x, y - 50 * scale, 172 * scale, 36 * scale);
    graphics.lineStyle(11 * scale, 0x674125, 1);
    graphics.beginPath(); graphics.arc(x - 103 * scale, y + 4 * scale, 46 * scale, 1.38, 4.9); graphics.strokePath();
    graphics.beginPath(); graphics.arc(x + 103 * scale, y + 4 * scale, 46 * scale, -1.76, 1.76); graphics.strokePath();
    graphics.lineStyle(11 * scale, 0x50301d, 1);
    graphics.lineBetween(x - 54 * scale, y + 72 * scale, x - 68 * scale, y + 116 * scale);
    graphics.lineBetween(x + 54 * scale, y + 72 * scale, x + 68 * scale, y + 116 * scale);
    this.add(graphics);
    this.add(scene.add.circle(x, y + 14 * scale, 29 * scale, PALETTE.gold, 1).setStrokeStyle(3, PALETTE.goldBright));
    this.add(addText(scene, x, y + 14 * scale, "丹", 25 * scale, "#fff0bd", { origin: 0.5, strokeThickness: 1 }));
    return { glow, flames: [flameOuter, flameInner] };
  }

  drawRecipeDetail() {
    const scene = this.scene;
    const recipe = this.service.listRecipes().find((entry) => entry.id === this.selectedRecipeId);
    this.add(scene.add.image(1339.397, 282.41, "pixso-alchemy-c17")
      .setOrigin(0)
      .setDisplaySize(556.938, 782.01));
    this.add(addText(scene, 1385.693, 320.686, "炼制筹备", 24, "#ddac4f", { strokeThickness: 0 }));
    this.add(addText(scene, 1852.038, 323.186, recipe?.learned ? "步骤 3/3" : "步骤 1/3", 18, "#f8f0d8", {
      origin: [1, 0],
      strokeThickness: 0,
    }));
    this.add(scene.add.image(1386, 368.33, "pixso-alchemy-c13")
      .setOrigin(0)
      .setDisplaySize(466.22, 12.632));
    if (!recipe) return;
    const furnace = this.service.getSelectedFurnace();
    const chance = Math.min(100, recipe.baseSuccessRate + (furnace?.successBonus || 0));
    this.add(scene.add.image(1390, 403.334, "pixso-alchemy-c3")
      .setOrigin(0)
      .setDisplaySize(88, 88));
    this.add(addText(scene, 1434, 447.334, recipe.name.slice(0, 1), 25, "#f4d892", {
      origin: 0.5,
      strokeThickness: 1,
    }));
    this.add(addText(scene, 1500.132, 407.334, recipe.name, 24, "#c8ab7d", {
      strokeThickness: 0,
      fontFamily: '"Alimama DongFangDaKai", "Microsoft YaHei"',
    }));
    this.add(scene.add.image(1790.286, 412.334, "pixso-alchemy-b7")
      .setOrigin(0)
      .setDisplaySize(55, 25));
    this.add(addText(scene, 1817.786, 424.834, recipe.grade, 16,
      recipe.grade === "灵品" ? "#3d634f" : recipe.grade === "天品" ? "#6c3f8e" : "#b7322f",
      { origin: 0.5, strokeThickness: 0 }));
    this.add(addText(scene, 1500.132, 449.971, recipe.description, 16, "#c0ac93", {
      wordWrap: { width: 350, useAdvancedWrap: true },
      lineSpacing: 3,
      strokeThickness: 0,
    }));

    this.add(addText(scene, 1390, 533.328, "综合成丹预估", 18, "#d4b472", { strokeThickness: 0 }));
    this.add(addText(scene, 1737.388, 544.328, `${chance}%`, 22, chance >= 75 ? "#63a98c" : "#ddac4f", {
      origin: [1, 0],
      strokeThickness: 0,
    }));
    this.add(scene.add.image(1407.79, 572.328, "pixso-alchemy-c10")
      .setOrigin(0)
      .setDisplaySize(442.105, 31.005));
    this.add(scene.add.image(1390, 571.754, "pixso-alchemy-c11")
      .setOrigin(0)
      .setDisplaySize(34.45, 32.153));
    const progressWidth = 310.77 * chance / 100;
    this.add(scene.add.rectangle(1416.201, 582.295, progressWidth, 10.5,
      chance >= 75 ? 0x4f9275 : 0xb38a45, 1).setOrigin(0));
    this.add(scene.add.image(1416.201 + progressWidth, 587.831, "pixso-alchemy-c12")
      .setDisplaySize(28.708, 29.856));

    this.add(addText(scene, 1390, 641.496, "入炉灵药", 18, "#d4b472", { strokeThickness: 0 }));
    const ingredientTops = recipe.ingredients.length <= 2
      ? [683.691, 779.542]
      : [672, 744, 816];
    recipe.ingredients.forEach((ingredient, index) => this.drawIngredientRow(ingredient, ingredientTops[index], recipe.ingredients.length));
    const bookText = recipe.bookItemId
      ? `丹方来源:《${recipe.book?.name || "未知丹方"}》${recipe.canLearn ? " 已持有" : " 未持有"}`
      : "丹方来源:天剑宗入门传承";
    this.add(addText(scene, 1618.052, 895.054, bookText, 16,
      recipe.canLearn || !recipe.bookItemId ? "#a09e85" : "#b7796d", { origin: 0.5, strokeThickness: 0 }));

    const furnaceButton = this.add(scene.add.image(1387.052, 926.054, "pixso-alchemy-c7")
      .setOrigin(0)
      .setDisplaySize(220.478, 73.493)
      .setInteractive({ useHandCursor: true }));
    this.add(addText(scene, 1497.291, 962.8, "更换丹炉", 24, "#e7c977", { origin: 0.5, strokeThickness: 0 }));
    furnaceButton.on("pointerdown", () => this.openFurnacePicker());
    furnaceButton.on("pointerover", () => furnaceButton.setAlpha(0.9));
    furnaceButton.on("pointerout", () => furnaceButton.setAlpha(1));

    const secondaryButton = this.add(scene.add.image(1628.573, 926.054, "pixso-alchemy-c7")
      .setOrigin(0)
      .setDisplaySize(220.478, 73.493)
      .setInteractive({ useHandCursor: true }));
    this.add(addText(scene, 1738.813, 962.8, recipe.learned ? "控火演练" : "参悟丹方", 24, "#e7c977", {
      origin: 0.5,
      strokeThickness: 0,
    }));
    secondaryButton.on("pointerdown", () => recipe.learned ? this.startMinigame(recipe, true) : this.useSelectedRecipe());
    secondaryButton.on("pointerover", () => secondaryButton.setAlpha(0.9));
    secondaryButton.on("pointerout", () => secondaryButton.setAlpha(1));

    if (recipe.learned) {
      this.add(addText(scene, 1618.052, 1021, "药材入炉后进入温炉、融药、凝丹三阶段控火", 16, "#a09e85", {
        origin: 0.5,
        strokeThickness: 0,
      }));
    } else {
      this.add(addText(scene, 1618.052, 1021, recipe.canLearn ? "参悟不会消耗丹方书" : "获得对应丹方书后方可参悟", 16,
        recipe.canLearn ? "#8da88e" : "#9d746c", { origin: 0.5, strokeThickness: 0 }));
    }
  }

  drawIngredientRow(ingredient, top, ingredientCount = 2) {
    const scene = this.scene;
    const enough = ingredient.enough;
    const height = ingredientCount <= 2 ? 75.851 : 58;
    this.add(scene.add.image(1387.052, top, "pixso-alchemy-c14")
      .setOrigin(0)
      .setDisplaySize(462, height));
    const centerY = top + height / 2;
    const texture = ingredient.item?.texture;
    if (texture && scene.textures.exists(texture)) {
      this.add(scene.add.image(1434.636, centerY, texture).setDisplaySize(60, 60));
    } else {
      this.add(scene.add.image(1404.636, centerY - 30, "pixso-alchemy-c3").setOrigin(0).setDisplaySize(60, 60));
      this.add(addText(scene, 1434.636, centerY, (ingredient.item?.name || ingredient.itemId).slice(0, 1), 18, "#f4d892", {
        origin: 0.5,
        strokeThickness: 1,
      }));
    }
    this.add(addText(scene, 1498, centerY, ingredient.item?.name || ingredient.itemId, 18, "#d5c6a9", {
      origin: [0, 0.5],
      strokeThickness: 0,
    }));
    this.add(addText(scene, 1775.892, centerY, enough ? "充足" : "不足", 18,
      enough ? "#5fa880" : "#c56d62", { origin: [1, 0.5], strokeThickness: 0 }));
    this.add(addText(scene, 1826.392, centerY, `${ingredient.owned}/${ingredient.quantity}`, 18, "#d5c6a9", {
      origin: [1, 0.5],
      strokeThickness: 0,
    }));
  }

  drawTag(x, y, width, label, color) {
    const scene = this.scene;
    const bg = scene.add.graphics();
    bg.fillStyle(color, 0.95);
    bg.fillRoundedRect(x - width / 2, y - 15, width, 30, 15);
    bg.lineStyle(1, PALETTE.gold, 0.72);
    bg.strokeRoundedRect(x - width / 2, y - 15, width, 30, 15);
    this.add(bg);
    this.add(addText(scene, x, y, label, 12, "#f3e4bf", { origin: 0.5, strokeThickness: 0 }));
  }

  drawStatChip(x, y, width, label, value, color) {
    const scene = this.scene;
    const bg = scene.add.graphics();
    bg.fillStyle(0x120d0b, 0.96);
    bg.fillRoundedRect(x - width / 2, y - 24, width, 48, 8);
    bg.lineStyle(1, color, 0.65);
    bg.strokeRoundedRect(x - width / 2, y - 24, width, 48, 8);
    this.add(bg);
    this.add(addText(scene, x - width / 2 + 18, y, label, 13, "#9f8f7c", { origin: [0, 0.5], strokeThickness: 0 }));
    this.add(addText(scene, x + width / 2 - 18, y, value, 17, color === PALETTE.jade ? "#72d0a2" : "#e2b75c", { origin: [1, 0.5], strokeThickness: 1 }));
  }

  drawActionButton(x, y, width, label, onClick, { primary = false, compact = false } = {}) {
    const scene = this.scene;
    const height = compact ? 44 : 54;
    const visual = scene.add.graphics();
    const fill = primary ? PALETTE.cinnabar : 0x241a15;
    const border = primary ? PALETTE.goldBright : PALETTE.gold;
    visual.fillStyle(fill, 1);
    visual.fillRoundedRect(x - width / 2, y - height / 2, width, height, 7);
    visual.lineStyle(primary ? 2 : 1, border, 0.95);
    visual.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 7);
    if (primary) {
      visual.lineStyle(1, 0xf2d596, 0.22);
      visual.strokeRoundedRect(x - width / 2 + 5, y - height / 2 + 5, width - 10, height - 10, 4);
    }
    const text = addText(scene, x, y, label, compact ? 15 : primary ? 19 : 16, primary ? "#fff0c8" : "#e3c98e", { origin: 0.5, strokeThickness: primary ? 1 : 0 });
    const hit = scene.add.rectangle(x, y, width, height, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    this.add(visual); this.add(text); this.add(hit);
    hit.on("pointerover", () => { visual.setAlpha(1.18); text.setColor("#fff0c7"); });
    hit.on("pointerout", () => { visual.setAlpha(1); text.setColor(primary ? "#fff0c8" : "#e3c98e"); });
    hit.on("pointerdown", () => {
      visual.setScale(0.985);
      this.scene.time.delayedCall(70, () => visual?.active && visual.setScale(1));
      onClick?.();
    });
  }

  useSelectedRecipe() {
    const recipe = this.service.listRecipes().find((entry) => entry.id === this.selectedRecipeId);
    if (!recipe) return;
    if (!recipe.learned) {
      const result = this.service.learnRecipe(recipe.id);
      this.render(result.message);
      return;
    }
    this.startMinigame(recipe, false);
  }

  startMinigame(recipe, practice = false) {
    const started = practice ? this.service.beginPractice(recipe.id) : this.service.beginRefinement(recipe.id);
    if (!started.ok) { this.render(started.message); return; }
    this.minigame = new AlchemyMinigamePanel(this.scene, {
      rules: this.minigameRules,
      attempt: started.attempt,
      onResolve: (outcome) => practice
        ? this.service.completePractice(outcome)
        : this.service.completeRefinement(outcome),
      onAbort: () => this.service.abortRefinement(),
      onClose: (message) => {
        this.minigame = null;
        this.render(message);
      },
    });
  }

  openFurnacePicker() {
    if (this.modal) return;
    this.modal = new FurnacePickerDialog(this.scene).open({
      furnaces: this.service.listFurnaces(),
      onSelect: (furnaceId) => {
        this.modal = null;
        const result = this.service.selectFurnace(furnaceId);
        this.render(result.message);
      },
      onCancel: () => {
        this.modal = null;
      },
    });
  }

  closeModal() { this.modal?.destroy(); this.modal = null; }

  handleEscape() {
    if (this.minigame) { this.minigame.handleEscape(); return true; }
    if (this.modal) { this.closeModal(); return true; }
    this.close();
    return true;
  }

  close() {
    if (this.minigame) {
      this.minigame.abort();
      return;
    }
    this.closeModal();
    this.root?.destroy(true);
    this.root = null;
    this.onBack?.();
  }
}

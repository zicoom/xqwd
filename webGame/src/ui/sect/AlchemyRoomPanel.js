import { addText } from "../../utils/UiHelpers.js";
import { AlchemyMinigamePanel } from "./AlchemyMinigamePanel.js";

const GRADE_COLORS = Object.freeze({
  凡品: "#d8cfbf", 灵品: "#75d4aa", 玄品: "#78b9ef", 地品: "#d997d6", 天品: "#f2c55d",
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
    this.root.add(scene.add.rectangle(0, 0, 1920, 1080, PALETTE.ink, 1).setOrigin(0).setInteractive());
    this.render();
  }

  add(display) { this.content.add(display); return display; }

  render(message = "") {
    this.content?.destroy(true);
    this.content = this.scene.add.container(0, 0);
    this.root.add(this.content);
    this.drawAtmosphere();
    this.drawHeader();
    this.drawRecipePanel();
    this.drawFurnacePanel();
    this.drawRecipeDetail();
    this.drawFooter(message);
  }

  drawAtmosphere() {
    const scene = this.scene;
    this.add(scene.add.rectangle(960, 625, 1920, 910, 0x0d0908, 1));
    this.add(scene.add.rectangle(960, 255, 1920, 150, 0x170d09, 0.92));
    this.add(scene.add.rectangle(960, 1040, 1920, 80, 0x070504, 0.96));
    const mist = this.add(scene.add.graphics());
    mist.fillStyle(0x5b2d1c, 0.07);
    mist.fillEllipse(820, 610, 980, 620);
    mist.fillStyle(0x27604b, 0.045);
    mist.fillEllipse(1160, 690, 720, 430);
    mist.lineStyle(2, 0x8a5e31, 0.16);
    [210, 265, 320].forEach((radius) => mist.strokeCircle(875, 575, radius));
    mist.lineStyle(1, 0xd6a74e, 0.1);
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      mist.lineBetween(
        875 + Math.cos(angle) * 332,
        575 + Math.sin(angle) * 332,
        875 + Math.cos(angle) * 356,
        575 + Math.sin(angle) * 356,
      );
    }
  }

  drawHeader() {
    const scene = this.scene;
    this.add(scene.add.rectangle(960, 177, 1920, 4, PALETTE.goldDark, 1));
    const ornament = this.add(scene.add.graphics());
    ornament.lineStyle(2, PALETTE.gold, 0.7);
    ornament.lineBetween(650, 215, 810, 215);
    ornament.lineBetween(1110, 215, 1270, 215);
    ornament.fillStyle(PALETTE.gold, 0.9);
    ornament.fillCircle(825, 215, 5);
    ornament.fillCircle(1095, 215, 5);
    this.add(addText(scene, 960, 207, "炼 丹 房", 35, "#e8c76f", { origin: 0.5, strokeThickness: 2 }));
    this.add(addText(scene, 960, 247, `${this.sectName} · 识药性，候丹火，收一炉造化`, 15, "#a98c69", { origin: 0.5, strokeThickness: 0 }));
    this.drawActionButton(1778, 214, 176, "返回宗门", () => this.close(), { compact: true });
  }

  drawFooter(message) {
    const scene = this.scene;
    const hasMessage = Boolean(message);
    this.add(scene.add.circle(710, 1027, 17, hasMessage ? PALETTE.cinnabar : PALETTE.jadeDark, 1)
      .setStrokeStyle(1, hasMessage ? PALETTE.cinnabarBright : PALETTE.jade));
    this.add(addText(scene, 710, 1027, hasMessage ? "讯" : "丹", 11, "#f6e8c9", { origin: 0.5, strokeThickness: 0 }));
    this.statusText = this.add(addText(scene, 740, 1027, message || "择一卷丹方，安置丹炉，备齐灵药后即可开炉。", 15,
      hasMessage ? "#e3b66b" : "#9ea68d", { origin: [0, 0.5], strokeThickness: 0 }));
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
    this.drawFrame(270, 626, 450, 672);
    this.drawSectionTitle(80, 325, "丹 方 录", `收录 ${recipes.length} 卷`, 380);
    recipes.forEach((recipe, index) => {
      const y = 408 + index * 132;
      const selected = recipe.id === this.selectedRecipeId;
      const card = scene.add.graphics();
      card.fillStyle(selected ? PALETTE.panelSelected : 0x1c1714, 1);
      card.fillRoundedRect(70, y - 52, 400, 108, 8);
      card.lineStyle(selected ? 2 : 1, selected ? PALETTE.gold : PALETTE.line, selected ? 1 : 0.62);
      card.strokeRoundedRect(70, y - 52, 400, 108, 8);
      if (selected) {
        card.fillStyle(PALETTE.gold, 1);
        card.fillRoundedRect(70, y - 52, 6, 108, 3);
      }
      this.add(card);
      const hit = scene.add.rectangle(270, y + 2, 400, 108, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      this.add(hit);
      this.add(scene.add.circle(120, y + 2, 31, selected ? PALETTE.cinnabar : 0x4a3428, 1)
        .setStrokeStyle(2, selected ? PALETTE.goldBright : 0x856445));
      this.add(addText(scene, 120, y + 2, recipe.name.slice(0, 1), 22, "#f3dca9", { origin: 0.5, strokeThickness: 1 }));
      this.add(addText(scene, 166, y - 26, recipe.name, 19, GRADE_COLORS[recipe.grade] || "#e8d8bb", { strokeThickness: 1 }));
      const stateText = recipe.learned ? "已掌握" : recipe.canLearn ? "可参悟" : "缺少丹方书";
      const stateColor = recipe.learned ? "#72cfa2" : recipe.canLearn ? "#dfb75b" : "#9a8175";
      this.add(addText(scene, 166, y + 2, stateText, 13, stateColor, { strokeThickness: 0 }));
      this.add(addText(scene, 438, y - 25, recipe.grade, 12, GRADE_COLORS[recipe.grade] || "#e8d8bb", { origin: [1, 0], strokeThickness: 0 }));
      this.add(scene.add.rectangle(166, y + 36, 188, 6, 0x0c0908, 1).setOrigin(0, 0.5));
      this.add(scene.add.rectangle(166, y + 36, 188 * recipe.baseSuccessRate / 100, 6, selected ? PALETTE.gold : PALETTE.jade, 1).setOrigin(0, 0.5));
      this.add(addText(scene, 438, y + 29, `${recipe.baseSuccessRate}%`, 12, "#a99882", { origin: [1, 0], strokeThickness: 0 }));
      hit.on("pointerover", () => { if (!selected) card.setAlpha(1.2); });
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
    this.drawFrame(870, 626, 690, 672, { raised: true, accent: 0x7d5229 });
    this.drawSectionTitle(565, 325, "丹 炉 灵 台", furnace ? `当前 · ${furnace.grade}` : "尚未安炉", 610);
    const ritual = this.add(scene.add.graphics());
    ritual.fillStyle(0x6f2d18, 0.08);
    ritual.fillCircle(870, 548, 210);
    ritual.lineStyle(2, PALETTE.gold, 0.22);
    ritual.strokeCircle(870, 548, 185);
    ritual.lineStyle(1, PALETTE.goldBright, 0.16);
    ritual.strokeCircle(870, 548, 155);
    ritual.strokeCircle(870, 548, 123);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
      ritual.fillStyle(index % 2 ? PALETTE.jade : PALETTE.gold, 0.75);
      ritual.fillCircle(870 + Math.cos(angle) * 188, 548 + Math.sin(angle) * 188, 4);
    }
    if (!furnace) {
      const slot = scene.add.circle(870, 548, 118, 0x17100e, 0.86).setStrokeStyle(3, PALETTE.goldDark)
        .setInteractive({ useHandCursor: true });
      this.add(slot);
      this.add(addText(scene, 870, 520, "+", 70, "#d5a44c", { origin: 0.5, strokeThickness: 0 }));
      this.add(addText(scene, 870, 615, "安 置 丹 炉", 20, "#d8bb7c", { origin: 0.5, strokeThickness: 1 }));
      this.add(addText(scene, 870, 665, "选择一座丹炉后，灵台才可聚火开炉", 14, "#8f7e6b", { origin: 0.5, strokeThickness: 0 }));
      slot.on("pointerdown", () => this.openFurnacePicker());
      return;
    }
    const visual = this.drawCauldron(870, 540, furnace.color, 1.55);
    this.scene.tweens.add({ targets: visual.glow, alpha: { from: 0.14, to: 0.38 }, scale: { from: 0.92, to: 1.08 }, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.scene.tweens.add({ targets: visual.flames, scaleY: { from: 0.88, to: 1.08 }, duration: 240, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add(addText(scene, 870, 705, furnace.name, 29, GRADE_COLORS[furnace.grade] || "#ebc371", { origin: 0.5, strokeThickness: 2 }));
    this.drawTag(870, 746, 96, furnace.grade, furnace.grade === "灵品" ? PALETTE.jadeDark : PALETTE.cinnabar);
    this.add(addText(scene, 870, 785, furnace.description, 14, "#af9e8c", {
      origin: 0.5, align: "center", wordWrap: { width: 500 }, lineSpacing: 5, strokeThickness: 0,
    }));
    this.drawStatChip(724, 836, 238, "成丹增益", `+${furnace.successBonus}%`, PALETTE.jade);
    this.drawStatChip(1016, 836, 238, "额外成丹", `+${furnace.yieldBonus}%`, PALETTE.gold);
    this.drawActionButton(870, 900, 190, "更换丹炉", () => this.openFurnacePicker());
    const state = this.service.getState();
    this.add(addText(scene, 870, 948, `累计开炉 ${state.refinementCount} 次  ·  成丹 ${state.successCount} 次  ·  最佳控火 ${state.bestControlScore || 0}`, 13, "#796b5e", { origin: 0.5, strokeThickness: 0 }));
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
    this.drawFrame(1555, 626, 570, 672);
    this.drawSectionTitle(1305, 325, "炼 制 筹 备", recipe?.learned ? "步骤 3 / 3" : "步骤 1 / 3", 500);
    if (!recipe) return;
    const furnace = this.service.getSelectedFurnace();
    const chance = Math.min(100, recipe.baseSuccessRate + (furnace?.successBonus || 0));
    this.add(scene.add.circle(1350, 405, 39, recipe.learned ? PALETTE.cinnabar : PALETTE.goldDark, 1).setStrokeStyle(2, PALETTE.gold));
    this.add(addText(scene, 1350, 405, recipe.name.slice(0, 1), 26, "#f5e2b2", { origin: 0.5, strokeThickness: 1 }));
    this.add(addText(scene, 1410, 382, recipe.name, 25, GRADE_COLORS[recipe.grade] || "#e9d4ae", { strokeThickness: 2 }));
    this.drawTag(1750, 389, 92, recipe.grade, recipe.learned ? PALETTE.jadeDark : PALETTE.goldDark);
    this.add(addText(scene, 1410, 420, recipe.description, 14, "#aa9987", { wordWrap: { width: 360 }, lineSpacing: 5, strokeThickness: 0 }));
    this.add(addText(scene, 1305, 487, "综合成丹预估", 14, "#c6b18f", { strokeThickness: 0 }));
    this.add(addText(scene, 1805, 480, `${chance}%`, 24, chance >= 75 ? "#78d1a4" : "#e0b75a", { origin: [1, 0], strokeThickness: 1 }));
    this.add(scene.add.rectangle(1305, 527, 500, 10, 0x090706, 1).setOrigin(0, 0.5));
    this.add(scene.add.rectangle(1305, 527, 500 * chance / 100, 10, chance >= 75 ? PALETTE.jade : PALETTE.gold, 1).setOrigin(0, 0.5));
    this.add(scene.add.circle(1305 + 500 * chance / 100, 527, 7, PALETTE.goldBright, 1));
    this.add(addText(scene, 1305, 564, "入炉灵药", 16, "#dbc28e", { strokeThickness: 1 }));
    recipe.ingredients.forEach((ingredient, index) => this.drawIngredientRow(ingredient, 603 + index * 66));
    const bookText = recipe.bookItemId
      ? `丹方来源  ·  《${recipe.book?.name || "未知丹方"}》${recipe.canLearn ? " 已持有" : " 未持有"}`
      : "丹方来源  ·  天剑宗入门传承";
    this.add(addText(scene, 1305, 756, bookText, 13, recipe.canLearn ? "#91aa8e" : "#b7796d", { strokeThickness: 0 }));
    if (recipe.learned) {
      this.drawActionButton(1420, 863, 205, "控火演练", () => this.startMinigame(recipe, true));
      this.drawActionButton(1685, 863, 285, "开 炉 炼 丹", () => this.useSelectedRecipe(), { primary: true });
      this.add(addText(scene, 1555, 923, "药材入炉后进入温炉、融药、凝丹三阶段控火", 13, "#817264", { origin: 0.5, strokeThickness: 0 }));
    } else {
      this.drawActionButton(1555, 863, 300, "参 悟 丹 方", () => this.useSelectedRecipe(), { primary: true });
      this.add(addText(scene, 1555, 923, recipe.canLearn ? "参悟不会消耗丹方书" : "获得对应丹方书后方可参悟", 13,
        recipe.canLearn ? "#8da88e" : "#9d746c", { origin: 0.5, strokeThickness: 0 }));
    }
  }

  drawIngredientRow(ingredient, y) {
    const scene = this.scene;
    const enough = ingredient.enough;
    const card = scene.add.graphics();
    card.fillStyle(enough ? 0x17221d : 0x251614, 1);
    card.fillRoundedRect(1305, y - 24, 500, 50, 7);
    card.lineStyle(1, enough ? PALETTE.jadeDark : 0x6b3b31, 1);
    card.strokeRoundedRect(1305, y - 24, 500, 50, 7);
    this.add(card);
    this.add(scene.add.circle(1335, y + 1, 13, enough ? PALETTE.jade : PALETTE.cinnabar, 1));
    this.add(addText(scene, 1335, y + 1, enough ? "✓" : "!", 11, "#f3ead1", { origin: 0.5, strokeThickness: 0 }));
    this.add(addText(scene, 1364, y, ingredient.item?.name || ingredient.itemId, 14, "#dfd3bc", { origin: [0, 0.5], strokeThickness: 0 }));
    this.add(addText(scene, 1718, y, enough ? "充足" : "不足", 12, enough ? "#72c99d" : "#d27e70", { origin: [1, 0.5], strokeThickness: 0 }));
    this.add(addText(scene, 1785, y, `${ingredient.owned}/${ingredient.quantity}`, 14, enough ? "#bcd7c7" : "#e0a39a", { origin: [1, 0.5], strokeThickness: 0 }));
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
    const scene = this.scene;
    this.modal = scene.add.container(0, 0).setDepth(1100);
    const shade = scene.add.rectangle(0, 0, 1920, 1080, 0x030201, 0.84).setOrigin(0).setInteractive();
    const panel = scene.add.graphics();
    panel.fillStyle(0x14100f, 1);
    panel.fillRoundedRect(430, 205, 1060, 760, 16);
    panel.lineStyle(2, PALETTE.gold, 0.9);
    panel.strokeRoundedRect(430, 205, 1060, 760, 16);
    panel.lineStyle(1, PALETTE.goldBright, 0.18);
    panel.strokeRoundedRect(440, 215, 1040, 740, 12);
    const title = addText(scene, 960, 252, "择 一 座 丹 炉", 31, "#e8c56b", { origin: 0.5, strokeThickness: 2 });
    const subtitle = addText(scene, 960, 295, "不同丹炉会改变成丹与额外产出，不会消耗背包物品", 14, "#998977", { origin: 0.5, strokeThickness: 0 });
    this.modal.add([shade, panel, title, subtitle]);
    this.service.listFurnaces().forEach((furnace, index) => {
      const x = 640 + (index % 3) * 320;
      const y = 445 + Math.floor(index / 3) * 260;
      const card = scene.add.graphics();
      card.fillStyle(furnace.selected ? 0x302016 : 0x191514, 1);
      card.fillRoundedRect(x - 135, y - 105, 270, 218, 10);
      card.lineStyle(furnace.selected ? 2 : 1, furnace.selected ? PALETTE.goldBright : PALETTE.line, 1);
      card.strokeRoundedRect(x - 135, y - 105, 270, 218, 10);
      const hit = scene.add.rectangle(x, y + 4, 270, 218, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      const seal = scene.add.circle(x, y - 48, 39, furnace.color, 1).setStrokeStyle(2, PALETTE.gold);
      const sealText = addText(scene, x, y - 48, furnace.seal, 25, "#fff1c5", { origin: 0.5, strokeThickness: 1 });
      const name = addText(scene, x, y + 12, furnace.name, 19, GRADE_COLORS[furnace.grade] || "#e8c276", { origin: 0.5, strokeThickness: 1 });
      const bonus = addText(scene, x, y + 60, `成丹 +${furnace.successBonus}%   ·   额外 +${furnace.yieldBonus}%`, 13, "#b99b65", { origin: 0.5, strokeThickness: 0 });
      this.modal.add([card, hit, seal, sealText, name, bonus]);
      hit.on("pointerover", () => card.setAlpha(1.2));
      hit.on("pointerout", () => card.setAlpha(1));
      hit.on("pointerdown", () => {
        const result = this.service.selectFurnace(furnace.id);
        this.closeModal();
        this.render(result.message);
      });
    });
    const cancelVisual = scene.add.graphics();
    cancelVisual.fillStyle(0x261b16, 1);
    cancelVisual.fillRoundedRect(850, 870, 220, 50, 7);
    cancelVisual.lineStyle(1, PALETTE.gold, 0.9);
    cancelVisual.strokeRoundedRect(850, 870, 220, 50, 7);
    const cancelText = addText(scene, 960, 895, "取 消", 17, "#dbc28e", { origin: 0.5, strokeThickness: 0 });
    const cancelHit = scene.add.rectangle(960, 895, 220, 50, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    cancelHit.on("pointerdown", () => this.closeModal());
    this.modal.add([cancelVisual, cancelText, cancelHit]);
  }

  closeModal() { this.modal?.destroy(true); this.modal = null; }

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

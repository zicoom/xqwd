import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/DisplayConfig.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { InventoryService } from "../domain/inventory/InventoryService.js";

/**
 * 角色菜单中的储物袋子页，只负责物品展示与交互。
 * 一级导航和菜单生命周期由 CharacterMenuPanel 负责。
 */
export class StorageBagPanel {
  constructor(scene, services = {}) {
    this.scene = scene;
    this.parent = services.parent;
    this.catalog = services.catalog || scene.itemCatalog || new ItemCatalog();
    this.inventoryService = services.inventoryService || scene.inventoryService || new InventoryService({
      player: gameState.player,
      save: saveFirstChapterProgress,
    });
    this.category = "全部";
    this.grade = "全部";
    this.scrollRow = 0;
    this.hoveredItemId = null;
    this.selectedItemId = null;
    this.bagOffsetY = 30;
    this.headerOffsetY = 8;
    this.titleOffsetY = 2;
    this.effectTimers = new Map();
    this.actionMenu = null;
    this.actionMenuItem = null;
    this.useResultLayer = null;
    this.sortByGradeAscending = false;
    this.storageLayer = null;
  }

  get visible() { return Boolean(this.storageLayer?.visible); }

  getGradeColor(grade) {
    return ({ "凡品": 0x414040, "灵品": 0x285c45, "玄品": 0x294e71, "地品": 0x70471d, "天品": 0x653962, "仙品": 0x9a6920, "神器": 0x8b3b37 })[grade] || 0x414040;
  }

  getGradeTextColor(grade) {
    return ({
      "凡品": "#c8c1b7", "灵品": "#63cfa0", "玄品": "#6ba9e4", "地品": "#d7a052",
      "天品": "#d183dc", "仙品": "#f2cf6c", "神器": "#ef7069",
    })[grade] || "#c8c1b7";
  }

  getItems() {
    const gradeOrder = ["神器", "仙品", "天品", "地品", "玄品", "灵品", "凡品"];
    const gradeAscendingOrder = ["凡品", "灵品", "玄品", "地品", "天品", "仙品", "神器"];
    const typeOrder = ["丹药", "灵草", "功法", "法宝", "装备", "书籍", "材料", "其他"];
    const normalizedType = (type) => type === "器材" ? "材料" : type;
    return this.catalog.ownedBy(gameState.player)
      .filter((item) => this.category === "全部" || normalizedType(item.type) === this.category)
      .filter((item) => this.grade === "全部" || item.grade === this.grade)
      .sort((left, right) => {
        if (this.sortByGradeAscending) {
          const leftGradeIndex = gradeAscendingOrder.indexOf(left.grade);
          const rightGradeIndex = gradeAscendingOrder.indexOf(right.grade);
          const gradeDifference = (leftGradeIndex < 0 ? Number.MAX_SAFE_INTEGER : leftGradeIndex)
            - (rightGradeIndex < 0 ? Number.MAX_SAFE_INTEGER : rightGradeIndex);
          if (gradeDifference !== 0) return gradeDifference;
          return left.name.localeCompare(right.name, "zh-CN");
        }
        const typeDifference = typeOrder.indexOf(normalizedType(left.type)) - typeOrder.indexOf(normalizedType(right.type));
        if (typeDifference !== 0) return typeDifference;
        const gradeDifference = gradeOrder.indexOf(left.grade) - gradeOrder.indexOf(right.grade);
        if (gradeDifference !== 0) return gradeDifference;
        return left.name.localeCompare(right.name, "zh-CN");
      });
  }
  
  create() {
    const scene = this.scene;
    // 右键会打开物品操作菜单，因此关闭浏览器自己的右键菜单，避免它挡住储物袋操作。
    scene.input.mouse?.disableContextMenu?.();
    const canvas = scene.game?.canvas;
    if (canvas && !canvas.__storageContextMenuBlocked) {
      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
      canvas.__storageContextMenuBlocked = true;
    }
    const bagY = this.bagOffsetY;
    const headerY = this.headerOffsetY;
    const titleY = this.titleOffsetY;
    if (!this.parent) throw new Error("StorageBagPanel 需要 CharacterMenuPanel 提供父容器");
    this.storageLayer = scene.add.container(0, 0).setVisible(false);
    this.parent.add(this.storageLayer);

    // 主角立绘位于左侧底部，保持在资料卡的后方，不遮挡物品详情。
    const playerPortrait = scene.add.image(430, 1080, "player-dialogue-portrait")
      .setOrigin(0.5, 1)
      // 原图 720 × 960，按 0.9167 等比显示为 660 × 880，不能拉伸。
      .setDisplaySize(660, 880)
      .setAlpha(0.98);
    this.storageLayer.add(playerPortrait);

    this.infoLayer = scene.add.container(0, 0).setVisible(false);
    this.storageLayer.add(this.infoLayer);
    this.useNotice = addText(scene, 814, 567, "", 16, "#b8deb4", { strokeThickness: 2 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.storageLayer.add(this.useNotice);

    // 用户提供的储物袋框为 860 × 825，按原始尺寸摆放，不能再用手绘框替代。
    const bagFrame = scene.add.image(1370, 577.5 + bagY, "storage-bag-frame").setDisplaySize(860, 825);
    this.storageLayer.add(bagFrame);
    const title = addText(scene, 1370, 254 + titleY, "储物袋", 28, "#f5d88c", { strokeThickness: 2 }).setOrigin(0.5);
    this.storageLayer.add(title);

    // 顶部分类：直接使用用户提供的 79 × 45 背景素材。
    this.categoryButtons = [];
    const categories = ["全部", "丹药", "灵草", "书籍", "装备", "材料", "其他"];
    categories.forEach((name, index) => {
      // 整组宽：95 + 7 × 79 + 7 × 8 = 704，围绕面板中心 1370 对齐。
      const x = 1121 + index * 87;
      const background = scene.add.image(x + 39.5, 332.5 + headerY, "storage-category").setDisplaySize(79, 45);
      const label = addText(scene, x + 39.5, 332.5 + headerY, name, 17, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      this.storageLayer.add([background, label]);
      this.categoryButtons.push({ name, x, background, label });
    });
    const gradeButton = scene.add.image(1065.5, 332.5 + headerY, "storage-grade-option").setDisplaySize(95, 45);
    this.gradeButtonLabel = addText(scene, 1058, 332.5 + headerY, "品级", 17, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    const gradeButtonArrow = scene.add.image(1095, 332.5 + headerY, "storage-grade-arrow").setDisplaySize(16, 18);
    this.storageLayer.add([gradeButton, this.gradeButtonLabel, gradeButtonArrow]);

    this.gridLayer = scene.add.container(0, 0);
    // 物品格子区域整体下移 10px。
    this.gridLayer.y = bagY + 10;
    this.storageLayer.add(this.gridLayer);
    this.emptyText = addText(scene, 1395, 635 + bagY, "储物袋中还没有物品", 21, "#9f8975", { strokeThickness: 0 }).setOrigin(0.5);
    this.storageLayer.add(this.emptyText);

    // 底部状态栏：734 × 92，底部两个角为 26px 圆角。
    const footer = scene.add.graphics();
    const footerX = 1004;
    const footerY = 904;
    const footerWidth = 732;
    const footerHeight = 72;
    const footerRadius = 26;
    footer.fillStyle(0x301E15, 1);
    footer.beginPath();
    footer.moveTo(footerX, footerY);
    footer.lineTo(footerX + footerWidth, footerY);
    footer.lineTo(footerX + footerWidth, footerY + footerHeight - footerRadius);
    footer.arc(footerX + footerWidth - footerRadius, footerY + footerHeight - footerRadius, footerRadius, 0, Math.PI / 2, false);
    footer.lineTo(footerX + footerRadius, footerY + footerHeight);
    footer.arc(footerX + footerRadius, footerY + footerHeight - footerRadius, footerRadius, Math.PI / 2, Math.PI, false);
    footer.lineTo(footerX, footerY);
    footer.closePath();
    footer.fillPath();
    const stone = scene.add.image(1040, 910 + bagY, "merchant-spirit-stone").setDisplaySize(13, 21);
    this.stonesText = addText(scene, 1058, 910 + bagY, "0 灵石", 20, "#f4c77c", { strokeThickness: 0 }).setOrigin(0, 0.5);
    this.capacityText = addText(scene, 1375, 910 + bagY, "0 / 100", 20, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    const sort = scene.add.graphics();
    sort.fillStyle(0x5a4530, 1);
    sort.fillRoundedRect(1631, 890 + bagY, 82, 43, 6);
    sort.lineStyle(1, 0x9d794b, 1);
    sort.strokeRoundedRect(1631, 890 + bagY, 82, 43, 6);
    const sortText = addText(scene, 1674, 910 + bagY, "整理", 16, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    this.storageLayer.add([footer, stone, this.stonesText, this.capacityText, sort, sortText]);

    this.gradeMenu = scene.add.container(0, 0).setVisible(false);
    this.gradeMenu.y = headerY;
    const menu = scene.add.graphics();
    menu.fillStyle(0x24170f, 0.99);
    menu.fillRoundedRect(1018, 358, 135, 458, 16);
    menu.lineStyle(1, 0x8c642f, 1);
    menu.strokeRoundedRect(1018, 358, 135, 458, 16);
    this.gradeMenu.add(menu);
    this.gradeOptions = [];
    ["全部", "凡品", "灵品", "玄品", "地品", "天品", "仙品", "神器"].forEach((name, index) => {
      const y = 374 + index * 55;
      const optionBg = scene.add.image(1083.5, y + 22.5, "storage-grade-option").setDisplaySize(95, 45);
      const optionText = addText(scene, 1076, y + 22.5, name, 17, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      const optionArrow = scene.add.image(1110, y + 22.5, "storage-grade-arrow").setDisplaySize(16, 18);
      this.gradeMenu.add([optionBg, optionText, optionArrow]);
      this.gradeOptions.push({ name, y, background: optionBg, label: optionText, arrow: optionArrow });
    });
    this.storageLayer.add(this.gradeMenu);

    // 右键菜单不使用浏览器原生菜单，所有操作都在游戏界面内完成。
    this.createItemActionMenu();
    this.createUseResultPopup();
  }

  createItemActionMenu() {
    const scene = this.scene;
    const menu = scene.add.container(0, 0).setVisible(false);
    // 直接使用美术按钮本身的尺寸：使用丹药 95×38，其他按钮 90×38。
    // 不再把素材强行拉大，后续替换按钮图片时也会自动读取新尺寸。
    const gap = 4;
    const actions = [
      { id: "use", label: "使用丹药", texture: "storage-action-use" },
      { id: "detail", label: "查看详情", texture: "storage-action-detail" },
      { id: "discard", label: "丢弃", texture: "storage-action-discard" },
    ];
    const sourceSize = (texture) => {
      const source = scene.textures.get(texture)?.getSourceImage();
      return {
        width: source?.width || 90,
        height: source?.height || 38,
      };
    };
    const actionSizes = actions.map((action) => sourceSize(action.texture));
    const width = Math.max(...actionSizes.map((size) => size.width));
    this.actionMenuButtons = actions.map((action, index) => {
      const size = actionSizes[index];
      const y = actionSizes.slice(0, index).reduce((total, item) => total + item.height + gap, 0);
      const x = Math.round((width - size.width) / 2);
      const background = scene.add.image(x + size.width / 2, y + size.height / 2, action.texture)
        .setDisplaySize(size.width, size.height);
      const label = addText(scene, x + size.width / 2, y + size.height / 2, action.label, 16, "#ffffff", { strokeThickness: 0 })
        .setOrigin(0.5);
      menu.add([background, label]);
      return { ...action, x, y, width: size.width, height: size.height };
    });
    this.storageLayer.add(menu);
    this.actionMenu = menu;
  }

  createUseResultPopup() {
    const scene = this.scene;
    const layer = scene.add.container(0, 0).setVisible(false).setAlpha(0);
    const shade = scene.add.rectangle(960, 540, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, 0.18);
    const card = scene.add.graphics();
    card.fillStyle(0x2b1b10, 0.98);
    card.fillRoundedRect(650, 385, 620, 250, 10);
    card.lineStyle(2, 0xc48d39, 1);
    card.strokeRoundedRect(650, 385, 620, 250, 10);
    this.useResultTitle = addText(scene, 960, 465, "使用丹药", 30, "#f5ce69", { strokeThickness: 1 }).setOrigin(0.5);
    this.useResultText = addText(scene, 960, 520, "", 20, "#d9c7ae", { strokeThickness: 0, align: "center", wordWrap: { width: 510 } }).setOrigin(0.5);
    layer.add([shade, card, this.useResultTitle, this.useResultText]);
    this.storageLayer.add(layer);
    this.useResultLayer = layer;
  }

  closeItemActionMenu() {
    this.actionMenu?.setVisible(false);
    this.actionMenuItem = null;
  }

  openItemActionMenu(item, slot) {
    if (!item || !slot || !this.actionMenu) return;
    const menuWidth = Math.max(...(this.actionMenuButtons || []).map((action) => action.width), 95);
    const menuHeight = (this.actionMenuButtons || []).reduce((height, action, index) => (
      height + action.height + (index ? 4 : 0)
    ), 122);
    let x = slot.x + slot.width + 12;
    // 最右列右边没有空间时，菜单改到格子左侧，始终完整显示。
    if (x + menuWidth > 1740) x = slot.x - menuWidth - 12;
    // 右键菜单整体向左微调，使其和物品格的视觉间距更贴近设计稿。
    x -= 5;
    // 右键菜单从物品格右侧、略低于格子顶部的位置展开，和设计稿保持一致。
    const y = Phaser.Math.Clamp(slot.y + Math.round(slot.height * 0.28), 0, SCREEN_HEIGHT - menuHeight);
    this.actionMenu.setPosition(x, y).setVisible(true);
    this.actionMenuItem = item;
    this.selectedItemId = item.id;
    this.showInfo(item);
  }

  getItemAction(pointer) {
    if (!this.actionMenu?.visible) return null;
    return this.pointerCandidates(pointer).map((point) => this.actionMenuButtons?.find((action) => (
      point.x >= this.actionMenu.x + action.x
      && point.x <= this.actionMenu.x + action.x + action.width
      && point.y >= this.actionMenu.y + action.y
      && point.y <= this.actionMenu.y + action.y + action.height
    ))).find(Boolean);
  }

  describeItemEffect(item) {
    return this.inventoryService.describeEffect(item);
  }

  showUseResult(item, message, failed = false) {
    if (!this.useResultLayer) return;
    const layer = this.useResultLayer;
    this.scene.tweens.killTweensOf(layer);
    this.useResultTitle.setText(failed ? "使用失败" : "使用丹药").setColor(failed ? "#e3a07e" : "#f5ce69");
    this.useResultText.setText(`${item.name}：${message}`).setColor(failed ? "#e3b99e" : "#d9c7ae");
    layer.setVisible(true).setAlpha(0);
    this.scene.tweens.add({
      targets: layer,
      alpha: 1,
      duration: 160,
      ease: "Sine.Out",
      hold: 1300,
      onComplete: () => this.scene.tweens.add({
        targets: layer,
        alpha: 0,
        duration: 180,
        ease: "Sine.In",
        onComplete: () => layer.setVisible(false),
      }),
    });
  }

  discardItem(item) {
    const result = this.inventoryService.discard(item);
    if (!result.ok) return;
    this.selectedItemId = null;
    this.hoveredItemId = null;
    this.clearInfo();
    this.closeItemActionMenu();
    this.showUseNotice(result.message, "#e3b99e");
    this.render();
  }

  reset() {
    if (!this.storageLayer) this.create();
    this.clearExpiredEffects();
    this.category = "全部";
    this.grade = "全部";
    this.gradeButtonLabel.setText("品级");
    this.scrollRow = 0;
    this.hoveredItemId = null;
    this.selectedItemId = null;
    this.gradeMenu.setVisible(false);
    this.infoLayer.setVisible(false);
    this.closeItemActionMenu();
    this.useResultLayer?.setVisible(false);
    this.render();
  }

  setVisible(visible) {
    if (!this.storageLayer) this.create();
    this.storageLayer.setVisible(visible);
    if (visible) this.render();
    else this.deactivate();
  }

  deactivate() {
    this.infoLayer.setVisible(false);
    this.gradeMenu.setVisible(false);
    this.closeItemActionMenu();
    this.useResultLayer?.setVisible(false);
  }

  render() {
    const scene = this.scene;
    const items = this.getItems();
    const columnCount = 6;
    const visibleRows = 5;
    const rows = Math.ceil(items.length / columnCount);
    const maxScroll = Math.max(0, rows - visibleRows);
    this.scrollRow = Phaser.Math.Clamp(this.scrollRow, 0, maxScroll);
    const first = this.scrollRow * columnCount;
    this.gridLayer.removeAll(true);
    this.slots = [];
    for (let index = 0; index < columnCount * visibleRows; index += 1) {
      const column = index % columnCount;
      const row = Math.floor(index / columnCount);
      // 每一格右侧与下侧固定留 12px。
      const x = 1025 + column * 117;
      const y = 380 + row * 110;
      const item = items[first + index];
      const slot = scene.add.graphics();
      // 储物袋格与商人购买界面共用同一套：105 × 98。
      slot.fillStyle(0x5b3b25, 1);
      slot.fillRoundedRect(x, y, 105, 98, 6);
      slot.fillStyle(0x2e2117, 0.86);
      slot.fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      this.gridLayer.add(slot);
      if (!item) continue;
      const grade = scene.add.graphics();
      grade.fillStyle(this.getGradeColor(item.grade), 1);
      grade.fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      // #2E2117 的多层内阴影，商人购买格同款。
      grade.fillStyle(0x2e2117, 0.6);
      grade.fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      grade.fillStyle(this.getGradeColor(item.grade), 0.18);
      grade.fillRoundedRect(x + 6, y + 6, 93, 86, 4);
      grade.fillStyle(this.getGradeColor(item.grade), 0.12);
      grade.fillRoundedRect(x + 10, y + 10, 85, 78, 3);
      const image = scene.add.image(x + 52.5, y + 49, item.texture).setDisplaySize(80, 80);
      // 物品名称条固定铺满格子内侧：101 × 30，不能跟随文字长度变化。
      // 用独立矩形而不是文字底图，确保任何名称都会拥有相同大小的黑色半透明背景。
      const nameBg = scene.add.rectangle(x + 52.5, y + 81, 101, 30, 0x000000, 0.3)
        .setOrigin(0.5);
      const name = addText(scene, x + 52.5, y + 81, item.name, 14, "#a0a0a0", { strokeThickness: 0 }).setOrigin(0.5);
      const amount = addText(scene, x + 101, y + 5, String(item.quantity), 14, "#c4c0b8", { stroke: "#20150e", strokeThickness: 1 }).setOrigin(1, 0);
      const highlight = scene.add.graphics();
      if (item.id === this.hoveredItemId || item.id === this.selectedItemId) {
        highlight.lineStyle(2, 0xfcc01f, 1);
        highlight.strokeRoundedRect(x + 1, y + 1, 103, 96, 6);
      }
      this.gridLayer.add([grade, image, nameBg, name, amount, highlight]);
      this.slots.push({ item, x, y: y + this.bagOffsetY + 10, width: 105, height: 98 });
    }
    if (maxScroll > 0) {
      const scroll = scene.add.graphics();
      scroll.fillStyle(0x2a190e, 1);
      scroll.fillRoundedRect(1725, 380, 8, 538, 4);
      const thumbHeight = Math.max(60, 538 * (visibleRows / rows));
      const thumbY = 380 + (538 - thumbHeight) * (this.scrollRow / maxScroll);
      scroll.fillGradientStyle(0xdda853, 0xdda853, 0x835522, 0x835522, 1);
      scroll.fillRoundedRect(1725, thumbY, 8, thumbHeight, 4);
      this.gridLayer.add(scroll);
    }
    this.emptyText.setVisible(!items.length);
    this.capacityText.setText(`${items.length} / 100`);
    this.stonesText.setText(`${(Number(gameState.player.spiritStones) || 0).toLocaleString("zh-CN")} 灵石`);
    this.categoryButtons.forEach((button) => {
      const selected = button.name === this.category;
      button.background.setTexture(selected ? "storage-category-selected" : "storage-category");
      button.label.setColor(selected ? "#fff1c4" : "#f2d1ab");
    });
    this.gradeOptions.forEach((option) => {
      const selected = option.name === this.grade;
      option.background.setTexture(selected ? "storage-grade-option-selected" : "storage-grade-option");
      option.arrow.setTexture(selected ? "storage-grade-arrow-selected" : "storage-grade-arrow");
      option.label.setColor(selected ? "#fff1c4" : "#f2d1ab");
    });
  }

  // Phaser 对没有空格的中文不会总是自动断行，因此按详情卡可用宽度（18 个汉字）补上换行。
  wrapDescription(text, charsPerLine = 18) {
    const lines = [];
    let line = "";
    for (const character of Array.from(String(text || ""))) {
      if (character === "\n") {
        lines.push(line);
        line = "";
      } else {
        line += character;
        if (Array.from(line).length >= charsPerLine) {
          lines.push(line);
          line = "";
        }
      }
    }
    if (line) lines.push(line);
    return lines.join("\n");
  }

  showInfo(item) {
    if (!item || this.hoveredItemId === item.id) return;
    this.hoveredItemId = item.id;
    const scene = this.scene;
    scene.tweens.killTweensOf(this.infoLayer);
    this.infoLayer.removeAll(true).setAlpha(0).setY(8).setVisible(true);
    const card = scene.add.graphics();
    card.fillStyle(0x2b1d14, 0.97);
    card.fillRoundedRect(664, 325, 300, 215, 15);
    card.lineStyle(2, 0x766657, 1);
    card.strokeRoundedRect(664, 325, 300, 215, 15);
    const name = addText(scene, 687, 352, item.name, 25, "#f8d600", { strokeThickness: 0 });
    // 灵草在背包详情中归入“灵药”分类；后续其它类别仍显示自己的类型。
    const typeName = item.type === "灵草" ? "灵药" : item.type;
    const type = addText(scene, 941, 358, typeName, 16, "#c7b69b", { strokeThickness: 0 }).setOrigin(1, 0.5);
    const gradeLabel = addText(scene, 687, 393, "品阶：", 20, "#e0bd8b", { strokeThickness: 0 });
    const grade = addText(scene, 756, 393, item.grade, 20, this.getGradeTextColor(item.grade), { strokeThickness: 0 });
    const description = addText(scene, 687, 427, this.wrapDescription(item.description), 14, "#b2a596", { strokeThickness: 0, lineSpacing: 4 });
    const divider = scene.add.rectangle(814, 494, 240, 1, 0x5b402c, 0.9);
    const hint = addText(scene, 814, 516, "左键选中 | 右键操作", 14, "#9d9184", { strokeThickness: 0 }).setOrigin(0.5);
    this.infoLayer.add([card, name, type, gradeLabel, grade, description, divider, hint]);
    scene.tweens.add({
      targets: this.infoLayer,
      alpha: 1,
      y: 0,
      duration: 160,
      ease: "Sine.Out",
    });
    this.render();
  }

  showUseNotice(message, color = "#b8deb4") {
    if (!this.useNotice) return;
    this.scene.tweens.killTweensOf(this.useNotice);
    this.useNotice.setText(message).setColor(color).setAlpha(0).setY(573);
    this.scene.tweens.add({
      targets: this.useNotice,
      alpha: 1,
      y: 567,
      duration: 150,
      ease: "Sine.Out",
      hold: 1400,
      onComplete: () => {
        this.scene.tweens.add({ targets: this.useNotice, alpha: 0, duration: 220, ease: "Sine.In" });
      },
    });
  }

  getUseEffect(item) {
    return this.inventoryService.getUseEffect(item);
  }

  useItem(item) {
    const result = this.inventoryService.use(item);
    this.selectedItemId = this.inventoryService.getQuantity(item.id) > 0 ? item.id : null;
    this.hoveredItemId = null;
    this.showUseNotice(result.ok ? `使用 ${item.name}：${result.message}` : result.message, result.ok ? "#b8deb4" : "#e3b99e");
    this.showUseResult(item, result.message, !result.ok);
    if (result.temporaryEffect) this.scheduleEffectExpiry(result.temporaryEffect);
    this.scene.chapterMapHud?.refreshPlayerStatus?.();
    this.render();
  }

  scheduleEffectExpiry(effect) {
    if (!effect?.id || this.effectTimers.has(effect.id)) return;
    const delay = Math.max(0, Number(effect.expiresAt) - Date.now());
    if (!delay) return this.clearExpiredEffects();
    const timer = this.scene.time.delayedCall(delay, () => {
      this.effectTimers.delete(effect.id);
      this.clearExpiredEffects();
    });
    this.effectTimers.set(effect.id, timer);
  }

  clearExpiredEffects() {
    const { expired, active } = this.inventoryService.clearExpiredEffects();
    expired.forEach((effect) => {
      this.effectTimers.get(effect.id)?.remove?.(false);
      this.effectTimers.delete(effect.id);
    });
    active.forEach((effect) => this.scheduleEffectExpiry(effect));
  }

  clearInfo() {
    if (!this.hoveredItemId) return;
    this.hoveredItemId = null;
    this.scene.tweens.killTweensOf(this.infoLayer);
    this.scene.tweens.add({
      targets: this.infoLayer,
      alpha: 0,
      y: 4,
      duration: 100,
      ease: "Sine.In",
      onComplete: () => {
        if (!this.hoveredItemId) this.infoLayer.setVisible(false).setY(0);
      },
    });
    this.render();
  }

  /**
   * Phaser 已把鼠标位置转换为 1920×1080 的游戏逻辑坐标。
   * 储物袋不能再根据浏览器 Canvas 尺寸进行第二次换算，否则分类、品级和物品格
   * 会在窗口化、全屏或高分屏时出现“视觉位置正确但无法点击”的问题。
   */
  pointerCandidates(pointer) {
    return [{ x: Number(pointer?.x) || 0, y: Number(pointer?.y) || 0 }];
  }

  findSlot(pointer) {
    return this.pointerCandidates(pointer).map((point) => this.slots?.find((slot) => (
      point.x >= slot.x && point.x <= slot.x + slot.width && point.y >= slot.y && point.y <= slot.y + slot.height
    ))).find(Boolean);
  }

  handlePointerMove(pointer) {
    if (!this.visible) return;
    const slot = this.findSlot(pointer);
    if (slot) this.showInfo(slot.item);
    else this.clearInfo();
  }

  handlePointer(pointer) {
    const points = this.pointerCandidates(pointer);
    const inArea = (predicate) => points.some(predicate);
    // 使用结果展示期间不允许点击穿透到背后的物品格。
    if (this.useResultLayer?.visible) return;
    const itemAction = this.getItemAction(pointer);
    if (itemAction) {
      const item = this.actionMenuItem;
      if (!item) return;
      playUiClickSound(this.scene);
      if (itemAction.id === "use") {
        this.closeItemActionMenu();
        this.useItem(item);
      } else if (itemAction.id === "detail") {
        this.closeItemActionMenu();
        this.selectedItemId = item.id;
        this.showInfo(item);
        this.render();
      } else if (itemAction.id === "discard") {
        this.discardItem(item);
      }
      return;
    }
    if (this.actionMenu?.visible) this.closeItemActionMenu();
    const category = this.categoryButtons.find((button) => inArea(({ x, y }) => x >= button.x && x <= button.x + 79 && y >= 318 && y <= 363));
    if (category) {
      playUiClickSound(this.scene);
      this.category = category.name;
      this.scrollRow = 0;
      this.clearInfo();
      this.render();
      return;
    }
    if (inArea(({ x, y }) => x >= 1018 && x <= 1113 && y >= 318 && y <= 363)) {
      playUiClickSound(this.scene);
      this.gradeMenu.setVisible(!this.gradeMenu.visible);
      return;
    }
    if (this.gradeMenu.visible) {
      const option = this.gradeOptions.find((entry) => inArea(({ x, y }) => x >= 1036 && x <= 1131 && y >= entry.y + this.headerOffsetY && y <= entry.y + this.headerOffsetY + 45));
      if (option) {
        playUiClickSound(this.scene);
        this.grade = option.name;
        this.gradeButtonLabel.setText(this.grade === "全部" ? "品级" : this.grade);
        this.gradeMenu.setVisible(false);
        this.scrollRow = 0;
        this.clearInfo();
        this.render();
        return;
      }
      this.gradeMenu.setVisible(false);
    }
    if (inArea(({ x, y }) => x >= 1631 && x <= 1713 && y >= 920 && y <= 963)) {
      playUiClickSound(this.scene);
      this.sortByGradeAscending = true;
      this.scrollRow = 0;
      this.clearInfo();
      this.showUseNotice("已按品阶由低到高整理物品");
      this.render();
      return;
    }
    const slot = this.findSlot(pointer);
    if (slot) {
      playUiClickSound(this.scene);
      const isRightClick = pointer?.button === 2
        || pointer?.event?.button === 2
        || pointer?.event?.which === 3
        || (typeof pointer?.rightButtonDown === "function" && pointer.rightButtonDown());
      if (isRightClick) {
        this.openItemActionMenu(slot.item, slot);
        return;
      }
      this.selectedItemId = slot.item.id;
      this.showInfo(slot.item);
      this.render();
    }
  }

  isGridPointer(pointer) {
    if (!this.visible) return false;
    return this.pointerCandidates(pointer).some(({ x, y }) => x >= 1015 && x <= 1740 && y >= 400 && y <= 950);
  }

  scroll(change) {
    const rows = Math.ceil(this.getItems().length / 6);
    const next = Phaser.Math.Clamp(this.scrollRow + change, 0, Math.max(0, rows - 5));
    if (next === this.scrollRow) return;
    this.scrollRow = next;
    this.clearInfo();
    this.render();
  }
}

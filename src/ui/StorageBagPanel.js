import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/DisplayConfig.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";

/**
 * 储物袋独立界面。
 * 所有布局均使用 1920 × 1080 设计坐标，避免与地图场景逻辑混在一起。
 */
export class StorageBagPanel {
  constructor(scene) {
    this.scene = scene;
    this.panel = null;
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
    // 同一张全屏界面内切换“储物袋”和“法宝”，避免为法宝另建场景造成重复逻辑。
    this.activeTab = "储物袋";
    this.navSelection = null;
    this.navLabels = [];
    this.storageLayer = null;
    this.artifactLayer = null;
    this.artifactCategory = "攻击";
    this.artifactCategoryButtons = [];
    // 功法页与法宝页同用木框，但拥有独立的装备栏与功法库。
    this.techniqueLayer = null;
    this.techniqueSlotButtons = [];
    this.techniqueGridLayer = null;
    this.techniqueLibrarySlots = [];
    this.selectedTechniqueSlot = "main";
  }

  get visible() { return Boolean(this.panel?.visible); }

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
    const inventory = gameState.player.inventory || {};
    const gradeOrder = ["神器", "仙品", "天品", "地品", "玄品", "灵品", "凡品"];
    const gradeAscendingOrder = ["凡品", "灵品", "玄品", "地品", "天品", "仙品", "神器"];
    const typeOrder = ["丹药", "灵草", "功法", "法宝", "装备", "书籍", "材料", "其他"];
    const normalizedType = (type) => type === "器材" ? "材料" : type;
    return this.scene.getMerchantItems()
      .map((item) => ({ ...item, quantity: Math.max(0, Number(inventory[item.id]) || 0) }))
      .filter((item) => item.quantity > 0)
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
    const panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(2050).setVisible(false);
    panel.setSize(SCREEN_WIDTH, SCREEN_HEIGHT).setInteractive({ useHandCursor: false });
    // 点击与悬浮统一由 VillageScene 转发，避免同一次右键被处理两次。

    // 用户提供的 1920 × 1080 背景，按原始尺寸一比一铺满。
    const backdrop = scene.add.image(960, 540, "storage-background").setDisplaySize(1920, 1080);
    panel.add(backdrop);

    // 一级栏目，尺寸取自 Pixso：选中标签 244 × 88，顶部条高 145。
    const nav = scene.add.graphics();
    nav.fillStyle(0x071213, 0.3);
    nav.fillRect(0, 0, SCREEN_WIDTH, 145);
    nav.lineStyle(1, 0x39504a, 0.75);
    nav.lineBetween(0, 144, SCREEN_WIDTH, 144);
    panel.add(nav);
    // 选中底框独立保存；切换到法宝页时可平滑移动到“法宝”栏目下。
    this.navSelection = scene.add.graphics();
    panel.add(this.navSelection);
    this.navEntries = [
      ["属性", 335], ["储物袋", 558], ["法宝", 768], ["法术", 922],
      ["功法", 1075], ["社交", 1228], ["存档", 1382],
    ];
    this.navEntries.forEach(([label, x]) => {
      const text = addText(scene, x, 72, label, 30, "#aa9a65", { strokeThickness: 0 }).setOrigin(0.5);
      panel.add(text);
      this.navLabels.push({ label, x, text });
    });
    const close = scene.add.graphics();
    close.fillStyle(0x332d25, 1);
    close.fillRoundedRect(1769, 40, 64, 64, 8);
    close.lineStyle(1, 0xa99763, 1);
    close.strokeRoundedRect(1769, 40, 64, 64, 8);
    const closeLabel = addText(scene, 1801, 72, "×", 34, "#eadfbf", { strokeThickness: 0 }).setOrigin(0.5);
    panel.add([close, closeLabel]);

    // 储物袋与法宝页各自拥有独立容器，切换时不会出现旧界面残留在新界面的情况。
    this.storageLayer = scene.add.container(0, 0);
    panel.add(this.storageLayer);

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

    // 法宝页只负责展示与整理法宝；其内容和普通物品背包严格分层。
    this.panel = panel;
    this.createArtifactPage();
    this.createTechniquePage();

    // 右键菜单不使用浏览器原生菜单，所有操作都在游戏界面内完成。
    this.createItemActionMenu();
    this.createUseResultPopup();
  }

  /**
   * 创建 Pixso「储物袋-法宝」页。
   * 设计稿以 1920 × 1080 为基础：木框完全使用用户提供的 860 × 638 原图，
   * 左侧六种法宝定位与右侧 5 × 2 格子均按设计稿坐标摆放，不能随意拉伸。
   */
  createArtifactPage() {
    const scene = this.scene;
    const layer = scene.add.container(0, 0).setVisible(false);
    this.panel.add(layer);
    this.artifactLayer = layer;

    // 原图坐标：右侧法宝框左上角为 (944, 273)，保持 860 × 638 原始像素尺寸。
    const frame = scene.add.image(1374, 592, "artifact-frame").setDisplaySize(860, 638);
    layer.add(frame);

    // 六个法宝定位。图标素材尚未单独提供时，先使用统一的“灵韵底座”占位；
    // 以后只替换该位置的图片，不会影响标签、间距与点击区域。
    const categoryLayout = [
      { name: "御剑", x: 530, y: 325 },
      { name: "防御", x: 362, y: 489 },
      { name: "属性", x: 690, y: 489 },
      { name: "攻击", x: 530, y: 632 },
      { name: "辅助", x: 362, y: 775 },
      { name: "抗性", x: 690, y: 775 },
    ];
    this.artifactCategoryButtons = categoryLayout.map((entry) => {
      const holder = scene.add.graphics();
      // 105 × 104 的图标容器与 Pixso 中的法宝展示位尺寸相同。
      holder.fillStyle(0x725a38, 0.92);
      holder.fillRoundedRect(entry.x - 53, entry.y - 52, 106, 104, 9);
      holder.fillStyle(0x5a452b, 0.94);
      holder.fillCircle(entry.x, entry.y, 42);
      holder.lineStyle(1, 0xe4cc8a, 0.72);
      holder.strokeRoundedRect(entry.x - 53, entry.y - 52, 106, 104, 9);
      const label = scene.add.image(entry.x, entry.y + 69, "artifact-category-label").setDisplaySize(90, 33);
      const text = addText(scene, entry.x, entry.y + 68, entry.name, 20, "#5e440d", { strokeThickness: 0 }).setOrigin(0.5);
      layer.add([holder, label, text]);
      return { ...entry, holder, label, text };
    });

    // 右侧固定 5 × 2 格：每格 105 × 104，横向间距 24px、纵向间距 26px。
    this.artifactGridLayer = scene.add.container(0, 0);
    layer.add(this.artifactGridLayer);
    this.artifactEmptyText = addText(scene, 1435, 626, "暂无已装备法宝", 21, "#a98c70", { strokeThickness: 0 })
      .setOrigin(0.5)
      .setVisible(false);
    layer.add(this.artifactEmptyText);

    // 原木框下沿已预留容量栏，只补充文字与可点击的“整理”功能。
    this.artifactCapacityText = addText(scene, 1443, 881, "0 / 100", 20, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    const sortBackground = scene.add.graphics();
    sortBackground.fillStyle(0x5a3a20, 0.93);
    sortBackground.fillRoundedRect(1564, 854, 123, 52, 7);
    sortBackground.lineStyle(1, 0x976331, 0.9);
    sortBackground.strokeRoundedRect(1564, 854, 123, 52, 7);
    const sortText = addText(scene, 1625.5, 880, "整理", 20, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    layer.add([this.artifactCapacityText, sortBackground, sortText]);
  }

  /** 返回玩家背包中实际拥有的法宝；不会凭空把未获得物品塞进正式背包。 */
  getArtifactItems() {
    const inventory = gameState.player.inventory || {};
    return this.scene.getMerchantItems()
      .map((item) => ({ ...item, quantity: Math.max(0, Number(inventory[item.id]) || 0) }))
      .filter((item) => item.quantity > 0 && item.type === "法宝")
      .filter((item) => !item.artifactCategory || item.artifactCategory === this.artifactCategory);
  }

  /** 根据当前分类重新绘制法宝格与其数量。 */
  renderArtifact() {
    if (!this.artifactLayer) return;
    const items = this.getArtifactItems();
    this.artifactGridLayer.removeAll(true);
    const columns = 5;
    const rows = 2;
    const slotWidth = 105;
    const slotHeight = 104;
    const startX = 1060;
    const startY = 334;
    const gapX = 24;
    const gapY = 26;
    for (let index = 0; index < columns * rows; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (slotWidth + gapX);
      const y = startY + row * (slotHeight + gapY);
      const item = items[index];
      const slot = this.scene.add.graphics();
      slot.fillStyle(0x36261c, 0.94);
      slot.fillRoundedRect(x, y, slotWidth, slotHeight, 5);
      slot.lineStyle(1, 0x715033, 0.86);
      slot.strokeRoundedRect(x, y, slotWidth, slotHeight, 5);
      this.artifactGridLayer.add(slot);
      if (!item) continue;
      const itemIcon = this.scene.add.image(x + slotWidth / 2, y + 47, item.texture).setDisplaySize(78, 78);
      const name = addText(this.scene, x + slotWidth / 2, y + 88, item.name, 14, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      const amount = addText(this.scene, x + 96, y + 10, String(item.quantity), 15, "#ffe0a0", { strokeThickness: 0 }).setOrigin(1, 0.5);
      this.artifactGridLayer.add([itemIcon, name, amount]);
    }
    this.artifactEmptyText.setVisible(!items.length);
    this.artifactCapacityText.setText(`${items.length} / 100`);
    this.artifactCategoryButtons.forEach((button) => {
      const selected = button.name === this.artifactCategory;
      button.holder.clear();
      button.holder.fillStyle(selected ? 0x9d7a40 : 0x725a38, selected ? 1 : 0.92);
      button.holder.fillRoundedRect(button.x - 53, button.y - 52, 106, 104, 9);
      button.holder.fillStyle(selected ? 0x655025 : 0x5a452b, 0.96);
      button.holder.fillCircle(button.x, button.y, 42);
      button.holder.lineStyle(1, selected ? 0xffe19a : 0xe4cc8a, selected ? 1 : 0.72);
      button.holder.strokeRoundedRect(button.x - 53, button.y - 52, 106, 104, 9);
      button.text.setColor(selected ? "#4e310a" : "#5e440d");
    });
  }

  /** 切换顶部标签，只有储物袋、法宝已有可运行的完整页面。 */
  setActiveTab(tab) {
    const nextTab = ["储物袋", "法宝", "功法"].includes(tab) ? tab : "储物袋";
    this.activeTab = nextTab;
    const selectedEntry = this.navEntries.find(([label]) => label === nextTab) || this.navEntries[1];
    this.navSelection.clear();
    this.navSelection.fillStyle(0x3a3a29, 1);
    this.navSelection.fillRoundedRect(selectedEntry[1] - 100, 34, 200, 76, 8);
    this.navSelection.lineStyle(1, 0xa99763, 1);
    this.navSelection.strokeRoundedRect(selectedEntry[1] - 100, 34, 200, 76, 8);
    this.navLabels.forEach((entry) => entry.text.setColor(entry.label === nextTab ? "#f2e2b5" : "#aa9a65"));
    this.storageLayer.setVisible(nextTab === "储物袋");
    this.artifactLayer.setVisible(nextTab === "法宝");
    this.techniqueLayer.setVisible(nextTab === "功法");
    this.gradeMenu.setVisible(false);
    this.closeItemActionMenu();
    this.useResultLayer?.setVisible(false);
    if (nextTab === "法宝") this.renderArtifact();
    else if (nextTab === "功法") this.renderTechniquePage();
    else this.render();
  }

  /**
   * 功法页：沿用法宝的 860 × 638 木框，左边固定放装备位，右边显示玩家实际拥有的功法。
   * 1 个主修、4 个辅修与 1 个速度位均只保存功法 id，不会消耗背包里的功法。
   */
  createTechniquePage() {
    const scene = this.scene;
    const layer = scene.add.container(0, 0).setVisible(false);
    this.panel.add(layer);
    this.techniqueLayer = layer;

    // 与法宝页严格共用用户提供的原始木框，尺寸不可缩放。
    layer.add(scene.add.image(1374, 592, "artifact-frame").setDisplaySize(860, 638));

    const slotLayout = [
      { id: "speed", label: "速度", x: 530, y: 325, hint: "战斗先手" },
      { id: "auxiliary-0", label: "辅修", x: 362, y: 489, hint: "辅助功法" },
      { id: "auxiliary-1", label: "辅修", x: 690, y: 489, hint: "辅助功法" },
      { id: "main", label: "主修", x: 530, y: 632, hint: "核心功法" },
      { id: "auxiliary-2", label: "辅修", x: 362, y: 775, hint: "辅助功法" },
      { id: "auxiliary-3", label: "辅修", x: 690, y: 775, hint: "辅助功法" },
    ];
    this.techniqueSlotButtons = slotLayout.map((entry) => {
      const holder = scene.add.graphics();
      const labelBg = scene.add.image(entry.x, entry.y + 69, "artifact-category-label").setDisplaySize(90, 33);
      const label = addText(scene, entry.x, entry.y + 68, entry.label, 20, "#5e440d", { strokeThickness: 0 }).setOrigin(0.5);
      const iconLayer = scene.add.container(entry.x, entry.y);
      layer.add([holder, iconLayer, labelBg, label]);
      return { ...entry, holder, labelBg, label, iconLayer };
    });

    this.techniqueGridLayer = scene.add.container(0, 0);
    layer.add(this.techniqueGridLayer);
    this.techniqueEmptyText = addText(scene, 1435, 626, "背包中暂无功法", 21, "#a98c70", { strokeThickness: 0 }).setOrigin(0.5);
    this.techniqueCapacityText = addText(scene, 1443, 881, "0 / 100", 20, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    const sortBg = scene.add.graphics();
    sortBg.fillStyle(0x5a3a20, 0.93);
    sortBg.fillRoundedRect(1564, 854, 123, 52, 7);
    sortBg.lineStyle(1, 0x976331, 0.9);
    sortBg.strokeRoundedRect(1564, 854, 123, 52, 7);
    const sortText = addText(scene, 1625.5, 880, "整理", 20, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    this.techniqueHintText = addText(scene, 1375, 930, "先选择左侧功法位，再选择右侧功法即可装备。", 16, "#b99a72", { strokeThickness: 0 }).setOrigin(0.5);
    layer.add([this.techniqueEmptyText, this.techniqueCapacityText, sortBg, sortText, this.techniqueHintText]);
  }

  /** 老存档进入功法页时补齐装备栏数据。 */
  ensureTechniqueEquipment() {
    const current = gameState.player.equippedTechniques || {};
    gameState.player.equippedTechniques = {
      main: current.main || null,
      auxiliary: Array.from({ length: 4 }, (_, index) => current.auxiliary?.[index] || null),
      speed: current.speed || null,
    };
    return gameState.player.equippedTechniques;
  }

  getTechniqueItems() {
    const inventory = gameState.player.inventory || {};
    return this.scene.getMerchantItems()
      .map((item) => ({ ...item, quantity: Math.max(0, Number(inventory[item.id]) || 0) }))
      .filter((item) => item.quantity > 0 && item.type === "功法")
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }

  getTechniqueForSlot(slotId) {
    const equipped = this.ensureTechniqueEquipment();
    if (slotId === "main" || slotId === "speed") return equipped[slotId];
    const index = Number(slotId.split("-")[1]);
    return equipped.auxiliary[index] || null;
  }

  /** 将功法装入指定位置；同一功法不可重复装备，改装后立即写入当前角色档案。 */
  equipTechnique(slotId, techniqueId) {
    const equipped = this.ensureTechniqueEquipment();
    // 先移除该功法旧的装备位置，避免主修、辅修、速度栏同时指向同一本功法。
    if (equipped.main === techniqueId) equipped.main = null;
    if (equipped.speed === techniqueId) equipped.speed = null;
    equipped.auxiliary = equipped.auxiliary.map((id) => id === techniqueId ? null : id);
    if (slotId === "main" || slotId === "speed") equipped[slotId] = techniqueId;
    else equipped.auxiliary[Number(slotId.split("-")[1])] = techniqueId;
    saveFirstChapterProgress();
    this.renderTechniquePage();
  }

  /** 功法页自己的提示文字位于可见层中，不能复用被隐藏的储物袋提示条。 */
  showTechniqueEquipNotice(item) {
    if (!this.techniqueHintText) return;
    const slot = this.techniqueSlotButtons.find((entry) => entry.id === this.selectedTechniqueSlot);
    const suffix = slot?.label === "速度" ? "；速度位会参与战斗先手判定" : "";
    this.techniqueHintText.setText(`已装备「${item.name}」至${slot?.label || "功法"}位${suffix}`).setColor("#e8cb85");
  }

  /** 将当前选中的功法位清空。右键点击左侧装备位即可使用。 */
  clearTechniqueSlot(slotId) {
    const equipped = this.ensureTechniqueEquipment();
    if (slotId === "main" || slotId === "speed") equipped[slotId] = null;
    else equipped.auxiliary[Number(slotId.split("-")[1])] = null;
    saveFirstChapterProgress();
    this.renderTechniquePage();
    if (this.techniqueHintText) this.techniqueHintText.setText("已卸下功法。选择左侧功法位后，可重新装备。").setColor("#b99a72");
  }

  renderTechniquePage() {
    if (!this.techniqueLayer) return;
    const items = this.getTechniqueItems();
    const itemsById = new Map(items.map((item) => [item.id, item]));
    this.techniqueSlotButtons.forEach((slot) => {
      const technique = itemsById.get(this.getTechniqueForSlot(slot.id));
      const selected = slot.id === this.selectedTechniqueSlot;
      slot.holder.clear();
      slot.holder.fillStyle(selected ? 0x9d7a40 : 0x725a38, selected ? 1 : 0.92);
      slot.holder.fillRoundedRect(slot.x - 53, slot.y - 52, 106, 104, 9);
      slot.holder.fillStyle(0x5a452b, 0.95);
      slot.holder.fillCircle(slot.x, slot.y, 42);
      slot.holder.lineStyle(selected ? 2 : 1, selected ? 0xffe19a : 0xe4cc8a, selected ? 1 : 0.72);
      slot.holder.strokeRoundedRect(slot.x - 53, slot.y - 52, 106, 104, 9);
      slot.iconLayer.removeAll(true);
      if (technique) {
        slot.iconLayer.add(this.scene.add.image(0, -2, technique.texture).setDisplaySize(84, 84));
        slot.iconLayer.add(addText(this.scene, 0, 39, technique.name, 13, "#f6ddb1", { strokeThickness: 0 }).setOrigin(0.5));
      }
      slot.text.setColor(slot.label === "主修" ? "#6b3b08" : "#5e440d");
    });

    this.techniqueGridLayer.removeAll(true);
    this.techniqueLibrarySlots = [];
    for (let index = 0; index < 10; index += 1) {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = 1060 + column * 129;
      const y = 334 + row * 130;
      const item = items[index];
      const cell = this.scene.add.graphics();
      cell.fillStyle(0x36261c, 0.94);
      cell.fillRoundedRect(x, y, 105, 104, 5);
      cell.lineStyle(1, 0x715033, 0.86);
      cell.strokeRoundedRect(x, y, 105, 104, 5);
      this.techniqueGridLayer.add(cell);
      if (!item) continue;
      const icon = this.scene.add.image(x + 52.5, y + 47, item.texture).setDisplaySize(78, 78);
      const name = addText(this.scene, x + 52.5, y + 88, item.name, 14, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      this.techniqueGridLayer.add([icon, name]);
      this.techniqueLibrarySlots.push({ item, x, y, width: 105, height: 104 });
    }
    this.techniqueEmptyText.setVisible(!items.length);
    this.techniqueCapacityText.setText(`${items.length} / 100`);
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
    const effect = this.getUseEffect(item);
    if (!effect) return "该物品暂时不能直接使用";
    const entries = [];
    if (effect.hp) entries.push(`生命 +${effect.hp}`);
    if (effect.qi) entries.push(`修为 +${effect.qi}`);
    if (effect.attack) entries.push(`攻击 +${effect.attack}`);
    if (effect.defense) entries.push(`防御 +${effect.defense}`);
    if (effect.resistanceType && effect.resistanceType !== "无") entries.push(`抗性：${effect.resistanceType}`);
    else if (effect.resistance) entries.push(`抗性 +${effect.resistance}`);
    if (effect.cultivationExp) entries.push(`修炼经验 +${effect.cultivationExp}`);
    if (effect.skillText) entries.push("习得技能");
    if (effect.duration) entries.push(`持续 ${effect.duration} 秒`);
    return entries.length ? entries.join("，") : "暂无可用效果";
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
    const inventory = gameState.player.inventory || {};
    const quantity = Math.max(0, Number(inventory[item?.id]) || 0);
    if (!item || quantity <= 0) return;
    inventory[item.id] = quantity - 1;
    if (inventory[item.id] <= 0) delete inventory[item.id];
    this.selectedItemId = null;
    this.hoveredItemId = null;
    this.clearInfo();
    this.closeItemActionMenu();
    this.showUseNotice(`已丢弃 ${item.name} × 1`, "#e3b99e");
    saveFirstChapterProgress();
    this.render();
  }

  /**
   * 打开背包总面板。
   * @param {"储物袋"|"法宝"|"功法"} initialTab 由顶部 HUD 决定默认打开的页签。
   */
  open(initialTab = "储物袋") {
    if (!this.panel) this.create();
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
    this.panel.setAlpha(0).setVisible(true);
    // 每次打开都显式切换页签，避免上一次停留在法宝页时状态残留。
    this.setActiveTab(initialTab);
    this.scene.tweens.add({ targets: this.panel, alpha: 1, duration: 180, ease: "Sine.Out" });
    playUiClickSound(this.scene);
  }

  close() {
    if (!this.visible) return;
    playUiClickSound(this.scene);
    this.panel.setVisible(false);
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
    if (item?.canUse === false) return null;

    // 物品管理编辑器填写的效果优先于旧的演示数据。
    const configuredEffect = {
      hp: Math.max(0, Number(item?.restoreHp) || 0),
      qi: Math.max(0, Number(item?.restoreQi) || 0),
      attack: Math.max(0, Number(item?.attackBonus) || 0),
      defense: Math.max(0, Number(item?.defenseBonus) || 0),
      resistance: Math.max(0, Number(item?.resistance) || 0),
      resistanceType: String(item?.resistanceType || "无"),
      cultivationExp: Math.max(0, Number(item?.cultivationExp) || 0),
      duration: Math.max(0, Number(item?.duration) || 0),
      successRate: Phaser.Math.Clamp(Number(item?.successRate ?? 100) || 0, 0, 100),
      skillText: String(item?.skillText || "").trim(),
    };
    const hasConfiguredEffect = Boolean(
      configuredEffect.hp || configuredEffect.qi || configuredEffect.attack
      || configuredEffect.defense || configuredEffect.resistance || configuredEffect.resistanceType !== "无" || configuredEffect.cultivationExp
      || configuredEffect.duration || configuredEffect.skillText
    );
    if (hasConfiguredEffect) return configuredEffect;

    return ({
      baixiangye: { hp: 4 },
      juqicao: { qi: 8 },
      xingyingguo: { qi: 18 },
      ninglutai: { hp: 8, qi: 4 },
      linggugen: { hp: 20 },
      yuyazhi: { hp: 16, qi: 16 },
      qingmaiteng: { hp: 8 },
      qinglinghua: { qi: 12 },
      chiyangshen: { hp: 10, qi: 20 },
    })[item.id] || null;
  }

  useItem(item) {
    const effect = this.getUseEffect(item);
    if (!effect) {
      this.showUseNotice(`${item.name} 暂时不能直接使用`, "#e3b99e");
      this.showUseResult(item, "该物品暂时不能直接使用", true);
      return;
    }
    const player = gameState.player;
    // 有成功率的物品先结算成败。失败同样会消耗该物品，符合丹药、符箓类消耗品的常见规则。
    const succeeded = Math.random() * 100 < (effect.successRate ?? 100);
    const inventory = player.inventory || (player.inventory = {});
    const consumeOne = () => {
      inventory[item.id] = Math.max(0, (Number(inventory[item.id]) || 0) - 1);
      if (inventory[item.id] <= 0) delete inventory[item.id];
    };
    if (!succeeded) {
      consumeOne();
      this.selectedItemId = null;
      this.hoveredItemId = null;
      this.showUseNotice(`使用 ${item.name} 失败，物品已消耗`, "#e3b99e");
      this.showUseResult(item, "使用失败，物品已消耗", true);
      saveFirstChapterProgress();
      this.render();
      return;
    }
    const oldHp = Number(player.hp) || 0;
    const oldQi = Number(player.qi) || 0;
    const nextHp = Phaser.Math.Clamp(oldHp + (effect.hp || 0), 0, Number(player.maxHp) || oldHp);
    const nextQi = Phaser.Math.Clamp(oldQi + (effect.qi || 0), 0, Number(player.maxQi) || oldQi);
    const gainedHp = nextHp - oldHp;
    const gainedQi = nextQi - oldQi;
    const hasOtherEffect = Boolean(effect.attack || effect.defense || effect.resistance || effect.resistanceType !== "无" || effect.cultivationExp || effect.skillText);
    if (gainedHp <= 0 && gainedQi <= 0 && !hasOtherEffect) {
      this.showUseNotice("生命与修为均已圆满，无需使用", "#e3b99e");
      this.showUseResult(item, "生命与修为均已圆满，无需使用", true);
      return;
    }
    consumeOne();
    player.hp = nextHp;
    player.qi = nextQi;
    player.cultivationExp = Math.max(0, Number(player.cultivationExp) || 0) + (effect.cultivationExp || 0);
    if (effect.resistanceType && effect.resistanceType !== "无") {
      const currentTypes = Array.isArray(player.resistanceTypes) ? player.resistanceTypes : [];
      player.resistanceTypes = Array.from(new Set([...currentTypes, effect.resistanceType]));
    }

    const bonus = { attack: effect.attack || 0, defense: effect.defense || 0, resistance: effect.resistance || 0 };
    const hasBonus = bonus.attack > 0 || bonus.defense > 0 || bonus.resistance > 0;
    if (hasBonus) {
      player.attack = Math.max(0, Number(player.attack) || 0) + bonus.attack;
      player.defense = Math.max(0, Number(player.defense) || 0) + bonus.defense;
      player.resistance = Math.max(0, Number(player.resistance) || 0) + bonus.resistance;
      if (effect.duration > 0) this.addTemporaryEffect(item, bonus, effect.duration);
    }
    if (effect.skillText) {
      player.learnedSkills = Array.isArray(player.learnedSkills) ? player.learnedSkills : [];
      if (!player.learnedSkills.includes(effect.skillText)) player.learnedSkills.push(effect.skillText);
    }
    this.selectedItemId = inventory[item.id] ? item.id : null;
    this.hoveredItemId = null;
    const recovered = [];
    if (gainedHp > 0) recovered.push(`生命 +${gainedHp}`);
    if (gainedQi > 0) recovered.push(`修为 +${gainedQi}`);
    if (bonus.attack > 0) recovered.push(`攻击 +${bonus.attack}`);
    if (bonus.defense > 0) recovered.push(`防御 +${bonus.defense}`);
    if (effect.resistanceType && effect.resistanceType !== "无") recovered.push(`抗性：${effect.resistanceType}`);
    else if (bonus.resistance > 0) recovered.push(`抗性 +${bonus.resistance}`);
    if (effect.cultivationExp > 0) recovered.push(`修炼经验 +${effect.cultivationExp}`);
    if (effect.skillText) recovered.push("已习得技能");
    if (effect.duration > 0 && hasBonus) recovered.push(`持续 ${effect.duration} 秒`);
    this.showUseNotice(`使用 ${item.name}：${recovered.join("，")}`);
    this.showUseResult(item, recovered.join("，") || this.describeItemEffect(item));
    saveFirstChapterProgress();
    this.scene.chapterMapHud?.refreshPlayerStatus?.();
    this.render();
  }

  addTemporaryEffect(item, bonus, duration) {
    const player = gameState.player;
    player.activeItemEffects = Array.isArray(player.activeItemEffects) ? player.activeItemEffects : [];
    const effect = {
      id: `${item.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      itemName: item.name,
      ...bonus,
      expiresAt: Date.now() + duration * 1000,
    };
    player.activeItemEffects.push(effect);
    this.scheduleEffectExpiry(effect);
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
    const player = gameState.player;
    const effects = Array.isArray(player.activeItemEffects) ? player.activeItemEffects : [];
    const now = Date.now();
    const expired = effects.filter((effect) => Number(effect.expiresAt) <= now);
    if (expired.length) {
      expired.forEach((effect) => {
        const timer = this.effectTimers.get(effect.id);
        timer?.remove?.(false);
        this.effectTimers.delete(effect.id);
        player.attack = Math.max(0, (Number(player.attack) || 0) - (Number(effect.attack) || 0));
        player.defense = Math.max(0, (Number(player.defense) || 0) - (Number(effect.defense) || 0));
        player.resistance = Math.max(0, (Number(player.resistance) || 0) - (Number(effect.resistance) || 0));
      });
      player.activeItemEffects = effects.filter((effect) => Number(effect.expiresAt) > now);
      saveFirstChapterProgress();
    }
    (player.activeItemEffects || []).forEach((effect) => this.scheduleEffectExpiry(effect));
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
    // 法宝页没有普通背包的悬浮详情卡，不应继续命中被隐藏的物品格。
    if (this.activeTab !== "储物袋") return;
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
    if (inArea(({ x, y }) => x >= 1769 && x <= 1833 && y >= 40 && y <= 104)) { this.close(); return; }

    // 顶部导航中已完成“储物袋”“法宝”“功法”三个页签；其它标签保留展示，不抢占点击。
    const navigation = this.navEntries?.find(([name, centerX]) => (
      (name === "储物袋" || name === "法宝" || name === "功法")
      && inArea(({ x, y }) => x >= centerX - 100 && x <= centerX + 100 && y >= 34 && y <= 110)
    ));
    if (navigation) {
      playUiClickSound(this.scene);
      this.setActiveTab(navigation[0]);
      return;
    }

    // 法宝页仅处理六个定位与整理按钮，不能落入储物袋的物品分类逻辑。
    if (this.activeTab === "法宝") {
      const category = this.artifactCategoryButtons.find((button) => inArea(({ x, y }) => (
        x >= button.x - 53 && x <= button.x + 53 && y >= button.y - 52 && y <= button.y + 87
      )));
      if (category) {
        playUiClickSound(this.scene);
        this.artifactCategory = category.name;
        this.renderArtifact();
        return;
      }
      if (inArea(({ x, y }) => x >= 1564 && x <= 1687 && y >= 854 && y <= 906)) {
        playUiClickSound(this.scene);
        this.showUseNotice("法宝已按品阶整理", "#e6c98c");
      }
      return;
    }

    // 功法页：左侧选择装备位，右侧选择背包中拥有的功法。
    // 右键左侧位可卸下功法，方便重新安排主修、辅修和速度位。
    if (this.activeTab === "功法") {
      const techniqueSlot = this.techniqueSlotButtons.find((button) => inArea(({ x, y }) => (
        x >= button.x - 53 && x <= button.x + 53 && y >= button.y - 52 && y <= button.y + 87
      )));
      if (techniqueSlot) {
        playUiClickSound(this.scene);
        const isRightClick = pointer?.button === 2
          || pointer?.event?.button === 2
          || pointer?.event?.which === 3
          || (typeof pointer?.rightButtonDown === "function" && pointer.rightButtonDown());
        if (isRightClick) this.clearTechniqueSlot(techniqueSlot.id);
        else {
          this.selectedTechniqueSlot = techniqueSlot.id;
          this.renderTechniquePage();
        }
        return;
      }
      const technique = this.techniqueLibrarySlots.find((slot) => inArea(({ x, y }) => (
        x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height
      )));
      if (technique) {
        playUiClickSound(this.scene);
        this.equipTechnique(this.selectedTechniqueSlot, technique.item.id);
        this.showTechniqueEquipNotice(technique.item);
        return;
      }
      if (inArea(({ x, y }) => x >= 1564 && x <= 1687 && y >= 854 && y <= 906)) {
        playUiClickSound(this.scene);
        this.techniqueHintText?.setText("功法库已按名称整理。").setColor("#e6c98c");
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
    if (this.activeTab !== "储物袋") return false;
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

import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

/**
 * 商店界面与会话状态的唯一所有者。
 * 场景只负责装配服务、打开面板和转发输入，不保存任何商店控件或购物会话字段。
 */
export class MerchantPanel {
  constructor({ scene, shopService, save = () => true }) {
    this.scene = scene;
    this.shopService = shopService;
    this.save = save;
    this.merchantShopPanel = null;
  }

  get displayObject() {
    return this.merchantShopPanel || null;
  }

  get visible() {
    return Boolean(this.displayObject?.visible);
  }

  endProductScrollDrag() {
    this.merchantProductScrollDragging = false;
  }

  ensureCreated() {
    if (!this.displayObject) this.create();
  }

  create() {
    const scene = this.scene;
    const panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(1800).setVisible(false);
    const shade = scene.add.rectangle(0, 0, 1920, 1080, 0x071009, 0.64).setOrigin(0).setInteractive();
    const background = scene.add.graphics();
    background.fillStyle(0x322115, 1);
    background.fillRoundedRect(121, 80, 1678, 920, 16);
    background.lineStyle(3, 0xb6773c, 1);
    background.strokeRoundedRect(121, 80, 1678, 920, 16);
    background.fillStyle(0x201208, 1);
    background.fillRect(124, 80, 1672, 88);
    background.lineStyle(2, 0xb6773c, 1);
    background.lineBetween(124, 168, 1796, 168);
    panel.add([shade, background]);

    const headerCenterY = 124;
    const merchantStoneMark = scene.add.image(151, headerCenterY, "merchant-spirit-stone").setDisplaySize(12, 20);
    this.merchantMerchantCurrencyText = addText(scene, 165, headerCenterY, "", 26, "#f2d1ab", { strokeThickness: 1 }).setOrigin(0, 0.5);
    const playerStoneMark = scene.add.image(1450, headerCenterY, "merchant-spirit-stone").setDisplaySize(12, 20);
    this.merchantPlayerCurrencyText = addText(scene, 1464, headerCenterY, "", 26, "#f2d1ab", { strokeThickness: 1 }).setOrigin(0, 0.5);
    const title = addText(scene, 900, headerCenterY, "商人", 38, "#f3d797", { strokeThickness: 2 }).setOrigin(0.5);
    this.merchantBuyTab = scene.add.rectangle(1050, 124, 112, 44, 0x80532c, 1).setStrokeStyle(1, 0xb98548).setInteractive({ useHandCursor: true });
    this.merchantSellTab = scene.add.rectangle(1175, 124, 112, 44, 0x392719, 1).setStrokeStyle(1, 0x765438).setInteractive({ useHandCursor: true });
    this.merchantBuyTabText = addText(scene, 1050, headerCenterY, "买入", 18, "#ffe284", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantSellTabText = addText(scene, 1175, headerCenterY, "卖出", 18, "#b9a794", { strokeThickness: 0 }).setOrigin(0.5);
    const close = scene.add.rectangle(1754, 124, 40, 40, 0x6a4b2e, 1).setStrokeStyle(1, 0x936c42).setInteractive({ useHandCursor: true });
    const closeText = addText(scene, 1754, headerCenterY, "×", 28, "#f1d7aa", { strokeThickness: 0 }).setOrigin(0.5);
    panel.add([merchantStoneMark, this.merchantMerchantCurrencyText, playerStoneMark, this.merchantPlayerCurrencyText, title, this.merchantBuyTab, this.merchantSellTab, this.merchantBuyTabText, this.merchantSellTabText, close, closeText]);

    const categoryBox = scene.add.graphics();
    categoryBox.fillStyle(0x24170f, 0.96);
    categoryBox.fillRoundedRect(143, 201, 135, 458, 14);
    categoryBox.lineStyle(3, 0x775c3f, 1);
    categoryBox.strokeRoundedRect(143, 201, 135, 458, 14);
    panel.add(categoryBox);
    this.merchantCategoryButtons = [];
    ["全部", "灵草", "丹药", "丹方", "装备", "法宝", "材料", "丹炉"].forEach((name, index) => {
      // 原图为 95×45，保持一对一尺寸；上、下留白与 Pixso 效果图一致。
      const y = 243 + index * 53;
      const bg = scene.add.image(211, y, "merchant-category-normal").setDisplaySize(95, 45).setInteractive({ useHandCursor: true });
      const text = addText(scene, 211, y - 1, name, 21, "#f2dfbf", {
        stroke: "#2a170d",
        strokeThickness: 1,
      }).setOrigin(0.5);
      panel.add([bg, text]);
      this.merchantCategoryButtons.push({ name, bg, text, y });
    });

    const detail = scene.add.graphics();
    detail.fillStyle(0x24170f, 0.96);
    detail.fillRoundedRect(1336, 201, 438, 515, 18);
    panel.add(detail);
    // 标签为暖金色，具体类型与品阶为灰米色，和设计稿的层级一致。
    const merchantDetailTypeLabel = addText(scene, 1370, 228, "类型：", 20, "#e6c07f", { strokeThickness: 0 });
    this.merchantDetailType = addText(scene, 1432, 228, "", 20, "#b8ada0", { strokeThickness: 0 });
    const merchantDetailGradeLabel = addText(scene, 1635, 228, "品阶：", 20, "#e6c07f", { strokeThickness: 0 });
    this.merchantDetailGrade = addText(scene, 1740, 228, "", 20, "#b8ada0", { strokeThickness: 0 }).setOrigin(1, 0);
    this.merchantDetailImageFrame = scene.add.rectangle(1555, 318, 104, 104, 0x3a2a1b).setStrokeStyle(2, 0x674a31).setOrigin(0.5);
    this.merchantDetailImage = scene.add.image(1555, 318, "merchant-herb-baixiangye").setDisplaySize(92, 92);
    this.merchantDetailName = addText(scene, 1555, 405, "", 25, "#ffe000", { strokeThickness: 1 }).setOrigin(0.5);
    this.merchantDetailDesc = addText(scene, 1375, 435, "", 17, "#a89c8e", { strokeThickness: 0, wordWrap: { width: 352 }, lineSpacing: 8 });
    this.merchantDetailPriceLabel = addText(scene, 1430, 535, "单价", 20, "#ead3b4", { strokeThickness: 0 }).setOrigin(0, 0.5);
    const detailPriceBg = scene.add.graphics();
    detailPriceBg.fillStyle(0x4a2f1a, 1);
    detailPriceBg.fillRoundedRect(1510, 513, 124, 44, 6);
    this.merchantDetailPriceIcon = scene.add.image(1532, 535, "merchant-spirit-stone").setDisplaySize(10, 17);
    this.merchantDetailPrice = addText(scene, 1544, 535, "", 20, "#ead3b4", { strokeThickness: 0 }).setOrigin(0, 0.5);
    this.merchantDetailQuantity = addText(scene, 1370, 610, "购买数量", 20, "#d4ae7f", { strokeThickness: 0 });
    const makeQuantityControl = (centerX, width, fillColor, strokeColor) => {
      const control = scene.add.graphics();
      control.fillStyle(fillColor, 1);
      control.fillRoundedRect(centerX - width / 2, 643, width, 50, 4);
      control.lineStyle(2, strokeColor, 1);
      control.strokeRoundedRect(centerX - width / 2, 643, width, 50, 4);
      control.setInteractive(new Phaser.Geom.Rectangle(centerX - width / 2, 643, width, 50), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
      return control;
    };
    // 四个按钮之间统一保留 10px，不重叠也不挤在一起。
    const minus = makeQuantityControl(1397, 54, 0x3a281b, 0x604226);
    const quantityInput = makeQuantityControl(1512, 156, 0x1b1510, 0xb58234);
    const plus = makeQuantityControl(1627, 54, 0x3a281b, 0x604226);
    const max = makeQuantityControl(1728, 74, 0x50341f, 0x805e35);
    this.merchantQuantityText = addText(scene, 1512, 668, "1", 22, "#f8e8d3", { strokeThickness: 0 }).setOrigin(0.5);
    const minusText = addText(scene, 1397, 668, "−", 28, "#f5e7d5", { strokeThickness: 0 }).setOrigin(0.5);
    const plusText = addText(scene, 1627, 668, "+", 28, "#f5e7d5", { strokeThickness: 0 }).setOrigin(0.5);
    const maxText = addText(scene, 1728, 668, "最大", 18, "#f5e7d5", { strokeThickness: 0 }).setOrigin(0.5);
    // 选中商品后，按 1 / 10 / 全部就直接加入清单。
    // 实际点击统一交给 handleMerchantShopPointer，防止缩放画面时重复加入。
    panel.add([merchantDetailTypeLabel, this.merchantDetailType, merchantDetailGradeLabel, this.merchantDetailGrade, this.merchantDetailImageFrame, this.merchantDetailImage, this.merchantDetailName, this.merchantDetailDesc, this.merchantDetailPriceLabel, detailPriceBg, this.merchantDetailPriceIcon, this.merchantDetailPrice, this.merchantDetailQuantity, minus, quantityInput, plus, max, minusText, this.merchantQuantityText, plusText, maxText]);

    const bag = scene.add.graphics();
    bag.fillStyle(0x24170f, 0.98);
    bag.fillRoundedRect(298, 730, 1476, 246, 18);
    panel.add(bag);
    // 储物袋名称使用横向文字，和右侧物品格的阅读方向一致。
    panel.add(addText(scene, 211, 780, "储物袋", 28, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5));
    // 明确的购买入口，避免玩家必须靠“双击商品”才知道怎么购买。
    const buyAll = scene.add.graphics();
    buyAll.fillStyle(0x315d42, 1);
    buyAll.fillRoundedRect(147, 830, 128, 40, 4);
    buyAll.lineStyle(1, 0x6d9d74, 1);
    buyAll.strokeRoundedRect(147, 830, 128, 40, 4);
    buyAll.setInteractive(new Phaser.Geom.Rectangle(147, 830, 128, 40), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
    const buyAllText = addText(scene, 211, 850, "购买全部", 16, "#edf4da", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantActionButtonText = buyAllText;
    this.merchantProductsLayer = scene.add.container(0, 0);
    this.merchantCartLayer = scene.add.container(0, 0);
    this.merchantShopNotice = addText(scene, 960, 710, "点击已选商品购买", 15, "#b8a387", { origin: 0.5, strokeThickness: 0 });
    this.merchantCancelButton = scene.add.container(0, 0).setVisible(false);
    // 使用用户提供的 117×60 按钮图，文字严格锚定在背景正中。
    const cancelBg = scene.add.image(0, 0, "merchant-cart-cancel").setDisplaySize(117, 60).setInteractive({ useHandCursor: true });
    const cancelText = addText(scene, 0, 0, "取消购物", 15, "#f6e4cc", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantCancelButton.add([cancelBg, cancelText]);
    this.merchantPurchaseConfirm = scene.add.container(0, 0).setVisible(false);
    const confirmShade = scene.add.rectangle(0, 0, 1920, 1080, 0x050302, 0.54).setOrigin(0).setInteractive();
    // 购买确认弹窗按效果图固定为 810×439：不再使用原本过窄的基础矩形。
    const confirmCard = scene.add.graphics();
    confirmCard.fillStyle(0x24170f, 1);
    confirmCard.fillRoundedRect(555, 320, 810, 439, 10);
    confirmCard.lineStyle(2, 0xc1863d, 1);
    confirmCard.strokeRoundedRect(555, 320, 810, 439, 10);
    this.merchantPurchaseTitle = addText(scene, 960, 373, "确认购买", 29, "#f1c35c", { strokeThickness: 1 }).setOrigin(0.5);
    this.merchantPurchaseCostPrefix = addText(scene, 916, 424, "将花费", 20, "#baac9d", { strokeThickness: 0 }).setOrigin(1, 0.5);
    this.merchantPurchaseCostIcon = scene.add.image(938, 424, "merchant-spirit-stone").setDisplaySize(10, 17);
    this.merchantPurchaseCostText = addText(scene, 952, 424, "", 20, "#d9c7ae", { strokeThickness: 0 }).setOrigin(0, 0.5);
    this.merchantPurchaseItemsLayer = scene.add.container(0, 0);
    // 购买失败等提示显示在按钮上方，不会挤乱物品卡片。
    this.merchantPurchaseSummary = addText(scene, 960, 702, "", 16, "#e6b98c", { strokeThickness: 0 }).setOrigin(0.5);
    const makeConfirmButton = (x, fill, border) => {
      const button = scene.add.graphics();
      button.fillStyle(fill, 1);
      button.fillRoundedRect(x, 650, 128, 40, 4);
      button.lineStyle(1, border, 1);
      button.strokeRoundedRect(x, 650, 128, 40, 4);
      button.setInteractive(new Phaser.Geom.Rectangle(x, 650, 128, 40), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
      return button;
    };
    // 效果图的顺序是：左侧“确认购买”，右侧“暂不购买”。
    const confirmButton = makeConfirmButton(824, 0x315f42, 0x71a177);
    const cancelButton = makeConfirmButton(971, 0x5a3434, 0x925b5b);
    const confirmText = addText(scene, 888, 670, "确认购买", 16, "#f4e8d4", { strokeThickness: 0 }).setOrigin(0.5);
    const cancelConfirmText = addText(scene, 1035, 670, "暂不购买", 16, "#f4e8d4", { strokeThickness: 0 }).setOrigin(0.5);
    this.merchantPurchaseConfirm.add([confirmShade, confirmCard, this.merchantPurchaseTitle, this.merchantPurchaseCostPrefix, this.merchantPurchaseCostIcon, this.merchantPurchaseCostText, this.merchantPurchaseItemsLayer, this.merchantPurchaseSummary, confirmButton, cancelButton, confirmText, cancelConfirmText]);
    panel.add([buyAll, buyAllText, this.merchantProductsLayer, this.merchantCartLayer, this.merchantShopNotice, this.merchantCancelButton, this.merchantPurchaseConfirm]);
    this.merchantShopPanel = panel;
    return panel;
  }

  open(merchantObject) {
    const scene = this.scene;
    this.ensureCreated();
    scene.tweens.killTweensOf(this.displayObject);
    this.closeQuantityInput(false);
    this.merchantProductScrollDragging = false;
    this.merchantCancelButton?.setVisible(false);
    this.merchantPurchaseConfirm?.setVisible(false);
    this.merchantShopObject = merchantObject;
    scene.target = null;
    this.merchantItems = this.shopService.listItems()
      .filter((item) => item.texture && scene.textures.exists(item.texture));
    this.merchantCategory = "全部";
    this.merchantBuyQuantity = 1;
    this.merchantMode = "buy";
    this.merchantCarts = { buy: [], sell: [] };
    this.merchantCart = this.merchantCarts.buy;
    this.merchantCartScrollRow = 0;
    this.merchantProductScrollRow = 0;
    this.refreshCurrencies();
    this.displayObject.setAlpha(0).setVisible(true);
    this.selectItem(this.merchantItems.find((item) => item.stock > 0) || this.merchantItems[0], true);
    this.selectCategory("全部");
    this.setMode("buy", true);
    this.renderCart();
    scene.tweens.add({ targets: this.displayObject, alpha: 1, duration: 180, ease: "Sine.Out" });
  }

  close() {
    const scene = this.scene;
    if (!this.visible) return;
    playUiClickSound(scene);
    scene.tweens.killTweensOf(this.displayObject);
    this.closeQuantityInput(false);
    this.merchantProductScrollDragging = false;
    this.merchantCancelButton?.setVisible(false);
    this.merchantPurchaseConfirm?.setVisible(false);
    this.displayObject.setAlpha(1).setVisible(false);
    this.merchantShopObject = null;
    this.save();
  }

  refreshCurrencies() {
    const scene = this.scene;
    const merchantStones = Number(this.shopService.world.merchantSpiritStones);
    if (!Number.isFinite(merchantStones)) this.shopService.world.merchantSpiritStones = 125850;
    const reserved = this.shopService.getReservedBuyCost(this.merchantCarts?.buy || []);
    const playerStones = Math.max(0, (Number(this.shopService.player.spiritStones) || 0) - reserved);
    this.merchantMerchantCurrencyText?.setText(`商人灵石 ${(Number(this.shopService.world.merchantSpiritStones) || 0).toLocaleString("zh-CN")}`);
    this.merchantPlayerCurrencyText?.setText(`我的灵石 ${playerStones.toLocaleString("zh-CN")}`);
  }

  selectCategory(category) {
    const scene = this.scene;
    this.merchantCategory = category;
    this.merchantProductScrollRow = 0;
    this.merchantCategoryButtons.forEach((button) => {
      const active = button.name === category;
      button.bg.setTexture(active ? "merchant-category-selected" : "merchant-category-normal");
      button.text.setColor(active ? "#fff2c6" : "#f2dfbf");
    });
    const items = this.getVisibleItems();
    this.renderProductCards(items);
    const action = this.merchantMode === "sell" ? "加入出售清单" : "加入储物袋";
    this.merchantShopNotice.setText(items.some((item) => item.stock > 0)
      ? `点击商品查看；再次点击同一商品即可${action}`
      : this.merchantMode === "sell" ? "背包没有可出售的该类物品" : `${category} 暂未上架`);
  }

  getSellableItems() {
    return this.shopService.listPlayerSellable(this.merchantItems);
  }

  getVisibleItems() {
    const scene = this.scene;
    const source = this.merchantMode === "sell" ? this.getSellableItems() : this.merchantItems;
    return this.shopService.filterByCategory(source, this.merchantCategory);
  }

  getAvailableStock(item) {
    const scene = this.scene;
    return this.shopService.getAvailableStock(item, this.merchantCarts?.[this.merchantMode] || []);
  }

  setMode(mode, silent = false) {
    const scene = this.scene;
    this.merchantMode = mode;
    this.merchantCart = this.merchantCarts?.[mode] || [];
    if (this.merchantCarts) this.merchantCarts[mode] = this.merchantCart;
    this.merchantCartScrollRow = 0;
    this.merchantProductScrollRow = 0;
    this.merchantProductScrollDragging = false;
    const buying = mode === "buy";
    this.merchantBuyTab?.setFillStyle(buying ? 0x80532c : 0x392719).setStrokeStyle(1, buying ? 0xb98548 : 0x765438);
    this.merchantSellTab?.setFillStyle(buying ? 0x392719 : 0x80532c).setStrokeStyle(1, buying ? 0x765438 : 0xb98548);
    this.merchantBuyTabText?.setColor(buying ? "#ffe284" : "#b9a794");
    this.merchantSellTabText?.setColor(buying ? "#b9a794" : "#ffe284");
    this.merchantActionButtonText?.setText(buying ? "购买全部" : "出售全部");
    const items = this.getVisibleItems();
    const next = items.find((item) => item.stock > 0);
    if (next) this.selectItem(next, true);
    this.renderProductCards(items);
    this.renderCart();
    this.refreshCurrencies();
    if (!silent) this.merchantShopNotice.setText(buying ? "买入：选择商人物品加入储物袋" : "卖出：选择背包物品加入出售清单");
  }

  openQuantityInput() {
    const scene = this.scene;
    if (!this.merchantSelectedItem || this.merchantQuantityInputElement) return;
    const canvas = scene.game.canvas;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / 1920;
    const scaleY = canvasRect.height / 1080;
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.value = String(this.merchantBuyQuantity);
    input.setAttribute("aria-label", "购买数量");
    Object.assign(input.style, {
      position: "fixed", left: `${canvasRect.left + 1434 * scaleX}px`, top: `${canvasRect.top + 643 * scaleY}px`,
      width: `${156 * scaleX}px`, height: `${50 * scaleY}px`, boxSizing: "border-box", zIndex: "9999",
      background: "#1b1510", border: `${Math.max(1, scaleX)}px solid #b58234`, borderRadius: `${4 * scaleX}px`,
      color: "#f8e8d3", textAlign: "center", fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: `${22 * scaleY}px`, outline: "none", padding: "0",
    });
    input.addEventListener("input", () => { input.value = input.value.replace(/[^0-9]/g, ""); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); this.closeQuantityInput(true, true); }
      if (event.key === "Escape") { event.preventDefault(); this.closeQuantityInput(false); }
    });
    input.addEventListener("blur", () => this.closeQuantityInput(true));
    document.body.appendChild(input);
    this.merchantQuantityInputElement = input;
    scene.input.keyboard.enabled = false;
    input.focus();
    input.select();
  }

  closeQuantityInput(commit = true, addToCart = false) {
    const scene = this.scene;
    const input = this.merchantQuantityInputElement;
    if (!input) return;
    this.merchantQuantityInputElement = null;
    if (commit && this.merchantSelectedItem) {
      const available = this.getAvailableStock(this.merchantSelectedItem);
      const entered = Number.parseInt(input.value, 10);
      this.merchantBuyQuantity = Phaser.Math.Clamp(Number.isFinite(entered) ? entered : 1, available > 0 ? 1 : 0, available);
      this.merchantQuantityText?.setText(String(this.merchantBuyQuantity));
    }
    input.remove();
    scene.input.keyboard.enabled = true;
    if (commit && addToCart && this.merchantBuyQuantity > 0) this.purchaseSelectedItem();
  }

  addSelectedQuantity(amount) {
    const scene = this.scene;
    if (!this.merchantSelectedItem) return;
    const available = this.getAvailableStock(this.merchantSelectedItem);
    if (available <= 0) {
      this.merchantShopNotice.setText(this.merchantMode === "sell" ? "背包中没有足够的该物品" : "该商品已经售罄");
      return;
    }
    this.merchantBuyQuantity = amount === "all" ? available : Math.min(Number(amount) || 1, available);
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    this.purchaseSelectedItem();
  }

  removeSelectedQuantity() {
    const scene = this.scene;
    const item = this.merchantSelectedItem;
    if (!item) return;
    const result = this.shopService.removeFromCart(this.merchantCart || [], item.id);
    if (!result.ok) { this.merchantShopNotice.setText(`购物清单中没有 ${item.name}`); return; }
    this.merchantBuyQuantity = 1;
    this.merchantQuantityText.setText("1");
    this.merchantShopNotice.setText(`已从购物清单移除 ${item.name} × 1`);
    playUiClickSound(scene);
    this.refreshCurrencies();
    this.renderProductCards(this.getVisibleItems());
    this.renderCart();
  }

  purchaseSelectedItem() {
    const scene = this.scene;
    const item = this.merchantSelectedItem;
    if (!item) return;
    const quantity = this.merchantBuyQuantity;
    if (item.stock <= 0 || quantity <= 0) {
      this.merchantShopNotice.setText(this.merchantMode === "sell" ? "背包中没有足够的该物品" : "该商品已经售罄");
      return;
    }
    const result = this.shopService.addToCart(this.merchantCart, item, quantity);
    if (!result.ok) {
      this.merchantShopNotice.setText(this.merchantMode === "sell" ? "加入数量超过背包拥有数量" : "加入数量超过商人库存");
      return;
    }
    this.merchantShopNotice.setText(`已加入 ${item.name} × ${quantity}，可在储物袋悬浮${this.merchantMode === "sell" ? "取消出售" : "取消购物"}`);
    playUiClickSound(scene);
    this.selectItem(item, true);
    this.refreshCurrencies();
    this.renderProductCards(this.getVisibleItems());
    this.renderCart();
  }

  getGradeColor(grade) {
    return ({ "凡品": 0x414040, "灵品": 0x285c45, "玄品": 0x294e71, "地品": 0x70471d, "天品": 0x653962, "仙品": 0x9a6920, "神器": 0x8b3b37 })[grade] || 0x414040;
  }

  formatDescription(description) {
    const characters = Array.from(`药材作用： ${description || "暂无说明"}`);
    const lines = [];
    for (let index = 0; index < characters.length; index += 19) lines.push(characters.slice(index, index + 19).join(""));
    return lines.join("\n");
  }

  getProductScrollMetrics(items = []) {
    const columns = 4;
    const visibleRows = 4;
    const totalRows = Math.ceil(items.length / columns);
    return { columns, visibleRows, totalRows, maxScrollRow: Math.max(0, totalRows - visibleRows) };
  }

  getScrollableProducts() {
    return this.getVisibleItems().filter((item) => item.stock > 0);
  }

  isProductPointer(pointer) {
    return pointer.x >= 280 && pointer.x <= 1328 && pointer.y >= 195 && pointer.y <= 724;
  }

  changeProductScroll(change) {
    const items = this.getScrollableProducts();
    const { maxScrollRow } = this.getProductScrollMetrics(items);
    const next = Phaser.Math.Clamp((this.merchantProductScrollRow || 0) + change, 0, maxScrollRow);
    if (next === this.merchantProductScrollRow) return;
    this.merchantProductScrollRow = next;
    this.renderProductCards(items);
  }

  updateProductScrollFromPointer(pointerY) {
    const items = this.getScrollableProducts();
    const { totalRows, visibleRows, maxScrollRow } = this.getProductScrollMetrics(items);
    if (maxScrollRow <= 0) return;
    const trackHeight = 508;
    const thumbHeight = Math.max(42, trackHeight * (visibleRows / totalRows));
    const ratio = Phaser.Math.Clamp((pointerY - 210 - thumbHeight / 2) / (trackHeight - thumbHeight), 0, 1);
    const next = Phaser.Math.Clamp(Math.round(ratio * maxScrollRow), 0, maxScrollRow);
    if (next === this.merchantProductScrollRow) return;
    this.merchantProductScrollRow = next;
    this.renderProductCards(items);
  }

  renderProductCards(items) {
    const scene = this.scene;
    this.merchantProductsLayer.removeAll(true);
    const availableItems = items.filter((item) => item.stock > 0);
    const { columns, visibleRows, totalRows, maxScrollRow } = this.getProductScrollMetrics(availableItems);
    this.merchantProductScrollRow = Phaser.Math.Clamp(this.merchantProductScrollRow || 0, 0, maxScrollRow);
    const shownItems = availableItems.slice(this.merchantProductScrollRow * columns, (this.merchantProductScrollRow + visibleRows) * columns);
    shownItems.forEach((item, index) => this.createProductCard(item, index));
    if (maxScrollRow > 0) this.createProductScrollbar({ totalRows, visibleRows, maxScrollRow });
  }

  createProductCard(item, index) {
    const scene = this.scene;
    const x = 300 + (index % 4) * 255;
    const y = 210 + Math.floor(index / 4) * 130;
    const card = scene.add.container(x, y);
    const background = scene.add.graphics();
    const drawBackground = (hovered = false) => {
      background.clear().fillStyle(hovered ? 0x2a1b10 : 0x24170f, 1).fillRoundedRect(0, 0, 240, 118, 6);
    };
    drawBackground();
    background.setInteractive(new Phaser.Geom.Rectangle(0, 0, 240, 118), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
    const frame = scene.add.graphics();
    const gradeColor = this.getGradeColor(item.grade);
    frame.fillStyle(0x5b3b25, 1).fillRoundedRect(12, 10, 105, 98, 6);
    frame.fillStyle(gradeColor, 1).fillRoundedRect(14, 12, 101, 94, 5);
    frame.fillStyle(0x2e2117, 0.6).fillRoundedRect(14, 12, 101, 94, 5);
    frame.fillStyle(gradeColor, 0.18).fillRoundedRect(18, 16, 93, 86, 4);
    frame.fillStyle(gradeColor, 0.12).fillRoundedRect(22, 20, 85, 78, 3);
    const image = scene.add.image(64.5, 59, item.texture).setDisplaySize(80, 80);
    const highlight = scene.add.graphics();
    const drawHighlight = (active) => {
      highlight.clear();
      if (active) highlight.lineStyle(2, 0xfcc01f, 1).strokeRoundedRect(13, 11, 103, 96, 6);
    };
    drawHighlight(this.merchantSelectedItem?.id === item.id);
    const available = this.getAvailableStock(item);
    const stock = addText(scene, 108, 14, String(available), 14, available > 0 ? "#c4c0b8" : "#a07870", { strokeThickness: 1 }).setOrigin(1, 0);
    const name = addText(scene, 126, 18, item.name, 20, "#f2d1ab", { strokeThickness: 0 });
    const priceBackground = scene.add.graphics().fillStyle(0x4a2f1a, 1).fillRoundedRect(129, 69, 98, 36, 4);
    const price = addText(scene, 0, 87, item.sellPrice ? `回收 ${item.price}` : String(item.price), 17, item.sellPrice ? "#9be0b1" : "#d8dfbf", { strokeThickness: 0 }).setOrigin(0, 0.5);
    const priceIcon = scene.add.image(0, 87, "merchant-spirit-stone").setDisplaySize(10, 17);
    const priceStartX = 178 - (16 + price.width) / 2;
    priceIcon.setX(priceStartX + 5);
    price.setX(priceStartX + 16);
    background.on("pointerover", () => { drawBackground(true); drawHighlight(true); });
    background.on("pointerout", () => { drawBackground(false); drawHighlight(this.merchantSelectedItem?.id === item.id); });
    card.add([background, frame, image, stock, name, priceBackground, priceIcon, price, highlight]);
    this.merchantProductsLayer.add(card);
  }

  createProductScrollbar({ totalRows, visibleRows, maxScrollRow }) {
    const scene = this.scene;
    const trackHeight = 508;
    const track = scene.add.rectangle(1320, 464, 12, trackHeight, 0x170f0a, 0.94).setStrokeStyle(1, 0x6f4c2d);
    const thumbHeight = Math.max(42, trackHeight * (visibleRows / totalRows));
    const thumbY = 210 + thumbHeight / 2 + (trackHeight - thumbHeight) * (this.merchantProductScrollRow / maxScrollRow);
    const thumb = scene.add.rectangle(1320, thumbY, 8, thumbHeight, 0xb7833f, 1).setStrokeStyle(1, 0xf1ca72);
    this.merchantProductsLayer.add([track, thumb]);
  }

  selectItem(item, silent = false) {
    if (!item) return;
    const scene = this.scene;
    const selectingDifferent = this.merchantSelectedItem?.id !== item.id;
    this.merchantSelectedItem = item;
    const available = this.getAvailableStock(item);
    this.merchantBuyQuantity = selectingDifferent || !Number.isFinite(this.merchantBuyQuantity)
      ? (available > 0 ? 1 : 0)
      : Phaser.Math.Clamp(this.merchantBuyQuantity, available > 0 ? 1 : 0, available);
    this.merchantDetailType.setText(item.type);
    this.merchantDetailGrade.setText(item.grade).setColor("#b8ada0");
    this.merchantDetailImage.setTexture(item.texture).setDisplaySize(92, 92);
    this.merchantDetailImageFrame.setFillStyle(this.getGradeColor(item.grade));
    this.merchantDetailName.setText(item.name);
    this.merchantDetailDesc.setText(this.formatDescription(item.description));
    this.merchantDetailPriceLabel.setText(item.sellPrice ? "回收单价" : "单价");
    this.merchantDetailPrice.setText(String(item.price));
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    if (!silent) {
      this.merchantShopNotice.setText(`已选择 ${item.name}，再点同一商品即可${this.merchantMode === "sell" ? "加入出售清单" : "加入储物袋"}`);
      this.renderProductCards(this.getVisibleItems());
    }
  }

  changeQuantity(change) {
    const scene = this.scene;
    if (!this.merchantSelectedItem) return;
    const available = this.getAvailableStock(this.merchantSelectedItem);
    this.merchantBuyQuantity = Phaser.Math.Clamp(this.merchantBuyQuantity + change, available > 0 ? 1 : 0, available);
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    if (this.merchantQuantityInputElement) this.merchantQuantityInputElement.value = String(this.merchantBuyQuantity);
  }

  setQuantityToMax() {
    const scene = this.scene;
    if (!this.merchantSelectedItem) return;
    this.merchantBuyQuantity = this.getAvailableStock(this.merchantSelectedItem);
    this.merchantQuantityText.setText(String(this.merchantBuyQuantity));
    if (this.merchantQuantityInputElement) this.merchantQuantityInputElement.value = String(this.merchantBuyQuantity);
  }

  openPurchaseConfirm() {
    const scene = this.scene;
    if (!this.merchantCart?.length) {
      this.merchantShopNotice.setText("储物袋为空，请先把商品加入储物袋");
      return;
    }
    const total = this.shopService.getCartTotal(this.merchantCart);
    const selling = this.merchantMode === "sell";
    this.merchantPurchaseTitle.setText(selling ? "确认出售" : "确认购买");
    this.merchantPurchaseCostPrefix.setText(selling ? "将获得" : "将花费");
    this.merchantPurchaseCostText.setText(`${total.toLocaleString("zh-CN")} 灵石`);
    this.merchantPurchaseSummary.setText("");
    this.renderPurchasePreview(this.merchantCart);
    this.merchantPurchaseConfirm.setVisible(true).setAlpha(0);
    scene.tweens.add({ targets: this.merchantPurchaseConfirm, alpha: 1, duration: 130, ease: "Sine.Out" });
  }

  renderPurchasePreview(entries) {
    const scene = this.scene;
    if (!this.merchantPurchaseItemsLayer) return;
    this.merchantPurchaseItemsLayer.removeAll(true);
    const shown = entries.slice(0, 4);
    const startCenterX = 960 - ((shown.length - 1) * 144) / 2;
    shown.forEach((entry, index) => {
      const centerX = startCenterX + index * 144;
      const x = centerX - 52;
      const y = 467;
      const gradeColor = this.getGradeColor(entry.item.grade);
      const frame = scene.add.graphics();
      frame.fillStyle(0x5b3b25, 1).fillRoundedRect(x, y, 105, 98, 6);
      frame.fillStyle(gradeColor, 1).fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      frame.fillStyle(0x2e2117, 0.38).fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      frame.fillStyle(gradeColor, 0.18).fillRoundedRect(x + 6, y + 6, 93, 86, 4);
      const icon = scene.add.image(centerX, y + 49, entry.item.texture).setDisplaySize(80, 80);
      const quantity = addText(scene, x + 94, y + 8, String(entry.quantity), 14, "#d6d5ca", { strokeThickness: 1 }).setOrigin(1, 0);
      const name = addText(scene, centerX, y + 118, entry.item.name, 19, "#e7c88c", { strokeThickness: 0 }).setOrigin(0.5);
      this.merchantPurchaseItemsLayer.add([frame, icon, quantity, name]);
    });
    if (entries.length > shown.length) {
      this.merchantPurchaseItemsLayer.add(addText(scene, 960, 624, `另有 ${entries.length - shown.length} 种物品`, 15, "#b8a387", { strokeThickness: 0 }).setOrigin(0.5));
    }
  }

  closePurchaseConfirm() {
    this.merchantPurchaseConfirm?.setVisible(false);
  }

  confirmCartPurchase() {
    const scene = this.scene;
    if (!this.merchantCart?.length) { this.closePurchaseConfirm(); return; }
    const result = this.shopService.commit(this.merchantCart, this.merchantMode);
    if (!result.ok) {
      this.merchantPurchaseSummary.setText(result.message);
      return;
    }
    this.merchantItems = this.shopService.listItems().filter((item) => item.texture && scene.textures.exists(item.texture));
    this.merchantCart = [];
    this.merchantCarts[this.merchantMode] = this.merchantCart;
    this.merchantCartScrollRow = 0;
    this.merchantCancelButton?.setVisible(false);
    this.closePurchaseConfirm();
    this.refreshCurrencies();
    this.merchantShopNotice.setText(this.merchantMode === "buy"
      ? `购买完成，花费 ◆ ${result.total.toLocaleString("zh-CN")}；售罄物品已从商人列表移除`
      : `出售完成，获得 ◆ ${result.total.toLocaleString("zh-CN")} 灵石`);
    const available = this.getVisibleItems().filter((item) => item.stock > 0);
    if (available.length) this.selectItem(available[0], true);
    this.renderProductCards(this.getVisibleItems());
    this.renderCart();
    playUiClickSound(scene);
  }

  renderCart() {
    const scene = this.scene;
    if (!this.merchantCartLayer) return;
    this.merchantCartLayer.removeAll(true);
    const totalRows = Math.ceil((this.merchantCart.length || 0) / 12);
    const maxScrollRow = Math.max(0, totalRows - 2);
    this.merchantCartScrollRow = Phaser.Math.Clamp(this.merchantCartScrollRow || 0, 0, maxScrollRow);
    const startIndex = this.merchantCartScrollRow * 12;
    for (let visibleIndex = 0; visibleIndex < 24; visibleIndex += 1) {
      this.createCartSlot(this.merchantCart[startIndex + visibleIndex], startIndex + visibleIndex, visibleIndex);
    }
    if (maxScrollRow > 0) this.createCartScrollbar({ totalRows, maxScrollRow });
  }

  createCartSlot(entry, entryIndex, visibleIndex) {
    const scene = this.scene;
    const x = 321 + (visibleIndex % 12) * 117;
    const y = 752 + Math.floor(visibleIndex / 12) * 108;
    const slot = scene.add.graphics();
    slot.fillStyle(0x36261c, 1).fillRoundedRect(x, y, 105, 98, 4);
    slot.lineStyle(1, 0x5a402b, 1).strokeRoundedRect(x, y, 105, 98, 4);
    if (entry) {
      const gradeColor = this.getGradeColor(entry.item.grade);
      slot.fillStyle(0x5b3b25, 1).fillRoundedRect(x, y, 105, 98, 6);
      slot.fillStyle(gradeColor, 1).fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      slot.fillStyle(0x2e2117, 0.38).fillRoundedRect(x + 2, y + 2, 101, 94, 5);
      slot.fillStyle(gradeColor, 0.18).fillRoundedRect(x + 6, y + 6, 93, 86, 4);
      slot.fillStyle(gradeColor, 0.12).fillRoundedRect(x + 10, y + 10, 85, 78, 3);
    }
    const pieces = [slot];
    if (entry) {
      pieces.push(
        scene.add.image(x + 52, y + 49, entry.item.texture).setDisplaySize(80, 80),
        addText(scene, x + 94, y + 8, String(entry.quantity), 14, "#d6d5ca", { strokeThickness: 1 }).setOrigin(1, 0),
      );
      slot.setInteractive(new Phaser.Geom.Rectangle(x, y, 105, 98), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
      slot.on("pointerover", () => this.showCancelButton(entryIndex, x, y));
      slot.on("pointerout", () => scene.time.delayedCall(80, () => {
        if (!this.merchantCancelHovered) this.merchantCancelButton?.setVisible(false);
      }));
    }
    this.merchantCartLayer.add(pieces);
  }

  createCartScrollbar({ totalRows, maxScrollRow }) {
    const scene = this.scene;
    const track = scene.add.rectangle(1742, 855, 18, 206, 0x160f0b, 0.9).setStrokeStyle(1, 0x765538);
    const thumbHeight = Math.max(42, 206 * (2 / totalRows));
    const thumbY = 752 + thumbHeight / 2 + (206 - thumbHeight) * (this.merchantCartScrollRow / maxScrollRow);
    const thumb = scene.add.rectangle(1742, thumbY, 12, thumbHeight, 0xb7833f, 1).setStrokeStyle(1, 0xf4cf7d);
    this.merchantCartLayer.add([track, thumb]);
  }

  isCartPointer(pointer) {
    return pointer.x >= 298 && pointer.x <= 1774 && pointer.y >= 730 && pointer.y <= 976;
  }

  changeCartScroll(change) {
    const scene = this.scene;
    const maxScrollRow = Math.max(0, Math.ceil((this.merchantCart?.length || 0) / 12) - 2);
    const next = Phaser.Math.Clamp((this.merchantCartScrollRow || 0) + change, 0, maxScrollRow);
    if (next === this.merchantCartScrollRow) return;
    this.merchantCartScrollRow = next;
    this.merchantCancelButton?.setVisible(false);
    this.renderCart();
  }

  showCancelButton(index, x, y) {
    const scene = this.scene;
    this.merchantCancelIndex = index;
    this.merchantCancelHovered = false;
    this.merchantCancelButton.setPosition(x > 1500 ? x - 64 : x + 110, y + 49).setVisible(true);
    this.merchantCancelButton.list[0].once("pointerover", () => { this.merchantCancelHovered = true; });
    this.merchantCancelButton.list[0].once("pointerout", () => {
      this.merchantCancelHovered = false;
      this.merchantCancelButton.setVisible(false);
    });
  }

  cancelCartItem() {
    const scene = this.scene;
    const entry = this.merchantCart?.[this.merchantCancelIndex];
    if (!entry) return;
    this.shopService.removeFromCart(this.merchantCart, entry.item.id, entry.quantity);
    this.merchantShopNotice.setText(`已从${this.merchantMode === "sell" ? "出售" : "待购"}清单移除 ${entry.item.name} × ${entry.quantity}`);
    this.merchantCancelButton.setVisible(false);
    this.refreshCurrencies();
    this.renderProductCards(this.getVisibleItems());
    this.renderCart();
  }

  handlePointer(pointer) {
    const scene = this.scene;
    const { x, y } = pointer;
    if (this.merchantPurchaseConfirm?.visible) { this.handlePurchaseConfirmPointer(pointer); return; }
    if (x >= 1732 && x <= 1776 && y >= 102 && y <= 146) { this.close(); return; }
    if (x >= 994 && x <= 1106 && y >= 102 && y <= 146) { this.setMode("buy"); return; }
    if (x >= 1119 && x <= 1231 && y >= 102 && y <= 146) { this.setMode("sell"); return; }
    const category = this.merchantCategoryButtons?.find((button) => (
      x >= button.bg.x - 48 && x <= button.bg.x + 48 && y >= button.y - 23 && y <= button.y + 23
    ));
    if (category) { this.selectCategory(category.name); return; }
    if (this.merchantCancelButton?.visible && Math.abs(x - this.merchantCancelButton.x) <= 59 && Math.abs(y - this.merchantCancelButton.y) <= 30) {
      this.cancelCartItem(); return;
    }
    if (x >= 147 && x <= 275 && y >= 830 && y <= 870) { this.openPurchaseConfirm(); return; }
    if (x >= 1308 && x <= 1332 && y >= 210 && y <= 718) {
      if (this.getProductScrollMetrics(this.getScrollableProducts()).maxScrollRow > 0) {
        this.merchantProductScrollDragging = true;
        this.updateProductScrollFromPointer(y);
      }
      return;
    }
    if (x >= 1727 && x <= 1757 && y >= 752 && y <= 958) {
      const maxScrollRow = Math.max(0, Math.ceil((this.merchantCart?.length || 0) / 12) - 2);
      if (maxScrollRow > 0) {
        this.merchantCartScrollRow = Phaser.Math.Clamp(Math.round(((y - 752) / 206) * maxScrollRow), 0, maxScrollRow);
        this.merchantCancelButton?.setVisible(false);
        this.renderCart();
      }
      return;
    }
    if (x >= 1370 && x <= 1424 && y >= 643 && y <= 693) { this.removeSelectedQuantity(); return; }
    if (x >= 1434 && x <= 1590 && y >= 643 && y <= 693) { this.openQuantityInput(); return; }
    if (x >= 1600 && x <= 1654 && y >= 643 && y <= 693) { this.addSelectedQuantity(1); return; }
    if (x >= 1691 && x <= 1765 && y >= 643 && y <= 693) { this.addSelectedQuantity("all"); return; }
    const items = this.getScrollableProducts();
    const { columns, visibleRows } = this.getProductScrollMetrics(items);
    const shown = items.slice((this.merchantProductScrollRow || 0) * columns, ((this.merchantProductScrollRow || 0) + visibleRows) * columns);
    for (let index = 0; index < shown.length; index += 1) {
      const cardX = 300 + (index % columns) * 255;
      const cardY = 210 + Math.floor(index / columns) * 130;
      if (x >= cardX && x <= cardX + 240 && y >= cardY && y <= cardY + 118) {
        if (this.merchantSelectedItem?.id === shown[index].id) this.purchaseSelectedItem();
        else this.selectItem(shown[index]);
        return;
      }
    }
  }

  handlePointerMove(pointer) {
    const scene = this.scene;
    const { x, y } = pointer;
    if (this.merchantProductScrollDragging) { this.updateProductScrollFromPointer(y); return; }
    const startIndex = (this.merchantCartScrollRow || 0) * 12;
    for (let visibleIndex = 0; visibleIndex < 24; visibleIndex += 1) {
      const index = startIndex + visibleIndex;
      if (!this.merchantCart[index]) continue;
      const slotX = 321 + (visibleIndex % 12) * 117;
      const slotY = 752 + Math.floor(visibleIndex / 12) * 108;
      if (x >= slotX && x <= slotX + 105 && y >= slotY && y <= slotY + 98) {
        this.showCancelButton(index, slotX, slotY);
        return;
      }
    }
    const overCancel = this.merchantCancelButton?.visible
      && Math.abs(x - this.merchantCancelButton.x) <= 59
      && Math.abs(y - this.merchantCancelButton.y) <= 30;
    if (!overCancel) this.merchantCancelButton?.setVisible(false);
  }

  handlePurchaseConfirmPointer(pointer) {
    const { x, y } = pointer;
    if (x >= 971 && x <= 1099 && y >= 650 && y <= 690) { this.closePurchaseConfirm(); return; }
    if (x >= 824 && x <= 952 && y >= 650 && y <= 690) this.confirmCartPurchase();
  }

  handleWheel(pointer, deltaY) {
    if (this.isProductPointer(pointer)) {
      this.changeProductScroll(deltaY > 0 ? 1 : -1);
      return true;
    }
    if (this.isCartPointer(pointer)) {
      this.changeCartScroll(deltaY > 0 ? 1 : -1);
      return true;
    }
    return false;
  }
}

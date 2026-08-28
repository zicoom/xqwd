export const DEFAULT_SHOP_STOCK_VERSION = "merchant-stock-50-test-v1";

/**
 * 商店领域服务。价格、库存、货币和背包变更在这里作为一次交易完成，
 * 场景只负责购物车交互与结果展示。
 */
export class ShopService {
  constructor({ player, world, catalog, save = () => true, stockVersion = DEFAULT_SHOP_STOCK_VERSION }) {
    this.player = player;
    this.world = world;
    this.catalog = catalog;
    this.save = save;
    this.stockVersion = stockVersion;
  }

  ensureStock() {
    if (this.world.merchantStockVersion === this.stockVersion) return;
    this.world.merchantStock = {};
    this.world.merchantStockVersion = this.stockVersion;
    this.save();
  }

  listItems() {
    this.ensureStock();
    const stock = this.world.merchantStock || {};
    return this.catalog.sellable().map((item) => ({
      ...item,
      stock: Number.isFinite(Number(stock[item.id])) ? Math.max(0, Number(stock[item.id])) : item.stock,
    }));
  }

  listPlayerSellable(items = this.listItems()) {
    const inventory = this.player.inventory || {};
    return items
      .map((item) => ({
        ...item,
        stock: Math.max(0, Number(inventory[item.id]) || 0),
        price: Math.max(1, Math.floor(item.price * 0.5)),
        sellPrice: true,
      }))
      .filter((item) => item.stock > 0);
  }

  filterByCategory(items, category) {
    if (category === "全部") return items;
    const categoryTypes = {
      "灵草": ["灵草"], "丹药": ["丹药"], "装备": ["装备"], "法宝": ["法宝"], "材料": ["材料", "器材"],
    };
    const allowedTypes = categoryTypes[category];
    return allowedTypes ? items.filter((item) => allowedTypes.includes(item.type)) : [];
  }

  getAvailableStock(item, entries = []) {
    const reserved = entries
      .filter((entry) => entry.item.id === item.id)
      .reduce((total, entry) => total + entry.quantity, 0);
    return Math.max(0, (Number(item.stock) || 0) - reserved);
  }

  getReservedBuyCost(entries = []) {
    return this.getCartTotal(entries);
  }

  addToCart(entries, item, quantity) {
    const amount = Math.max(0, Number(quantity) || 0);
    if (!item || amount <= 0) return { ok: false, message: "请选择有效数量。" };
    const entry = entries.find((candidate) => candidate.item.id === item.id);
    const alreadyAdded = entry?.quantity || 0;
    if (alreadyAdded + amount > Number(item.stock || 0)) return { ok: false, message: "加入数量超过当前可用数量。" };
    if (entry) entry.quantity += amount;
    else entries.push({ item: { ...item }, quantity: amount });
    return { ok: true, entry: entry || entries.at(-1) };
  }

  removeFromCart(entries, itemId, quantity = 1) {
    const entry = entries.find((candidate) => candidate.item.id === itemId);
    if (!entry) return { ok: false, message: "清单中没有该物品。" };
    entry.quantity -= Math.max(1, Number(quantity) || 1);
    if (entry.quantity <= 0) entries.splice(entries.indexOf(entry), 1);
    return { ok: true, item: entry.item };
  }

  getCartTotal(entries = []) {
    return entries.reduce((total, entry) => total + Math.max(0, Number(entry.item?.price) || 0) * Math.max(0, Number(entry.quantity) || 0), 0);
  }

  commit(entries, mode = "buy") {
    if (!Array.isArray(entries) || entries.length === 0) return { ok: false, message: "购物清单为空。" };
    if (mode !== "buy" && mode !== "sell") return { ok: false, message: "未知的交易类型。" };
    const items = new Map(this.listItems().map((item) => [item.id, item]));
    let total = 0;
    for (const entry of entries) {
      const item = items.get(entry.item.id);
      const quantity = Number(entry.quantity);
      const available = mode === "sell" ? Number(this.player.inventory?.[item?.id]) || 0 : Number(item?.stock) || 0;
      if (!item || !Number.isInteger(quantity) || quantity <= 0 || available < quantity) {
        return { ok: false, message: `${entry.item?.name || "物品"} 数量已经变化，请重新选择。` };
      }
      // 最终价格必须从领域目录重新计算，不能相信 UI 购物车携带的价格。
      const unitPrice = mode === "buy"
        ? Math.max(0, Number(item.price) || 0)
        : Math.max(1, Math.floor((Number(item.price) || 0) * 0.5));
      total += unitPrice * quantity;
    }
    if (mode === "buy" && (Number(this.player.spiritStones) || 0) < total) {
      return { ok: false, message: `灵石不足：需要 ${total.toLocaleString("zh-CN")}。` };
    }
    if (mode === "sell" && (Number(this.world.merchantSpiritStones) || 0) < total) {
      return { ok: false, message: `商人灵石不足：本次收购需要 ${total.toLocaleString("zh-CN")}。` };
    }
    this.player.inventory ||= {};
    this.world.merchantStock ||= {};
    this.player.spiritStones = Math.max(0, (Number(this.player.spiritStones) || 0) + (mode === "buy" ? -total : total));
    this.world.merchantSpiritStones = Math.max(0, (Number(this.world.merchantSpiritStones) || 0) + (mode === "buy" ? total : -total));
    entries.forEach((entry) => {
      const item = items.get(entry.item.id);
      const quantity = Number(entry.quantity);
      this.world.merchantStock[item.id] = Math.max(0, item.stock + (mode === "buy" ? -quantity : quantity));
      this.player.inventory[item.id] = Math.max(0, (Number(this.player.inventory[item.id]) || 0) + (mode === "buy" ? quantity : -quantity));
      if (this.player.inventory[item.id] === 0) delete this.player.inventory[item.id];
    });
    this.save();
    return { ok: true, total };
  }
}

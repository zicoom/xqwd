import assert from "node:assert/strict";
import { ShopService } from "../src/domain/shop/ShopService.js";

const herb = Object.freeze({
  id: "herb",
  name: "灵草",
  type: "灵草",
  price: 100,
  stock: 10,
});

const createShop = ({ player = {}, world = {}, onSave = () => true } = {}) => {
  const state = {
    player: {
      spiritStones: 0,
      inventory: {},
      ...player,
    },
    world: {
      merchantStockVersion: "test-stock-v1",
      merchantStock: { herb: 10 },
      merchantSpiritStones: 0,
      ...world,
    },
  };
  const catalog = { sellable: () => [herb] };
  const service = new ShopService({
    player: state.player,
    world: state.world,
    catalog,
    save: onSave,
    stockVersion: "test-stock-v1",
  });
  return { ...state, service };
};

// 未知交易模式不能被当成出售处理。
{
  const { service } = createShop();
  assert.equal(service.commit([{ item: herb, quantity: 1 }], "unknown").ok, false);
}

// 玩家灵石不足时购买失败，并且不会产生半笔交易。
{
  const { service, player, world } = createShop({ player: { spiritStones: 20 } });
  const before = JSON.stringify({ player, world });
  const result = service.commit([{ item: herb, quantity: 1 }], "buy");
  assert.equal(result.ok, false);
  assert.match(result.message, /灵石不足/);
  assert.equal(JSON.stringify({ player, world }), before);
}

// UI 即使携带了错误低价，最终结算仍必须使用领域目录中的真实价格。
{
  const { service, player, world } = createShop({ player: { spiritStones: 1000 } });
  const result = service.commit([{ item: { ...herb, price: 1 }, quantity: 1 }], "buy");
  assert.equal(result.ok, true);
  assert.equal(result.total, 100);
  assert.equal(player.spiritStones, 900);
  assert.equal(world.merchantSpiritStones, 100);
  assert.equal(player.inventory.herb, 1);
  assert.equal(world.merchantStock.herb, 9);
}

// 商人灵石不足时不能收购；玩家物品、双方货币和库存必须全部保持不变。
{
  let saveCount = 0;
  const { service, player, world } = createShop({
    player: { inventory: { herb: 1 } },
    world: { merchantSpiritStones: 49 },
    onSave: () => { saveCount += 1; return true; },
  });
  const sellEntry = { item: { ...herb, price: 50, stock: 1 }, quantity: 1 };
  const before = JSON.stringify({ player, world });
  const result = service.commit([sellEntry], "sell");
  assert.equal(result.ok, false);
  assert.match(result.message, /商人灵石不足/);
  assert.equal(JSON.stringify({ player, world }), before);
  assert.equal(saveCount, 0);
}

// 资金充足时出售作为一次完整事务提交：玩家得钱、商人扣钱、物品和库存同步转移，只保存一次。
{
  let saveCount = 0;
  const { service, player, world } = createShop({
    player: { spiritStones: 5, inventory: { herb: 2 } },
    world: { merchantSpiritStones: 200 },
    onSave: () => { saveCount += 1; return true; },
  });
  const sellEntry = { item: { ...herb, price: 50, stock: 2 }, quantity: 2 };
  const result = service.commit([sellEntry], "sell");
  assert.equal(result.ok, true);
  assert.equal(result.total, 100);
  assert.equal(player.spiritStones, 105);
  assert.equal(world.merchantSpiritStones, 100);
  assert.equal(player.inventory.herb, undefined);
  assert.equal(world.merchantStock.herb, 12);
  assert.equal(saveCount, 1);
}

console.log("商店领域冒烟测试通过：交易模式、双方资金、库存、背包和原子提交正确。");

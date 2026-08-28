import assert from "node:assert/strict";
import {
  getCultivationProgress,
  grantCultivationExp,
  isCultivationFull,
} from "../src/domain/cultivation/CultivationProgressService.js";
import { InventoryService } from "../src/domain/inventory/InventoryService.js";

// 历史档案即使存过异常高修为，读取进度时也不能显示超过当前境界上限的数值。
assert.deepEqual(
  getCultivationProgress({ cultivationExp: 18961 }),
  { experience: 1000, target: 1000, isFull: true },
);

const player = { cultivationExp: 960, cultivationExpTarget: 1000 };
const firstGain = grantCultivationExp(player, 20);
assert.equal(firstGain.gained, 20);
assert.equal(firstGain.overflow, 0);
assert.equal(player.cultivationExp, 980);

const cappedGain = grantCultivationExp(player, 80);
assert.equal(cappedGain.gained, 20, "只能获得到当前境界瓶颈前的最后 20 点");
assert.equal(cappedGain.overflow, 60);
assert.equal(cappedGain.reachedCap, true);
assert.equal(player.cultivationExp, 1000);
assert.equal(isCultivationFull(player), true);

// 单纯提供修炼经验的丹药在满修为时不得消耗，避免玩家无提示浪费物品。
const itemPlayer = { cultivationExp: 1000, cultivationExpTarget: 1000, inventory: { "exp-pill": 1 } };
const inventory = new InventoryService({ player: itemPlayer });
const itemResult = inventory.use({ id: "exp-pill", name: "聚气丹", cultivationExp: 50 });
assert.equal(itemResult.ok, false);
assert.equal(itemResult.consumed, false);
assert.equal(itemPlayer.inventory["exp-pill"], 1);
assert.match(itemResult.message, /需要突破/);

console.log("修为上限冒烟测试通过：经验截断、溢出阻止和满值物品保护正确。");

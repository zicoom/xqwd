import assert from "node:assert/strict";
import {
  ARTIFACT_SLOT_IDS,
  ArtifactLoadoutService,
  normalizeArtifactLoadout,
} from "../src/domain/artifacts/ArtifactLoadoutService.js";

const artifacts = [
  { id: "sword", name: "试炼飞剑", type: "法宝", artifactCategory: "御剑" },
  { id: "shield", name: "试炼灵盾", type: "法宝", artifactCategory: "防御" },
];
const player = { inventory: { sword: 1, shield: 1 }, equippedArtifacts: {} };
let saveCount = 0;
const catalog = {
  getById: (itemId) => artifacts.find((item) => item.id === itemId) || null,
  ownedBy: (owner, predicate) => artifacts
    .map((item) => ({ ...item, quantity: Number(owner.inventory[item.id]) || 0 }))
    .filter((item) => item.quantity > 0 && predicate(item)),
};
const service = new ArtifactLoadoutService({ player, catalog, save: () => { saveCount += 1; } });

assert.deepEqual(Object.keys(normalizeArtifactLoadout({})), ARTIFACT_SLOT_IDS, "旧档应补齐六类槽位");
assert.equal(service.equip("未知", "sword").ok, false, "非法槽位必须被拒绝");
assert.equal(service.equip("攻击", "missing").ok, false, "未拥有法宝必须被拒绝");
assert.equal(service.equip("攻击", "sword").ok, false, "法宝类别与槽位不匹配时必须被拒绝");
assert.equal(service.equip("御剑", "sword").ok, true, "合法法宝应能装备");
assert.equal(service.getEquippedId("御剑"), "sword");
assert.equal(service.equip("防御", "shield").ok, true);
assert.equal(service.getEquippedId("防御"), "shield");
assert.equal(service.unequip("御剑").ok, true);
assert.equal(service.getEquippedId("御剑"), null);
assert.equal(saveCount, 3, "只有成功装备或卸下才保存");

console.log("法宝领域冒烟测试通过：旧档、校验、装备、去重与卸下行为正确。");

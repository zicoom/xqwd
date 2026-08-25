import assert from "node:assert/strict";
import { CharacterProfileService } from "../src/domain/character/CharacterProfileService.js";

const catalog = {
  getById(id) {
    return { qingxin: { name: "清心诀" }, fengxing: { name: "风行步" } }[id] || null;
  },
};
const profile = new CharacterProfileService({
  player: {
    name: "流雨", realm: "炼气·初期", selectedElement: "火", spiritStones: 200,
    hp: 7006, maxHp: 7500, qi: 700, maxQi: 1000, attack: 24, defense: 12, resistance: 8,
    resistanceTypes: ["火"], cultivationExp: 320, roots: { 金: 6, 木: 7, 水: 5, 火: 8, 土: 6 },
    activeItemEffects: [{ id: "pill" }],
  },
  catalog,
  techniqueService: { getLoadout: () => ({ main: "qingxin", speed: "fengxing" }) },
  artifactService: { getLoadout: () => ({ weapon: "sword", head: null, robe: "robe" }) },
  spellService: { listAvailable: () => [{ id: "element-fire" }, { id: "fireball" }] },
}).getProfile();

assert.equal(profile.identity.primaryRoots.join("、"), "火");
assert.equal(profile.battle.hp, 7006);
assert.equal(profile.cultivation.roots.find((root) => root.element === "火").value, 8);
assert.equal(profile.cultivation.specialRoots[0].state, "未觉醒");
assert.equal(profile.loadout.mainTechnique, "清心诀");
assert.equal(profile.loadout.artifactCount, 2);
assert.equal(profile.loadout.spellCount, 2);
console.log("角色属性资料服务冒烟验证通过。");

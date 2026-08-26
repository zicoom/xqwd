import assert from "node:assert/strict";
import { CombatShortcutService } from "../src/domain/combat/CombatShortcutService.js";

const player = {
  selectedElement: "水",
  learnedTechniques: ["spell-fireball"],
  equippedTechniques: { main: null, auxiliary: [], speed: null },
  inventory: { "pill-heal": 3, "ore-iron": 8 },
};
const templates = [
  {
    id: "spell-fireball", name: "火球术", type: "功法", techniqueKind: "法术",
    techniqueElement: "火", texture: "spell-fireball",
  },
  { id: "pill-heal", name: "小还丹", type: "丹药", restoreHp: 30, texture: "pill-heal" },
  { id: "ore-iron", name: "玄铁", type: "材料", texture: "ore-iron" },
];
const catalog = {
  all: () => templates.map((item) => ({ ...item })),
  ownedBy(target, predicate = () => true) {
    return templates
      .map((item) => ({ ...item, quantity: Number(target.inventory[item.id]) || 0 }))
      .filter((item) => item.quantity > 0 && predicate(item));
  },
};
const spellService = {
  listAvailable: () => [
    { id: "element-water", name: "水箭术", element: "水", innate: true },
    { id: "spell-fireball", name: "火球术", element: "火", texture: "spell-fireball" },
  ],
};
let saveCount = 0;
const service = new CombatShortcutService({
  player,
  catalog,
  spellService,
  save: () => { saveCount += 1; },
});

assert.deepEqual(service.getKeys(), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);
const defaultSlots = service.getSlots();
assert.equal(defaultSlots.length, 10);
assert.equal(defaultSlots[0].candidate.id, "normal-attack");
assert.equal(defaultSlots[1].candidate.id, "element-water");
assert.equal(defaultSlots[2].candidate.id, "defend");
assert.equal(defaultSlots[9].candidate, null);

const candidates = service.listCandidates();
assert.equal(candidates.some((entry) => entry.key === "spell:element-water"), true);
assert.equal(candidates.some((entry) => entry.key === "spell:spell-fireball"), true);
assert.equal(candidates.some((entry) => entry.key === "item:pill-heal" && entry.quantity === 3), true);
assert.equal(candidates.some((entry) => entry.key === "item:ore-iron"), false, "材料不能装备到战斗快捷栏");

let result = service.assign(4, "item:pill-heal");
assert.equal(result.ok, true);
assert.equal(player.combatShortcuts[4].kind, "item");
assert.equal(player.combatShortcuts[4].id, "pill-heal");
assert.equal(saveCount, 1);

result = service.assign(7, "item:pill-heal");
assert.equal(result.ok, true);
assert.equal(player.combatShortcuts[4], null, "同一内容再次装备时应移动而不是复制");
assert.equal(player.combatShortcuts[7].id, "pill-heal");
assert.equal(saveCount, 2);

assert.equal(service.assign(10, "spell:element-water").ok, false);
assert.equal(service.assign(0, "item:missing").ok, false);
assert.equal(saveCount, 2, "无效操作不能写存档");

result = service.unequip(7);
assert.equal(result.ok, true);
assert.equal(player.combatShortcuts[7], null);
assert.equal(saveCount, 3);

console.log("战斗快捷栏冒烟测试通过：十键位、法术/丹药候选、移动装备与卸下规则正确。");

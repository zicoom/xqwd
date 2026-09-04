import assert from "node:assert/strict";
import {
  CURRENT_SAVE_CONTAINER_VERSION,
  CURRENT_SAVE_VERSION,
  createDefaultSaveData,
  createSaveContainer,
  migrateSaveContainer,
  migrateSaveData,
} from "../src/core/save/SaveMigrations.js";

const legacy = {
  version: 1,
  player: {
    name: "旧档修士",
    roots: { 火: 7 },
    hp: 999,
    maxHp: 80,
    cultivationExp: 18961,
    spiritStones: "42",
    inventory: { herb: "3", invalid: -4 },
    equippedTechniques: { auxiliary: ["a"] },
    equippedArtifacts: { 攻击: "artifact-1", 未知槽: "bad" },
  },
  chapter: { eliteDefeated: true },
  world: { merchantStock: { soldOut: 0, available: "9", invalid: -2 } },
};
const snapshot = JSON.stringify(legacy);
const migrated = migrateSaveData(legacy);
assert.equal(migrated.ok, true);
assert.equal(migrated.migrated, true);
assert.equal(migrated.data.version, CURRENT_SAVE_VERSION);
assert.equal(migrated.data.player.name, "旧档修士");
assert.equal(migrated.data.player.hp, 80);
assert.equal(migrated.data.player.cultivationExp, 1000, "旧档超出当前境界上限的修为必须裁切");
assert.equal(migrated.data.player.cultivationExpTarget, 1000);
assert.equal(migrated.data.player.spiritStones, 42);
assert.deepEqual(migrated.data.player.inventory, { herb: 3 });
assert.deepEqual(migrated.data.player.equippedTechniques.auxiliary, ["a", null, null, null]);
assert.equal(migrated.data.player.equippedArtifacts.攻击, "artifact-1");
assert.equal("未知槽" in migrated.data.player.equippedArtifacts, false);
assert.equal(migrated.data.player.combatShortcuts.length, 10);
assert.deepEqual(migrated.data.player.combatShortcuts[0], { kind: "action", id: "normal-attack" });
assert.deepEqual(migrated.data.player.combatShortcuts[1], { kind: "spell", id: "element-fire" });
assert.deepEqual(migrated.data.world.defeatedMonsterIds, []);
assert.deepEqual(migrated.data.world.completedQuestIds, []);
assert.deepEqual(migrated.data.world.sectProgress, {});
assert.deepEqual(migrated.data.world.dungeonRuns, {});
assert.deepEqual(migrated.data.world.merchantStock, { soldOut: 0, available: 9, invalid: 0 });
assert.equal(JSON.stringify(legacy), snapshot, "迁移不能修改读入的原始存档");

const current = migrateSaveData(migrated.data);
assert.equal(current.ok, true);
assert.equal(current.migrated, false);
assert.deepEqual(current.data, migrated.data, "当前版本重复迁移必须幂等");

assert.equal(migrateSaveData({ ...legacy, version: CURRENT_SAVE_VERSION + 1 }).ok, false);
assert.equal(migrateSaveData({ version: 1, player: {}, chapter: {} }).ok, false);

const container = migrateSaveContainer({ version: 1, slots: [legacy, null] }, 5);
assert.equal(container.ok, true);
assert.equal(container.migrated, true);
assert.equal(container.data.version, CURRENT_SAVE_CONTAINER_VERSION);
assert.equal(container.data.slots.length, 5);
assert.equal(container.data.slots[0].version, CURRENT_SAVE_VERSION);
assert.equal(container.data.slots[1], null);

const defaults = createDefaultSaveData();
const created = createSaveContainer([defaults], 5);
assert.equal(created.version, CURRENT_SAVE_CONTAINER_VERSION);
assert.equal(created.slots.length, 5);
assert.notEqual(defaults.player.equippedTechniques, createDefaultSaveData().player.equippedTechniques);

// 用内存 localStorage 验证 GameState 会从旧键复制到稳定键，并始终回写当前版本。
class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
globalThis.localStorage = new MemoryStorage();
const storageLegacy = {
  ...legacy,
  player: { ...legacy.player, testSpiritStoneGrantV1: true },
};
localStorage.setItem("xuanqiong-wendao-save-slots-v1", JSON.stringify({ version: 1, slots: [storageLegacy] }));
const { gameState, getSaveSlots, getSaveStorageStatus, loadFirstChapterProgress, saveFirstChapterProgress } = await import("../src/core/GameState.js");
const migratedSlots = getSaveSlots();
assert.equal(migratedSlots[0].version, CURRENT_SAVE_VERSION);
assert.equal(localStorage.getItem("xuanqiong-wendao-save-slots-v1") !== null, true, "迁移不能删除旧键");
assert.equal(JSON.parse(localStorage.getItem("xuanqiong-wendao-save-slots")).version, CURRENT_SAVE_CONTAINER_VERSION);
assert.equal(loadFirstChapterProgress(0), true);
assert.equal(gameState.player.name, "旧档修士");
gameState.player.spiritStones = 77;
assert.equal(saveFirstChapterProgress(), true);
const persisted = JSON.parse(localStorage.getItem("xuanqiong-wendao-save-slots"));
assert.equal(persisted.version, CURRENT_SAVE_CONTAINER_VERSION);
assert.equal(persisted.slots[0].version, CURRENT_SAVE_VERSION);
assert.equal(persisted.slots[0].player.spiritStones, 77);

const futureContainer = JSON.stringify({ version: CURRENT_SAVE_CONTAINER_VERSION + 1, slots: [] });
localStorage.setItem("xuanqiong-wendao-save-slots", futureContainer);
const originalWarn = console.warn;
console.warn = () => {};
assert.deepEqual(getSaveSlots(), [null, null, null, null, null]);
assert.equal(getSaveStorageStatus().writable, false);
gameState.activeSaveSlot = 0;
assert.equal(saveFirstChapterProgress(), false);
console.warn = originalWarn;
assert.equal(localStorage.getItem("xuanqiong-wendao-save-slots"), futureContainer, "未来版本存档不能被旧代码覆盖");

console.log("存档迁移冒烟测试通过：旧档升级、字段归一、幂等、未来版本拒绝和容器迁移正确。");

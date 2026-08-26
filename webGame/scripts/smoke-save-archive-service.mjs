import assert from "node:assert/strict";
import {
  AUTO_SAVE_INTERVAL_MINUTES,
  MANUAL_SAVE_SLOT_COUNT,
  SaveArchiveService,
} from "../src/domain/save/SaveArchiveService.js";

class MemorySaveArchiveRepository {
  constructor() { this.profiles = new Map(); }
  read(profileId) { return structuredClone(this.profiles.get(profileId) || null); }
  write(profileId, value) { this.profiles.set(profileId, structuredClone(value)); }
}

const repository = new MemorySaveArchiveRepository();
let restoredSnapshot = null;
let snapshotSequence = 0;
const service = new SaveArchiveService({
  repository,
  profileId: "role-slot-0",
  captureSnapshot: () => ({
    version: 3,
    player: { name: "流雨", realm: "炼气初期", hp: 60, maxHp: 60 },
    chapter: { sequence: ++snapshotSequence },
    world: {},
  }),
  restoreSnapshot: (snapshot) => { restoredSnapshot = snapshot; return true; },
  now: () => 1_000,
});

assert.equal(MANUAL_SAVE_SLOT_COUNT, 5, "存档页必须固定提供五个手动档位");
assert.deepEqual(AUTO_SAVE_INTERVAL_MINUTES, [5, 10, 15, 30], "自动存档只能选择需求中的四档间隔");
assert.equal(service.getState().slots.length, 5, "新角色首次打开存档页也应看见五个空档位");
assert.equal(service.getState().autoSaveEnabled, true, "自动存档默认启用");
assert.equal(service.getState().autoSaveIntervalMinutes, 5, "自动存档默认五分钟");

const firstSave = service.saveSlot(0);
assert.equal(firstSave.success, true);
assert.equal(firstSave.slotIndex, 0);
assert.equal(service.getState().slots[0].snapshot.player.name, "流雨");
assert.equal(service.getState().slots[0].savedAt, 1_000);

service.saveSlot(0);
assert.equal(service.getState().slots[0].snapshot.chapter.sequence, 2, "同一档位再次保存应覆盖旧快照");
assert.equal(service.loadSlot(0).success, true);
assert.equal(restoredSnapshot.chapter.sequence, 2, "读取必须恢复当前档位最新快照");
assert.equal(service.loadSlot(4).success, false, "空档位不可读取");

assert.equal(service.setAutoSaveInterval(15).success, true);
assert.equal(service.getState().autoSaveIntervalMinutes, 15);
assert.equal(service.setAutoSaveInterval(12).success, false, "非法分钟数不能写入配置");
assert.equal(service.getState().autoSaveIntervalMinutes, 15);

service.markAutoSaved(2_000);
assert.equal(service.shouldAutoSave(2_000 + 15 * 60_000 - 1), false);
assert.equal(service.shouldAutoSave(2_000 + 15 * 60_000), true, "达到设置间隔后应触发自动存档");
service.setAutoSaveEnabled(false);
assert.equal(service.shouldAutoSave(Number.MAX_SAFE_INTEGER), false, "关闭自动存档后不应再触发");

const secondProfile = new SaveArchiveService({
  repository,
  profileId: "role-slot-1",
  captureSnapshot: () => ({ player: { name: "另一角色" }, chapter: {}, world: {} }),
  restoreSnapshot: () => true,
  now: () => 3_000,
});
assert.equal(secondProfile.getState().slots[0], null, "不同角色的五个手动档位必须彼此隔离");

console.log("存档领域服务冒烟测试通过：五档位、覆盖读取和 5/10/15/30 分钟自动存档规则正确。");

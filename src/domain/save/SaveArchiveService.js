/**
 * 手动存档页固定提供五个档位。
 * 这是玩法规则而不是界面尺寸，因此集中放在领域层，所有 UI 都只能消费这里的结果。
 */
export const MANUAL_SAVE_SLOT_COUNT = 5;
export const AUTO_SAVE_INTERVAL_MINUTES = Object.freeze([5, 10, 15, 30]);

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function createDefaultState(now) {
  return {
    slots: Array.from({ length: MANUAL_SAVE_SLOT_COUNT }, () => null),
    autoSaveEnabled: true,
    autoSaveIntervalMinutes: AUTO_SAVE_INTERVAL_MINUTES[0],
    // 新进入地图时从当前时刻开始计时，避免刚加载场景就立刻触发一次自动保存。
    lastAutoSaveAt: now,
  };
}

function normalizeState(value, now) {
  const defaults = createDefaultState(now);
  const source = value && typeof value === "object" ? value : {};
  const interval = Number(source.autoSaveIntervalMinutes);
  return {
    slots: Array.from({ length: MANUAL_SAVE_SLOT_COUNT }, (_, index) => {
      const slot = source.slots?.[index];
      if (!slot?.snapshot || typeof slot.snapshot !== "object") return null;
      return {
        savedAt: Number.isFinite(Number(slot.savedAt)) ? Number(slot.savedAt) : now,
        snapshot: clone(slot.snapshot),
      };
    }),
    autoSaveEnabled: source.autoSaveEnabled !== false,
    autoSaveIntervalMinutes: AUTO_SAVE_INTERVAL_MINUTES.includes(interval)
      ? interval
      : defaults.autoSaveIntervalMinutes,
    lastAutoSaveAt: Number.isFinite(Number(source.lastAutoSaveAt))
      ? Number(source.lastAutoSaveAt)
      : defaults.lastAutoSaveAt,
  };
}

/**
 * 存档领域服务。
 *
 * 它不依赖 Phaser、DOM 或 localStorage。浏览器存储、当前角色快照的创建与恢复都由
 * 外部注入，因此这套规则可以用纯 JavaScript 测试，也能在未来替换成桌面版存储。
 */
export class SaveArchiveService {
  constructor({ repository, profileId, captureSnapshot, restoreSnapshot, now = () => Date.now() }) {
    if (!repository?.read || !repository?.write) throw new Error("存档服务缺少资料仓库");
    if (!profileId) throw new Error("存档服务缺少角色标识");
    if (typeof captureSnapshot !== "function" || typeof restoreSnapshot !== "function") {
      throw new Error("存档服务缺少快照创建或恢复方法");
    }
    this.repository = repository;
    this.profileId = String(profileId);
    this.captureSnapshot = captureSnapshot;
    this.restoreSnapshot = restoreSnapshot;
    this.now = now;
    this.state = normalizeState(this.repository.read(this.profileId), this.now());
  }

  getState() { return clone(this.state); }

  persist() {
    this.repository.write(this.profileId, this.state);
  }

  isValidSlotIndex(slotIndex) {
    return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < MANUAL_SAVE_SLOT_COUNT;
  }

  saveSlot(slotIndex) {
    if (!this.isValidSlotIndex(slotIndex)) return { success: false, message: "存档位无效。" };
    try {
      const snapshot = this.captureSnapshot();
      if (!snapshot || typeof snapshot !== "object") return { success: false, message: "当前角色资料无法保存。" };
      this.state.slots[slotIndex] = { savedAt: this.now(), snapshot: clone(snapshot) };
      this.persist();
      return { success: true, slotIndex, slot: clone(this.state.slots[slotIndex]) };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "保存失败。" };
    }
  }

  loadSlot(slotIndex) {
    if (!this.isValidSlotIndex(slotIndex)) return { success: false, message: "存档位无效。" };
    const slot = this.state.slots[slotIndex];
    if (!slot) return { success: false, message: "这个档位还没有存档。" };
    try {
      const success = this.restoreSnapshot(clone(slot.snapshot));
      return success === false
        ? { success: false, message: "存档格式无法读取。" }
        : { success: true, slotIndex };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "读取失败。" };
    }
  }

  deleteSlot(slotIndex) {
    if (!this.isValidSlotIndex(slotIndex) || !this.state.slots[slotIndex]) {
      return { success: false, message: "这个档位还没有存档。" };
    }
    this.state.slots[slotIndex] = null;
    this.persist();
    return { success: true, slotIndex };
  }

  setAutoSaveEnabled(enabled) {
    this.state.autoSaveEnabled = Boolean(enabled);
    // 重新启用时从现在开始计时，不会立即触发一次旧时间遗留的自动保存。
    if (this.state.autoSaveEnabled) this.state.lastAutoSaveAt = this.now();
    this.persist();
    return { success: true, enabled: this.state.autoSaveEnabled };
  }

  setAutoSaveInterval(minutes) {
    const interval = Number(minutes);
    if (!AUTO_SAVE_INTERVAL_MINUTES.includes(interval)) {
      return { success: false, message: "自动存档只支持 5、10、15 或 30 分钟。" };
    }
    this.state.autoSaveIntervalMinutes = interval;
    this.state.lastAutoSaveAt = this.now();
    this.persist();
    return { success: true, minutes: interval };
  }

  shouldAutoSave(at = this.now()) {
    if (!this.state.autoSaveEnabled) return false;
    const elapsed = Number(at) - this.state.lastAutoSaveAt;
    return elapsed >= this.state.autoSaveIntervalMinutes * 60_000;
  }

  markAutoSaved(at = this.now()) {
    this.state.lastAutoSaveAt = Number.isFinite(Number(at)) ? Number(at) : this.now();
    this.persist();
  }
}

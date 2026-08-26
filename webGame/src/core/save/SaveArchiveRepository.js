const SAVE_ARCHIVE_KEY = "xuanqiong-wendao-progress-snapshots-v1";
const SAVE_ARCHIVE_VERSION = 1;

/**
 * 手动存档资料仓库。
 * 只负责把普通对象放进浏览器 localStorage；档位数量、覆盖和自动存档规则都在领域服务中。
 */
export class SaveArchiveRepository {
  constructor(storage = localStorage) {
    this.storage = storage;
  }

  readContainer() {
    const raw = this.storage.getItem(SAVE_ARCHIVE_KEY);
    if (!raw) return { version: SAVE_ARCHIVE_VERSION, profiles: {} };
    const parsed = JSON.parse(raw);
    if (Number(parsed?.version) !== SAVE_ARCHIVE_VERSION || !parsed?.profiles || typeof parsed.profiles !== "object") {
      throw new Error("手动存档资料格式无效，已阻止覆盖原资料。");
    }
    return parsed;
  }

  read(profileId) {
    return this.readContainer().profiles[String(profileId)] || null;
  }

  write(profileId, value) {
    const container = this.readContainer();
    container.profiles[String(profileId)] = value;
    this.storage.setItem(SAVE_ARCHIVE_KEY, JSON.stringify(container));
  }
}

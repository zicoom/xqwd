const DEFAULT_SPAWN = Object.freeze({ x: 960, y: 900 });

function stableId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[a-z0-9:_-]{1,80}$/i.test(normalized) ? normalized : "";
}

function position(value, fallback = DEFAULT_SPAWN) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return {
    x: Number.isFinite(x) ? Math.round(x) : fallback.x,
    y: Number.isFinite(y) ? Math.round(y) : fallback.y,
  };
}

function cloneRun(run) {
  return {
    runNumber: run.runNumber,
    active: run.active,
    defeatedSpawnIds: [...run.defeatedSpawnIds],
    playerPosition: { ...run.playerPosition },
  };
}

/**
 * 独立洞穴的一轮探索状态。
 *
 * “本轮击败哪些怪、退出后开始下一轮、刷新后仍停留原轮次”都属于世界规则，
 * 场景只报告进入、移动、击败与退出事件，不直接改写存档字段。
 */
export class DungeonRunService {
  constructor({ world = {}, save = () => true } = {}) {
    this.world = world;
    this.save = typeof save === "function" ? save : () => true;
    if (!this.world.dungeonRuns || typeof this.world.dungeonRuns !== "object" || Array.isArray(this.world.dungeonRuns)) {
      this.world.dungeonRuns = {};
    }
  }

  getRun(dungeonId) {
    const id = stableId(dungeonId);
    const raw = id ? this.world.dungeonRuns[id] : null;
    if (!raw) return null;
    const run = {
      runNumber: Math.max(1, Math.floor(Number(raw.runNumber) || 1)),
      active: Boolean(raw.active),
      defeatedSpawnIds: [...new Set((Array.isArray(raw.defeatedSpawnIds) ? raw.defeatedSpawnIds : [])
        .map(stableId).filter(Boolean))],
      playerPosition: position(raw.playerPosition),
    };
    return cloneRun(run);
  }

  beginRun(dungeonId, spawnPoint = DEFAULT_SPAWN) {
    const id = stableId(dungeonId);
    if (!id) return { ok: false, reason: "invalid-dungeon" };
    const previous = this.getRun(id);
    const run = {
      runNumber: (previous?.runNumber || 0) + 1,
      active: true,
      defeatedSpawnIds: [],
      playerPosition: position(spawnPoint),
    };
    this.world.dungeonRuns[id] = run;
    this.save();
    return { ok: true, dungeonId: id, run: cloneRun(run) };
  }

  resumeRun(dungeonId, spawnPoint = DEFAULT_SPAWN) {
    const id = stableId(dungeonId);
    if (!id) return { ok: false, reason: "invalid-dungeon" };
    const current = this.getRun(id);
    if (current?.active) return { ok: true, dungeonId: id, resumed: true, run: current };
    return this.beginRun(id, spawnPoint);
  }

  recordPosition(dungeonId, nextPosition, { persist = false } = {}) {
    const id = stableId(dungeonId);
    const current = this.getRun(id);
    if (!id || !current?.active) return { ok: false, reason: "inactive-run" };
    current.playerPosition = position(nextPosition, current.playerPosition);
    this.world.dungeonRuns[id] = current;
    if (persist) this.save();
    return { ok: true, run: cloneRun(current) };
  }

  markDefeated(dungeonId, spawnId, runNumber) {
    const id = stableId(dungeonId);
    const monsterSpawnId = stableId(spawnId);
    const current = this.getRun(id);
    if (!id || !monsterSpawnId || !current?.active) return { ok: false, reason: "inactive-run" };
    if (Number(runNumber) !== current.runNumber) return { ok: false, reason: "stale-run" };
    if (current.defeatedSpawnIds.includes(monsterSpawnId)) {
      return { ok: true, alreadyDefeated: true, run: current };
    }
    current.defeatedSpawnIds.push(monsterSpawnId);
    this.world.dungeonRuns[id] = current;
    this.save();
    return { ok: true, alreadyDefeated: false, run: cloneRun(current) };
  }

  /**
   * 判断指定轮次是否已清除全部必需怪物出生点。
   * 场景传入普通 ID 数组，领域服务负责去重、校验轮次并计算完成度。
   */
  getClearState(dungeonId, runNumber, requiredSpawnIds = []) {
    const id = stableId(dungeonId);
    const current = this.getRun(id);
    if (!id || !current?.active) return { ok: false, reason: "inactive-run" };
    if (Number(runNumber) !== current.runNumber) return { ok: false, reason: "stale-run" };
    const required = [...new Set((Array.isArray(requiredSpawnIds) ? requiredSpawnIds : [])
      .map(stableId).filter(Boolean))];
    if (!required.length) return { ok: false, reason: "missing-spawns" };
    const defeated = new Set(current.defeatedSpawnIds);
    const defeatedCount = required.filter((spawnId) => defeated.has(spawnId)).length;
    return {
      ok: true,
      cleared: defeatedCount === required.length,
      defeated: defeatedCount,
      remaining: required.length - defeatedCount,
      total: required.length,
    };
  }

  leaveRun(dungeonId, finalPosition) {
    const id = stableId(dungeonId);
    const current = this.getRun(id);
    if (!id || !current) return { ok: false, reason: "missing-run" };
    current.playerPosition = position(finalPosition, current.playerPosition);
    current.active = false;
    this.world.dungeonRuns[id] = current;
    this.save();
    return { ok: true, run: cloneRun(current) };
  }

  static settlementId(dungeonId, runNumber, spawnId) {
    const id = stableId(dungeonId);
    const monsterSpawnId = stableId(spawnId);
    const run = Math.max(0, Math.floor(Number(runNumber) || 0));
    return id && monsterSpawnId && run > 0 ? `dungeon:${id}:run-${run}:${monsterSpawnId}` : "";
  }

  static clearSettlementId(dungeonId, runNumber) {
    const id = stableId(dungeonId);
    const run = Math.max(0, Math.floor(Number(runNumber) || 0));
    return id && run > 0 ? `dungeon:${id}:run-${run}:clear` : "";
  }
}

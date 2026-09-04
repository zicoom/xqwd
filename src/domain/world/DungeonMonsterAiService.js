const PATROL_DIRECTIONS = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0.55, y: 0.82 }),
  Object.freeze({ x: -0.45, y: 0.9 }),
  Object.freeze({ x: -1, y: 0.1 }),
  Object.freeze({ x: -0.55, y: -0.82 }),
  Object.freeze({ x: 0.5, y: -0.86 }),
]);

const DEFAULT_CONFIG = Object.freeze({
  patrolRadius: 90,
  detectionRadius: 210,
  disengageRadius: 350,
  leashRadius: 300,
  patrolSpeed: 32,
  chaseSpeed: 78,
  contactRadius: 72,
});

function finite(value, fallback, min = 0, max = 9999) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function point(value, fallback = { x: 0, y: 0 }) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return {
    x: Number.isFinite(x) ? x : fallback.x,
    y: Number.isFinite(y) ? y : fallback.y,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveToward(from, target, speed, deltaMs) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return { ...target };
  const step = Math.min(length, speed * deltaMs / 1000);
  return { x: from.x + dx / length * step, y: from.y + dy / length * step };
}

function stableSeed(value) {
  return [...String(value || "monster")].reduce((hash, character) => (
    ((hash * 31) + character.charCodeAt(0)) >>> 0
  ), 7);
}

/**
 * 洞穴妖兽的巡逻、警戒、追击和脱战规则。
 * 服务只接收坐标与普通对象，不依赖 Phaser，也不直接启动战斗。
 */
export class DungeonMonsterAiService {
  normalizeConfig(value = {}) {
    const detectionRadius = finite(value.detectionRadius, DEFAULT_CONFIG.detectionRadius, 60, 800);
    return {
      patrolRadius: finite(value.patrolRadius, DEFAULT_CONFIG.patrolRadius, 0, 300),
      detectionRadius,
      disengageRadius: finite(value.disengageRadius, Math.max(DEFAULT_CONFIG.disengageRadius, detectionRadius + 80), detectionRadius, 1000),
      leashRadius: finite(value.leashRadius, DEFAULT_CONFIG.leashRadius, 100, 800),
      patrolSpeed: finite(value.patrolSpeed, DEFAULT_CONFIG.patrolSpeed, 0, 250),
      chaseSpeed: finite(value.chaseSpeed, DEFAULT_CONFIG.chaseSpeed, 1, 350),
      contactRadius: finite(value.contactRadius, DEFAULT_CONFIG.contactRadius, 30, 160),
    };
  }

  createState({ spawnId = "", origin, config = {} } = {}) {
    const seed = stableSeed(spawnId);
    return {
      mode: "idle",
      origin: point(origin),
      target: point(origin),
      patrolIndex: seed % PATROL_DIRECTIONS.length,
      waitMs: 550 + seed % 850,
      seed,
      config: this.normalizeConfig(config),
    };
  }

  update({ state, position, playerPosition, deltaMs = 0 } = {}) {
    if (!state?.config) return { ok: false, reason: "missing-state" };
    const current = point(position, state.origin);
    const player = point(playerPosition, current);
    const elapsed = finite(deltaMs, 0, 0, 250);
    const next = {
      ...state,
      origin: point(state.origin),
      target: point(state.target, state.origin),
      config: this.normalizeConfig(state.config),
    };
    const { config } = next;
    const playerDistance = distance(current, player);
    const originDistance = distance(current, next.origin);

    if (next.mode === "chase" && (playerDistance > config.disengageRadius || originDistance > config.leashRadius)) {
      next.mode = "return";
      next.target = { ...next.origin };
    } else if (["idle", "patrol"].includes(next.mode)
      && playerDistance <= config.detectionRadius
      && originDistance <= config.leashRadius) {
      next.mode = "chase";
    }

    if (next.mode === "chase") {
      if (playerDistance <= config.contactRadius) return { ok: true, state: next, position: current, engage: true };
      const moved = moveToward(current, player, config.chaseSpeed, elapsed);
      return {
        ok: true,
        state: next,
        position: moved,
        engage: distance(moved, player) <= config.contactRadius,
      };
    }

    if (next.mode === "return") {
      const moved = moveToward(current, next.origin, config.chaseSpeed, elapsed);
      if (distance(moved, next.origin) <= 2) {
        next.mode = "idle";
        next.waitMs = 700 + next.seed % 600;
      }
      return { ok: true, state: next, position: moved, engage: false };
    }

    if (next.mode === "idle") {
      next.waitMs = Math.max(0, finite(next.waitMs, 0) - elapsed);
      if (next.waitMs > 0 || config.patrolRadius <= 0 || config.patrolSpeed <= 0) {
        return { ok: true, state: next, position: current, engage: false };
      }
      const direction = PATROL_DIRECTIONS[next.patrolIndex % PATROL_DIRECTIONS.length];
      next.target = {
        x: next.origin.x + direction.x * config.patrolRadius,
        y: next.origin.y + direction.y * config.patrolRadius,
      };
      next.patrolIndex = (next.patrolIndex + 1) % PATROL_DIRECTIONS.length;
      next.mode = "patrol";
    }

    const moved = moveToward(current, next.target, config.patrolSpeed, elapsed);
    if (distance(moved, next.target) <= 2) {
      next.mode = "idle";
      next.waitMs = 650 + (next.seed + next.patrolIndex * 113) % 800;
    }
    return { ok: true, state: next, position: moved, engage: false };
  }
}

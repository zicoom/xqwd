const DEFAULT_SAMPLE_DISTANCE = 120;
const DEFAULT_MAX_POINTS = 1000;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePoint(point) {
  if (!point || typeof point !== "object" || point.x === null || point.y === null) return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

function pointsMatch(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && right.every((point, index) => left[index]?.x === point.x && left[index]?.y === point.y);
}

/**
 * 大地图探索足迹的纯领域服务。
 *
 * HUD 只负责把服务返回的坐标画进“观山镜”；记录间距、旧档修复、容量上限和
 * `world.miniMapVisitedPoints` 的实际修改全部集中在这里，不依赖 Phaser 或 DOM。
 */
export class MapExplorationService {
  constructor({
    world = {},
    sampleDistance = DEFAULT_SAMPLE_DISTANCE,
    maxPoints = DEFAULT_MAX_POINTS,
    save = () => true,
  } = {}) {
    this.world = world;
    this.sampleDistance = positiveNumber(sampleDistance, DEFAULT_SAMPLE_DISTANCE);
    this.maxPoints = positiveInteger(maxPoints, DEFAULT_MAX_POINTS);
    this.save = typeof save === "function" ? save : () => true;
  }

  /**
   * 返回与存档脱离引用的坐标快照。UI 即使修改返回值，也不会绕过领域服务污染存档。
   */
  getVisitedPoints() {
    const rawPoints = Array.isArray(this.world?.miniMapVisitedPoints)
      ? this.world.miniMapVisitedPoints
      : [];
    return rawPoints
      .map(normalizePoint)
      .filter(Boolean)
      .slice(-this.maxPoints)
      .map((point) => ({ ...point }));
  }

  /**
   * 显式修复旧档：移除无效坐标、统一为整数并只保留最新足迹。
   * 只有数据实际发生变化时才保存一次，重复调用保持幂等。
   */
  reconcileLegacyState() {
    const rawPoints = Array.isArray(this.world?.miniMapVisitedPoints)
      ? this.world.miniMapVisitedPoints
      : [];
    const normalizedPoints = rawPoints
      .map(normalizePoint)
      .filter(Boolean)
      .slice(-this.maxPoints);
    const changed = !pointsMatch(this.world?.miniMapVisitedPoints, normalizedPoints);
    const removedCount = Math.max(0, rawPoints.length - normalizedPoints.length);
    if (changed) {
      this.world.miniMapVisitedPoints = normalizedPoints;
      this.save();
    }
    return {
      changed,
      removedCount,
      visitedPoints: normalizedPoints.map((point) => ({ ...point })),
    };
  }

  /**
   * 尝试记录主角当前位置。距离上一点不足采样间距时只返回状态，不写入存档。
   * 足迹的浏览器落盘仍由现有自动存档节奏统一处理，避免角色移动时频繁写 localStorage。
   */
  recordPosition(x, y) {
    const point = normalizePoint({ x, y });
    if (!point) {
      return {
        recorded: false,
        reason: "invalid-position",
        point: null,
        trimmedCount: 0,
        total: this.getVisitedPoints().length,
      };
    }

    this.reconcileLegacyState();
    const visitedPoints = this.world.miniMapVisitedPoints;
    const lastPoint = visitedPoints[visitedPoints.length - 1];
    if (lastPoint && Math.hypot(lastPoint.x - point.x, lastPoint.y - point.y) < this.sampleDistance) {
      return {
        recorded: false,
        reason: "too-close",
        point: { ...point },
        trimmedCount: 0,
        total: visitedPoints.length,
      };
    }

    visitedPoints.push(point);
    const trimmedCount = Math.max(0, visitedPoints.length - this.maxPoints);
    if (trimmedCount > 0) visitedPoints.splice(0, trimmedCount);
    return {
      recorded: true,
      reason: "recorded",
      point: { ...point },
      trimmedCount,
      total: visitedPoints.length,
    };
  }
}


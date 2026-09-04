const EPSILON = 1e-7;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function point(value, fallback = { x: 0, y: 0 }) {
  return { x: finite(value?.x, fallback.x), y: finite(value?.y, fallback.y) };
}

function pointOnSegment(target, start, end) {
  const cross = (target.y - start.y) * (end.x - start.x) - (target.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > EPSILON) return false;
  return target.x >= Math.min(start.x, end.x) - EPSILON
    && target.x <= Math.max(start.x, end.x) + EPSILON
    && target.y >= Math.min(start.y, end.y) - EPSILON
    && target.y <= Math.max(start.y, end.y) + EPSILON;
}

/** 射线法判断点是否位于多边形内；边界也算在区域中。 */
export function isPointInMapRegion(target, region) {
  const vertices = Array.isArray(region?.points) ? region.points : [];
  if (vertices.length < 3) return false;
  const test = point(target);
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
    const start = point(vertices[previous]);
    const end = point(vertices[index]);
    if (pointOnSegment(test, start, end)) return true;
    const crosses = (start.y > test.y) !== (end.y > test.y)
      && test.x < ((end.x - start.x) * (test.y - start.y)) / (end.y - start.y) + start.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function withinBounds(target, bounds) {
  if (!bounds) return true;
  return target.x >= finite(bounds.left, Number.NEGATIVE_INFINITY)
    && target.x <= finite(bounds.right, Number.POSITIVE_INFINITY)
    && target.y >= finite(bounds.top, Number.NEGATIVE_INFINITY)
    && target.y <= finite(bounds.bottom, Number.POSITIVE_INFINITY);
}

/** 地图通行规则：必须落在任一可行走区内，并且不能落入任何阻挡区。 */
export class MapNavigationService {
  constructor({ regions = [], bounds = null } = {}) {
    this.regions = Array.from(regions || []).filter((region) => Array.isArray(region?.points) && region.points.length >= 3);
    this.bounds = bounds;
    this.walkableRegions = this.regions.filter((region) => region.type === "walkable");
    this.blockedRegions = this.regions.filter((region) => region.type === "blocked");
  }

  isWalkable(target) {
    const test = point(target);
    if (!withinBounds(test, this.bounds)) return false;
    if (this.blockedRegions.some((region) => isPointInMapRegion(test, region))) return false;
    return !this.walkableRegions.length || this.walkableRegions.some((region) => isPointInMapRegion(test, region));
  }

  canTraverse(from, to, sampleGap = 10) {
    const start = point(from);
    const end = point(to, start);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(2, finite(sampleGap, 10))));
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      if (!this.isWalkable({
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      })) return false;
    }
    return true;
  }

  /** 被边界拦住时依次尝试横向、纵向和斜向滑动，让角色能自然贴墙移动。 */
  resolveMovement(from, desired) {
    const start = point(from);
    const target = point(desired, start);
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const candidates = [
      target,
      { x: start.x + dx, y: start.y },
      { x: start.x, y: start.y + dy },
      { x: start.x + dx * 0.7 - dy * 0.7, y: start.y + dy * 0.7 + dx * 0.7 },
      { x: start.x + dx * 0.7 + dy * 0.7, y: start.y + dy * 0.7 - dx * 0.7 },
    ];
    const next = candidates.find((candidate) => this.canTraverse(start, candidate));
    return next
      ? { position: next, moved: Math.hypot(next.x - start.x, next.y - start.y) > EPSILON, blocked: next !== target }
      : { position: start, moved: false, blocked: true };
  }

  /** 新画区域覆盖旧存档位置时，把角色或怪物移到附近最近的合法点。 */
  findNearestWalkable(target, maxRadius = 320) {
    const start = point(target);
    if (this.isWalkable(start)) return start;
    for (let radius = 12; radius <= maxRadius; radius += 12) {
      for (let index = 0; index < 24; index += 1) {
        const angle = index / 24 * Math.PI * 2;
        const candidate = { x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius };
        if (this.isWalkable(candidate)) return candidate;
      }
    }
    return start;
  }
}

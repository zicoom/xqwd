const EPSILON = 1e-7;

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pointOnSegment(point, start, end) {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > EPSILON) return false;
  return point.x >= Math.min(start.x, end.x) - EPSILON
    && point.x <= Math.max(start.x, end.x) + EPSILON
    && point.y >= Math.min(start.y, end.y) - EPSILON
    && point.y <= Math.max(start.y, end.y) + EPSILON;
}

function pointLocation(point, vertices) {
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
    const start = vertices[previous];
    const end = vertices[index];
    if (pointOnSegment(point, start, end)) return "boundary";
    const crossesRay = (start.y > point.y) !== (end.y > point.y)
      && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;
    if (crossesRay) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

function orientation(start, end, point) {
  const value = (end.y - start.y) * (point.x - end.x) - (end.x - start.x) * (point.y - end.y);
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  if (firstA !== firstB && secondA !== secondB) return true;
  if (firstA === 0 && pointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (firstB === 0 && pointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (secondA === 0 && pointOnSegment(firstStart, secondStart, secondEnd)) return true;
  return secondB === 0 && pointOnSegment(firstEnd, secondStart, secondEnd);
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

/**
 * 把建筑模板中的 0～1 相对碰撞点转换为地图世界坐标。
 * 地图实例的 scale 会同时影响图片和碰撞范围。
 */
export function getBuildingCollisionVertices(object) {
  const template = object?.type === "building" ? object.buildingTemplate : null;
  const collision = template?.collision;
  if (!collision?.enabled || !Array.isArray(collision.points) || collision.points.length < 3) return [];
  const instanceScale = Math.min(4, Math.max(0.25, numberOr(object.scale, 1)));
  const width = Math.max(1, numberOr(template.display?.width, 256)) * instanceScale;
  const height = Math.max(1, numberOr(template.display?.height, 256)) * instanceScale;
  const objectX = numberOr(object.x, 0);
  const objectY = numberOr(object.y, 0);
  const top = template.display?.anchor === "center" ? objectY - height / 2 : objectY - height;
  return collision.points.map((point) => ({
    x: objectX + (numberOr(point.x, 0.5) - 0.5) * width,
    y: top + numberOr(point.y, 0.5) * height,
  }));
}

/** 角色脚底到建筑碰撞轮廓的最短距离；站在轮廓内时返回 0。 */
export function getDistanceToBuildingCollision(point, object) {
  const vertices = getBuildingCollisionVertices(object);
  if (vertices.length < 3) return Number.POSITIVE_INFINITY;
  if (pointLocation(point, vertices) !== "outside") return 0;
  return Math.min(...vertices.map((start, index) => (
    pointToSegmentDistance(point, start, vertices[(index + 1) % vertices.length])
  )));
}

/**
 * 检查一次脚底移动是否进入或穿过建筑碰撞边界。
 * 若旧存档已经把角色留在建筑内部，则允许继续移动直到走出，避免角色被永久卡住。
 */
export function movementCrossesBuilding(from, to, object) {
  const vertices = getBuildingCollisionVertices(object);
  if (vertices.length < 3) return false;
  const startLocation = pointLocation(from, vertices);
  const endLocation = pointLocation(to, vertices);
  if (startLocation === "inside") return false;
  if (endLocation === "inside") return true;
  if (startLocation === "boundary") return false;
  if (endLocation === "boundary") return true;
  for (let index = 0; index < vertices.length; index += 1) {
    const edgeStart = vertices[index];
    const edgeEnd = vertices[(index + 1) % vertices.length];
    if (segmentsIntersect(from, to, edgeStart, edgeEnd)) return true;
  }
  return false;
}

export function isMovementBlockedByBuildings(from, to, objects) {
  return Array.from(objects || []).some((object) => movementCrossesBuilding(from, to, object));
}

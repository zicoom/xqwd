import { getDistanceToBuildingCollision } from "./BuildingCollisionService.js";

const DEFAULT_PROMPT_RANGE = 180;

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 没有碰撞轮廓的建筑仍需能显示入口按钮，因此退回到图片矩形边缘计算距离。
 * 坐标规则与 BuildingCollisionService 保持一致：bottom 锚点的 y 是建筑底部。
 */
function getDistanceToBuildingDisplay(point, buildingObject) {
  const display = buildingObject?.buildingTemplate?.display || {};
  const scale = Math.min(4, Math.max(0.25, numberOr(buildingObject?.scale, 1)));
  const width = Math.max(1, numberOr(display.width, 256)) * scale;
  const height = Math.max(1, numberOr(display.height, 256)) * scale;
  const centerX = numberOr(buildingObject?.x, 0);
  const objectY = numberOr(buildingObject?.y, 0);
  const top = display.anchor === "center" ? objectY - height / 2 : objectY - height;
  const bottom = top + height;
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const pointX = numberOr(point?.x, 0);
  const pointY = numberOr(point?.y, 0);
  const dx = Math.max(left - pointX, 0, pointX - right);
  const dy = Math.max(top - pointY, 0, pointY - bottom);
  return Math.hypot(dx, dy);
}

/**
 * 所有可交互建筑共用的入口规则。
 * 场景只负责展示按钮和执行回调；建筑识别、提示距离与最近入口选择集中在这里。
 */
export class BuildingEntranceService {
  constructor({ resolveSect = () => null, resolveSceneDestination = () => null } = {}) {
    this.resolveSect = resolveSect;
    this.resolveSceneDestination = resolveSceneDestination;
  }

  resolve(buildingObject) {
    if (buildingObject?.type !== "building") return null;
    const sect = this.resolveSect(buildingObject);
    if (sect) return { kind: "sect", buildingObject, sect, destination: null };

    const interaction = buildingObject.buildingTemplate?.interaction || {};
    if (interaction.enabled !== true) return null;
    const kind = String(interaction.kind || "dialogue");
    return {
      kind,
      buildingObject,
      sect: null,
      destination: kind === "scene" ? this.resolveSceneDestination(interaction.targetId) : null,
    };
  }

  getPromptRange(entry) {
    if (entry?.kind === "sect") {
      return Math.max(0, numberOr(entry.sect?.building?.autoPromptRange, DEFAULT_PROMPT_RANGE));
    }
    return Math.max(0, numberOr(entry?.buildingObject?.buildingTemplate?.interaction?.autoPromptRange, DEFAULT_PROMPT_RANGE));
  }

  getDistance(point, buildingObject) {
    const collisionDistance = getDistanceToBuildingCollision(point, buildingObject);
    return Number.isFinite(collisionDistance)
      ? collisionDistance
      : getDistanceToBuildingDisplay(point, buildingObject);
  }

  findNearest(point, buildingObjects = []) {
    let nearest = null;
    for (const buildingObject of buildingObjects) {
      const entry = this.resolve(buildingObject);
      if (!entry) continue;
      const distance = this.getDistance(point, buildingObject);
      const range = this.getPromptRange(entry);
      if (distance > range || (nearest && distance >= nearest.distance)) continue;
      nearest = { ...entry, distance, range };
    }
    return nearest;
  }
}

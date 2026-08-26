import { getSectTemplates } from "../../core/SectCatalog.js";

const distanceBetween = (left, right) => Math.hypot(
  (Number(left?.x) || 0) - (Number(right?.x) || 0),
  (Number(left?.y) || 0) - (Number(right?.y) || 0),
);

/** 门派准入领域服务：统一处理建筑匹配、任务/令牌判定与接引人奖励。 */
export class SectAccessService {
  constructor({ player, world, inventoryService, save = () => true, loadSects = getSectTemplates }) {
    this.player = player;
    this.world = world;
    this.inventoryService = inventoryService;
    this.save = save;
    this.loadSects = loadSects;
  }

  all() {
    return this.loadSects();
  }

  getById(sectId) {
    return this.all().find((sect) => sect.id === sectId) || null;
  }

  resolveForBuilding(buildingObject) {
    if (buildingObject?.type !== "building") return null;
    const interaction = buildingObject.buildingTemplate?.interaction || {};
    if (interaction.enabled === false || (interaction.kind && interaction.kind !== "sect")) return null;
    return this.all().find((sect) => {
      const targetId = String(interaction.targetId || "").trim();
      const names = [buildingObject.name, buildingObject.buildingTemplate?.name, interaction.title].filter(Boolean);
      return (targetId && sect.building.targetIds.includes(targetId))
        || sect.building.templateIds.includes(buildingObject.buildingTemplateId)
        || names.some((name) => sect.building.names.includes(name));
    }) || null;
  }

  hasCompletedAccessQuest(sect) {
    const completed = new Set([
      ...(Array.isArray(this.world?.completedQuestIds) ? this.world.completedQuestIds : []),
      ...(Array.isArray(this.player?.completedQuestIds) ? this.player.completedQuestIds : []),
    ]);
    return sect.access.questIds.some((questId) => completed.has(questId))
      || this.world?.sectProgress?.[sect.id]?.accessGranted === true;
  }

  hasAccessToken(sect) {
    return Boolean(sect?.access?.tokenItemId && this.inventoryService?.getQuantity(sect.access.tokenItemId) > 0);
  }

  evaluate(sectId) {
    const sect = this.getById(sectId);
    if (!sect) return { ok: false, reason: "unknown-sect", message: "尚未配置这个门派。", sect: null };
    const byQuest = this.hasCompletedAccessQuest(sect);
    const byToken = this.hasAccessToken(sect);
    return {
      ok: byQuest || byToken,
      reason: byQuest ? "quest" : byToken ? "token" : "locked",
      message: byQuest || byToken ? `可以进入${sect.name}。` : sect.access.deniedText,
      sect,
    };
  }

  getGuideContext(npcObject, mapObjects = []) {
    if (npcObject?.type !== "npc") return null;
    let best = null;
    for (const building of mapObjects.filter((object) => object.type === "building")) {
      const sect = this.resolveForBuilding(building);
      if (!sect) continue;
      const guide = sect.guide || {};
      const explicitObjectMatch = guide.npcObjectIds?.includes(npcObject.id);
      const templateMatch = guide.npcTemplateIds?.includes(npcObject.npcTemplateId);
      if (!explicitObjectMatch && !templateMatch) continue;
      const distance = distanceBetween(npcObject, building);
      if (!explicitObjectMatch && distance > (Number(guide.radius) || 0)) continue;
      if (!best || distance < best.distance) best = { sect, building, distance, guide };
    }
    return best;
  }

  grantGuideToken(npcObject, mapObjects = []) {
    const context = this.getGuideContext(npcObject, mapObjects);
    if (!context) return { ok: false, reason: "not-guide" };
    const itemId = context.sect.access.tokenItemId;
    if (!itemId) return { ok: false, reason: "no-token", sect: context.sect };
    if (this.inventoryService.getQuantity(itemId) > 0) {
      return { ok: false, reason: "already-owned", sect: context.sect, itemId };
    }
    const grant = this.inventoryService.grant(itemId, 1);
    return { ...grant, reason: grant.ok ? "granted" : "grant-failed", sect: context.sect, itemId, quantity: 1 };
  }
}


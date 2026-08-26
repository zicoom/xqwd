import assert from "node:assert/strict";
import { getSystemItemTemplates } from "../src/core/SystemItemCatalog.js";
import { InventoryService } from "../src/domain/inventory/InventoryService.js";
import { ItemCatalog } from "../src/domain/items/ItemCatalog.js";
import { SectAccessService } from "../src/domain/world/SectAccessService.js";

const player = { inventory: {} };
const world = { completedQuestIds: [], sectProgress: {} };
let saveCount = 0;
const inventoryService = new InventoryService({ player, save: () => { saveCount += 1; return true; } });
const service = new SectAccessService({ player, world, inventoryService });
const building = {
  id: "building-tianjian",
  type: "building",
  name: "天剑宗",
  x: 1000,
  y: 1000,
  buildingTemplateId: "building-qixia-house",
  buildingTemplate: { interaction: { enabled: true, kind: "sect", targetId: "" } },
};
const guide = { id: "guide", type: "npc", npcTemplateId: "npc-qixia-elder", x: 1450, y: 1000 };
const distantNpc = { id: "distant", type: "npc", npcTemplateId: "npc-qixia-elder", x: 1700, y: 1000 };

const sect = service.resolveForBuilding(building);
assert.equal(sect.id, "sect:tianjian");
assert.equal(sect.building.autoPromptRange, 320, "门派入口提示应在玩家贴近建筑前提前出现");
assert.equal(service.evaluate(sect.id).ok, false, "没有任务或令牌时必须拦截");
assert.equal(service.getGuideContext(guide, [guide, building]).sect.id, sect.id);
assert.equal(service.getGuideContext(distantNpc, [distantNpc, building]), null, "接引 NPC 必须确实位于门派附近");

const reward = service.grantGuideToken(guide, [guide, building]);
assert.equal(reward.ok, true);
assert.equal(player.inventory[sect.access.tokenItemId], 1);
assert.equal(saveCount, 1, "发放令牌必须立即触发存档");
assert.equal(service.evaluate(sect.id).reason, "token");
assert.equal(service.grantGuideToken(guide, [guide, building]).reason, "already-owned", "令牌不能重复发放");

delete player.inventory[sect.access.tokenItemId];
world.completedQuestIds.push(sect.access.questIds[0]);
assert.equal(service.evaluate(sect.id).reason, "quest", "完成准入任务也可以进入");

const systemItem = getSystemItemTemplates().find((item) => item.id === sect.access.tokenItemId);
assert.equal(systemItem.sellable, false);
assert.equal(systemItem.canUse, false);
const catalog = new ItemCatalog({ loadTemplates: () => [] });
assert.equal(catalog.getById(sect.access.tokenItemId).name, "天剑宗令牌");

console.log("门派准入冒烟测试通过：建筑匹配、附近接引人、令牌发放、任务通行与系统物品正确。");

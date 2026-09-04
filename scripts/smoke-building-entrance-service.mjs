import assert from "node:assert/strict";
import { BuildingEntranceService } from "../src/domain/world/BuildingEntranceService.js";

const destination = { id: "monster-cave-1", sceneKey: "MonsterCaveScene" };
const sect = { id: "sect:test", building: { autoPromptRange: 320 } };
const service = new BuildingEntranceService({
  resolveSect: (building) => building.id === "sect-building" ? sect : null,
  resolveSceneDestination: (targetId) => targetId === destination.id ? destination : null,
});

const cave = {
  id: "cave-building",
  type: "building",
  name: "怪物洞穴",
  x: 500,
  y: 500,
  scale: 1,
  buildingTemplate: {
    display: { width: 200, height: 200, anchor: "center" },
    collision: {
      enabled: true,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    },
    interaction: { enabled: true, kind: "scene", targetId: "monster-cave-1" },
  },
};
const caveEntry = service.resolve(cave);
assert.equal(caveEntry.kind, "scene");
assert.equal(caveEntry.destination, destination);
assert.notEqual(service.findNearest({ x: 500, y: 750 }, [cave]), caveEntry, "附近结果应附加本次距离而不是修改解析结果");

const nearbyCave = service.findNearest({ x: 500, y: 650 }, [cave]);
assert.equal(nearbyCave.buildingObject, cave);
assert.equal(nearbyCave.distance, 50);
assert.equal(nearbyCave.range, 180);
assert.equal(service.findNearest({ x: 500, y: 781 }, [cave]), null, "离建筑边缘超过提示范围后按钮必须消失");

const sectBuilding = {
  ...cave,
  id: "sect-building",
  buildingTemplate: { ...cave.buildingTemplate, interaction: { enabled: true, kind: "sect" } },
};
const sectEntry = service.findNearest({ x: 500, y: 800 }, [sectBuilding]);
assert.equal(sectEntry.kind, "sect");
assert.equal(sectEntry.sect, sect);
assert.equal(sectEntry.range, 320, "门派继续使用自身配置的提示范围");

const houseWithoutCollision = {
  ...cave,
  id: "house",
  buildingTemplate: {
    display: { width: 100, height: 100, anchor: "bottom" },
    collision: { enabled: false, points: [] },
    interaction: { enabled: true, kind: "dialogue", targetId: "" },
  },
};
assert.equal(service.findNearest({ x: 500, y: 550 }, [houseWithoutCollision]).distance, 50,
  "没有碰撞轮廓的可交互建筑也必须按图片边缘出现入口");

const disabledBuilding = {
  ...houseWithoutCollision,
  id: "disabled",
  buildingTemplate: {
    ...houseWithoutCollision.buildingTemplate,
    interaction: { enabled: false, kind: "dialogue", targetId: "" },
  },
};
assert.equal(service.resolve(disabledBuilding), null);
assert.equal(service.resolve({ type: "npc" }), null);

console.log("建筑入口冒烟测试通过：门派、洞穴、普通建筑统一靠近显示入口，离开隐藏且无碰撞配置可回退。");

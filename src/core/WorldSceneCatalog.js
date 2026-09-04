import { SceneKeys } from "./SceneKeys.js";

const DESTINATIONS = Object.freeze({
  "monster-cave-1": Object.freeze({
    id: "monster-cave-1",
    name: "幽晶兽窟",
    sceneKey: SceneKeys.MONSTER_CAVE,
    dungeon: true,
    spawnPoint: Object.freeze({ x: 960, y: 900 }),
  }),
});

/** 建筑模板只保存稳定目标 ID；可启动的场景必须经过此白名单解析。 */
export function getWorldSceneDestination(targetId) {
  return DESTINATIONS[String(targetId || "").trim()] || null;
}

export function getWorldSceneDestinations() {
  return Object.values(DESTINATIONS);
}

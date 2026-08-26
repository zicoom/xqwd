import { SceneKeys } from "./SceneKeys.js";

// 开发工具独立使用时，刷新网页也要回到当前工具，而不是跳回大地图。
const HASH_TO_SCENE = Object.freeze({
  "#editor-console": SceneKeys.DEVELOPER_CONSOLE,
  "#editor-npc": SceneKeys.NPC_EDITOR,
  "#editor-item": SceneKeys.ITEM_EDITOR,
  "#editor-map": SceneKeys.MAP_EDITOR,
  "#editor-building": SceneKeys.BUILDING_EDITOR,
  "#editor-monster": SceneKeys.MONSTER_EDITOR,
});

const SCENE_TO_HASH = Object.freeze(Object.fromEntries(Object.entries(HASH_TO_SCENE).map(([hash, scene]) => [scene, hash])));

export function rememberEditorRoute(sceneKey) {
  const hash = SCENE_TO_HASH[sceneKey];
  if (!hash || window.location.hash === hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
}

export function getEditorRoute() { return HASH_TO_SCENE[window.location.hash] || null; }

export function clearEditorRoute() {
  if (!window.location.hash.startsWith("#editor-")) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

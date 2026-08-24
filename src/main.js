import { BootScene } from "./scenes/BootScene.js";
import { CoverScene } from "./scenes/CoverScene.js";
import { SaveSlotScene } from "./scenes/SaveSlotScene.js";
import { MapEditorScene } from "./scenes/MapEditorScene.js";
import { DeveloperConsoleScene } from "./scenes/DeveloperConsoleScene.js";
import { MonsterEditorScene } from "./scenes/MonsterEditorScene.js";
import { NpcEditorScene } from "./scenes/NpcEditorScene.js";
import { ItemEditorScene } from "./scenes/ItemEditorScene.js";
import { BuildingEditorScene } from "./scenes/BuildingEditorScene.js";
import { CharacterCreateScene } from "./scenes/CharacterCreateScene.js";
import { VillageScene } from "./scenes/VillageScene.js";
import { BattleScene } from "./scenes/BattleScene.js";
import { ChapterResultScene } from "./scenes/ChapterResultScene.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./core/DisplayConfig.js";

// 游戏内右键由游戏功能自行处理，不显示浏览器原生的“保存图片”等菜单。
document.addEventListener("contextmenu", (event) => event.preventDefault());

/**
 * 游戏现在统一使用 1920×1080 Full HD 设计画布。
 * 浏览器窗口较小时由 Phaser 等比例缩小，不会改变 16:9 排版。
 */
const screenScale = Math.max(window.innerWidth / SCREEN_WIDTH, window.innerHeight / SCREEN_HEIGHT, 1);
const renderResolution = Math.min((window.devicePixelRatio || 1) * screenScale, 2);

/**
 * Phaser 总配置。
 * FIT 负责按比例填满浏览器窗口；resolution 则让画布按显示器的真实像素密度渲染。
 * 例如普通 1920×1080 屏幕不会再把一张 1280×720 的低分辨率画布硬拉大。
 */
// 开发时保留游戏实例，便于排查“只有背景、场景没有显示”这一类启动问题。
// 正常玩家不会看到这个变量，也不会影响游戏功能。
window.__xuanqiongGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  // 高分屏会使用更多物理像素，从而保证角色、文字和水墨背景尽量清晰。
  // 限制为 2，避免少数超高分屏占用过多显存，影响中大型游戏性能。
  resolution: renderResolution,
  render: {
    antialias: true,
    roundPixels: false,
  },
  backgroundColor: "#203b3a",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // 封面是玩家最先看到的场景；之后由 BootScene 判断进入角色创建还是已保存的第一章。
  // BootScene 放在第一个，负责判断刷新后进入最近角色还是首次封面。
  scene: [BootScene, CoverScene, SaveSlotScene, DeveloperConsoleScene, MapEditorScene, MonsterEditorScene, NpcEditorScene, ItemEditorScene, BuildingEditorScene, CharacterCreateScene, VillageScene, BattleScene, ChapterResultScene],
});

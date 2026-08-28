import { gameState, saveFirstChapterProgress } from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { addButton, addText, addTitle } from "../utils/UiHelpers.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { ChapterQuestService } from "../domain/quests/ChapterQuestService.js";

/** 第一章结算场景，展示已解锁内容和下一阶段目标。 */
export class ChapterResultScene extends Phaser.Scene {
  constructor() { super(SceneKeys.RESULT); }

  create() {
    configureFullHdScene(this);
    // 场景只装配章节事务；具体需要重置哪些任务与角色字段由领域服务统一决定。
    const chapterQuestService = new ChapterQuestService({
      chapter: gameState.chapter,
      player: gameState.player,
      save: saveFirstChapterProgress,
    });
    this.cameras.main.setBackgroundColor("#203b3a");
    addTitle(this, "第一章完成 · 古玉初鸣", "原型流程已完成，后续系统将按需求逐步扩展");
    this.add.rectangle(960, 555, 1410, 705, 0x182827, 0.92).setStrokeStyle(5, 0xe2bb6d);
    addText(this, 960, 255, `恭喜你，${gameState.player.name}！`, 47, "#ffe19b", { origin: 0.5 });
    const summary = [
      "✓ 发现上古飞升者遗留的古玉",
      `✓ 确认主灵根：${gameState.player.selectedElement}，获得初始术法`,
      "✓ 击败蚀月盟劫修，取得令牌残片",
      "✓ 解锁线索：云渡坊市、青衡剑宗、古传送阵",
      "✓ 获得第一件法宝：引灵玉灯（后续版本开放）",
      "下一步：继续扩展苍岚山野、坊市、门派与古雾秘境。",
    ];
    summary.forEach((line, index) => addText(this, 390, 353 + index * 71, line, 33, index === 5 ? "#d8e7cb" : "#fff7e0"));
    addButton(this, 750, 953, 390, "重新体验第一章", () => {
      chapterQuestService.restartChapter();
      this.scene.start(SceneKeys.VILLAGE);
    }, { height: 81, size: 29 });
    addButton(this, 1185, 953, 390, "返回角色选择", () => this.scene.start(SceneKeys.SLOT_SELECT), { height: 81, size: 29 });
  }
}

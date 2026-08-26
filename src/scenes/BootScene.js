import { SceneKeys } from "../core/SceneKeys.js";
import { gameState, loadLastPlayedProgress } from "../core/GameState.js";
import { getEditorRoute } from "../core/EditorRoute.js";
import { clearSceneResumeRoute, getSectResumeRoute } from "../core/SceneResumeState.js";

/**
 * 启动场景。
 * 正式项目中这里会检查多个存档、浏览器兼容性并加载最基础资源。
 * 第一章原型会先进入五档角色选择页，由玩家选择进入已有角色或新建角色。
 */
export class BootScene extends Phaser.Scene {
  constructor() { super(SceneKeys.BOOT); }

  create() {
    // 编辑器带有 #editor-... 地址时，刷新后优先回到同一个编辑器。
    const editorRoute = getEditorRoute();
    if (editorRoute) {
      this.scene.start(editorRoute);
      return;
    }
    // 有最近存档时先恢复本标签页所在的门派页面；没有页面记录才回到青云山。
    // 门派恢复状态与档位绑定，避免切换角色后误进入另一个角色之前停留的页面。
    if (!loadLastPlayedProgress()) {
      clearSceneResumeRoute();
      this.scene.start(SceneKeys.COVER);
      return;
    }
    const sectRoute = getSectResumeRoute(gameState.activeSaveSlot);
    if (sectRoute) {
      this.scene.start(SceneKeys.SECT, sectRoute);
      return;
    }
    this.scene.start(SceneKeys.VILLAGE);
  }
}

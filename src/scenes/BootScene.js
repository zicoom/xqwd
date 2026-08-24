import { SceneKeys } from "../core/SceneKeys.js";
import { loadLastPlayedProgress } from "../core/GameState.js";
import { getEditorRoute } from "../core/EditorRoute.js";

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
    // 有最近存档时，刷新网页会直接回到青云山；第一次打开或没有角色时才显示封面。
    this.scene.start(loadLastPlayedProgress() ? SceneKeys.VILLAGE : SceneKeys.COVER);
  }
}

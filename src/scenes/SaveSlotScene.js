import { deleteSaveSlot, getSaveSlots, loadFirstChapterProgress, MAX_SAVE_SLOTS } from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { CharacterArchiveView, preloadCharacterArchiveAssets } from "../ui/save/CharacterArchiveView.js";
import { rememberSceneRoute } from "../core/SceneResumeState.js";

/**
 * 角色档案选择场景。
 *
 * 角色数据仍由 GameState 负责；场景只装配 Pixso 角色档案视图与档位操作回调。
 */
export class SaveSlotScene extends Phaser.Scene {
  constructor() { super(SceneKeys.SLOT_SELECT); }

  preload() {
    preloadCharacterArchiveAssets(this);
  }

  create() {
    configureFullHdScene(this);
    rememberSceneRoute({ sceneKey: SceneKeys.SLOT_SELECT });
    const slots = getSaveSlots();
    this.archiveView = new CharacterArchiveView(this).render({
      slots,
      maxSlots: MAX_SAVE_SLOTS,
      onEnter: (index) => this.enterSlot(index),
      onCreate: (index) => this.createNewCharacter(index),
      onDelete: (index, name) => this.deleteSlot(index, name),
      onBack: () => this.scene.start(SceneKeys.COVER),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.archiveView?.destroy();
      this.archiveView = null;
    });
  }

  enterSlot(index) {
    if (loadFirstChapterProgress(index)) this.scene.start(SceneKeys.VILLAGE);
  }

  createNewCharacter(index) {
    this.scene.start(SceneKeys.CREATE, { newCharacter: true, slotIndex: index });
  }

  deleteSlot(index, name) {
    if (!window.confirm(`确定删除角色“${name}”吗？删除后无法恢复。`)) return;
    if (deleteSaveSlot(index)) this.scene.restart();
  }
}

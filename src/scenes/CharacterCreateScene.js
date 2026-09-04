import {
  gameState,
  prepareNewCharacter,
  saveFirstChapterProgress,
} from "../core/GameState.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { DEFAULT_PLAYER_PORTRAIT_ID, PLAYER_PORTRAITS } from "../core/PortraitCatalog.js";
import { CharacterCreationService } from "../domain/character/CharacterCreationService.js";
import { rememberSceneRoute } from "../core/SceneResumeState.js";
import {
  CharacterCreateView,
  preloadCharacterCreateAssets,
} from "../ui/character/CharacterCreateView.js";
import {
  PortraitPickerView,
  preloadPortraitPickerAssets,
} from "../ui/character/PortraitPickerView.js";

/**
 * 角色创建场景。
 * 场景只装配 Pixso 创建视图、立绘选择层和 CharacterCreationService；创建规则不在 UI 中实现。
 */
export class CharacterCreateScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.CREATE);
  }

  init(data) {
    this.isCreatingNewCharacter = Boolean(data?.newCharacter);
    this.slotIndex = data?.slotIndex;
    this.resumeInterfaceId = data?.interfaceId || "";
  }

  preload() {
    // 刷新后 BootScene 可以直接恢复到创建页，不能依赖先经过封面时留下的纹理缓存。
    preloadCharacterCreateAssets(this);
    preloadPortraitPickerAssets(this);
    PLAYER_PORTRAITS.forEach((portrait) => this.load.image(portrait.textureKey, portrait.imagePath));
  }

  create() {
    configureFullHdScene(this);
    rememberSceneRoute({
      sceneKey: SceneKeys.CREATE,
      interfaceId: this.resumeInterfaceId,
      slotIndex: this.slotIndex,
      newCharacter: this.isCreatingNewCharacter,
    });
    if (this.isCreatingNewCharacter) prepareNewCharacter(this.slotIndex);

    this.creationService = new CharacterCreationService({
      player: gameState.player,
      portraits: PLAYER_PORTRAITS,
      defaultPortraitId: DEFAULT_PLAYER_PORTRAIT_ID,
    });
    this.selectedElement = this.creationService.getHighestElement();
    this.portraitSelectionIndex = this.getCurrentPortraitIndex();

    this.characterCreateView = new CharacterCreateView(this).render(this.getViewState(), {
      onBack: () => this.scene.start(SceneKeys.SLOT_SELECT),
      onPreviousPortrait: () => this.shiftMainPortrait(-1),
      onNextPortrait: () => this.shiftMainPortrait(1),
      onPortraitPicker: () => this.openPortraitPicker(),
      onNameInput: (value) => this.updateNameDraft(value),
      onNameCommit: (value) => this.commitNameInput(value),
      onNameCancel: (value) => this.cancelNameInput(value),
      onGender: (gender) => this.setGender(gender),
      onSelectRoot: (element) => {
        this.selectedElement = element;
        this.refreshView();
      },
      onStepRoot: (delta) => this.changeRoot(this.selectedElement, delta),
      onEnter: () => this.enterVillage(),
    });

    this.portraitPickerView = new PortraitPickerView(this).render({
      portraits: PLAYER_PORTRAITS,
      selectedIndex: this.portraitSelectionIndex,
    }, {
      onBack: () => this.closePortraitPicker(),
      onPrevious: () => this.shiftPortraitSelection(-1),
      onNext: () => this.shiftPortraitSelection(1),
      onSelect: (index, direction) => {
        if (!this.portraitPickerView?.canNavigate()) return;
        if (index === this.portraitSelectionIndex) return;
        this.shiftPortraitSelection(Math.sign(direction));
      },
      onConfirm: () => this.confirmPortraitSelection(),
    });
    if (this.resumeInterfaceId === "portrait-picker") {
      this.time.delayedCall(0, () => this.openPortraitPicker());
    }
    this.events.once("shutdown", () => {
      this.characterCreateView?.destroy();
      this.characterCreateView = null;
      this.portraitPickerView?.destroy();
      this.portraitPickerView = null;
    });
  }

  getCurrentPortraitIndex() {
    return Math.max(0, PLAYER_PORTRAITS.findIndex((portrait) => portrait.id === gameState.player.portraitId));
  }

  getViewState() {
    return {
      name: gameState.player.name,
      gender: gameState.player.gender,
      portraitId: gameState.player.portraitId,
      roots: gameState.player.roots,
      remaining: this.creationService.getRemainingPoints(),
      selectedElement: this.selectedElement,
      skillPreview: this.creationService.getSkillPreview(),
    };
  }

  refreshView() {
    this.characterCreateView?.update(this.getViewState());
  }

  shiftMainPortrait(delta) {
    const index = (this.getCurrentPortraitIndex() + delta + PLAYER_PORTRAITS.length) % PLAYER_PORTRAITS.length;
    const result = this.creationService.selectPortrait(PLAYER_PORTRAITS[index].id);
    if (!result.ok) return;
    this.portraitSelectionIndex = index;
    this.refreshView();
  }

  openPortraitPicker() {
    rememberSceneRoute({
      sceneKey: SceneKeys.CREATE,
      interfaceId: "portrait-picker",
      slotIndex: this.slotIndex,
      newCharacter: this.isCreatingNewCharacter,
    });
    this.portraitSelectionIndex = this.getCurrentPortraitIndex();
    this.refreshPortraitPicker();
    this.portraitPickerView?.show();
  }

  closePortraitPicker() {
    rememberSceneRoute({
      sceneKey: SceneKeys.CREATE,
      slotIndex: this.slotIndex,
      newCharacter: this.isCreatingNewCharacter,
    });
    this.portraitPickerView?.hide();
  }

  shiftPortraitSelection(delta) {
    if (!this.portraitPickerView?.canNavigate()) return;
    this.portraitSelectionIndex = (this.portraitSelectionIndex + delta + PLAYER_PORTRAITS.length) % PLAYER_PORTRAITS.length;
    this.refreshPortraitPicker(Math.sign(delta));
  }

  refreshPortraitPicker(direction = 0) {
    this.portraitPickerView?.update({
      portraits: PLAYER_PORTRAITS,
      selectedIndex: this.portraitSelectionIndex,
      direction,
    });
  }

  confirmPortraitSelection() {
    if (!this.portraitPickerView?.canNavigate()) return;
    const portrait = PLAYER_PORTRAITS[this.portraitSelectionIndex];
    const result = this.creationService.selectPortrait(portrait.id);
    if (!result.ok) return;
    this.refreshView();
    this.closePortraitPicker();
    this.showMessage(`已选择「${portrait.name}」，地图头像将同步更新。`);
  }

  updateNameDraft(value) {
    return this.creationService.setName(value);
  }

  commitNameInput(value) {
    const result = this.creationService.setName(value);
    if (!result.ok) {
      this.showMessage("道号不能为空。");
      this.refreshView();
      return result;
    }
    this.refreshView();
    this.showMessage("道号已更新。");
    return result;
  }

  cancelNameInput(value) {
    const result = this.creationService.setName(value);
    this.refreshView();
    return result;
  }

  setGender(gender) {
    const result = this.creationService.setGender(gender);
    if (!result.ok) return;
    this.portraitSelectionIndex = this.getCurrentPortraitIndex();
    this.refreshView();
  }

  changeRoot(element, delta) {
    const result = this.creationService.changeRoot(element, delta);
    if (!result.ok && result.reason === "no-points") {
      this.showMessage("灵根潜能已全部分配。");
      return;
    }
    if (!result.ok && result.reason === "minimum-root") {
      this.showMessage(`${element}灵根已是最低点数。`);
      return;
    }
    if (!result.ok) return;
    this.refreshView();
  }

  enterVillage() {
    const result = this.creationService.confirm();
    if (!result.ok) {
      const remaining = Math.max(0, result.remaining);
      this.showMessage(remaining > 0 ? `还需分配 ${remaining} 点灵根潜能。` : "灵根点数不符合创建规则。");
      return;
    }
    saveFirstChapterProgress();
    this.scene.start(SceneKeys.VILLAGE);
  }

  showMessage(message) {
    this.characterCreateView?.showMessage(message);
  }
}

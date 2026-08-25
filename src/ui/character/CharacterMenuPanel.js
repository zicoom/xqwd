import { gameState, saveFirstChapterProgress } from "../../core/GameState.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../../core/DisplayConfig.js";
import { ItemCatalog } from "../../domain/items/ItemCatalog.js";
import { InventoryService } from "../../domain/inventory/InventoryService.js";
import { TechniqueLoadoutService } from "../../domain/techniques/TechniqueLoadoutService.js";
import { SpellService } from "../../domain/spells/SpellService.js";
import { ArtifactLoadoutService } from "../../domain/artifacts/ArtifactLoadoutService.js";
import { CombatShortcutService } from "../../domain/combat/CombatShortcutService.js";
import { CharacterProfileService } from "../../domain/character/CharacterProfileService.js";
import { addText, playUiClickSound } from "../../utils/UiHelpers.js";
import { StorageBagPanel } from "../StorageBagPanel.js";
import { ArtifactPanel } from "../artifacts/ArtifactPanel.js";
import { TechniquePanel } from "../techniques/TechniquePanel.js";
import { SpellPanel } from "../spells/SpellPanel.js";
import { SavePanel } from "../save/SavePanel.js";
import { SocialPanel } from "../social/SocialPanel.js";
import { AttributePanel } from "./AttributePanel.js";

const AVAILABLE_TABS = Object.freeze(["属性", "储物袋", "法宝", "法术", "功法", "社交", "存档"]);
// 一级导航按固定 180px 单元格均分，文字、选中框与点击区共用同一套坐标，避免手写坐标造成间距不一。
const NAV_SLOT_WIDTH = 180;
const NAV_FIRST_CENTER_X = 320;
const NAV_LABELS = Object.freeze(["属性", "储物袋", "法宝", "法术", "功法", "社交", "存档"]);

/**
 * 角色菜单公共外壳。
 * 只拥有全屏生命周期、一级导航和子页调度，不实现背包、法宝或功法规则。
 */
export class CharacterMenuPanel {
  constructor(scene, services = {}) {
    this.scene = scene;
    this.catalog = services.catalog || scene.itemCatalog || new ItemCatalog();
    this.inventoryService = services.inventoryService || scene.inventoryService || new InventoryService({
      player: gameState.player,
      save: saveFirstChapterProgress,
    });
    this.techniqueService = services.techniqueService || scene.techniqueService || new TechniqueLoadoutService({
      player: gameState.player,
      catalog: this.catalog,
      save: saveFirstChapterProgress,
    });
    this.spellService = services.spellService || scene.spellService || new SpellService({
      player: gameState.player,
      catalog: this.catalog,
    });
    this.artifactService = services.artifactService || scene.artifactService || new ArtifactLoadoutService({
      player: gameState.player,
      catalog: this.catalog,
      save: saveFirstChapterProgress,
    });
    this.shortcutService = services.shortcutService || scene.shortcutService || new CombatShortcutService({
      player: gameState.player,
      catalog: this.catalog,
      spellService: this.spellService,
      save: saveFirstChapterProgress,
    });
    this.saveArchiveService = services.saveArchiveService || scene.saveArchiveService;
    this.profileService = services.profileService || new CharacterProfileService({
      player: gameState.player,
      catalog: this.catalog,
      spellService: this.spellService,
      techniqueService: this.techniqueService,
      artifactService: this.artifactService,
    });
    this.panel = null;
    this.activeTab = "储物袋";
    this.navEntries = [];
    this.navLabels = [];
  }

  get visible() { return Boolean(this.panel?.visible); }

  create() {
    const scene = this.scene;
    const panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(2050).setVisible(false);
    panel.setSize(SCREEN_WIDTH, SCREEN_HEIGHT).setInteractive({ useHandCursor: false });
    panel.add(scene.add.image(960, 540, "storage-background").setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT));

    const nav = scene.add.graphics();
    nav.fillStyle(0x071213, 0.3);
    nav.fillRect(0, 0, SCREEN_WIDTH, 145);
    nav.lineStyle(1, 0x39504a, 0.75);
    nav.lineBetween(0, 144, SCREEN_WIDTH, 144);
    panel.add(nav);

    this.navSelection = scene.add.graphics();
    panel.add(this.navSelection);
    this.navEntries = NAV_LABELS.map((label, index) => [label, NAV_FIRST_CENTER_X + index * NAV_SLOT_WIDTH]);
    this.navEntries.forEach(([label, x]) => {
      const textObject = addText(scene, x, 72, label, 30, "#aa9a65", { strokeThickness: 0 }).setOrigin(0.5);
      panel.add(textObject);
      this.navLabels.push({ label, x, textObject });
    });

    const close = scene.add.graphics();
    close.fillStyle(0x332d25, 1);
    close.fillRoundedRect(1769, 40, 64, 64, 8);
    close.lineStyle(1, 0xa99763, 1);
    close.strokeRoundedRect(1769, 40, 64, 64, 8);
    const closeLabel = addText(scene, 1801, 72, "×", 34, "#eadfbf", { strokeThickness: 0 }).setOrigin(0.5);
    panel.add([close, closeLabel]);

    this.panel = panel;
    this.attributePage = new AttributePanel({
      scene,
      parent: panel,
      profileService: this.profileService,
    });
    this.attributePage.create();
    this.storagePage = new StorageBagPanel(scene, {
      parent: panel,
      catalog: this.catalog,
      inventoryService: this.inventoryService,
    });
    this.storagePage.create();
    this.artifactPage = new ArtifactPanel({
      scene,
      parent: panel,
      artifactService: this.artifactService,
      showNotice: (message, color) => this.storagePage.showUseNotice(message, color),
    });
    this.techniquePage = new TechniquePanel({
      scene,
      parent: panel,
      catalog: this.catalog,
      techniqueService: this.techniqueService,
    });
    this.spellPage = new SpellPanel({
      scene,
      parent: panel,
      shortcutService: this.shortcutService,
      showNotice: (message, color) => this.storagePage.showUseNotice(message, color),
    });
    this.socialPage = new SocialPanel({ scene, parent: panel });
    this.socialPage.create();
    this.savePage = new SavePanel({
      scene,
      parent: panel,
      saveArchiveService: this.saveArchiveService,
      beforeSave: () => scene.rememberPlayerPosition(),
      onLoaded: () => scene.scene.restart(),
    });
    this.savePage.create();
  }

  setActiveTab(tab) {
    const nextTab = AVAILABLE_TABS.includes(tab) ? tab : "储物袋";
    this.activeTab = nextTab;
    const selectedEntry = this.navEntries.find(([label]) => label === nextTab) || this.navEntries[1];
    this.navSelection.clear();
    this.navSelection.fillStyle(0x3a3a29, 1);
    this.navSelection.fillRoundedRect(selectedEntry[1] - NAV_SLOT_WIDTH / 2, 34, NAV_SLOT_WIDTH, 76, 8);
    this.navSelection.lineStyle(1, 0xa99763, 1);
    this.navSelection.strokeRoundedRect(selectedEntry[1] - NAV_SLOT_WIDTH / 2, 34, NAV_SLOT_WIDTH, 76, 8);
    this.navLabels.forEach((entry) => entry.textObject.setColor(entry.label === nextTab ? "#f2e2b5" : "#aa9a65"));
    this.attributePage.setVisible(nextTab === "属性");
    this.storagePage.setVisible(nextTab === "储物袋");
    this.artifactPage.setVisible(nextTab === "法宝");
    this.spellPage.setVisible(nextTab === "法术");
    this.techniquePage.setVisible(nextTab === "功法");
    this.socialPage.setVisible(nextTab === "社交");
    this.savePage.setVisible(nextTab === "存档");
  }

  open(initialTab = "储物袋") {
    if (!this.panel) this.create();
    // 当角色菜单已打开时，地图 HUD 可能仍收到同一次点击。此时只能切页，
    // 绝不能再次把整页 alpha 设为 0；否则会短暂露出地图，形成明显闪屏。
    if (this.visible) {
      this.setActiveTab(initialTab);
      return;
    }
    this.storagePage.reset();
    this.scene.tweens.killTweensOf(this.panel);
    this.panel.setAlpha(0).setVisible(true);
    this.setActiveTab(initialTab);
    this.scene.tweens.add({ targets: this.panel, alpha: 1, duration: 180, ease: "Sine.Out" });
    playUiClickSound(this.scene);
  }

  close() {
    if (!this.visible) return;
    playUiClickSound(this.scene);
    this.storagePage.deactivate();
    this.scene.tweens.killTweensOf(this.panel);
    this.panel.setVisible(false);
  }

  pointerCandidates(pointer) {
    return [{ x: Number(pointer?.x) || 0, y: Number(pointer?.y) || 0 }];
  }

  handlePointer(pointer) {
    const points = this.pointerCandidates(pointer);
    const inArea = (predicate) => points.some(predicate);
    if (inArea(({ x, y }) => x >= 1769 && x <= 1833 && y >= 40 && y <= 104)) {
      this.close();
      return;
    }
    const navigation = this.navEntries.find(([name, centerX]) => (
      AVAILABLE_TABS.includes(name)
      && inArea(({ x, y }) => x >= centerX - NAV_SLOT_WIDTH / 2 && x <= centerX + NAV_SLOT_WIDTH / 2 && y >= 34 && y <= 110)
    ));
    if (navigation) {
      playUiClickSound(this.scene);
      this.setActiveTab(navigation[0]);
      return;
    }
    if (this.activeTab === "属性") return;
    if (this.activeTab === "社交") return;
    if (this.activeTab === "法宝") this.artifactPage.handlePointer(points, pointer);
    else if (this.activeTab === "法术") this.spellPage.handlePointer(points, pointer);
    else if (this.activeTab === "功法") this.techniquePage.handlePointer(points, pointer);
    else if (this.activeTab === "存档") this.savePage.handlePointer(points, pointer);
    else this.storagePage.handlePointer(pointer);
  }

  handlePointerMove(pointer) {
    if (this.activeTab === "储物袋") this.storagePage.handlePointerMove(pointer);
  }

  isGridPointer(pointer) {
    return this.activeTab === "储物袋" && this.storagePage.isGridPointer(pointer);
  }

  scroll(change) {
    if (this.activeTab === "储物袋") this.storagePage.scroll(change);
  }
}

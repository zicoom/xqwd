import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

/**
 * 角色菜单中的功法页。
 * 只负责功法槽与功法库的绘制和输入，配装规则全部交给 TechniqueLoadoutService。
 */
export class TechniquePanel {
  constructor({ scene, parent, catalog, techniqueService }) {
    this.scene = scene;
    this.parent = parent;
    this.catalog = catalog;
    this.techniqueService = techniqueService;
    this.selectedSlotId = "main";
    this.slotButtons = [];
    this.librarySlots = [];
    this.create();
  }

  create() {
    const { scene } = this;
    this.layer = scene.add.container(0, 0).setVisible(false);
    this.parent.add(this.layer);
    this.layer.add(scene.add.image(1374, 592, "artifact-frame").setDisplaySize(860, 638));

    const layout = [
      { id: "speed", label: "速度", x: 530, y: 325, hint: "战斗先手" },
      { id: "auxiliary-0", label: "辅修", x: 362, y: 489, hint: "辅助功法" },
      { id: "auxiliary-1", label: "辅修", x: 690, y: 489, hint: "辅助功法" },
      { id: "main", label: "主修", x: 530, y: 632, hint: "核心功法" },
      { id: "auxiliary-2", label: "辅修", x: 362, y: 775, hint: "辅助功法" },
      { id: "auxiliary-3", label: "辅修", x: 690, y: 775, hint: "辅助功法" },
    ];
    this.slotButtons = layout.map((entry) => this.createSlot(entry));

    this.gridLayer = scene.add.container(0, 0);
    this.layer.add(this.gridLayer);
    this.emptyText = addText(scene, 1435, 626, "背包中暂无功法", 21, "#a98c70", { strokeThickness: 0 }).setOrigin(0.5);
    this.capacityText = addText(scene, 1443, 881, "0 / 100", 20, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    const sortBackground = scene.add.graphics();
    sortBackground.fillStyle(0x5a3a20, 0.93);
    sortBackground.fillRoundedRect(1564, 854, 123, 52, 7);
    sortBackground.lineStyle(1, 0x976331, 0.9);
    sortBackground.strokeRoundedRect(1564, 854, 123, 52, 7);
    const sortText = addText(scene, 1625.5, 880, "整理", 20, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    this.hintText = addText(scene, 1375, 930, "先选择左侧功法位，再选择右侧功法即可装备。", 16, "#b99a72", { strokeThickness: 0 }).setOrigin(0.5);
    this.layer.add([this.emptyText, this.capacityText, sortBackground, sortText, this.hintText]);
  }

  createSlot(entry) {
    const holder = this.scene.add.graphics();
    const labelBackground = this.scene.add.image(entry.x, entry.y + 69, "artifact-category-label").setDisplaySize(90, 33);
    const label = addText(this.scene, entry.x, entry.y + 68, entry.label, 20, "#5e440d", { strokeThickness: 0 }).setOrigin(0.5);
    const iconLayer = this.scene.add.container(entry.x, entry.y);
    this.layer.add([holder, iconLayer, labelBackground, label]);
    return { ...entry, holder, labelBackground, labelObject: label, iconLayer };
  }

  setVisible(visible) {
    this.layer.setVisible(visible);
    if (visible) this.render();
  }

  render() {
    const owned = this.techniqueService.listOwned();
    const templates = new Map(this.catalog.all().filter((item) => item.type === "功法").map((item) => [item.id, item]));
    this.slotButtons.forEach((slot) => this.renderSlot(slot, templates.get(this.techniqueService.getEquippedId(slot.id))));
    this.renderLibrary(owned);
  }

  renderSlot(slot, technique) {
    const selected = slot.id === this.selectedSlotId;
    slot.holder.clear();
    slot.holder.fillStyle(selected ? 0x9d7a40 : 0x725a38, selected ? 1 : 0.92);
    slot.holder.fillRoundedRect(slot.x - 53, slot.y - 52, 106, 104, 9);
    slot.holder.fillStyle(0x5a452b, 0.95);
    slot.holder.fillCircle(slot.x, slot.y, 42);
    slot.holder.lineStyle(selected ? 2 : 1, selected ? 0xffe19a : 0xe4cc8a, selected ? 1 : 0.72);
    slot.holder.strokeRoundedRect(slot.x - 53, slot.y - 52, 106, 104, 9);
    slot.iconLayer.removeAll(true);
    if (technique) {
      slot.iconLayer.add(this.scene.add.image(0, -2, technique.texture).setDisplaySize(84, 84));
      slot.iconLayer.add(addText(this.scene, 0, 39, technique.name, 13, "#f6ddb1", { strokeThickness: 0 }).setOrigin(0.5));
    }
    slot.labelObject.setColor(slot.label === "主修" ? "#6b3b08" : "#5e440d");
  }

  renderLibrary(items) {
    this.gridLayer.removeAll(true);
    this.librarySlots = [];
    for (let index = 0; index < 10; index += 1) {
      const x = 1060 + (index % 5) * 129;
      const y = 334 + Math.floor(index / 5) * 130;
      const item = items[index];
      const cell = this.scene.add.graphics();
      cell.fillStyle(0x36261c, 0.94);
      cell.fillRoundedRect(x, y, 105, 104, 5);
      cell.lineStyle(1, 0x715033, 0.86);
      cell.strokeRoundedRect(x, y, 105, 104, 5);
      this.gridLayer.add(cell);
      if (!item) continue;
      const icon = this.scene.add.image(x + 52.5, y + 47, item.texture).setDisplaySize(78, 78);
      const name = addText(this.scene, x + 52.5, y + 88, item.name, 14, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      this.gridLayer.add([icon, name]);
      this.librarySlots.push({ item, x, y, width: 105, height: 104 });
    }
    this.emptyText.setVisible(items.length === 0);
    this.capacityText.setText(`${items.length} / 100`);
  }

  handlePointer(points, pointer) {
    const inArea = (predicate) => points.some(predicate);
    const slot = this.slotButtons.find((button) => inArea(({ x, y }) => (
      x >= button.x - 53 && x <= button.x + 53 && y >= button.y - 52 && y <= button.y + 87
    )));
    if (slot) {
      playUiClickSound(this.scene);
      if (this.isRightClick(pointer)) this.unequip(slot.id);
      else { this.selectedSlotId = slot.id; this.render(); }
      return true;
    }
    const libraryItem = this.librarySlots.find((entry) => inArea(({ x, y }) => (
      x >= entry.x && x <= entry.x + entry.width && y >= entry.y && y <= entry.y + entry.height
    )));
    if (libraryItem) {
      playUiClickSound(this.scene);
      this.equip(libraryItem.item);
      return true;
    }
    if (inArea(({ x, y }) => x >= 1564 && x <= 1687 && y >= 854 && y <= 906)) {
      playUiClickSound(this.scene);
      this.hintText.setText("功法库已按名称整理。").setColor("#e6c98c");
      return true;
    }
    return false;
  }

  equip(item) {
    const result = this.techniqueService.equip(this.selectedSlotId, item.id);
    if (!result.ok) this.hintText.setText(result.message).setColor("#e18f7d");
    else {
      const slot = this.slotButtons.find((entry) => entry.id === this.selectedSlotId);
      const suffix = slot?.label === "速度" ? "；速度位会参与战斗先手判定" : "";
      this.hintText.setText(`已装备「${item.name}」至${slot?.label || "功法"}位${suffix}`).setColor("#e8cb85");
    }
    this.render();
  }

  unequip(slotId) {
    const result = this.techniqueService.unequip(slotId);
    if (!result.ok) return;
    this.render();
    this.hintText.setText("已卸下功法。选择左侧功法位后，可重新装备。").setColor("#b99a72");
  }

  isRightClick(pointer) {
    return pointer?.button === 2 || pointer?.event?.button === 2 || pointer?.event?.which === 3
      || (typeof pointer?.rightButtonDown === "function" && pointer.rightButtonDown());
  }
}

import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

/**
 * 角色菜单中的法宝页。
 * 只负责六类法宝槽与法宝库的绘制和输入，配装规则全部交给 ArtifactLoadoutService。
 */
export class ArtifactPanel {
  constructor({ scene, parent, artifactService, showNotice = () => {} }) {
    this.scene = scene;
    this.artifactService = artifactService;
    this.showNotice = showNotice;
    this.category = "攻击";
    this.categoryButtons = [];
    this.itemSlots = [];
    this.layer = scene.add.container(0, 0).setVisible(false);
    parent.add(this.layer);
    this.create();
  }

  create() {
    const { scene, layer } = this;
    layer.add(scene.add.image(1374, 592, "artifact-frame").setDisplaySize(860, 638));
    const layout = [
      { name: "御剑", x: 530, y: 325 }, { name: "防御", x: 362, y: 489 },
      { name: "属性", x: 690, y: 489 }, { name: "攻击", x: 530, y: 632 },
      { name: "辅助", x: 362, y: 775 }, { name: "抗性", x: 690, y: 775 },
    ];
    this.categoryButtons = layout.map((entry) => this.createCategory(entry));
    this.gridLayer = scene.add.container(0, 0);
    layer.add(this.gridLayer);
    this.emptyText = addText(scene, 1435, 626, "暂无该类法宝", 21, "#a98c70", { strokeThickness: 0 })
      .setOrigin(0.5)
      .setVisible(false);
    this.capacityText = addText(scene, 1443, 881, "0 / 100", 20, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    const sortText = addText(scene, 1625.5, 880, "整理", 20, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    this.noticeText = addText(scene, 1375, 930, "选择左侧法宝位，再选择右侧法宝即可装备；右键槽位卸下。", 16, "#b99a72", { strokeThickness: 0 }).setOrigin(0.5);
    layer.add([this.emptyText, this.capacityText, sortText, this.noticeText]);
  }

  createCategory(entry) {
    const holder = this.scene.add.graphics();
    const iconLayer = this.scene.add.container(entry.x, entry.y);
    const label = this.scene.add.image(entry.x, entry.y + 69, "artifact-category-label").setDisplaySize(90, 33);
    const text = addText(this.scene, entry.x, entry.y + 68, entry.name, 20, "#5e440d", { strokeThickness: 0 }).setOrigin(0.5);
    this.layer.add([holder, iconLayer, label, text]);
    return { ...entry, holder, iconLayer, label, text };
  }

  setVisible(visible) {
    this.layer.setVisible(visible);
    if (visible) this.render();
  }

  render() {
    const items = this.artifactService.listOwned(this.category);
    this.renderGrid(items);
    this.renderCategories();
  }

  renderGrid(items) {
    this.gridLayer.removeAll(true);
    this.itemSlots = [];
    for (let index = 0; index < 10; index += 1) {
      const x = 1060 + (index % 5) * 129;
      const y = 334 + Math.floor(index / 5) * 130;
      const item = items[index];
      const slot = this.scene.add.graphics();
      slot.fillStyle(0x36261c, 0.94);
      slot.fillRoundedRect(x, y, 105, 104, 5);
      slot.lineStyle(1, 0x715033, 0.86);
      slot.strokeRoundedRect(x, y, 105, 104, 5);
      this.gridLayer.add(slot);
      if (!item) continue;
      const icon = this.createArtifactIcon(item, x + 52.5, y + 47, 78);
      const name = addText(this.scene, x + 52.5, y + 88, item.name, 14, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      const amount = addText(this.scene, x + 96, y + 10, String(item.quantity), 15, "#ffe0a0", { strokeThickness: 0 }).setOrigin(1, 0.5);
      this.gridLayer.add([icon, name, amount]);
      this.itemSlots.push({ item, x, y, width: 105, height: 104 });
    }
    this.emptyText.setVisible(items.length === 0);
    this.capacityText.setText(`${items.length} / 100`);
  }

  renderCategories() {
    this.categoryButtons.forEach((button) => {
      const selected = button.name === this.category;
      const equipped = this.artifactService.getEquipped(button.name);
      button.holder.clear();
      button.holder.fillStyle(selected ? 0x9d7a40 : 0x725a38, selected ? 1 : 0.92);
      button.holder.fillRoundedRect(button.x - 53, button.y - 52, 106, 104, 9);
      button.holder.fillStyle(selected ? 0x655025 : 0x5a452b, 0.96);
      button.holder.fillCircle(button.x, button.y, 42);
      button.holder.lineStyle(1, selected ? 0xffe19a : 0xe4cc8a, selected ? 1 : 0.72);
      button.holder.strokeRoundedRect(button.x - 53, button.y - 52, 106, 104, 9);
      button.text.setColor(selected ? "#4e310a" : "#5e440d");
      button.iconLayer.removeAll(true);
      if (equipped) {
        button.iconLayer.add(this.createArtifactIcon(equipped, 0, -2, 76));
        button.iconLayer.add(addText(this.scene, 0, 37, equipped.name, 12, "#f6ddb1", { strokeThickness: 0 }).setOrigin(0.5));
      }
    });
  }

  createArtifactIcon(item, x, y, size) {
    if (item.texture && this.scene.textures.exists(item.texture)) {
      return this.scene.add.image(x, y, item.texture).setDisplaySize(size, size);
    }
    const holder = this.scene.add.container(x, y);
    const circle = this.scene.add.graphics();
    circle.fillStyle(0x8a6b3e, 0.96);
    circle.fillCircle(0, 0, size / 2);
    const label = addText(this.scene, 0, 0, item.name.slice(0, 1), Math.max(20, Math.round(size * 0.42)), "#fff0be", { strokeThickness: 1 }).setOrigin(0.5);
    holder.add([circle, label]);
    return holder;
  }

  handlePointer(points, pointer) {
    const inArea = (predicate) => points.some(predicate);
    const category = this.categoryButtons.find((button) => inArea(({ x, y }) => (
      x >= button.x - 53 && x <= button.x + 53 && y >= button.y - 52 && y <= button.y + 87
    )));
    if (category) {
      playUiClickSound(this.scene);
      if (this.isRightClick(pointer)) {
        const result = this.artifactService.unequip(category.name);
        if (result.ok) this.notify(`已卸下${category.name}位法宝`, "#e6c98c");
      } else this.category = category.name;
      this.render();
      return true;
    }
    const itemSlot = this.itemSlots.find((entry) => inArea(({ x, y }) => (
      x >= entry.x && x <= entry.x + entry.width && y >= entry.y && y <= entry.y + entry.height
    )));
    if (itemSlot) {
      playUiClickSound(this.scene);
      const result = this.artifactService.equip(this.category, itemSlot.item.id);
      this.notify(result.ok ? `已装备「${itemSlot.item.name}」至${this.category}位` : result.message, result.ok ? "#e6c98c" : "#e18f7d");
      this.render();
      return true;
    }
    if (inArea(({ x, y }) => x >= 1564 && x <= 1687 && y >= 854 && y <= 906)) {
      playUiClickSound(this.scene);
      this.notify("法宝已按名称整理", "#e6c98c");
      return true;
    }
    return false;
  }

  isRightClick(pointer) {
    return pointer?.button === 2 || pointer?.event?.button === 2 || pointer?.event?.which === 3
      || (typeof pointer?.rightButtonDown === "function" && pointer.rightButtonDown());
  }

  notify(message, color) {
    this.noticeText?.setText(message).setColor(color);
    this.showNotice(message, color);
  }
}

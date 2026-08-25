import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const ELEMENT_COLORS = Object.freeze({
  金: 0xd6c27a, 木: 0x63a56c, 水: 0x619cc8, 火: 0xc85e42, 土: 0xaa824e, 无: 0x77716a,
});

/**
 * 角色菜单中的法术页。
 * 只展示 SpellService 返回的可用法术，不读取功法槽位或直接修改角色存档。
 */
export class SpellPanel {
  constructor({ scene, parent, spellService }) {
    this.scene = scene;
    this.spellService = spellService;
    this.selectedSpellId = null;
    this.spellSlots = [];
    this.create(parent);
  }

  create(parent) {
    const { scene } = this;
    this.layer = scene.add.container(0, 0).setVisible(false);
    parent.add(this.layer);
    this.layer.add(scene.add.image(1374, 592, "artifact-frame").setDisplaySize(860, 638));

    const detailCard = scene.add.graphics();
    detailCard.fillStyle(0x292116, 0.9);
    detailCard.fillRoundedRect(238, 244, 580, 650, 18);
    detailCard.lineStyle(1, 0x9d7a40, 0.82);
    detailCard.strokeRoundedRect(238, 244, 580, 650, 18);
    this.layer.add(detailCard);

    this.detailLayer = scene.add.container(0, 0);
    this.gridLayer = scene.add.container(0, 0);
    this.layer.add([this.detailLayer, this.gridLayer]);
    this.emptyText = addText(scene, 1435, 626, "尚未掌握可用法术", 21, "#a98c70", { strokeThickness: 0 })
      .setOrigin(0.5)
      .setVisible(false);
    this.countText = addText(scene, 1443, 881, "0 / 100", 20, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    this.hintText = addText(scene, 1375, 930, "选择法术查看来源与说明。", 16, "#b99a72", { strokeThickness: 0 }).setOrigin(0.5);
    this.layer.add([this.emptyText, this.countText, this.hintText]);
  }

  setVisible(visible) {
    this.layer.setVisible(visible);
    if (visible) this.render();
  }

  render() {
    const spells = this.spellService.listAvailable();
    if (!spells.some((spell) => spell.id === this.selectedSpellId)) this.selectedSpellId = spells[0]?.id || null;
    this.renderGrid(spells);
    this.renderDetail(spells.find((spell) => spell.id === this.selectedSpellId));
    this.emptyText.setVisible(spells.length === 0);
    this.countText.setText(`${spells.length} / 100`);
  }

  renderGrid(spells) {
    const { scene } = this;
    this.gridLayer.removeAll(true);
    this.spellSlots = [];
    for (let index = 0; index < 10; index += 1) {
      const x = 1060 + (index % 5) * 129;
      const y = 334 + Math.floor(index / 5) * 130;
      const spell = spells[index];
      const selected = spell?.id === this.selectedSpellId;
      const cell = scene.add.graphics();
      cell.fillStyle(selected ? 0x684827 : 0x36261c, 0.96);
      cell.fillRoundedRect(x, y, 105, 104, 5);
      cell.lineStyle(selected ? 2 : 1, selected ? 0xe0b45d : 0x715033, selected ? 1 : 0.86);
      cell.strokeRoundedRect(x, y, 105, 104, 5);
      this.gridLayer.add(cell);
      if (!spell) continue;
      this.drawSpellIcon(this.gridLayer, spell, x + 52.5, y + 44, 68);
      const name = addText(scene, x + 52.5, y + 88, spell.name, 14, selected ? "#ffe19a" : "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
      this.gridLayer.add(name);
      this.spellSlots.push({ spell, x, y, width: 105, height: 104 });
    }
  }

  renderDetail(spell) {
    const { scene } = this;
    this.detailLayer.removeAll(true);
    if (!spell) return;
    const element = String(spell.element || "无");
    const title = addText(scene, 528, 320, spell.name, 32, "#f2d384", { strokeThickness: 1 }).setOrigin(0.5);
    const iconHolder = scene.add.container(528, 440);
    this.drawSpellIcon(iconHolder, spell, 0, 0, 126);
    const elementText = addText(scene, 528, 535, `${element}系法术`, 21, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    const source = addText(scene, 300, 600, `来源：${spell.source || "未知"}`, 19, "#c9b088", { strokeThickness: 0 });
    const grade = addText(scene, 756, 600, `品阶：${spell.grade || "未定"}`, 19, "#c9b088", { strokeThickness: 0 }).setOrigin(1, 0);
    const description = addText(scene, 300, 662, spell.description || "暂无法术说明。", 19, "#b8aa98", {
      strokeThickness: 0,
      wordWrap: { width: 456 },
      lineSpacing: 10,
    });
    const innateHint = addText(scene, 528, 820, spell.innate ? "先天法术随主灵根而生" : "由已掌握或已装备的法术功法提供", 16, "#9f8c73", { strokeThickness: 0 }).setOrigin(0.5);
    this.detailLayer.add([title, iconHolder, elementText, source, grade, description, innateHint]);
  }

  drawSpellIcon(parent, spell, x, y, size) {
    const { scene } = this;
    if (spell.texture && scene.textures.exists(spell.texture)) {
      parent.add(scene.add.image(x, y, spell.texture).setDisplaySize(size, size));
      return;
    }
    const element = String(spell.element || "无");
    const icon = scene.add.graphics();
    icon.fillStyle(ELEMENT_COLORS[element] || ELEMENT_COLORS.无, 0.94);
    icon.fillCircle(x, y, size / 2);
    icon.lineStyle(2, 0xf3dda5, 0.75);
    icon.strokeCircle(x, y, size / 2);
    const label = addText(scene, x, y, element, Math.max(22, Math.round(size * 0.42)), "#fff4d3", { strokeThickness: 1 }).setOrigin(0.5);
    parent.add([icon, label]);
  }

  handlePointer(points) {
    const spellSlot = this.spellSlots.find((entry) => points.some(({ x, y }) => (
      x >= entry.x && x <= entry.x + entry.width && y >= entry.y && y <= entry.y + entry.height
    )));
    if (!spellSlot) return false;
    playUiClickSound(this.scene);
    this.selectedSpellId = spellSlot.spell.id;
    this.hintText.setText(`已选择「${spellSlot.spell.name}」。`).setColor("#e8cb85");
    this.render();
    return true;
  }
}

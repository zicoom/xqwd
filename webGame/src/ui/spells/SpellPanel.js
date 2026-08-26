import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const ELEMENT_COLORS = Object.freeze({
  金: 0xd6c27a, 木: 0x63a56c, 水: 0x619cc8, 火: 0xc85e42, 土: 0xaa824e, 无: 0x77716a,
});

// 左侧快捷栏原先比右侧 860×638 木质法术框的视觉中心高约 40 像素。
// 将左侧所有内容统一使用同一个偏移量，既能保持标题、键位和提示之间的原有间距，
// 也能确保本次调整完全不触碰右侧法术框、候选格子和底部计数栏的坐标。
const QUICK_PANEL_OFFSET_Y = 100;

const QUICK_SLOT_LAYOUT = Object.freeze(Array.from({ length: 10 }, (_, index) => ({
  x: 95 + (index % 5) * 170,
  y: 318 + QUICK_PANEL_OFFSET_Y + Math.floor(index / 5) * 235,
})));

/**
 * 角色菜单中的法术页。
 *
 * 左侧是战斗快捷栏：十个位置严格对应键盘 1～9、0；右侧是当前可装备的
 * 普通行动、法术和丹药。页面只负责绘制与输入，配装、去重和存档由
 * CombatShortcutService 统一处理。
 */
export class SpellPanel {
  constructor({ scene, parent, shortcutService, showNotice = () => {} }) {
    this.scene = scene;
    this.shortcutService = shortcutService;
    this.showNotice = showNotice;
    this.selectedCandidateKey = null;
    this.quickSlots = [];
    this.candidateSlots = [];
    this.create(parent);
  }

  create(parent) {
    const { scene } = this;
    this.layer = scene.add.container(0, 0).setVisible(false);
    parent.add(this.layer);

    // 右侧沿用法宝/功法共用的 860×638 原尺寸木质框，保证系列页面一致。
    this.layer.add(scene.add.image(1374, 592, "artifact-frame").setDisplaySize(860, 638));

    this.quickLayer = scene.add.container(0, 0);
    this.candidateLayer = scene.add.container(0, 0);
    this.layer.add([this.quickLayer, this.candidateLayer]);

    this.quickTitle = addText(scene, 480, 232 + QUICK_PANEL_OFFSET_Y, "战斗快捷栏", 28, "#ead69c", { strokeThickness: 0 }).setOrigin(0.5);
    this.quickSubtitle = addText(scene, 480, 270 + QUICK_PANEL_OFFSET_Y, "键盘 1—9、0 · 法术与丹药可自由配装", 17, "#C2BA9F", { strokeThickness: 0 }).setOrigin(0.5);
    this.emptyText = addText(scene, 1435, 626, "暂无可装备内容", 21, "#a98c70", { strokeThickness: 0 })
      .setOrigin(0.5)
      .setVisible(false);
    this.countText = addText(scene, 1443, 881, "0 / 100", 20, "#d7be90", { strokeThickness: 0 }).setOrigin(0.5);
    this.sortText = addText(scene, 1625.5, 880, "整理", 20, "#f2d1ab", { strokeThickness: 0 }).setOrigin(0.5);
    this.hintText = addText(scene, 480, 770 + QUICK_PANEL_OFFSET_Y, "先选右侧内容，再点左侧键位装备；右键键位可卸下。", 17, "#69533a", {
      strokeThickness: 0,
      wordWrap: { width: 760 },
      align: "center",
    }).setOrigin(0.5);
    this.selectionText = addText(scene, 480, 800 + QUICK_PANEL_OFFSET_Y, "当前未选择待装备内容", 19, "#75551e", { strokeThickness: 0 }).setOrigin(0.5);
    this.layer.add([
      this.quickTitle, this.quickSubtitle, this.emptyText, this.countText,
      this.sortText, this.hintText, this.selectionText,
    ]);
  }

  setVisible(visible) {
    this.layer.setVisible(visible);
    if (visible) this.render();
  }

  render() {
    const candidates = this.shortcutService.listCandidates();
    if (!candidates.some((candidate) => candidate.key === this.selectedCandidateKey)) this.selectedCandidateKey = null;
    this.renderQuickSlots(this.shortcutService.getSlots());
    this.renderCandidates(candidates);
    this.emptyText.setVisible(candidates.length === 0);
    this.countText.setText(`${candidates.length} / 100`);
    const selected = candidates.find((candidate) => candidate.key === this.selectedCandidateKey);
    this.selectionText.setText(selected ? `待装备：${selected.name}` : "当前未选择待装备内容");
  }

  renderQuickSlots(slots) {
    this.quickLayer.removeAll(true);
    this.quickSlots = [];
    slots.forEach((slot, index) => {
      const layout = QUICK_SLOT_LAYOUT[index];
      const x = layout.x;
      const y = layout.y;
      const frame = this.scene.add.graphics();
      frame.fillStyle(slot.candidate ? 0x765b35 : 0x665036, 0.92);
      frame.fillRoundedRect(x, y, 105, 105, 8);
      frame.fillStyle(0x594328, 0.92);
      frame.fillCircle(x + 52.5, y + 52.5, 42);
      frame.lineStyle(1, slot.candidate ? 0xe8ca7d : 0xc8b276, 0.9);
      frame.strokeRoundedRect(x, y, 105, 105, 8);

      // 用户提供的 130×33 原图专门作为快捷栏文字底签，不缩放、不裁切。
      const label = this.scene.add.image(x + 52.5, y + 125, "combat-shortcut-label");
      const name = addText(this.scene, x + 52.5, y + 125, slot.candidate?.name || "装备", 16, "#614713", {
        strokeThickness: 0,
      }).setOrigin(0.5);
      const keyBadge = this.scene.add.graphics();
      keyBadge.fillStyle(0x25251f, 0.96);
      keyBadge.fillRoundedRect(x + 4, y + 4, 26, 26, 4);
      const keyText = addText(this.scene, x + 17, y + 17, slot.key, 16, "#c5c5c5", { strokeThickness: 0 }).setOrigin(0.5);
      this.quickLayer.add([frame, label, name, keyBadge, keyText]);
      if (slot.candidate) this.drawCandidateIcon(this.quickLayer, slot.candidate, x + 52.5, y + 51, 78);
      this.quickSlots.push({ ...slot, x, y, width: 105, height: 138 });
    });
  }

  renderCandidates(candidates) {
    this.candidateLayer.removeAll(true);
    this.candidateSlots = [];
    for (let index = 0; index < 10; index += 1) {
      const x = 1060 + (index % 5) * 129;
      const y = 334 + Math.floor(index / 5) * 130;
      const candidate = candidates[index];
      const selected = candidate?.key === this.selectedCandidateKey;
      const cell = this.scene.add.graphics();
      cell.fillStyle(selected ? 0x684827 : 0x36261c, 0.96);
      cell.fillRoundedRect(x, y, 105, 104, 5);
      cell.lineStyle(selected ? 2 : 1, selected ? 0xe0b45d : 0x715033, selected ? 1 : 0.86);
      cell.strokeRoundedRect(x, y, 105, 104, 5);
      this.candidateLayer.add(cell);
      if (!candidate) continue;
      this.drawCandidateIcon(this.candidateLayer, candidate, x + 52.5, y + 43, 66);
      const name = addText(this.scene, x + 52.5, y + 88, candidate.name, 14, selected ? "#ffe19a" : "#f2d1ab", {
        strokeThickness: 0,
      }).setOrigin(0.5);
      this.candidateLayer.add(name);
      if (candidate.kind === "item") {
        const amount = addText(this.scene, x + 96, y + 10, String(candidate.quantity), 14, "#ffe0a0", { strokeThickness: 0 }).setOrigin(1, 0.5);
        this.candidateLayer.add(amount);
      }
      this.candidateSlots.push({ candidate, x, y, width: 105, height: 104 });
    }
  }

  drawCandidateIcon(parent, candidate, x, y, size) {
    if (candidate.texture && this.scene.textures.exists(candidate.texture)) {
      parent.add(this.scene.add.image(x, y, candidate.texture).setDisplaySize(size, size));
      return;
    }
    const icon = this.scene.add.graphics();
    const isAction = candidate.kind === "action";
    const isItem = candidate.kind === "item";
    const color = isAction
      ? (candidate.id === "defend" ? 0x687d7d : 0x8b5b42)
      : isItem ? 0x876339 : (ELEMENT_COLORS[String(candidate.element || "无")] || ELEMENT_COLORS.无);
    icon.fillStyle(color, 0.96);
    icon.fillCircle(x, y, size / 2);
    icon.lineStyle(2, 0xf3dda5, 0.72);
    icon.strokeCircle(x, y, size / 2);
    const symbol = isAction ? (candidate.id === "defend" ? "守" : "攻") : isItem ? "丹" : String(candidate.element || "术");
    const label = addText(this.scene, x, y, symbol, Math.max(20, Math.round(size * 0.4)), "#fff4d3", { strokeThickness: 1 }).setOrigin(0.5);
    parent.add([icon, label]);
  }

  handlePointer(points, pointer) {
    const inArea = (predicate) => points.some(predicate);
    const quickSlot = this.quickSlots.find((entry) => inArea(({ x, y }) => (
      x >= entry.x && x <= entry.x + entry.width && y >= entry.y && y <= entry.y + entry.height
    )));
    if (quickSlot) {
      playUiClickSound(this.scene);
      const result = this.isRightClick(pointer)
        ? this.shortcutService.unequip(quickSlot.index)
        : this.selectedCandidateKey
          ? this.shortcutService.assign(quickSlot.index, this.selectedCandidateKey)
          : { ok: false, message: "请先在右侧选择要装备的法术或丹药" };
      this.notify(result.message, result.ok ? "#e8cb85" : "#d98c79");
      if (result.ok) this.selectedCandidateKey = null;
      this.render();
      return true;
    }

    const candidateSlot = this.candidateSlots.find((entry) => inArea(({ x, y }) => (
      x >= entry.x && x <= entry.x + entry.width && y >= entry.y && y <= entry.y + entry.height
    )));
    if (candidateSlot) {
      playUiClickSound(this.scene);
      this.selectedCandidateKey = candidateSlot.candidate.key;
      this.notify(`已选择「${candidateSlot.candidate.name}」，请点击左侧 1—0 键位`, "#e8cb85");
      this.render();
      return true;
    }

    if (inArea(({ x, y }) => x >= 1564 && x <= 1687 && y >= 854 && y <= 906)) {
      playUiClickSound(this.scene);
      this.selectedCandidateKey = null;
      this.notify("已取消当前选择", "#e8cb85");
      this.render();
      return true;
    }
    return false;
  }

  isRightClick(pointer) {
    return pointer?.button === 2 || pointer?.event?.button === 2 || pointer?.event?.which === 3
      || (typeof pointer?.rightButtonDown === "function" && pointer.rightButtonDown());
  }

  notify(message, color) {
    this.hintText.setText(message).setColor(color);
    this.showNotice(message, color);
  }
}

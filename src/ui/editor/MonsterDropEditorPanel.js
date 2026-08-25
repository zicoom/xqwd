import { addButton, addText } from "../../utils/UiHelpers.js";

const OPTION_PAGE_SIZE = 8;
const DROP_PAGE_SIZE = 7;

/** 怪物掉落编辑弹窗；只处理选择、数量和页面交互，不读取存档或解释奖励规则。 */
export class MonsterDropEditorPanel {
  constructor({ scene, rewardCatalog }) {
    this.scene = scene;
    this.rewardCatalog = rewardCatalog;
    this.panel = null;
  }

  get visible() { return Boolean(this.panel?.visible); }

  ensureCreated() {
    if (this.panel) return;
    const scene = this.scene;
    this.panel = scene.add.container(0, 0).setDepth(3000).setVisible(false);
    const shade = scene.add.rectangle(0, 0, 1920, 1080, 0x050914, 0.78).setOrigin(0).setInteractive();
    const card = scene.add.rectangle(960, 540, 1580, 900, 0x17223a, 1).setStrokeStyle(4, 0xc49a51);
    const divider = scene.add.rectangle(960, 540, 2, 700, 0x506b9d, 0.8);
    const title = addText(scene, 960, 125, "怪物掉落配置", 38, "#ffe4a1", { origin: 0.5 });
    const subtitle = addText(scene, 960, 174, "从统一目录选择奖励；旧版未登记文本可保留或删除，但不能新增", 18, "#b9cde0", { origin: 0.5 });
    const leftTitle = addText(scene, 545, 215, "可选奖励", 25, "#f5d38a", { origin: 0.5 });
    const rightTitle = addText(scene, 1370, 215, "当前掉落", 25, "#f5d38a", { origin: 0.5 });
    this.panel.add([shade, card, divider, title, subtitle, leftTitle, rightTitle]);

    this.optionsLayer = scene.add.container(0, 0);
    this.dropsLayer = scene.add.container(0, 0);
    this.panel.add([this.optionsLayer, this.dropsLayer]);

    this.selectedText = addText(scene, 535, 835, "尚未选择奖励", 18, "#dfe8f2", { origin: 0.5, wordWrap: { width: 560 } });
    this.quantityText = addText(scene, 535, 887, "数量：1", 20, "#ffe4a1", { origin: 0.5 });
    this.noticeText = addText(scene, 1370, 835, "", 17, "#e9b979", { origin: 0.5, wordWrap: { width: 650 }, align: "center" });
    this.panel.add([this.selectedText, this.quantityText, this.noticeText]);

    [
      addButton(scene, 350, 887, 70, "−", () => this.changePendingQuantity(-1), { height: 42, size: 25 }),
      addButton(scene, 720, 887, 70, "+", () => this.changePendingQuantity(1), { height: 42, size: 25 }),
      addButton(scene, 535, 945, 240, "加入当前掉落", () => this.addSelected(), { height: 48, size: 18 }),
      addButton(scene, 1270, 945, 190, "取消", () => this.close(), { height: 48, size: 18 }),
      addButton(scene, 1480, 945, 190, "应用掉落", () => this.apply(), { height: 48, size: 18 }),
      addButton(scene, 1700, 120, 58, "×", () => this.close(), { height: 48, size: 28 }),
    ].forEach((button) => this.panel.add(button));
  }

  open({ drops = [], onApply = () => {} } = {}) {
    this.ensureCreated();
    this.options = this.rewardCatalog.all();
    this.draft = this.rewardCatalog.parseDrops(drops);
    this.onApply = onApply;
    this.optionPage = 0;
    this.dropPage = 0;
    this.pendingQuantity = 1;
    this.selectedRewardId = this.options[0]?.id || null;
    this.noticeText.setText("");
    this.panel.setVisible(true);
    this.render();
    this.escHandler = () => this.close();
    this.scene.input.keyboard?.on("keydown-ESC", this.escHandler);
  }

  close() {
    if (!this.panel) return;
    this.panel.setVisible(false);
    if (this.escHandler) this.scene.input.keyboard?.off("keydown-ESC", this.escHandler);
    this.escHandler = null;
  }

  render() {
    this.renderOptions();
    this.renderDrops();
    const selected = this.options.find((reward) => reward.id === this.selectedRewardId);
    this.selectedText.setText(selected ? `已选：${selected.name}（${selected.typeLabel}）` : "尚未选择奖励");
    this.quantityText.setText(`数量：${this.pendingQuantity}`);
  }

  renderOptions() {
    this.optionsLayer.removeAll(true);
    const pageCount = Math.max(1, Math.ceil(this.options.length / OPTION_PAGE_SIZE));
    this.optionPage = Math.max(0, Math.min(this.optionPage, pageCount - 1));
    this.options.slice(this.optionPage * OPTION_PAGE_SIZE, (this.optionPage + 1) * OPTION_PAGE_SIZE)
      .forEach((reward, index) => {
        const y = 270 + index * 66;
        const selected = reward.id === this.selectedRewardId;
        const card = this.scene.add.rectangle(545, y, 680, 54, selected ? 0x4e644d : 0x202d46, 1)
          .setStrokeStyle(2, selected ? 0xe6bb69 : 0x486081)
          .setInteractive({ useHandCursor: true });
        const name = addText(this.scene, 225, y - 13, reward.name, 18, selected ? "#ffe6a7" : "#f2f5fc");
        const type = addText(this.scene, 225, y + 11, reward.typeLabel, 13, "#aebfd3");
        card.on("pointerdown", () => { this.selectedRewardId = reward.id; this.render(); });
        this.optionsLayer.add([card, name, type]);
      });
    this.addLayerButton(this.optionsLayer, 360, 790, 110, "上一页", () => { this.optionPage -= 1; this.renderOptions(); });
    this.addLayerButton(this.optionsLayer, 730, 790, 110, "下一页", () => { this.optionPage += 1; this.renderOptions(); });
    this.optionsLayer.add(addText(this.scene, 545, 790, `${this.optionPage + 1} / ${pageCount}`, 17, "#c9d5e5", { origin: 0.5 }));
  }

  renderDrops() {
    this.dropsLayer.removeAll(true);
    const pageCount = Math.max(1, Math.ceil(this.draft.length / DROP_PAGE_SIZE));
    this.dropPage = Math.max(0, Math.min(this.dropPage, pageCount - 1));
    this.draft.slice(this.dropPage * DROP_PAGE_SIZE, (this.dropPage + 1) * DROP_PAGE_SIZE)
      .forEach((entry, localIndex) => {
        const index = this.dropPage * DROP_PAGE_SIZE + localIndex;
        const y = 275 + localIndex * 72;
        const card = this.scene.add.rectangle(1370, y, 690, 58, entry.resolved ? 0x202d46 : 0x4b2830, 1)
          .setStrokeStyle(2, entry.resolved ? 0x486081 : 0xb45b62);
        const label = addText(this.scene, 1045, y - 12, `${entry.name} × ${entry.quantity}`, 18, entry.resolved ? "#f2f5fc" : "#ffc2c2");
        const type = addText(this.scene, 1045, y + 13, entry.typeLabel, 13, entry.resolved ? "#aebfd3" : "#e59a9a");
        this.dropsLayer.add([card, label, type]);
        this.addLayerButton(this.dropsLayer, 1510, y, 48, "−", () => this.changeDraft(index, -1));
        this.addLayerButton(this.dropsLayer, 1570, y, 48, "+", () => this.changeDraft(index, 1));
        this.addLayerButton(this.dropsLayer, 1650, y, 80, "删除", () => this.removeDraft(index));
      });
    if (!this.draft.length) {
      this.dropsLayer.add(addText(this.scene, 1370, 430, "暂无掉落", 24, "#8190a5", { origin: 0.5 }));
    }
    this.addLayerButton(this.dropsLayer, 1185, 790, 110, "上一页", () => { this.dropPage -= 1; this.renderDrops(); });
    this.addLayerButton(this.dropsLayer, 1555, 790, 110, "下一页", () => { this.dropPage += 1; this.renderDrops(); });
    this.dropsLayer.add(addText(this.scene, 1370, 790, `${this.dropPage + 1} / ${pageCount}`, 17, "#c9d5e5", { origin: 0.5 }));
  }

  addLayerButton(layer, x, y, width, label, callback) {
    const button = addButton(this.scene, x, y, width, label, callback, { height: 38, size: 15 });
    layer.add(button);
    return button;
  }

  changePendingQuantity(delta) {
    this.pendingQuantity = Math.max(1, Math.min(999999, this.pendingQuantity + delta));
    this.render();
  }

  addSelected() {
    const reward = this.options.find((option) => option.id === this.selectedRewardId);
    if (!reward) return;
    const existing = this.draft.find((entry) => entry.id === reward.id);
    if (existing) existing.quantity = Math.min(999999, existing.quantity + this.pendingQuantity);
    else this.draft.push({ ...reward, quantity: this.pendingQuantity, resolved: true });
    this.dropPage = Math.floor((this.draft.length - 1) / DROP_PAGE_SIZE);
    this.noticeText.setText(`已加入 ${reward.name} × ${this.pendingQuantity}`);
    this.render();
  }

  changeDraft(index, delta) {
    const entry = this.draft[index];
    if (!entry) return;
    entry.quantity = Math.max(1, Math.min(999999, entry.quantity + delta));
    this.renderDrops();
  }

  removeDraft(index) {
    this.draft.splice(index, 1);
    this.renderDrops();
  }

  apply() {
    const drops = this.rewardCatalog.serializeDrops(this.draft);
    this.onApply(drops);
    this.close();
  }
}

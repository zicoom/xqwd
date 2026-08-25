import { addText, playUiClickSound } from "../../utils/UiHelpers.js";

const OPTION_PAGE_SIZE = 6;
const DROP_PAGE_SIZE = 6;

/**
 * 怪物掉落编辑器。
 *
 * 这是独立的复杂编辑面板：只负责目录选择、数量调整、分页和结果回传；奖励解析、
 * 去重和旧数据兼容仍由 RewardCatalog 负责，避免 UI 层承担任何掉落规则。
 */
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
    const shade = scene.add.rectangle(960, 540, 1920, 1080, 0x080907, 0.78).setInteractive();
    const shadow = scene.add.rectangle(970, 552, 1420, 820, 0x050403, 0.5);
    const frame = scene.add.graphics();
    this.drawFrame(frame, 250, 130, 1420, 820);
    const title = this.centerText(960, 183, "怪物掉落配置", 38, "#f5d27a", 720);
    const subtitle = this.centerText(960, 224, "从奖励目录选择掉落；数量会自动合并，同名旧数据可保留或删除。", 17, "#c9b99b", 920);
    const titleRule = scene.add.rectangle(960, 254, 1120, 1, 0x8e6734, 0.9);
    const leftPanel = scene.add.graphics();
    this.drawContentPanel(leftPanel, 290, 284, 605, 520);
    const rightPanel = scene.add.graphics();
    this.drawContentPanel(rightPanel, 1025, 284, 605, 520);
    const leftTitle = this.centerText(592, 311, "可选奖励", 24, "#f0ca6b", 360);
    const rightTitle = this.centerText(1328, 311, "当前掉落", 24, "#f0ca6b", 360);
    const leftHint = this.centerText(592, 342, "选择一项奖励，再设置数量后加入右侧。", 14, "#9e907b", 500);
    const rightHint = this.centerText(1328, 342, "已加入的奖励会在怪物战斗结算时使用。", 14, "#9e907b", 500);
    this.panel.add([shade, shadow, frame, title, subtitle, titleRule, leftPanel, rightPanel, leftTitle, rightTitle, leftHint, rightHint]);

    this.optionsLayer = scene.add.container(0, 0);
    this.dropsLayer = scene.add.container(0, 0);
    this.panel.add([this.optionsLayer, this.dropsLayer]);

    this.selectedText = this.centerText(592, 742, "尚未选择奖励", 16, "#e8ddc5", 490);
    this.quantityText = this.centerText(592, 777, "数量  1", 19, "#f0ca6b", 140);
    this.noticeText = this.centerText(1328, 742, "", 15, "#bde3b5", 480);
    this.panel.add([this.selectedText, this.quantityText, this.noticeText]);

    this.addButton(510, 777, 54, 38, "−", () => this.changePendingQuantity(-1), { size: 22, variant: "secondary" });
    this.addButton(674, 777, 54, 38, "＋", () => this.changePendingQuantity(1), { size: 20, variant: "secondary" });
    this.addButton(592, 838, 270, 44, "加入掉落列表", () => this.addSelected(), { variant: "utility" });
    this.addButton(1428, 885, 170, 46, "应用掉落", () => this.apply(), { variant: "primary", size: 18 });
    this.addButton(1228, 885, 170, 46, "取消", () => this.close(), { variant: "secondary", size: 18 });
    this.addButton(1612, 174, 44, 40, "×", () => this.close(), { size: 26, variant: "danger" });
  }

  drawFrame(graphics, x, y, width, height) {
    graphics.fillStyle(0x21160f, 0.99);
    graphics.fillRoundedRect(x, y, width, height, 14);
    graphics.lineStyle(3, 0xc79a4b, 1);
    graphics.strokeRoundedRect(x, y, width, height, 14);
    graphics.fillStyle(0x302016, 0.45);
    graphics.fillRoundedRect(x + 10, y + 10, width - 20, height - 20, 10);
    graphics.lineStyle(1, 0x7b572d, 0.95);
    graphics.strokeRoundedRect(x + 10, y + 10, width - 20, height - 20, 10);
    // 简洁四角金线，使弹窗与游戏内其他木质界面保持同一视觉语言。
    const inset = 25; const length = 28;
    graphics.lineStyle(2, 0xdfba66, 0.85);
    [[x + inset, y + inset, 1, 1], [x + width - inset, y + inset, -1, 1], [x + inset, y + height - inset, 1, -1], [x + width - inset, y + height - inset, -1, -1]]
      .forEach(([cornerX, cornerY, horizontal, vertical]) => {
        graphics.lineBetween(cornerX, cornerY, cornerX + horizontal * length, cornerY);
        graphics.lineBetween(cornerX, cornerY, cornerX, cornerY + vertical * length);
      });
  }

  drawContentPanel(graphics, x, y, width, height) {
    graphics.fillStyle(0x181613, 0.98);
    graphics.fillRoundedRect(x, y, width, height, 9);
    graphics.lineStyle(1.5, 0x594634, 1);
    graphics.strokeRoundedRect(x, y, width, height, 9);
    graphics.lineStyle(1, 0x8a6537, 0.65);
    graphics.lineBetween(x + 28, y + 79, x + width - 28, y + 79);
  }

  centerText(x, y, value, size, color, width) {
    const text = addText(this.scene, x - width / 2, y, value, size, color, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      stroke: "#17100b",
      strokeThickness: 1,
      align: "center",
      wordWrap: { width },
    });
    text.setFixedSize(width, 0).setOrigin(0, 0.5);
    return text;
  }

  addButton(x, y, width, height, label, callback, options = {}) {
    const colors = {
      primary: { fill: 0x365d39, hover: 0x477849, stroke: 0x6d9e6e },
      secondary: { fill: 0x3b414a, hover: 0x525b68, stroke: 0x6d7683 },
      utility: { fill: 0x614622, hover: 0x806033, stroke: 0xc69d54 },
      danger: { fill: 0x563135, hover: 0x704146, stroke: 0xa66d68 },
    }[options.variant ?? "utility"];
    const background = this.scene.add.rectangle(x, y, width, height, colors.fill)
      .setStrokeStyle(1.5, colors.stroke)
      .setInteractive({ useHandCursor: true });
    const text = addText(this.scene, x, y, label, options.size ?? 16, "#fff0c7", {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      stroke: "#1b130d",
      strokeThickness: 1,
      align: "center",
    }).setOrigin(0.5);
    background.on("pointerover", () => background.setFillStyle(colors.hover));
    background.on("pointerout", () => background.setFillStyle(colors.fill));
    background.on("pointerdown", () => { playUiClickSound(this.scene); callback(); });
    this.panel.add([background, text]);
    return background;
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
    this.quantityText.setText(`数量  ${this.pendingQuantity}`);
  }

  renderOptions() {
    this.optionsLayer.removeAll(true);
    const pageCount = Math.max(1, Math.ceil(this.options.length / OPTION_PAGE_SIZE));
    this.optionPage = Math.max(0, Math.min(this.optionPage, pageCount - 1));
    this.options.slice(this.optionPage * OPTION_PAGE_SIZE, (this.optionPage + 1) * OPTION_PAGE_SIZE).forEach((reward, index) => {
      const y = 390 + index * 51;
      const selected = reward.id === this.selectedRewardId;
      const card = this.scene.add.rectangle(592, y, 548, 43, selected ? 0x4c604a : 0x24211d)
        .setStrokeStyle(1.5, selected ? 0xe5bd64 : 0x4e4439)
        .setInteractive({ useHandCursor: true });
      const marker = this.scene.add.circle(330, y, 5, selected ? 0xe9ca75 : 0x75634d);
      const name = addText(this.scene, 350, y - 8, reward.name, 17, selected ? "#fff1c7" : "#e3d6bf", { stroke: "#17100b", strokeThickness: 1 });
      const type = addText(this.scene, 350, y + 10, reward.typeLabel, 12, "#aaa093", { stroke: "#17100b", strokeThickness: 0 });
      card.on("pointerdown", () => { this.selectedRewardId = reward.id; this.render(); });
      this.optionsLayer.add([card, marker, name, type]);
    });
    this.addLayerButton(this.optionsLayer, 405, 690, 105, "上一页", () => { this.optionPage -= 1; this.renderOptions(); });
    this.addLayerButton(this.optionsLayer, 780, 690, 105, "下一页", () => { this.optionPage += 1; this.renderOptions(); });
    this.optionsLayer.add(this.centerText(592, 690, `${this.optionPage + 1} / ${pageCount}`, 16, "#c9b994", 110));
  }

  renderDrops() {
    this.dropsLayer.removeAll(true);
    const pageCount = Math.max(1, Math.ceil(this.draft.length / DROP_PAGE_SIZE));
    this.dropPage = Math.max(0, Math.min(this.dropPage, pageCount - 1));
    this.draft.slice(this.dropPage * DROP_PAGE_SIZE, (this.dropPage + 1) * DROP_PAGE_SIZE).forEach((entry, localIndex) => {
      const index = this.dropPage * DROP_PAGE_SIZE + localIndex;
      const y = 390 + localIndex * 57;
      const resolved = entry.resolved;
      const card = this.scene.add.rectangle(1328, y, 548, 48, resolved ? 0x24211d : 0x482c2d)
        .setStrokeStyle(1.5, resolved ? 0x4e4439 : 0xa9595c);
      const name = addText(this.scene, 1065, y - 8, `${entry.name} × ${entry.quantity}`, 17, resolved ? "#eee0c7" : "#ffc6c3", { stroke: "#17100b", strokeThickness: 1 });
      const type = addText(this.scene, 1065, y + 11, entry.typeLabel, 12, resolved ? "#aaa093" : "#e29b99", { stroke: "#17100b", strokeThickness: 0 });
      this.dropsLayer.add([card, name, type]);
      this.addLayerButton(this.dropsLayer, 1470, y, 42, "−", () => this.changeDraft(index, -1), { size: 19 });
      this.addLayerButton(this.dropsLayer, 1520, y, 42, "＋", () => this.changeDraft(index, 1), { size: 17 });
      this.addLayerButton(this.dropsLayer, 1580, y, 70, "删除", () => this.removeDraft(index), { size: 14, variant: "danger" });
    });
    if (!this.draft.length) this.dropsLayer.add(this.centerText(1328, 495, "暂无掉落\n从左侧目录选择奖励后加入", 20, "#877b69", 420));
    this.addLayerButton(this.dropsLayer, 1140, 690, 105, "上一页", () => { this.dropPage -= 1; this.renderDrops(); });
    this.addLayerButton(this.dropsLayer, 1515, 690, 105, "下一页", () => { this.dropPage += 1; this.renderDrops(); });
    this.dropsLayer.add(this.centerText(1328, 690, `${this.dropPage + 1} / ${pageCount}`, 16, "#c9b994", 110));
  }

  addLayerButton(layer, x, y, width, label, callback, options = {}) {
    const height = options.height ?? 34;
    const variant = options.variant ?? "utility";
    const colors = variant === "danger"
      ? { fill: 0x563135, hover: 0x704146, stroke: 0xa66d68 }
      : { fill: 0x4a3523, hover: 0x60472d, stroke: 0xb88f4a };
    const background = this.scene.add.rectangle(x, y, width, height, colors.fill)
      .setStrokeStyle(1, colors.stroke).setInteractive({ useHandCursor: true });
    const text = addText(this.scene, x, y, label, options.size ?? 14, "#f8e6b9", { stroke: "#1b130d", strokeThickness: 1 }).setOrigin(0.5);
    background.on("pointerover", () => background.setFillStyle(colors.hover));
    background.on("pointerout", () => background.setFillStyle(colors.fill));
    background.on("pointerdown", () => { playUiClickSound(this.scene); callback(); });
    layer.add([background, text]);
    return background;
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
    this.onApply(this.rewardCatalog.serializeDrops(this.draft));
    this.close();
  }
}

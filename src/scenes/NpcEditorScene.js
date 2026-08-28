import { getNpcTemplates, normalizeNpc, saveNpcTemplates } from "../core/WorldTemplateStore.js";
import { getNpcIdentityOptions, getNpcSectOptions } from "../core/NpcProfileCatalog.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addText } from "../utils/UiHelpers.js";
import { optimiseImageForStorage, prepareImageForStorage } from "../utils/ImageStorage.js";

const REALM_OPTIONS = [
  "", ...["炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫"]
    .flatMap((realm) => ["初期", "中期", "后期", "大圆满"].map((stage) => `${realm}${stage}`)),
  "飞升",
];
const SECT_OPTIONS = getNpcSectOptions();
const IDENTITY_OPTIONS = getNpcIdentityOptions();

/** NPC 管理界面，按 Pixso 的 NPC管理稿重制。 */
export class NpcEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.NPC_EDITOR); }

  preload() {
    this.load.spritesheet("npc-editor-default", "./public/assets/images/characters/player-idle-5dir.png", {
      frameWidth: 256, frameHeight: 256,
    });
  }

  create() {
    rememberEditorRoute(SceneKeys.NPC_EDITOR);
    this.itemCatalog = new ItemCatalog();
    this.items = getNpcTemplates();
    this.selectedId = this.items[0]?.id;
    this.page = "basic";
    this.ui = this.add.container();
    this.domInputs = [];
    this.windowResizeHandler = () => this.layoutDomInputs();
    window.addEventListener("resize", this.windowResizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("resize", this.windowResizeHandler);
      this.clearDomInputs();
    });
    this.refresh();
  }

  get selected() { return this.items.find((item) => item.id === this.selectedId); }

  refresh() {
    this.clearDomInputs();
    this.ui.removeAll(true);
    this.drawBackground();
    this.drawHeader();
    this.drawSidebar();
    this.drawContentPanel();
  }

  track(display) { this.ui.add(display); return display; }

  clearDomInputs() {
    (this.domInputs || []).forEach((entry) => entry.element.remove());
    this.domInputs = [];
  }

  layoutDomInputs() {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / 1920;
    const scaleY = rect.height / 1080;
    this.domInputs.forEach((entry) => {
      const { element, x, y, width, height } = entry;
      element.style.left = `${rect.left + x * scaleX}px`;
      element.style.top = `${rect.top + y * scaleY}px`;
      element.style.width = `${width * scaleX}px`;
      element.style.height = `${height * scaleY}px`;
      element.style.fontSize = `${entry.fontSize * Math.min(scaleX, scaleY)}px`;
    });
  }

  /** 在 Phaser 画出的黑色框内覆盖真正的网页输入框，输入时不会出现浏览器白色弹窗。 */
  domInput(x, y, width, height, value, onCommit, options = {}) {
    const element = document.createElement("input");
    element.type = options.type || "text";
    element.value = String(value ?? "");
    element.autocomplete = "off";
    element.spellcheck = false;
    element.style.cssText = [
      `position:fixed`, "z-index:20", "box-sizing:border-box", "margin:0", `padding:0 ${options.padding ?? 16}px`,
      "border:1px solid transparent", "border-radius:5px", "outline:none", "background:transparent",
      `color:${options.color || "#ddd7cf"}`, "font-family:Microsoft YaHei, Noto Sans SC, sans-serif", "font-weight:400",
      `text-align:${options.align || "left"}`,
    ].join(";");
    const entry = { element, x, y, width, height, fontSize: options.fontSize || 15 };
    let committedValue = element.value;
    const commit = () => {
      const nextValue = element.value.trim();
      if (nextValue === committedValue) return;
      if (onCommit(nextValue) === false) { element.value = committedValue; return; }
      committedValue = nextValue;
    };
    // 保存按钮在画布上，点击它时浏览器不一定会先触发 input 的 blur。
    // 把提交函数保留在条目中，保存时可以主动读取仍处于焦点的输入框。
    entry.commit = commit;
    element.addEventListener("focus", () => { element.style.borderColor = "#b79754"; });
    element.addEventListener("blur", () => { element.style.borderColor = "transparent"; commit(); });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); element.blur(); }
      event.stopPropagation();
    });
    document.body.appendChild(element);
    this.domInputs.push(entry);
    this.layoutDomInputs();
    return element;
  }

  /** 和普通输入框同样放在画布内，但境界只允许从既定修炼阶段中选择。 */
  domSelect(x, y, width, height, value, choices, onCommit, options = {}) {
    const element = document.createElement("select");
    const normalizedChoices = choices.map((choice) => typeof choice === "string" ? { value: choice, label: choice } : choice);
    const values = normalizedChoices.some((choice) => choice.value === value)
      ? normalizedChoices
      : [{ value: "", label: options.emptyLabel || "请选择" }, { value, label: value }, ...normalizedChoices.filter((choice) => choice.value)];
    values.forEach((choice) => {
      const option = document.createElement("option");
      option.value = choice.value;
      option.textContent = choice.label || options.emptyLabel || "请选择境界";
      option.style.background = "#1b1b1a";
      option.style.color = "#ddd7cf";
      element.appendChild(option);
    });
    element.value = value || "";
    element.style.cssText = [
      "position:fixed", "z-index:20", "box-sizing:border-box", "margin:0", "padding:0 34px 0 16px",
      "border:1px solid transparent", "border-radius:5px", "outline:none", "background:transparent",
      "color:#ddd7cf", "font-family:Microsoft YaHei, Noto Sans SC, sans-serif", "font-size:15px",
    ].join(";");
    const entry = { element, x, y, width, height, fontSize: options.fontSize || 15 };
    let committedValue = element.value;
    const commit = () => {
      const nextValue = element.value;
      if (nextValue === committedValue) return;
      if (onCommit(nextValue) === false) { element.value = committedValue; return; }
      committedValue = nextValue;
    };
    entry.commit = commit;
    element.addEventListener("focus", () => { element.style.borderColor = "#b79754"; });
    element.addEventListener("blur", () => { element.style.borderColor = "transparent"; });
    element.addEventListener("change", commit);
    element.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.appendChild(element);
    this.domInputs.push(entry);
    this.layoutDomInputs();
    return element;
  }

  /** 对话使用多行编辑框，直接输入时立即写入当前句子，不需要弹窗或逐行失焦。 */
  domTextarea(x, y, width, height, value, onChange, options = {}) {
    const element = document.createElement("textarea");
    element.value = String(value ?? "");
    element.placeholder = options.placeholder || "请输入这句对话……";
    element.spellcheck = false;
    element.style.cssText = [
      "position:fixed", "z-index:20", "box-sizing:border-box", "margin:0", "padding:16px 18px",
      "border:1px solid transparent", "border-radius:7px", "outline:none", "resize:none", "background:transparent",
      "color:#eee5d7", "font-family:Microsoft YaHei, Noto Sans SC, sans-serif", "font-size:18px", "line-height:1.65",
    ].join(";");
    const entry = { element, x, y, width, height, fontSize: options.fontSize || 18 };
    entry.commit = () => onChange(element.value);
    element.addEventListener("input", () => onChange(element.value));
    element.addEventListener("focus", () => { element.style.borderColor = "#b79754"; });
    element.addEventListener("blur", () => { element.style.borderColor = "transparent"; });
    element.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.appendChild(element);
    this.domInputs.push(entry);
    this.layoutDomInputs();
    return element;
  }

  text(x, y, value, size = 20, color = "#eee3ca", style = {}) {
    return this.track(addText(this, x, y, value, size, color, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      stroke: "#19130f", strokeThickness: 3, ...style,
    }));
  }

  roundedBox(x, y, width, height, fill, stroke = null, radius = 10, lineWidth = 2) {
    const box = this.track(this.add.graphics());
    box.fillStyle(fill, 1);
    box.fillRoundedRect(x, y, width, height, radius);
    if (stroke !== null) {
      box.lineStyle(lineWidth, stroke, 1);
      box.strokeRoundedRect(x, y, width, height, radius);
    }
    return box;
  }

  button(x, y, width, label, action, options = {}) {
    const height = options.height ?? 46;
    const normal = options.fill ?? 0x4b3627;
    const hover = options.hover ?? 0x64472f;
    const background = this.track(this.add.rectangle(x + width / 2, y + height / 2, width, height, normal, 1)
      .setStrokeStyle(2, options.stroke ?? 0xe6bd61).setInteractive({ useHandCursor: true }));
    const labelText = this.text(x + width / 2, y + height / 2, label, options.size ?? 18, options.color ?? "#f5e5b7", { strokeThickness: 3 }).setOrigin(0.5);
    background.on("pointerover", () => background.setFillStyle(hover));
    background.on("pointerout", () => background.setFillStyle(normal));
    background.on("pointerdown", action);
    return [background, labelText];
  }

  drawBackground() {
    this.track(this.add.rectangle(960, 540, 1920, 1080, 0x171310));
    this.track(this.add.rectangle(174, 540, 348, 1080, 0x211812));
    this.track(this.add.rectangle(960, 35, 1920, 70, 0x211711));
    this.track(this.add.rectangle(960, 70, 1920, 1, 0x76512e, 0.75));
  }

  drawHeader() {
    this.text(31, 26, "NPC管理", 25, "#f4d5a4", { strokeThickness: 2 });
    this.text(292, 26, `${this.items.length}个`, 23, "#f4d5a4", { strokeThickness: 2 });
    [["basic", "基本信息"], ["dialogue", "对话编辑"], ["quest", "任务管理"], ["preview", "预览"]].forEach(([key, label], index) => {
      const x = 382 + index * 135;
      const active = key === this.page;
      const hit = this.track(this.add.rectangle(x + 56, 35, 112, 70, active ? 0x4b321d : 0x211711, active ? 1 : 0.01).setInteractive({ useHandCursor: true }));
      this.text(x + 56, 35, label, 17, active ? "#f4cf56" : "#aaa096", { strokeThickness: 2 }).setOrigin(0.5);
      if (active) this.track(this.add.rectangle(x + 56, 67, 112, 3, 0xf0ca5c));
      hit.on("pointerdown", () => { this.page = key; this.refresh(); });
    });
    this.button(1770, 15, 90, "返回", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), {
      height: 40, size: 16, fill: 0x4b3928, hover: 0x654b31, stroke: 0x80613d,
    });
  }

  drawSidebar() {
    this.roundedBox(14, 84, 322, 44, 0x282624, 0x45403b, 4, 1);
    const search = this.domInput(14, 84, 322, 44, this.searchKeyword || "", (value) => {
      this.searchKeyword = value;
      this.filteredItems = value ? this.items.filter((item) => item.name.includes(value)) : null;
      this.refresh();
    }, { fontSize: 15 });
    search.placeholder = "搜索NPC名称...";
    search.style.color = "#c9c2b8";
    search.style.setProperty("--placeholder-color", "#77716b");
    (this.filteredItems || this.items).slice(0, 9).forEach((item, index) => this.drawNpcCard(item, index));
    this.button(14, 1007, 322, "＋ 新建NPC", () => this.addItem(), { height: 56, fill: 0x365d39, hover: 0x467847, stroke: 0x5f9561, size: 19 });
  }

  drawNpcCard(item, index) {
    const y = 145 + index * 96;
    const active = item.id === this.selectedId;
    const card = this.track(this.add.rectangle(175, y + 39, 322, 80, active ? 0x4a311b : 0x292827, 1)
      .setStrokeStyle(2, active ? 0xd8ad58 : 0x3f3c38).setInteractive({ useHandCursor: true }));
    this.track(this.add.circle(58, y + 39, 30, 0x1c1c1b).setStrokeStyle(2, 0x65605a));
    // 头像在圆框内居中显示；超出圆形的区域由 drawPortrait 的蒙版自动裁掉。
    this.drawPortrait(item, 58, y + 39, 56, true, "avatar");
    this.text(109, y + 19, item.name || "未命名 NPC", 20, "#f2ce4a", { strokeThickness: 2 });
    this.text(109, y + 48, [item.profile.realm, item.profile.sect].filter(Boolean).join(" · ") || "未填写资料", 14, "#9f9991", { strokeThickness: 1 });
    card.on("pointerdown", () => { this.selectedId = item.id; this.filteredItems = null; this.refresh(); });
  }

  drawContentPanel() {
    this.roundedBox(367, 84, 1530, 980, 0x262525, 0x45413d, 8, 2);
    if (!this.selected) {
      this.text(1132, 510, "请新建一个 NPC", 28, "#d7c6a5").setOrigin(0.5);
      return;
    }
    if (this.page === "basic") this.drawBasicPage();
    if (this.page === "dialogue") this.drawDialoguePage();
    if (this.page === "quest") this.drawQuestPage();
    if (this.page === "preview") this.drawPreviewPage();
  }

  sectionTitle(value, x = 389, y = 100) { this.text(x, y, value, 20, "#f0ce57", { strokeThickness: 2 }); }

  drawBasicPage() {
    const item = this.selected;
    const profile = item.profile;
    this.sectionTitle("立绘与头像");
    this.roundedBox(894, 139, 224, 306, 0x1d1d1c, 0x4b4945, 12, 2);
    // NPC 只维护一张立绘；列表与地图头像都从立绘自动裁切。
    this.drawPortrait(item, 1006, 295, 205, false, "portrait");
    this.text(1006, 468, "立绘(对话时显示)", 17, "#aaa39b", { strokeThickness: 1 }).setOrigin(0.5);
    this.track(this.add.circle(1254, 221, 48, 0x1c1c1c).setStrokeStyle(2, 0x66625d));
    // 头像在圆框内居中显示；保留 2px 内边距给圆框描边。
    this.drawPortrait(item, 1254, 221, 92, true, "avatar");
    this.text(1254, 275, "立绘自动裁切头像", 15, "#aaa39b", { strokeThickness: 1 }).setOrigin(0.5);
    this.button(1148, 335, 220, "上传立绘", () => this.pickPortrait(), { height: 45, fill: 0x9d8248, hover: 0xb09255, stroke: 0x9d8248 });
    this.text(1258, 407, "上传一次立绘即可同步全部头像", 15, "#8f8a83", { strokeThickness: 1 }).setOrigin(0.5);

    // Pixso 稿中的十种灵根：直接在对应数字框填写，不再弹出浏览器输入窗口。
    this.text(600, 485, "灵根属性", 16, "#f0ce57", { strokeThickness: 2 }).setOrigin(0.5);
    ["金", "木", "水", "火", "土", "风", "雷", "冰", "魔", "神"].forEach((root, index) => {
      const x = 572 + index * 106;
      this.text(x, 520, root, 14, "#aaa39b", { strokeThickness: 1 });
      this.valueField(x + 28, 510, 48, profile.roots[root], (raw) => this.commitNumber(raw, profile.roots[root], (value) => { profile.roots[root] = value; }), 14, "number", 33, { color: "#aaa39b" });
    });

    this.sectionTitle("基本信息", 389, 565);
    this.roundedBox(388, 600, 570, 286, 0x242322, 0x3d3935, 8, 2);
    [["NPC ID", item.isNew ? "" : item.id, (value) => this.commitNpcId(value, item)], ["名称", item.name, (value) => { item.name = value; }], ["性别", profile.gender, (value) => { profile.gender = value; }], ["境界", profile.realm, (value) => { profile.realm = value; }], ["门派", profile.sect, (value) => { profile.sect = value; }], ["身份", profile.identity, (value) => { profile.identity = value; }]].forEach(([label, value, setValue], index) => {
      const y = 628 + index * 45;
      this.text(425, y + 8, label, 16, "#bcb5ad", { strokeThickness: 1 });
      if (label === "境界") this.selectField(494, y, 263, value, REALM_OPTIONS, setValue, 15, { emptyLabel: "请选择境界" });
      else if (label === "门派") this.selectField(494, y, 263, value, SECT_OPTIONS, setValue, 15, { emptyLabel: "请选择门派" });
      else if (label === "身份") this.selectField(494, y, 263, value, IDENTITY_OPTIONS, setValue, 15, { emptyLabel: "请选择身份" });
      else this.valueField(494, y, 263, value, setValue || null, 15);
    });

    this.sectionTitle("基本属性", 980, 565);
    this.roundedBox(979, 600, 893, 286, 0x242322, 0x3d3935, 8, 2);
    [["寿命", "lifespan"], ["气血", "qi"], ["灵力", "spirit"], ["攻击", "attack"], ["防御", "defense"], ["身法", "agility"]].forEach(([label, key], index) => {
      const y = 628 + index * 45;
      this.text(1012, y + 8, label, 16, "#bcb5ad", { strokeThickness: 1 });
      this.valueField(1082, y, 280, profile[key], (raw) => this.commitNumber(raw, profile[key], (value) => { profile[key] = value; }), 15, "number");
    });
    this.button(1378, 628, 126, "随机", () => {
      profile.lifespan = Phaser.Math.Between(80, 180);
      this.refresh();
    }, { height: 33, size: 15, fill: 0x3b3a39, hover: 0x51504e, stroke: 0x3b3a39, color: "#ddd7cf" });
    this.drawSkillSlots(item);
    this.button(1375, 1025, 146, "删除", () => this.deleteItem(), { height: 34, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff4b35", size: 16 });
    this.button(1538, 1025, 334, "保存全部", () => this.save(), { height: 34, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360, size: 17 });
  }

  /** 人物技能栏固定十格；空格显示加号，已有技能显示名称，技能资料会随 NPC 一起保存。 */
  drawSkillSlots(item) {
    const slotX = 408;
    const slotY = 932;
    const slotWidth = 126;
    const slotGap = 18;
    this.sectionTitle("人物技能", 389, 901);
    this.roundedBox(388, 930, 1484, 82, 0x242322, 0x3d3935, 8, 2);
    for (let index = 0; index < 10; index += 1) {
      const x = slotX + index * (slotWidth + slotGap);
      const skill = item.skills?.[index];
      const tile = this.track(this.add.rectangle(x + slotWidth / 2, slotY + 37, slotWidth, 66, skill ? 0x303a30 : 0x2a2927, 1)
        .setStrokeStyle(1, skill ? 0x8b9a70 : 0x817c73));
      this.track(this.add.rectangle(x + 12, slotY + 12, 21, 21, 0x1c1d1b, 1));
      this.text(x + 12, slotY + 12, index === 9 ? "0" : String(index + 1), 12, "#a9a39b", { strokeThickness: 0 }).setOrigin(0.5);
      if (skill) {
        this.track(this.add.circle(x + slotWidth / 2, slotY + 32, 19, 0x755630, 1));
        this.text(x + slotWidth / 2, slotY + 31, skill.name.slice(0, 1), 18, "#fff2cf", { strokeThickness: 1 }).setOrigin(0.5);
        this.text(x + slotWidth / 2, slotY + 55, skill.name, 13, "#ddd7cf", { strokeThickness: 1 }).setOrigin(0.5);
      } else {
        this.text(x + slotWidth / 2, slotY + 37, "＋", 38, "#d5d0c8", { strokeThickness: 0 }).setOrigin(0.5);
      }
      // 先保留每一格的点击区域，后续接入技能编辑器时可直接绑定技能选择功能。
      tile.setInteractive({ useHandCursor: true });
    }
  }

  /** 画出输入框，并在框内放入真正可直接填写的输入控件。 */
  valueField(x, y, width, value, onCommit = null, size = 15, type = "text", height = 33, options = {}) {
    const field = this.roundedBox(x, y, width, height, 0x1b1b1a, 0x393735, 5, 1);
    if (onCommit) this.domInput(x, y, width, height, value, onCommit, {
      type, fontSize: size, padding: width <= 60 ? 3 : 16, align: width <= 60 ? "center" : "left", ...options,
    });
    else this.text(x + 16, y + 7, String(value), size, "#ddd7cf", { strokeThickness: 1 });
    return field;
  }

  selectField(x, y, width, value, choices, onCommit, size = 15, options = {}) {
    const field = this.roundedBox(x, y, width, 33, 0x1b1b1a, 0x393735, 5, 1);
    this.text(x + width - 18, y + 7, "▾", 14, "#aaa39b", { strokeThickness: 0 }).setOrigin(0.5, 0);
    this.domSelect(x, y, width, 33, value, choices, onCommit, { fontSize: size, ...options });
    return field;
  }

  drawDialoguePage() {
    const item = this.selected;
    this.sectionTitle("对话编辑");
    this.text(409, 134, "普通台词请选择“顺序对话”；只有需要玩家选择不同回答时，才使用高级分支。", 16, "#aaa39b", { strokeThickness: 1 });
    this.drawDialogueModeCard(409, 166, 690, "顺序对话（推荐）", "一句接一句播放，最适合接引人和普通 NPC", item.dialogueMode === "simple", () => this.setDialogueMode("simple"));
    this.drawDialogueModeCard(1119, 166, 710, "玩家选项分支（高级）", "主角选择回答后，跳转到不同 NPC 回复", item.dialogueMode === "branch", () => this.setDialogueMode("branch"));

    if (item.dialogueMode === "branch") this.drawBranchDialogueEditor(item);
    else this.drawSimpleDialogueEditor(item);
  }

  drawDialogueModeCard(x, y, width, title, detail, active, action) {
    this.roundedBox(x, y, width, 78, active ? 0x4a311b : 0x242322, active ? 0xd8ad58 : 0x49443e, 8, active ? 2 : 1);
    const hit = this.track(this.add.rectangle(x + width / 2, y + 39, width, 78, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }));
    this.track(this.add.circle(x + 42, y + 39, 22, active ? 0xa87827 : 0x37332f, 1)
      .setStrokeStyle(2, active ? 0xf0c85b : 0x686159));
    this.text(x + 42, y + 39, active ? "✓" : "", 18, "#fff1bd", { strokeThickness: 1 }).setOrigin(0.5);
    this.text(x + 78, y + 15, title, 18, active ? "#f2ce4a" : "#e2d9cc", { strokeThickness: 1 });
    this.text(x + 78, y + 45, detail, 14, active ? "#d2c19b" : "#918b84", { strokeThickness: 0 });
    hit.on("pointerdown", action);
  }

  setDialogueMode(mode) {
    const item = this.selected;
    if (!item || item.dialogueMode === mode) return;
    this.commitAllDomInputs();
    if (mode === "simple") {
      const treeLines = item.dialogueTree?.nodes?.map((node) => String(node.text || "").trim()).filter(Boolean) || [];
      item.dialogue = item.dialogue?.filter((line) => String(line || "").trim()).length
        ? item.dialogue.map((line) => String(line || "").trim()).filter(Boolean)
        : treeLines;
      item.dialogueTree = null;
      item.dialogueMode = "simple";
      this.dialoguePageIndex = 0;
      this.showNotice("已切换为顺序对话，原 NPC 回复文字均已保留");
    } else {
      item.dialogueTree = this.createLinearDialogueTree(item.dialogue);
      item.dialogue = [];
      item.dialogueMode = "branch";
      this.selectedDialogueNodeId = item.dialogueTree.startId;
      this.showNotice("已切换为高级分支，可为每段回复添加主角选项");
    }
    this.refresh();
  }

  drawSimpleDialogueEditor(item) {
    const lines = Array.isArray(item.dialogue) ? item.dialogue : (item.dialogue = []);
    const visibleCount = 5;
    const totalRows = Math.max(1, lines.length);
    const maxPage = Math.max(0, Math.ceil(totalRows / visibleCount) - 1);
    this.dialoguePageIndex = Phaser.Math.Clamp(Number(this.dialoguePageIndex) || 0, 0, maxPage);
    const start = this.dialoguePageIndex * visibleCount;

    this.roundedBox(409, 270, 1420, 650, 0x1d1d1c, 0x49443e, 10, 2);
    this.text(440, 291, `连续台词（共 ${lines.length || 1} 句）`, 19, "#f0ce57", { strokeThickness: 1 });
    this.text(710, 294, "地图中会严格按照 1 → 2 → 3 的顺序播放，最后一句结束后才发放奖励。", 15, "#73c69a", { strokeThickness: 0 });

    const indexes = lines.length
      ? lines.map((_line, index) => index).slice(start, start + visibleCount)
      : [-1];
    indexes.forEach((lineIndex, localIndex) => {
      const displayIndex = lineIndex < 0 ? 0 : lineIndex;
      const y = 330 + localIndex * 108;
      this.roundedBox(440, y, 1358, 92, lineIndex === start ? 0x29251f : 0x242322, lineIndex === start ? 0x80653d : 0x3d3935, 7, 1);
      this.track(this.add.circle(478, y + 46, 24, 0x5a4024, 1).setStrokeStyle(1, 0xc79b4e));
      this.text(478, y + 46, String(displayIndex + 1), 17, "#f4d36a", { strokeThickness: 1 }).setOrigin(0.5);
      this.domTextarea(515, y + 9, 1040, 74, lineIndex < 0 ? "" : lines[lineIndex], (value) => {
        if (lineIndex < 0) item.dialogue = [value];
        else item.dialogue[lineIndex] = value;
      }, { placeholder: `请输入第 ${displayIndex + 1} 句 NPC 台词……`, fontSize: 16 });
      this.button(1580, y + 10, 54, "↑", () => this.moveSimpleDialogueLine(displayIndex, -1), {
        height: 32, size: 17, fill: 0x38332e, hover: 0x51483d, stroke: 0x665b4d,
      });
      this.button(1642, y + 10, 54, "↓", () => this.moveSimpleDialogueLine(displayIndex, 1), {
        height: 32, size: 17, fill: 0x38332e, hover: 0x51483d, stroke: 0x665b4d,
      });
      this.button(1580, y + 51, 116, "删除", () => this.removeSimpleDialogueLine(displayIndex), {
        height: 32, size: 15, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff9a88",
      });
    });

    if (maxPage > 0) {
      this.button(745, 866, 120, "上一页", () => { this.dialoguePageIndex -= 1; this.refresh(); }, { height: 36, size: 14 });
      this.text(925, 884, `${this.dialoguePageIndex + 1} / ${maxPage + 1}`, 15, "#aaa39b", { strokeThickness: 0 }).setOrigin(0.5);
      this.button(985, 866, 120, "下一页", () => { this.dialoguePageIndex += 1; this.refresh(); }, { height: 36, size: 14 });
    }
    this.button(440, 950, 300, "＋ 添加下一句", () => this.addSimpleDialogueLine(), { height: 48, size: 17, fill: 0x4b3627, hover: 0x64472f });
    this.text(770, 966, "可用 ↑ ↓ 调整顺序；不需要创建节点或设置跳转。", 14, "#8f8a83", { strokeThickness: 0 });
    this.button(1510, 950, 288, "保存对话", () => this.save(), { height: 48, size: 17, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360 });
  }

  addSimpleDialogueLine() {
    const lines = this.selected.dialogue || (this.selected.dialogue = []);
    if (lines.length >= 30) { this.showNotice("每个 NPC 最多设置 30 句连续台词"); return; }
    this.commitAllDomInputs();
    if (!lines.length) lines.push("");
    else lines.push("");
    this.dialoguePageIndex = Math.floor((lines.length - 1) / 5);
    this.refresh();
  }

  moveSimpleDialogueLine(index, offset) {
    this.commitAllDomInputs();
    const lines = this.selected.dialogue || [];
    const target = index + offset;
    if (index < 0 || index >= lines.length || target < 0 || target >= lines.length) return;
    [lines[index], lines[target]] = [lines[target], lines[index]];
    this.dialoguePageIndex = Math.floor(target / 5);
    this.refresh();
  }

  removeSimpleDialogueLine(index) {
    this.commitAllDomInputs();
    const lines = this.selected.dialogue || [];
    if (index >= 0 && index < lines.length) lines.splice(index, 1);
    this.dialoguePageIndex = Math.min(Number(this.dialoguePageIndex) || 0, Math.max(0, Math.ceil(Math.max(1, lines.length) / 5) - 1));
    this.refresh();
  }

  createLinearDialogueTree(lines = []) {
    const source = lines.map((line) => String(line || "").trim()).filter(Boolean);
    if (!source.length) source.push("");
    const seed = Date.now();
    const nodes = source.map((text, index) => ({ id: `node-${seed}-${index + 1}`, text, choices: [] }));
    nodes.forEach((node, index) => {
      if (nodes[index + 1]) node.choices.push({ id: `choice-${seed}-${index + 1}`, text: "继续", nextId: nodes[index + 1].id, action: "" });
    });
    return { startId: nodes[0].id, nodes };
  }

  drawBranchDialogueEditor(item) {
    const tree = this.getDialogueTree(item);
    if (!tree.nodes.some((node) => node.id === this.selectedDialogueNodeId)) this.selectedDialogueNodeId = tree.startId;
    const node = tree.nodes.find((entry) => entry.id === this.selectedDialogueNodeId) || tree.nodes[0];

    this.roundedBox(409, 270, 1420, 650, 0x1d1d1c, 0x49443e, 10, 2);
    this.text(440, 286, "高级分支：左侧选 NPC 回复，右侧填写主角选项和跳转目标。未连接的回复不会自动播放。", 15, "#d2a965", { strokeThickness: 0 });
    // 左侧：NPC 回复节点。每个节点可以配置多个主角选择。
    this.roundedBox(440, 320, 380, 560, 0x242322, 0x3d3935, 8, 1);
    this.text(465, 342, `NPC 回复（${tree.nodes.length}个）`, 18, "#f0ce57", { strokeThickness: 1 });
    tree.nodes.slice(0, 6).forEach((entry, index) => {
      const y = 382 + index * 70;
      const active = entry.id === node.id;
      const row = this.track(this.add.rectangle(630, y + 26, 340, 52, active ? 0x4a311b : 0x2d2c2a, 1)
        .setStrokeStyle(1, active ? 0xd8ad58 : 0x48443e).setInteractive({ useHandCursor: true }));
      this.text(468, y + 16, entry.id === tree.startId ? "起" : `${index + 1}`, 16, active ? "#f7d56b" : "#aaa39b", { strokeThickness: 1 });
      const summary = entry.text.replace(/\s+/g, " ") || "（空白回复）";
      this.text(502, y + 16, summary.length > 18 ? `${summary.slice(0, 18)}…` : summary, 16, "#e5ddd2", { strokeThickness: 1 });
      row.on("pointerdown", () => { this.selectedDialogueNodeId = entry.id; this.refresh(); });
    });
    if (tree.nodes.length > 6) this.text(630, 840, `另有 ${tree.nodes.length - 6} 个回复，后续继续补分页`, 14, "#88817a", { strokeThickness: 0 }).setOrigin(0.5);

    // 右侧：当前 NPC 回复和主角可选回答。
    this.roundedBox(850, 320, 948, 560, 0x242322, 0x3d3935, 8, 1);
    this.text(880, 342, node.id === tree.startId ? "起始 NPC 回复" : "NPC 回复", 18, "#f0ce57", { strokeThickness: 1 });
    this.roundedBox(880, 374, 888, 120, 0x1b1b1a, 0x4e4942, 7, 1);
    this.domTextarea(880, 374, 888, 120, node.text, (value) => { node.text = value; }, { placeholder: "请输入 NPC 的回复……", fontSize: 17 });
    this.text(880, 516, "主角可选回答（选择后跳到指定的 NPC 回复）", 17, "#f0ce57", { strokeThickness: 1 });
    node.choices.forEach((choice, index) => {
      const y = 550 + index * 52;
      this.text(890, y + 8, `${index + 1}.`, 16, "#aaa39b", { strokeThickness: 1 });
      this.valueField(922, y, 415, choice.text, (value) => { choice.text = value; }, 15);
      const targets = [
        { value: "", label: "结束对话" },
        ...tree.nodes.map((entry, targetIndex) => ({
          value: entry.id,
          label: `${entry.id === tree.startId ? "起始" : `回复 ${targetIndex + 1}`}：${(entry.text || "未填写").replace(/\s+/g, " ").slice(0, 9)}`,
        })),
      ];
      this.selectField(1350, y, 250, choice.nextId, targets, (value) => { choice.nextId = value; }, 14, { emptyLabel: "结束对话" });
      this.text(1624, y + 8, choice.nextId ? "→ 回复节点" : "→ 结束", 14, "#aaa39b", { strokeThickness: 0 });
      this.button(1702, y, 54, "×", () => { node.choices.splice(index, 1); this.refresh(); }, { height: 33, size: 20, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff7867" });
    });
    this.button(880, 790, 210, "＋ 添加结束选项", () => this.addDialogueChoice(node), { height: 42, size: 15, fill: 0x4b3627, hover: 0x64472f });
    this.button(1105, 790, 240, "＋ 添加选项与新回复", () => this.addDialogueBranch(node), { height: 42, size: 15, fill: 0x4b3627, hover: 0x64472f });
    this.button(1360, 790, 190, "删除此回复", () => this.removeDialogueNode(tree, node), { height: 42, size: 16, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff7867" });
    this.button(1565, 790, 203, "保存对话", () => this.save(), { height: 42, size: 16, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360 });
  }

  getDialogueTree(item) {
    // 首次打开栖霞村村长时，直接载入完整的第一章示范分支剧情。
    // 已载入过的剧情带有 elder-start 节点，之后用户自行修改不会被覆盖。
    if (item.id === "npc-qixia-elder" && !item.dialogueTree?.nodes?.some((node) => node.id === "elder-start")) {
      item.dialogueTree = this.createQixiaElderStory();
      item.dialogue = [];
      saveNpcTemplates(this.items);
      return item.dialogueTree;
    }
    if (item.id === "npc-qixia-elder" && item.dialogueTree?.nodes?.length) {
      let updated = false;
      item.dialogueTree.nodes.forEach((node) => node.choices?.forEach((choice) => {
        if (["elder-start-1", "elder-accept-1", "elder-clue-1", "elder-worry-1"].includes(choice.id) && choice.action !== "accept-qingyun-investigation") {
          choice.action = "accept-qingyun-investigation";
          updated = true;
        }
      }));
      if (updated) saveNpcTemplates(this.items);
      return item.dialogueTree;
    }
    if (item.dialogueTree?.nodes?.length) return item.dialogueTree;
    const legacyLines = item.dialogue?.length ? item.dialogue : [""];
    const nodes = legacyLines.map((text, index) => ({
      id: `node-${Date.now()}-${index + 1}`,
      text,
      choices: index < legacyLines.length - 1 ? [{ id: `choice-${index + 1}`, text: "继续", nextId: "" }] : [],
    }));
    nodes.forEach((entry, index) => { if (nodes[index + 1]) entry.choices[0].nextId = nodes[index + 1].id; });
    item.dialogueTree = { startId: nodes[0].id, nodes };
    return item.dialogueTree;
  }

  createQixiaElderStory() {
    return {
      startId: "elder-start",
      nodes: [
        {
          id: "elder-start",
          text: "村长：昨夜子时，青云山方向忽然亮起一道青白异光，村外的灵兽都躁动不安。\n村长：我担心山中封存的古物出了变故。你若有空，可愿替栖霞村前去查看？",
          choices: [
            { id: "elder-start-1", text: "我愿意前往青云山。", nextId: "elder-accept", action: "accept-qingyun-investigation" },
            { id: "elder-start-2", text: "那道异光具体出现在哪里？", nextId: "elder-clue" },
            { id: "elder-start-3", text: "我还需要准备，暂时告辞。", nextId: "" },
          ],
        },
        {
          id: "elder-accept",
          text: "村长：好，有你这句话，我便放心些。\n村长：沿村北小径向东走，见到三块石碑后便是青云山脚。山中雾气异常，切记不要贸然深入。",
          choices: [
            { id: "elder-accept-1", text: "我现在就出发。", nextId: "elder-task", action: "accept-qingyun-investigation" },
            { id: "elder-accept-2", text: "村长可还有别的提醒？", nextId: "elder-clue" },
            { id: "elder-accept-3", text: "我再准备一下。", nextId: "" },
          ],
        },
        {
          id: "elder-clue",
          text: "村长：异光最初出现在山脚的古潭附近。那里原本有一座残破石台，村中老人称它为“问道台”。\n村长：近几日还有人听见潭边传来玉石相击之声，但无人敢靠近。",
          choices: [
            { id: "elder-clue-1", text: "我会去古潭查看。", nextId: "elder-task", action: "accept-qingyun-investigation" },
            { id: "elder-clue-2", text: "这件事和村子有什么关系？", nextId: "elder-worry" },
            { id: "elder-clue-3", text: "我还需要准备。", nextId: "" },
          ],
        },
        {
          id: "elder-worry",
          text: "村长：栖霞村靠青云山而生。若山中灵气失衡，田地、溪流，甚至村民都会受到影响。\n村长：我不求你冒险，只希望你替我们确认异象的根源。",
          choices: [
            { id: "elder-worry-1", text: "我明白了，我会去调查。", nextId: "elder-task", action: "accept-qingyun-investigation" },
            { id: "elder-worry-2", text: "我暂时无法答应。", nextId: "" },
          ],
        },
        {
          id: "elder-task",
          text: "村长：多谢。此事就拜托你了。\n村长：前往青云山脚，调查古潭与问道台附近的异常玉光。若遇危险，先保全自己。",
          choices: [
            { id: "elder-task-1", text: "我记下了。", nextId: "" },
          ],
        },
      ],
    };
  }

  makeDialogueNodeId(tree) { return `node-${Date.now()}-${tree.nodes.length + 1}`; }

  addDialogueNode(tree) {
    const node = { id: this.makeDialogueNodeId(tree), text: "", choices: [] };
    tree.nodes.push(node);
    this.selectedDialogueNodeId = node.id;
    this.refresh();
  }

  addDialogueChoice(node) {
    if (node.choices.length >= 4) { this.showNotice("每句回复最多设置 4 个主角选择"); return; }
    node.choices.push({ id: `choice-${Date.now()}`, text: "我明白了。", nextId: "", action: "" });
    this.refresh();
  }

  addDialogueBranch(node) {
    if (node.choices.length >= 4) { this.showNotice("每句回复最多设置 4 个主角选择"); return; }
    const tree = this.selected.dialogueTree;
    const child = { id: this.makeDialogueNodeId(tree), text: "", choices: [] };
    tree.nodes.push(child);
    // 留在当前回复上，让编辑者先把“主角说什么”写清楚；再从左侧点进新回复填写 NPC 回答。
    node.choices.push({ id: `choice-${Date.now()}`, text: "我想继续询问。", nextId: child.id, action: "" });
    this.refresh();
    this.showNotice("已创建新回复：先修改主角选项，再从左侧打开空白回复");
  }

  removeDialogueNode(tree, node) {
    if (node.id === tree.startId) { this.showNotice("起始回复不能删除"); return; }
    tree.nodes = tree.nodes.filter((entry) => entry.id !== node.id);
    tree.nodes.forEach((entry) => entry.choices.forEach((choice) => { if (choice.nextId === node.id) choice.nextId = ""; }));
    this.selectedDialogueNodeId = tree.startId;
    this.refresh();
  }

  drawQuestPage() {
    const quest = this.selected.quest;
    this.sectionTitle("互动与任务");
    this.text(389, 134, "不用填写代码或物品 ID：先选择玩家对话后要发生的事情，再从物品库选择奖励。", 16, "#aaa39b", { strokeThickness: 1 });
    this.button(1450, 101, 405, "一键设为天剑宗接引人", () => this.applyTianjianGuidePreset(), {
      height: 44, size: 17, fill: 0x365d39, hover: 0x477849, stroke: 0x6b9a69,
    });

    const modes = [
      { id: "none", seal: "聊", title: "只进行对话", detail: "不发物品，也不发布任务" },
      { id: "talk_reward", seal: "赠", title: "对话后赠礼", detail: "看完对话自动获得物品 · 推荐" },
      { id: "task", seal: "令", title: "发布任务", detail: "填写名称、目标和完成奖励" },
    ];
    modes.forEach((mode, index) => this.drawQuestModeCard(409 + index * 480, 176, 450, 112, mode, quest.mode === mode.id));

    if (quest.mode === "talk_reward") this.drawTalkRewardEditor(quest);
    else if (quest.mode === "task") this.drawTaskCommissionEditor(quest);
    else this.drawNoNpcInteraction();

    this.text(409, 1019, "设置后请点击右侧“保存全部 NPC”，地图中的同模板 NPC 会自动使用新配置。", 15, "#8f8a83", { strokeThickness: 1 });
    this.button(1485, 995, 370, "保存全部 NPC", () => this.save(), {
      height: 44, size: 18, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360,
    });
  }

  drawQuestModeCard(x, y, width, height, mode, active) {
    this.roundedBox(x, y, width, height, active ? 0x4a311b : 0x242322, active ? 0xd8ad58 : 0x4c4741, 9, active ? 2 : 1);
    const hit = this.track(this.add.rectangle(x + width / 2, y + height / 2, width, height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }));
    this.track(this.add.circle(x + 54, y + height / 2, 31, active ? 0xa87827 : 0x38332e, 1)
      .setStrokeStyle(2, active ? 0xf0c85b : 0x6d6458));
    this.text(x + 54, y + height / 2, mode.seal, 25, active ? "#fff1bd" : "#c7beb1", { strokeThickness: 1 }).setOrigin(0.5);
    this.text(x + 101, y + 26, mode.title, 20, active ? "#f2ce4a" : "#e2d9cc", { strokeThickness: 1 });
    this.text(x + 101, y + 65, mode.detail, 14, active ? "#d2c19b" : "#918b84", { strokeThickness: 0 });
    hit.on("pointerdown", () => this.setQuestMode(mode.id));
  }

  setQuestMode(mode) {
    const quest = this.selected.quest;
    quest.mode = ["none", "talk_reward", "task"].includes(mode) ? mode : "none";
    quest.enabled = quest.mode !== "none";
    if (quest.mode === "talk_reward") {
      quest.title ||= "对话赠礼";
      quest.target = "完整结束对话";
    }
    this.refresh();
  }

  drawNoNpcInteraction() {
    this.roundedBox(409, 320, 1420, 620, 0x1d1d1c, 0x49443e, 10, 2);
    this.text(1119, 490, "当前只进行普通对话", 28, "#d8cdbd", { strokeThickness: 1 }).setOrigin(0.5);
    this.text(1119, 548, "玩家看完对话后不会自动获得物品，也不会新增任务。", 17, "#99928a", { strokeThickness: 0 }).setOrigin(0.5);
    this.text(1119, 618, "如果要制作天剑宗接引人，可直接点击右上角的绿色快捷按钮。", 17, "#c9ad67", { strokeThickness: 0 }).setOrigin(0.5);
  }

  drawTalkRewardEditor(quest) {
    this.roundedBox(409, 320, 610, 620, 0x1d1d1c, 0x49443e, 10, 2);
    this.text(445, 353, "1　设置发放规则", 20, "#f0ce57", { strokeThickness: 1 });
    this.text(455, 408, "① 玩家在地图上与这个 NPC 交谈", 16, "#d7d0c7", { strokeThickness: 0 });
    this.text(455, 447, "② 完整看完普通对话，或走到分支对话结尾", 16, "#d7d0c7", { strokeThickness: 0 });
    this.text(455, 486, "③ 系统把右侧选择的物品放入真实储物袋", 16, "#73c69a", { strokeThickness: 0 });

    this.text(455, 548, "重复发放规则", 16, "#c8b994", { strokeThickness: 1 });
    this.selectField(455, 578, 515, quest.repeatPolicy, [
      { value: "once", label: "每个角色只能领取一次" },
      { value: "if_missing", label: "玩家没有该物品时补发（令牌推荐）" },
      { value: "always", label: "每次完成对话都发放" },
    ], (value) => { quest.repeatPolicy = value; }, 15);

    this.text(455, 650, "互动名称（仅用于编辑器识别）", 16, "#c8b994", { strokeThickness: 1 });
    this.valueField(455, 680, 515, quest.title || "", (value) => { quest.title = value; }, 15, "text", 40);
    this.text(455, 744, "给玩家的说明（选填）", 16, "#c8b994", { strokeThickness: 1 });
    this.valueField(455, 774, 515, quest.description || "", (value) => { quest.description = value; }, 15, "text", 40);
    this.text(455, 850, "提示：玩家主动点“返回地图”中断对话时不会领取。", 14, "#8f8a83", { strokeThickness: 0 });

    this.drawQuestRewardPanel(1042, 320, 787, 620, quest, "2　选择对话赠礼");
  }

  drawTaskCommissionEditor(quest) {
    this.roundedBox(409, 320, 750, 620, 0x1d1d1c, 0x49443e, 10, 2);
    this.text(445, 353, "1　填写玩家能看懂的任务资料", 20, "#f0ce57", { strokeThickness: 1 });
    [["任务名称", "title", "例如：调查青云山异光"], ["任务说明", "description", "告诉玩家为什么要做这件事"], ["任务目标", "target", "例如：击败青木狼 × 3"]].forEach(([label, key, hint], index) => {
      const y = 415 + index * 130;
      this.text(455, y, label, 16, "#c8b994", { strokeThickness: 1 });
      this.text(585, y + 1, hint, 13, "#77716b", { strokeThickness: 0 });
      this.valueField(455, y + 31, 655, quest[key] || "", (value) => { quest[key] = value; }, 15, "text", 44);
    });
    this.roundedBox(455, 806, 655, 82, 0x29231d, 0x5c4a37, 7, 1);
    this.text(475, 826, "设计提示", 15, "#e3bf69", { strokeThickness: 1 });
    this.text(475, 857, "当前第一章的打怪、收集等目标事件仍由任务领域服务接入；本页先保存任务资料和奖励。", 13, "#a79d91", { strokeThickness: 0 });

    this.drawQuestRewardPanel(1182, 320, 647, 620, quest, "2　选择任务完成奖励");
  }

  drawQuestRewardPanel(x, y, width, height, quest, heading) {
    this.roundedBox(x, y, width, height, 0x1d1d1c, 0x49443e, 10, 2);
    this.text(x + 35, y + 33, heading, 20, "#f0ce57", { strokeThickness: 1 });
    this.text(x + 35, y + 76, "物品来自“物品管理”；门派令牌等系统物品也会自动列出。", 14, "#918b84", { strokeThickness: 0 });
    const rewards = Array.isArray(quest.rewardItems) ? quest.rewardItems : (quest.rewardItems = []);
    const rows = rewards.length ? rewards : [{ itemId: "", quantity: 1, draft: true }];
    const choices = this.getQuestRewardChoices();
    rows.forEach((reward, index) => {
      const rowY = y + 122 + index * 82;
      this.text(x + 35, rowY + 7, `奖励 ${index + 1}`, 15, "#c8b994", { strokeThickness: 1 });
      this.selectField(x + 115, rowY, width - 300, reward.itemId || "", choices, (itemId) => {
        this.setQuestRewardItem(index, itemId);
      }, 14, { emptyLabel: "请选择物品" });
      this.text(x + width - 167, rowY + 7, "数量", 14, "#aaa39b", { strokeThickness: 0 });
      if (reward.draft) this.valueField(x + width - 110, rowY, 60, "1", null, 14, "number", 33);
      else this.valueField(x + width - 110, rowY, 60, reward.quantity, (raw) => this.commitNumber(raw, reward.quantity, (value) => { reward.quantity = Math.max(1, value); }), 14, "number", 33);
      if (!reward.draft) this.button(x + width - 42, rowY, 34, "×", () => this.removeQuestReward(index), {
        height: 33, size: 18, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff7867",
      });
    });

    if (rewards.length < 3) this.button(x + 35, y + 390, 235, "＋ 添加一种奖励", () => this.addQuestReward(), {
      height: 42, size: 15, fill: 0x3b352e, hover: 0x51483d, stroke: 0x77654d,
    });
    const configured = rewards.map((reward) => {
      const item = this.itemCatalog.getById(reward.itemId);
      return item ? `${item.name} × ${reward.quantity}` : "";
    }).filter(Boolean);
    this.roundedBox(x + 35, y + 458, width - 70, 120, 0x242b24, 0x46634b, 7, 1);
    this.text(x + 55, y + 479, "玩家最终获得", 15, "#73c69a", { strokeThickness: 1 });
    this.text(x + 55, y + 516, configured.length ? configured.join("　　") : "尚未选择物品", 17, configured.length ? "#e5ddd2" : "#77716b", { strokeThickness: 0, wordWrap: { width: width - 110 } });
  }

  getQuestRewardChoices() {
    const items = this.itemCatalog.all();
    return [
      { value: "", label: "请选择物品" },
      ...items.map((item) => ({
        value: item.id,
        label: `${item.name}　｜　${item.type || "物品"}${item.sellable === false ? " · 系统物品" : ""}`,
      })),
    ];
  }

  setQuestRewardItem(index, itemId) {
    const rewards = this.selected.quest.rewardItems || (this.selected.quest.rewardItems = []);
    if (!itemId) return;
    if (rewards.some((reward, rewardIndex) => rewardIndex !== index && reward.itemId === itemId)) {
      this.showNotice("这个物品已经在奖励列表中");
      return;
    }
    if (rewards[index]) rewards[index].itemId = itemId;
    else rewards.push({ itemId, quantity: 1 });
    this.refresh();
  }

  addQuestReward() {
    const rewards = this.selected.quest.rewardItems || (this.selected.quest.rewardItems = []);
    if (rewards.length >= 3) return;
    rewards.push({ itemId: "", quantity: 1 });
    this.refresh();
  }

  removeQuestReward(index) {
    this.selected.quest.rewardItems.splice(index, 1);
    this.refresh();
  }

  applyTianjianGuidePreset() {
    const item = this.selected;
    item.profile.sect = "天剑宗";
    item.profile.identity = "接引人";
    item.quest = {
      ...item.quest,
      enabled: true,
      mode: "talk_reward",
      title: "天剑宗接引凭证",
      description: "完成对话后赠送天剑宗令牌，持令牌可进入天剑宗。",
      target: "完整结束对话",
      rewardItems: [{ itemId: "sect:tianjian-token", quantity: 1 }],
      repeatPolicy: "if_missing",
      completionQuestId: "quest:tianjian-introduction",
    };
    this.refresh();
    this.showNotice("已配置：看完对话 → 获得天剑宗令牌 → 可进入天剑宗");
  }

  drawPreviewPage() {
    const item = this.selected;
    const branchStart = item.dialogueTree?.nodes?.find((node) => node.id === item.dialogueTree?.startId);
    const previewDialogue = item.dialogueMode === "branch" ? branchStart?.text : item.dialogue[0];
    this.sectionTitle("预览");
    this.roundedBox(465, 170, 1250, 610, 0x171717, 0x4c4640, 12, 2);
    this.drawPortrait(item, 1430, 472, 265, false, "portrait");
    this.roundedBox(535, 535, 730, 177, 0x30241c, 0x9c7a40, 10, 2);
    this.text(568, 559, item.name, 22, "#f4d56b", { strokeThickness: 3 });
    this.text(568, 601, previewDialogue || "……", 20, "#f5eee0", { wordWrap: { width: 650 }, lineSpacing: 6 });
    this.text(535, 815, "这是角色在地图中按 E 交谈时的对话预览。", 17, "#aaa39a", { strokeThickness: 1 });
  }

  drawPortrait(item, x, y, size, compact, type = "portrait") {
    // 历史 NPC 已有单独裁好的小头像；优先使用它，不能再拿整张立绘重复裁切。
    const imageData = type === "avatar"
      ? (item.avatarData || item.imageData || item.portraitData || "")
      : (item.portraitData || item.imageData || item.avatarData || "");
    // 空白新建 NPC 不显示系统示例人物，等待用户自行上传头像和立绘。
    if (!imageData && item.isNew) return;
    // 立绘和头像可能是两张不同的历史图片，必须各用独立纹理键；
    // 否则先绘制列表头像后，会错误复用到右侧立绘区域。
    const textureType = type === "avatar" ? "avatar" : "portrait";
    const customKey = `npc-manage-${textureType}-${item.id}`;
    if (imageData && !this.textures.exists(customKey)) this.loadNpcTexture(item, textureType, imageData);
    const textureKey = imageData && this.textures.exists(customKey) ? customKey : "npc-editor-default";
    const portrait = this.track(this.add.image(x, y, textureKey, textureKey === "npc-editor-default" ? 0 : undefined));
    // 按原比例缩放：立绘贴近大框下沿并尽量填满；头像居中填满圆框。
    // `npc-editor-default` 是精灵表，必须读取当前帧的实际尺寸；
    // 上传的普通图片在这里同样会取得自己的原始宽高。
    const source = { width: portrait.frame.width, height: portrait.frame.height };
    const maxWidth = size;
    const maxHeight = compact ? size : size * 1.46;
    if (compact) {
      const nearlySquare = Math.abs(source.width - source.height) / Math.max(source.width, source.height) < 0.12;
      if (nearlySquare) {
        // 已有的头像资源本身就是方形裁切图，直接等比填满圆框，不再二次放大或截断。
        portrait.setDisplaySize(size, size).setOrigin(0.5, 0.5);
      } else {
        // 新上传的只有立绘时，取上方中央的头肩区域生成头像。
        const cropSize = Math.min(source.width, source.height) * 0.55;
        const cropY = Math.min(Math.max(0, source.height * 0.04), Math.max(0, source.height - cropSize));
        // Phaser 的 setCrop 不会改变原始图片的定位原点，圆形蒙版下容易把胸口而非头肩放进圆内。
        // 因此保留完整立绘，按“头肩裁切区域”的尺寸缩放并移动到圆心；再由下方的圆形蒙版裁掉其余部分。
        const scale = size / cropSize;
        const cropTop = y - size / 2;
        portrait.setScale(scale).setOrigin(0.5, 0).setPosition(x, cropTop - cropY * scale);
      }
      // 头像不是把方图缩成圆，而是用真正的圆形 GeometryMask 收口：
      // 图片始终以圆心为中心，任何越出圆周的头发、衣服或透明像素都会被裁掉。
      // 蒙版半径与显示尺寸一致，外层圆框还能留下 2px 的描边安全边距。
      const avatarMask = this.track(this.add.graphics());
      avatarMask.fillStyle(0xffffff, 1);
      avatarMask.fillCircle(x, y, size / 2);
      portrait.setMask(avatarMask.createGeometryMask());
      // 蒙版仅参与裁切，不能渲染成一个白色实心圆。
      avatarMask.setVisible(false);
    } else {
      const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
      portrait.setDisplaySize(source.width * scale, source.height * scale);
      // 效果稿的立绘落在框底，留很小的下边距，而不是悬在框中央。
      portrait.setOrigin(0.5, 1).setY(y + maxHeight / 2 - 4);
    }
  }

  addItem() {
    const item = normalizeNpc({ isNew: true, name: "", dialogue: [], profile: { roots: {} } });
    this.items.push(item); this.selectedId = item.id; this.filteredItems = null; this.refresh();
  }

  deleteItem() {
    const item = this.selected;
    if (!item) return;
    this.items = this.items.filter((entry) => entry.id !== item.id);
    this.selectedId = this.items[0]?.id;
    this.filteredItems = null;
    this.refresh();
  }

  commitNumber(raw, currentValue, setValue) {
    const value = Number(raw);
    if (!Number.isFinite(value) || raw === "") { this.showNotice("请输入有效数字"); return false; }
    setValue(Math.max(0, Math.round(value)));
    return true;
  }

  commitNpcId(raw, item) {
    const nextId = raw.trim();
    if (!nextId) { this.showNotice("NPC ID 不能为空"); return false; }
    if (this.items.some((entry) => entry !== item && entry.id === nextId)) {
      this.showNotice("这个 NPC ID 已存在");
      return false;
    }
    item.id = nextId;
    this.selectedId = nextId;
    return true;
  }

  /** 上传立绘：只用于对话、预览等显示半身人物的位置。 */
  pickPortrait() {
    this.pickFile((data) => this.setNpcImage("portrait", data), { maxSide: 768, quality: 0.84 });
  }

  /**
   * 两张图片分别用不同的 Phaser 纹理名称加载。
   * 等图片真正读取完成后才重画界面，因此不会再出现上传后的空框或互相覆盖。
   */
  setNpcImage(type, data) {
    const item = this.selected;
    item.portraitData = data;
    item.avatarData = data;
    item.imageData = data;
    // 新立绘上传后，头像也应立即换成同一张图；清掉旧头像纹理，下一次绘制会重新读取新图。
    const avatarTextureKey = `npc-manage-avatar-${item.id}`;
    if (this.textures.exists(avatarTextureKey)) this.textures.remove(avatarTextureKey);
    this.loadNpcTexture(item, "portrait", data, true);
  }

  /**
   * 原生 Image.onload 在图片真正读完时触发，再交给 Phaser 注册纹理。
   * 这样上传的当前图片立即显示，不会等到下一次点按钮或刷新界面才出现。
   */
  loadNpcTexture(item, type, data, replace = false) {
    const textureKey = `npc-manage-${type}-${item.id}`;
    this.loadingNpcTextures ??= new Set();
    if (this.loadingNpcTextures.has(textureKey)) return;
    if (!replace && this.textures.exists(textureKey)) return;
    this.loadingNpcTextures.add(textureKey);
    const image = new Image();
    image.onload = () => {
      if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
      this.textures.addImage(textureKey, image);
      this.loadingNpcTextures.delete(textureKey);
      this.refresh();
    };
    image.onerror = () => {
      this.loadingNpcTextures.delete(textureKey);
      this.showNotice("图片读取失败，请换一张 PNG、JPG 或 WEBP 图片");
    };
    image.src = data;
  }
  pickFile(done, options) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      this.showNotice("正在转换为 WebP…");
      prepareImageForStorage(file, options)
        .then((imageData) => {
          done(imageData);
          this.showNotice("图片已转换为 WebP，请点击保存全部");
        })
        .catch(() => this.showNotice("图片处理失败，请换一张 PNG、JPG 或 WEBP 图片"));
    };
    input.click();
  }

  async save() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.commitAllDomInputs();
    const prepared = this.items.map(normalizeNpc);
    this.showNotice("正在整理图片并保存…");
    const savingOptions = [
      { portrait: 768, avatar: 384, map: 512, quality: 0.82 },
      { portrait: 640, avatar: 320, map: 448, quality: 0.76 },
      { portrait: 512, avatar: 256, map: 384, quality: 0.7 },
    ];
    for (const option of savingOptions) {
      try {
        const compressed = await Promise.all(prepared.map(async (item) => {
          const portraitData = item.portraitData
            ? await optimiseImageForStorage(item.portraitData, option.portrait, option.quality)
            : "";
          const avatarData = portraitData;
          const mapPortraitData = item.mapPortraitData
            ? await optimiseImageForStorage(item.mapPortraitData, option.map, option.quality)
            : "";
          return { ...item, portraitData, avatarData, mapPortraitData, imageData: avatarData };
        }));
        if (saveNpcTemplates(compressed)) {
          this.items = compressed;
          this.isSaving = false;
          this.refresh();
          this.showNotice("NPC资料与 WebP 图片已保存");
          return;
        }
      } catch (error) {
        // 当前清晰度保存失败后继续尝试更轻的图片档位。
      }
    }
    this.isSaving = false;
    this.showNotice("保存失败：无法写入项目文件夹，请确认本地服务器正在运行");
  }

  /** 保存前强制提交所有框内的文字，包含仍在编辑、尚未失焦的灵根数值。 */
  commitAllDomInputs() {
    (this.domInputs || []).forEach((entry) => entry.commit?.());
  }

  showNotice(message) {
    const notice = this.add.container(1600, 930);
    const bg = this.add.rectangle(0, 0, 220, 48, 0x365d39, 0.98).setStrokeStyle(1, 0x7bac70);
    const text = addText(this, 0, 0, message, 17, "#f1f0d7", { strokeThickness: 2 }).setOrigin(0.5);
    notice.add([bg, text]);
    this.tweens.add({ targets: notice, alpha: 0, delay: 1300, duration: 400, onComplete: () => notice.destroy() });
  }
}

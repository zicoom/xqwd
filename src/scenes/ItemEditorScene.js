import {
  ARTIFACT_CATEGORIES,
  BOOK_KINDS,
  ELEMENT_TYPES,
  EQUIPMENT_SLOTS,
  getItemTemplates,
  HERB_EFFECT_TYPES,
  ITEM_GRADES,
  ITEM_TYPES,
  MATERIAL_PURPOSES,
  OTHER_KINDS,
  PILL_EFFECT_TYPES,
  RESISTANCE_TYPES,
  TECHNIQUE_KINDS,
  normalizeItem,
  saveItemTemplates,
} from "../core/ItemStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";
import { optimiseImageForStorage, prepareImageForStorage } from "../utils/ImageStorage.js";

/**
 * 物品管理编辑器。
 * 采用 NPC 管理相同的：左侧资料列表 + 顶部分页 + 右侧直接填写的结构。
 */
export class ItemEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.ITEM_EDITOR); }

  preload() {
    ["baixiangye", "chiyangshen", "juqicao", "linggugen", "ninglutai", "qinglinghua", "qingmaiteng", "xingyingguo", "yuelulan", "yuyazhi"]
      .forEach((name) => this.load.image(`merchant-herb-${name}`, `./public/assets/images/merchant/herb-${name}.png`));
  }

  create() {
    rememberEditorRoute(SceneKeys.ITEM_EDITOR);
    this.items = getItemTemplates();
    this.selectedId = this.items[0]?.id || null;
    this.page = "basic";
    this.categoryFilter = "全部";
    this.listStartIndex = 0;
    this.domInputs = [];
    this.ui = this.add.container();
    this.windowResizeHandler = () => this.layoutDomInputs();
    window.addEventListener("resize", this.windowResizeHandler);
    this.wheelHandler = (pointer, _objects, _deltaX, deltaY) => {
      if (pointer.x >= 8 && pointer.x <= 344 && pointer.y >= 216 && pointer.y <= 992 && deltaY !== 0) {
        this.scrollItemList(deltaY > 0 ? 1 : -1);
      }
    };
    this.input.on("wheel", this.wheelHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("resize", this.windowResizeHandler);
      this.input.off("wheel", this.wheelHandler);
      this.clearDomInputs();
    });
    this.refresh();
  }

  get selected() { return this.items.find((item) => item.id === this.selectedId); }
  track(display) { this.ui.add(display); return display; }

  refresh() {
    this.clearDomInputs();
    this.ui.removeAll(true);
    this.drawBackground();
    this.drawHeader();
    this.drawSidebar();
    this.drawContent();
  }

  drawBackground() {
    this.track(this.add.rectangle(960, 540, 1920, 1080, 0x171310));
    this.track(this.add.rectangle(174, 540, 348, 1080, 0x211812));
    this.track(this.add.rectangle(960, 35, 1920, 70, 0x211711));
    this.track(this.add.rectangle(960, 70, 1920, 1, 0x76512e, 0.75));
  }

  text(x, y, value, size = 20, color = "#eee3ca", style = {}) {
    return this.track(addText(this, x, y, value, size, color, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif", stroke: "#19130f", strokeThickness: 2, ...style,
    }));
  }

  box(x, y, width, height, fill = 0x242322, stroke = 0x45413d, radius = 8, lineWidth = 2) {
    const graphic = this.track(this.add.graphics());
    graphic.fillStyle(fill, 1).fillRoundedRect(x, y, width, height, radius);
    if (stroke !== null) graphic.lineStyle(lineWidth, stroke, 1).strokeRoundedRect(x, y, width, height, radius);
    return graphic;
  }

  button(x, y, width, label, action, options = {}) {
    const height = options.height ?? 44;
    const normal = options.fill ?? 0x4b3627;
    const hover = options.hover ?? 0x65482f;
    const background = this.track(this.add.rectangle(x + width / 2, y + height / 2, width, height, normal)
      .setStrokeStyle(options.lineWidth ?? 2, options.stroke ?? 0xe6bd61).setInteractive({ useHandCursor: true }));
    this.text(x + width / 2, y + height / 2, label, options.size ?? 17, options.color ?? "#f5e5b7", { strokeThickness: 2 }).setOrigin(0.5);
    background.on("pointerover", () => background.setFillStyle(hover));
    background.on("pointerout", () => background.setFillStyle(normal));
    background.on("pointerdown", () => { playUiClickSound(this); action(); });
    return background;
  }

  drawHeader() {
    this.text(31, 26, "物品管理", 25, "#f4d5a4");
    this.text(292, 26, `${this.items.length}个`, 23, "#f4d5a4");
    [["basic", "基本信息"], ["effect", "使用效果"], ["shop", "商店设置"], ["preview", "预览"]].forEach(([key, label], index) => {
      const x = 382 + index * 135;
      const active = key === this.page;
      const hit = this.track(this.add.rectangle(x + 56, 35, 112, 70, active ? 0x4b321d : 0x211711, active ? 1 : 0.01).setInteractive({ useHandCursor: true }));
      this.text(x + 56, 35, label, 17, active ? "#f4cf56" : "#aaa096", { strokeThickness: 1 }).setOrigin(0.5);
      if (active) this.track(this.add.rectangle(x + 56, 67, 112, 3, 0xf0ca5c));
      hit.on("pointerdown", () => { playUiClickSound(this); this.page = key; this.refresh(); });
    });
    this.button(1754, 15, 106, "返回", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), {
      height: 40, size: 16, fill: 0x4b3928, hover: 0x654b31, stroke: 0x80613d,
    });
  }

  drawSidebar() {
    this.box(14, 84, 322, 44, 0x282624, 0x45403b, 4, 1);
    const search = this.domInput(14, 84, 322, 44, this.searchKeyword || "", (value) => {
      this.searchKeyword = value;
      this.refresh();
    }, { placeholder: "搜索物品名称..." });
    const filters = ["全部", "灵草", "丹药", "功法", "书籍", "装备", "材料", "其他"];
    filters.forEach((filter, index) => {
      const secondRow = index >= 4;
      // 两行筛选保持同一组宽度和间距，避免第二行越出左侧栏。
      const x = secondRow ? 14 + (index - 4) * 82 : 14 + index * 82;
      const width = 74;
      const y = secondRow ? 177 : 138;
      const active = filter === this.categoryFilter;
      this.button(x, y, width, filter, () => { this.categoryFilter = filter; this.listStartIndex = 0; this.refresh(); }, {
        height: 31,
        size: 14,
        fill: active ? 0x9b7431 : 0x39302a,
        hover: active ? 0xae8740 : 0x4a3c31,
        stroke: active ? 0xf0c85c : 0x655246,
        lineWidth: 1,
        color: active ? "#fff0c7" : "#d8c7ad",
      });
    });

    const keyword = (this.searchKeyword || "").trim();
    const list = this.getSidebarItems(keyword);
    const visibleCount = 8;
    const maxStart = Math.max(0, list.length - visibleCount);
    this.listStartIndex = Phaser.Math.Clamp(this.listStartIndex || 0, 0, maxStart);
    list.slice(this.listStartIndex, this.listStartIndex + visibleCount).forEach((item, index) => this.drawItemCard(item, index));

    if (list.length > visibleCount) this.drawListScrollbar(list.length, visibleCount, maxStart);
    this.button(14, 1007, 322, "＋ 新建物品", () => this.addItem(), { height: 56, fill: 0x365d39, hover: 0x467847, stroke: 0x5f9561, size: 19 });
  }

  getSidebarItems(keyword = (this.searchKeyword || "").trim()) {
    return this.items
      .filter((item) => this.matchesCategory(item))
      .filter((item) => !keyword || item.name.includes(keyword) || item.type.includes(keyword));
  }

  scrollItemList(direction) {
    const maxStart = Math.max(0, this.getSidebarItems().length - 8);
    const next = Phaser.Math.Clamp((this.listStartIndex || 0) + direction, 0, maxStart);
    if (next === this.listStartIndex) return;
    this.listStartIndex = next;
    playUiClickSound(this);
    this.refresh();
  }

  drawListScrollbar(total, visible, maxStart) {
    const top = 218;
    const height = 752;
    const track = this.track(this.add.rectangle(329, top + height / 2, 5, height, 0x171411, 0.9));
    const thumbHeight = Math.max(70, height * (visible / total));
    const thumbY = top + thumbHeight / 2 + ((height - thumbHeight) * ((this.listStartIndex || 0) / maxStart));
    const thumb = this.track(this.add.rectangle(329, thumbY, 7, thumbHeight, 0x8d6b3f, 0.95)
      .setInteractive({ useHandCursor: true }));
    const up = this.text(310, 205, "▲", 13, "#d2b379", { strokeThickness: 0 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const down = this.text(310, 987, "▼", 13, "#d2b379", { strokeThickness: 0 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    up.on("pointerdown", () => this.scrollItemList(-1));
    down.on("pointerdown", () => this.scrollItemList(1));
    thumb.on("pointerdown", () => track.setFillStyle(0x3a2a1c));
  }

  matchesCategory(item) {
    if (this.categoryFilter === "全部") return true;
    if (this.categoryFilter === "材料") return ["材料", "器材"].includes(item.type);
    if (this.categoryFilter === "其他") return !["灵草", "丹药", "功法", "书籍", "装备", "材料", "器材"].includes(item.type);
    return item.type === this.categoryFilter;
  }

  drawItemCard(item, index) {
    const y = 218 + index * 96;
    const active = item.id === this.selectedId;
    const card = this.track(this.add.rectangle(175, y + 39, 322, 80, active ? 0x4a311b : 0x292827)
      .setStrokeStyle(2, active ? 0xd8ad58 : 0x3f3c38).setInteractive({ useHandCursor: true }));
    this.track(this.add.rectangle(58, y + 39, 60, 60, this.gradeColor(item.grade)).setStrokeStyle(2, 0x65503a));
    this.drawItemImage(item, 58, y + 39, 52);
    this.text(109, y + 18, item.name || "未命名物品", 20, "#f2ce4a", { strokeThickness: 1 });
    this.text(109, y + 48, `${item.type} · ${item.grade}`, 14, this.gradeTextColor(item.grade), { strokeThickness: 0 });
    card.on("pointerdown", () => { playUiClickSound(this); this.selectedId = item.id; this.refresh(); });
  }

  drawContent() {
    this.box(367, 84, 1530, 980, 0x262525, 0x45413d, 8, 2);
    if (!this.selected) { this.text(1132, 510, "请新建一个物品", 28, "#d7c6a5").setOrigin(0.5); return; }
    if (this.page === "basic") this.drawBasicPage();
    if (this.page === "effect") this.drawEffectPage();
    if (this.page === "shop") this.drawShopPage();
    if (this.page === "preview") this.drawPreviewPage();
  }

  section(value, x = 389, y = 100) { this.text(x, y, value, 20, "#f0ce57", { strokeThickness: 1 }); }
  gradeColor(grade) { return ({ "凡品": 0x414040, "灵品": 0x285c45, "玄品": 0x294e71, "地品": 0x70471d, "天品": 0x653962, "仙品": 0x9a6920, "神器": 0x8b3b37 })[grade] || 0x414040; }
  gradeTextColor(grade) { return ({ "凡品": "#c8c1b7", "灵品": "#63cfa0", "玄品": "#6ba9e4", "地品": "#d7a052", "天品": "#d183dc", "仙品": "#f2cf6c", "神器": "#ef7069" })[grade] || "#c8c1b7"; }

  drawBasicPage() {
    const item = this.selected;
    this.section("物品图标");
    this.box(840, 150, 220, 220, 0x1d1d1c, 0x4b4945, 10, 2);
    this.drawItemImage(item, 950, 260, 180);
    this.button(1095, 220, 220, "上传物品图片", () => this.pickImage(), { height: 45, fill: 0x9d8248, hover: 0xb09255, stroke: 0x9d8248 });
    this.button(1095, 282, 220, "清除自定义图片", () => { item.imageData = ""; this.refresh(); }, { height: 42, fill: 0x383838, hover: 0x4c4c4c, stroke: 0x383838, color: "#b6b1a9" });
    this.text(950, 392, "商店与储物袋显示", 16, "#aaa39b", { strokeThickness: 0 }).setOrigin(0.5);

    this.section("基本信息", 389, 470);
    this.box(388, 505, 690, 365, 0x242322, 0x3d3935, 8, 2);
    const fields = [
      ["物品 ID", item.id, (value) => this.commitId(value, item)], ["名称", item.name, (value) => { item.name = value; }],
      ["类型", item.type, (value) => { item.type = value; this.refresh(); }, "select", ITEM_TYPES],
      ["品阶", item.grade, (value) => { item.grade = value; this.refresh(); }, "select", ITEM_GRADES],
      ["图片键名", item.texture, (value) => { item.texture = value; }],
    ];
    fields.forEach(([label, value, commit, kind, choices], index) => {
      const y = 535 + index * 57;
      this.text(425, y + 9, label, 16, "#bcb5ad", { strokeThickness: 0 });
      this.field(514, y, 470, value, commit, { select: kind === "select", choices });
    });
    this.section("物品说明", 1110, 470);
    this.box(1109, 505, 716, 365, 0x242322, 0x3d3935, 8, 2);
    this.text(1140, 535, "说明会显示在商店、储物袋的物品详情里。", 16, "#aaa39b", { strokeThickness: 0 });
    this.textarea(1140, 580, 645, 180, item.description, (value) => { item.description = value; }, "请输入物品说明…");
    const isEquipment = item.type === "装备";
    if (isEquipment) {
      this.section("套装加成（装备专用）", 389, 885);
      this.box(388, 914, 1437, 100, 0x242322, 0x3d3935, 8, 2);
      const setFields = [
        ["套装名称", 425, 924, 514, 315, item.setName, (value) => { item.setName = value; }],
        ["装备部位", 865, 924, 954, 315, item.equipmentSlot, (value) => { item.equipmentSlot = value; }, "select", EQUIPMENT_SLOTS],
        ["2件套效果", 425, 968, 514, 285, item.setBonus2, (value) => { item.setBonus2 = value; }],
        ["4件套效果", 830, 968, 919, 285, item.setBonus4, (value) => { item.setBonus4 = value; }],
        ["6件套效果", 1235, 968, 1324, 455, item.setBonus6, (value) => { item.setBonus6 = value; }],
      ];
      setFields.forEach(([label, labelX, y, fieldX, width, value, commit, kind, choices]) => {
        this.text(labelX, y + 9, label, 16, "#bcb5ad", { strokeThickness: 0 });
        this.field(fieldX, y, width, value, commit, { select: kind === "select", choices });
      });
    }

    const actionY = isEquipment ? 1020 : 960;
    this.button(1380, actionY, 145, "删除", () => this.deleteItem(), { height: 42, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff6c57" });
    this.button(1540, actionY, 285, "保存全部", () => this.save(), { height: 42, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360, size: 18 });
  }

  getEffectConfig(item) {
    const select = (label, key, choices) => ({ label, key, type: "select", choices });
    const number = (label, key, max) => ({ label, key, type: "number", max });
    const input = (label, key) => ({ label, key, type: "text" });

    const configs = {
      灵草: {
        useLabel: "可直接使用",
        noteLabel: "灵草作用说明",
        placeholder: "例如：可作为炼制聚气丹的主药；采集自青云山北坡。",
        left: [
          select("药效类别", "herbEffect", HERB_EFFECT_TYPES),
          number("药龄（年）", "herbMaturity"),
          number("药力", "herbMedicinalPower"),
          number("炼丹价值", "herbAlchemyValue"),
          select("元素属性", "herbElement", ELEMENT_TYPES),
        ],
        right: [
          number("恢复生命", "restoreHp"),
          number("恢复修为", "restoreQi"),
          select("抗性属性", "resistanceType", RESISTANCE_TYPES),
          number("抗性数值", "resistance"),
          number("持续（秒）", "duration"),
        ],
      },
      丹药: {
        useLabel: "可直接使用",
        noteLabel: "丹药效果说明",
        placeholder: "例如：服用后进入破阶状态，提升炼气期小境界突破成功率。",
        left: [
          select("丹药效果", "pillEffect", PILL_EFFECT_TYPES),
          input("适用境界", "pillRealm"),
          number("恢复生命", "pillHpRestore"),
          number("恢复修为", "pillQiRestore"),
          number("突破成功加成", "pillBreakthrough"),
        ],
        right: [
          select("抗性属性", "pillResistanceType", RESISTANCE_TYPES),
          number("抗性数值", "pillResistance"),
          number("持续（秒）", "pillDuration"),
          number("成功率（%）", "pillSuccessRate", 100),
        ],
      },
      功法: {
        useLabel: "可学习",
        noteLabel: "功法 / 法术说明",
        placeholder: "例如：施展后发出火焰剑气，对目标造成火属性伤害。",
        left: [
          select("功法类型", "techniqueKind", TECHNIQUE_KINDS),
          select("元素属性", "techniqueElement", ELEMENT_TYPES),
          number("基础伤害", "techniqueDamage"),
          number("灵力消耗", "techniqueQiCost"),
          number("冷却（秒）", "techniqueCooldown"),
        ],
        right: [
          number("持续（秒）", "techniqueDuration"),
          number("施法范围", "techniqueRange"),
          // 只有装入功法页的“速度位”时才参与战斗先手判定。
          number("先手速度", "techniqueInitiative"),
          input("学习境界", "techniqueLearnRealm"),
          number("等级上限", "techniqueLevelLimit", 99),
        ],
      },
      法宝: {
        useLabel: "可装备",
        noteLabel: "法宝能力说明",
        placeholder: "例如：御剑飞行时提升先手，或为角色提供护体抗性。",
        left: [
          select("法宝类别", "artifactCategory", ARTIFACT_CATEGORIES),
        ],
        right: [],
      },
      书籍: {
        useLabel: "可阅读",
        noteLabel: "书籍 / 配方说明",
        placeholder: "例如：记载筑基丹丹方，阅读后可解锁炼制配方。",
        left: [
          select("书籍类型", "bookKind", BOOK_KINDS),
          input("学习名称", "bookLearnName"),
          input("学习境界", "bookRequiredRealm"),
          number("修炼经验", "bookCultivationExp"),
        ],
        right: [
          number("学习成功率（%）", "bookSuccessRate", 100),
          number("阅读时长（秒）", "bookDuration"),
          input("配方产物", "bookFormulaOutput"),
          input("材料需求", "bookIngredientText"),
        ],
      },
      装备: {
        useLabel: "可装备",
        noteLabel: "装备特效说明",
        placeholder: "例如：攻击命中时附加火焰伤害；套装属性请在“基本信息”页填写。",
        left: [
          select("装备部位", "equipmentSlot", EQUIPMENT_SLOTS),
          number("攻击加成", "equipAttack"),
          number("防御加成", "equipDefense"),
          number("伤害加成", "equipDamage"),
          number("生命加成", "equipHp"),
          number("修为加成", "equipQi"),
        ],
        right: [
          number("暴击率（%）", "equipCritRate", 100),
          number("暴击伤害（%）", "equipCritDamage"),
          select("元素属性", "equipElement", ELEMENT_TYPES),
          number("元素伤害", "equipElementDamage"),
          select("抗性属性", "equipResistanceType", RESISTANCE_TYPES),
          number("抗性数值", "equipResistance"),
        ],
      },
      材料: {
        useLabel: "可作为材料",
        noteLabel: "材料用途说明",
        placeholder: "例如：用于炼制筑基丹或锻造火属性法器。",
        left: [
          select("材料用途", "materialPurpose", MATERIAL_PURPOSES),
          select("元素属性", "materialElement", ELEMENT_TYPES),
          number("材料纯度（%）", "materialPurity", 100),
          number("材料硬度", "materialHardness"),
          number("堆叠上限", "materialStackLimit", 9999),
          number("炼器价值", "materialForgeValue"),
        ],
        right: [
          number("任务等级", "materialTaskLevel"),
          input("产地", "materialOrigin"),
          input("用途关键词", "materialUseText"),
        ],
      },
      其他: {
        useLabel: "可使用",
        noteLabel: "其他用途说明",
        placeholder: "例如：凭此令牌可进入青云山秘境。",
        left: [
          select("物品类别", "otherKind", OTHER_KINDS),
          number("物品价值", "otherValue"),
          input("任务编号", "otherTaskId"),
          number("持续（秒）", "otherDuration"),
          number("自定义数值", "otherCustomValue"),
        ],
        right: [
          select("交易状态", "otherTradable", ["可交易", "不可交易"]),
          input("用途关键词", "otherUseText"),
        ],
      },
    };
    return configs[item.type] || configs.其他;
  }

  drawEffectField(item, field, labelX, fieldX, y) {
    const initial = item[field.key] ?? (field.type === "select" ? field.choices?.[0] : field.type === "number" ? 0 : "");
    this.text(labelX, y + 9, field.label, 16, "#c8bfb4", { strokeThickness: 0 });
    const commit = (value) => {
      item[field.key] = field.max === undefined ? value : Math.min(field.max, value);
    };
    if (field.type === "select") {
      this.field(fieldX, y, 230, initial, commit, { select: true, choices: field.choices });
      return;
    }
    if (field.type === "text") {
      this.field(fieldX, y, 230, initial, commit);
      return;
    }
    this.numberField(fieldX, y, 230, initial, commit);
  }

  getEffectPreview(item) {
    const lines = [];
    const add = (label, value, suffix = "") => {
      if (value !== undefined && value !== null && value !== "" && Number(value) !== 0) lines.push(`${label}${value}${suffix}`);
    };
    const addText = (label, value) => {
      if (value && value !== "无") lines.push(`${label}${value}`);
    };
    switch (item.type) {
      case "灵草":
        addText("药效：", item.herbEffect);
        add("药力 +", item.herbMedicinalPower);
        add("炼丹价值 +", item.herbAlchemyValue);
        addText("元素：", item.herbElement);
        break;
      case "丹药":
        addText("药效：", item.pillEffect);
        add("生命 +", item.pillHpRestore);
        add("修为 +", item.pillQiRestore);
        add("突破加成 +", item.pillBreakthrough, "%");
        addText("抗性：", item.pillResistanceType);
        break;
      case "功法":
        addText("类型：", item.techniqueKind);
        addText("元素：", item.techniqueElement);
        add("伤害 +", item.techniqueDamage);
        add("灵力消耗 ", item.techniqueQiCost);
        break;
      case "法宝":
        addText("类别：", item.artifactCategory);
        break;
      case "书籍":
        addText("类别：", item.bookKind);
        addText("学习：", item.bookLearnName);
        add("修炼经验 +", item.bookCultivationExp);
        addText("配方：", item.bookFormulaOutput);
        break;
      case "装备":
        addText("部位：", item.equipmentSlot);
        add("攻击 +", item.equipAttack);
        add("防御 +", item.equipDefense);
        add("伤害 +", item.equipDamage);
        add("生命 +", item.equipHp);
        add("修为 +", item.equipQi);
        add("暴击率 +", item.equipCritRate, "%");
        addText("元素：", item.equipElement);
        addText("套装：", item.setName);
        break;
      case "材料":
        addText("用途：", item.materialPurpose);
        addText("元素：", item.materialElement);
        add("纯度 ", item.materialPurity, "%");
        add("炼器价值 +", item.materialForgeValue);
        break;
      default:
        addText("类别：", item.otherKind);
        add("价值 ", item.otherValue);
        addText("任务：", item.otherTaskId);
        addText("交易：", item.otherTradable);
    }
    return lines.slice(0, 8);
  }

  drawEffectPage() {
    const item = this.selected;
    const config = this.getEffectConfig(item);
    this.section("使用效果");
    this.box(408, 150, 1040, 600, 0x20201f, 0x49443e, 10, 2);
    this.text(455, 198, config.useLabel, 19, "#e7d3ad", { strokeThickness: 0 });
    this.button(600, 176, 150, item.canUse ? "已启用" : "未启用", () => { item.canUse = !item.canUse; this.refresh(); }, {
      height: 42, fill: item.canUse ? 0x365d39 : 0x4b3627, hover: item.canUse ? 0x477849 : 0x65482f,
      stroke: item.canUse ? 0x5d9360 : 0xe6bd61,
    });
    config.left.forEach((field, index) => this.drawEffectField(item, field, 455, 620, 255 + index * 50));
    config.right.forEach((field, index) => this.drawEffectField(item, field, 930, 1090, 255 + index * 50));
    this.text(455, 570, config.noteLabel, 18, "#c8bfb4", { strokeThickness: 0 });
    this.textarea(455, 600, 820, 95, item.skillText, (value) => { item.skillText = value; }, config.placeholder);
    this.section("效果预览", 1500, 150);
    this.box(1490, 190, 275, 355, 0x292017, 0x705239, 10, 2);
    this.drawItemImage(item, 1628, 285, 116);
    this.text(1628, 370, item.name || "未命名物品", 23, "#ffe000", { strokeThickness: 1 }).setOrigin(0.5);
    const effect = this.getEffectPreview(item);
    this.text(1520, 415, effect.join("\n") || "暂未设置数值效果", 17, "#c9b9a5", { strokeThickness: 0, lineSpacing: 8, wordWrap: { width: 220 } });
    this.button(1540, 960, 285, "保存全部", () => this.save(), { height: 42, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360, size: 18 });
  }

  drawShopPage() {
    const item = this.selected;
    this.section("商店设置");
    this.box(408, 150, 1040, 500, 0x20201f, 0x49443e, 10, 2);
    this.text(455, 208, "可在商人处出售", 19, "#e7d3ad", { strokeThickness: 0 });
    this.button(655, 186, 150, item.sellable ? "已上架" : "未上架", () => { item.sellable = !item.sellable; this.refresh(); }, {
      height: 42, fill: item.sellable ? 0x365d39 : 0x4b3627, hover: item.sellable ? 0x477849 : 0x65482f,
      stroke: item.sellable ? 0x5d9360 : 0xe6bd61,
    });
    this.text(455, 300, "单价（灵石）", 18, "#c8bfb4", { strokeThickness: 0 });
    this.numberField(655, 284, 270, item.price, (value) => { item.price = value; });
    this.text(455, 380, "初始库存", 18, "#c8bfb4", { strokeThickness: 0 });
    this.numberField(655, 364, 270, item.stock, (value) => { item.stock = value; });
    this.text(455, 468, "说明", 16, "#aaa39b", { strokeThickness: 0, wordWrap: { width: 750 } });
    this.text(455, 510, "保存后，关闭再打开商店会按这里的物品资料读取；已购买库存仍由当前角色存档保存。", 17, "#c8bfb4", { strokeThickness: 0, wordWrap: { width: 780 } });
    this.section("商店卡片预览", 1500, 150);
    this.box(1490, 190, 275, 320, 0x25170f, 0x705039, 10, 2);
    this.box(1520, 220, 105, 98, this.gradeColor(item.grade), null, 6, 0);
    this.drawItemImage(item, 1572, 269, 80);
    this.text(1648, 240, item.name || "未命名", 20, "#f0d3a5", { strokeThickness: 0 });
    this.text(1648, 286, `◆ ${item.price}`, 18, "#d8dfc7", { strokeThickness: 0 });
    this.text(1520, 358, `库存：${item.stock}`, 17, "#c5b5a2", { strokeThickness: 0 });
    this.text(1520, 400, item.sellable ? "已在商人货架显示" : "未上架，不会在商店显示", 16, item.sellable ? "#9bd69a" : "#d7a592", { strokeThickness: 0 });
    this.button(1540, 960, 285, "保存全部", () => this.save(), { height: 42, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360, size: 18 });
  }

  drawPreviewPage() {
    const item = this.selected;
    this.section("物品预览");
    this.box(700, 190, 760, 550, 0x21150d, 0x845f39, 14, 2);
    this.box(790, 290, 180, 166, this.gradeColor(item.grade), 0x704c30, 8, 2);
    this.drawItemImage(item, 880, 373, 132);
    this.text(1070, 300, item.name || "未命名物品", 30, "#f8d600", { strokeThickness: 1 });
    this.text(1070, 350, `类型：${item.type}`, 19, "#dfc08b", { strokeThickness: 0 });
    this.text(1070, 386, `品阶：${item.grade}`, 19, this.gradeTextColor(item.grade), { strokeThickness: 0 });
    this.text(790, 500, item.description || "尚未填写物品说明。", 19, "#c4b6a5", { strokeThickness: 0, wordWrap: { width: 570 }, lineSpacing: 8 });
    this.text(790, 665, `商店单价：${item.price} 灵石　库存：${item.stock}`, 18, "#d7c2a1", { strokeThickness: 0 });
  }

  drawItemImage(item, x, y, maxSize) {
    const customKey = `item-editor-${item.id}`;
    let texture = item.texture;
    if (item.imageData) {
      if (!this.textures.exists(customKey)) this.loadItemTexture(item);
      texture = this.textures.exists(customKey) ? customKey : null;
    }
    if (texture && this.textures.exists(texture)) {
      const image = this.track(this.add.image(x, y, texture));
      const source = image.frame;
      const scale = Math.min(maxSize / source.width, maxSize / source.height);
      image.setDisplaySize(source.width * scale, source.height * scale);
      return image;
    }
    // 新建物品未上传图片时保持空白，不沿用任何旧物品图标。
    return null;
  }

  clearDomInputs() { this.domInputs.forEach((entry) => entry.element.remove()); this.domInputs = []; }
  layoutDomInputs() {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / 1920; const scaleY = rect.height / 1080;
    this.domInputs.forEach((entry) => {
      entry.element.style.left = `${rect.left + entry.x * scaleX}px`;
      entry.element.style.top = `${rect.top + entry.y * scaleY}px`;
      entry.element.style.width = `${entry.width * scaleX}px`;
      entry.element.style.height = `${entry.height * scaleY}px`;
      entry.element.style.fontSize = `${entry.fontSize * Math.min(scaleX, scaleY)}px`;
    });
  }

  domInput(x, y, width, height, value, onCommit, options = {}) {
    const element = document.createElement("input");
    element.type = options.type || "text"; element.value = String(value ?? ""); element.autocomplete = "off";
    element.placeholder = options.placeholder || "";
    element.style.cssText = `position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:0 16px;border:1px solid transparent;border-radius:5px;outline:none;background:transparent;color:#ddd7cf;font-family:Microsoft YaHei,Noto Sans SC,sans-serif;text-align:${options.align || "left"};`;
    const entry = { element, x, y, width, height, fontSize: options.fontSize || 15 };
    let committed = element.value;
    entry.commit = () => { const next = element.value.trim(); if (next !== committed && onCommit(next) !== false) committed = next; };
    element.addEventListener("focus", () => { element.style.borderColor = "#b79754"; });
    element.addEventListener("blur", () => { element.style.borderColor = "transparent"; entry.commit(); });
    element.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); element.blur(); } event.stopPropagation(); });
    document.body.appendChild(element); this.domInputs.push(entry); this.layoutDomInputs(); return element;
  }

  textarea(x, y, width, height, value, onChange, placeholder) {
    this.box(x, y, width, height, 0x1b1b1a, 0x393735, 5, 1);
    const element = document.createElement("textarea");
    element.value = String(value ?? ""); element.placeholder = placeholder; element.spellcheck = false;
    element.style.cssText = "position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:12px 16px;border:1px solid transparent;border-radius:5px;outline:none;resize:none;background:transparent;color:#ddd7cf;font-family:Microsoft YaHei,Noto Sans SC,sans-serif;line-height:1.6;";
    const entry = { element, x, y, width, height, fontSize: 16, commit: () => onChange(element.value.trim()) };
    element.addEventListener("input", entry.commit); element.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.appendChild(element); this.domInputs.push(entry); this.layoutDomInputs();
  }

  field(x, y, width, value, onCommit, options = {}) {
    this.box(x, y, width, 36, 0x1b1b1a, 0x393735, 5, 1);
    if (!options.select) return this.domInput(x, y, width, 36, value, onCommit, { type: options.type || "text", align: options.align });
    const select = document.createElement("select");
    options.choices.forEach((choice) => { const option = document.createElement("option"); option.value = choice; option.textContent = choice; select.appendChild(option); });
    select.value = value;
    select.style.cssText = "position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:0 16px;border:1px solid transparent;border-radius:5px;outline:none;background:#1A1A1A;color:#ddd7cf;font-family:Microsoft YaHei,Noto Sans SC,sans-serif;font-size:15px;color-scheme:dark;";
    Array.from(select.options).forEach((option) => {
      option.style.backgroundColor = "#1A1A1A";
      option.style.color = "#ddd7cf";
    });
    const entry = { element: select, x, y, width, height: 36, fontSize: 15, commit: () => onCommit(select.value) };
    select.addEventListener("change", entry.commit); select.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.appendChild(select); this.domInputs.push(entry); this.layoutDomInputs();
  }

  numberField(x, y, width, value, onCommit) {
    this.field(x, y, width, value, (raw) => {
      if (raw === "" || !Number.isFinite(Number(raw))) { this.showNotice("请输入有效数字"); return false; }
      onCommit(Math.max(0, Math.round(Number(raw)))); return true;
    }, { type: "number" });
  }

  commitId(raw, item) {
    const id = raw.trim();
    if (!id) { this.showNotice("物品 ID 不能为空"); return false; }
    if (this.items.some((entry) => entry !== item && entry.id === id)) { this.showNotice("这个物品 ID 已存在"); return false; }
    item.id = id; this.selectedId = id; return true;
  }

  addItem() {
    // 在某个分类下新建时，自动沿用当前分类；这样“丹药”列表中新建的就是丹药，
    // 左侧筛选也不会跳回“全部”。
    const defaultType = ITEM_TYPES.includes(this.categoryFilter) ? this.categoryFilter : "其他";
    let id = "";
    do {
      id = `item-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    } while (this.items.some((entry) => entry.id === id));
    const item = normalizeItem({
      id,
      isNew: true,
      name: "",
      type: defaultType,
      grade: "凡品",
      description: "",
      texture: "",
      imageData: "",
      price: 0,
      stock: 50,
      restoreHp: 0,
      restoreQi: 0,
      attackBonus: 0,
      defenseBonus: 0,
      resistance: 0,
      resistanceType: "无",
      cultivationExp: 0,
      duration: 0,
      successRate: 100,
      skillText: "",
      canUse: false,
      sellable: true,
    });
    this.items = [...this.items, item];
    this.selectedId = item.id;
    this.searchKeyword = "";
    // 新物品放在当前筛选结果的末尾，因此让左侧列表自动滚到能看到它的位置。
    this.listStartIndex = Math.max(0, this.getSidebarItems("").length - 8);
    this.refresh();
    this.showNotice(`已新建${defaultType}物品，请填写后保存`);
  }
  deleteItem() { this.items = this.items.filter((item) => item.id !== this.selectedId); this.selectedId = this.items[0]?.id || null; this.refresh(); }

  pickImage() {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp"; input.style.display = "none"; document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;

      const selectedId = this.selectedId;
      this.showNotice("正在处理图片…");
      this.prepareImageForStorage(file)
        .then((imageData) => {
          const item = this.items.find((entry) => entry.id === selectedId);
          if (!item) return;
          item.imageData = imageData;
          this.loadItemTexture(item, true);
          this.showNotice("图片已添加，请点击保存全部");
        })
        .catch(() => this.showNotice("图片处理失败，请换一张 PNG、JPG 或 WEBP 图片"));
    };
    input.click();
  }

  // 上传时不限制原图文件大小。图片会在浏览器内自动转成适合游戏图标的格式，
  // 这样商店和储物袋依然清晰，同时不会因为本地存档空间被图片撑满而保存失败。
  prepareImageForStorage(file) {
    return prepareImageForStorage(file, { maxSide: 256, quality: 0.76 });
  }

  // 将已有素材也一并整理；旧版本上传的图片可以在下一次保存时自动变轻。
  optimiseImageForStorage(sourceData, maxSide = 256, quality = 0.76) {
    return optimiseImageForStorage(sourceData, maxSide, quality);
  }

  loadItemTexture(item, replace = false) {
    const key = `item-editor-${item.id}`;
    if (!replace && this.textures.exists(key)) return;
    const image = new Image();
    image.onload = () => { if (this.textures.exists(key)) this.textures.remove(key); this.textures.addImage(key, image); this.refresh(); };
    image.onerror = () => this.showNotice("图片读取失败，请换一张 PNG、JPG 或 WEBP 图片");
    image.src = item.imageData;
  }

  async save() {
    if (this.isSaving) return;
    this.isSaving = true;
    // 输入框仍在焦点中时也要先写回资料，不能只依赖失焦事件。
    this.domInputs.forEach((entry) => entry.commit?.());
    const ids = new Set();
    const prepared = [];
    for (const item of this.items) {
      const normalized = normalizeItem({ ...item, isNew: false });
      if (!normalized.id) {
        this.showNotice("物品 ID 不能为空，未保存");
        this.isSaving = false;
        return;
      }
      if (ids.has(normalized.id)) {
        this.showNotice(`物品 ID「${normalized.id}」重复，未保存`);
        this.isSaving = false;
        return;
      }
      ids.add(normalized.id);
      prepared.push(normalized);
    }
    this.showNotice("正在整理图片并保存…");

    // 不限制选择的原图大小；若浏览器的本地存档空间不足，会自动改用更轻的
    // 图标格式再次保存。游戏中图标最大只显示约 180px，不影响实际显示效果。
    const savingOptions = [[256, 0.76], [192, 0.68], [144, 0.6]];
    for (const [maxSide, quality] of savingOptions) {
      try {
        const compressed = await Promise.all(prepared.map(async (item) => ({
          ...item,
          imageData: item.imageData ? await this.optimiseImageForStorage(item.imageData, maxSide, quality) : "",
        })));
        if (saveItemTemplates(compressed)) {
          this.items = compressed;
          this.isSaving = false;
          this.refresh();
          this.showNotice(`已保存 ${this.items.length} 个物品，商人和储物袋会读取最新数据`);
          return;
        }
      } catch (error) {
        // 继续尝试更轻的图标格式；最终提示会说明真正的原因。
      }
    }
    this.isSaving = false;
    this.showNotice("保存失败：浏览器本地存档空间不足，请清理旧存档后重试");
  }

  showNotice(message) {
    const notice = this.add.container(1590, 920);
    const bg = this.add.rectangle(0, 0, 310, 48, 0x365d39, 0.98).setStrokeStyle(1, 0x7bac70);
    const label = addText(this, 0, 0, message, 16, "#f1f0d7", { strokeThickness: 1 }).setOrigin(0.5);
    notice.add([bg, label]); this.tweens.add({ targets: notice, alpha: 0, delay: 1450, duration: 350, onComplete: () => notice.destroy() });
  }
}

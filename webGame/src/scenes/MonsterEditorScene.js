import { getMonsterTemplates, normalizeMonster, saveMonsterTemplates } from "../core/MonsterStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { configureFullHdScene } from "../core/DisplayConfig.js";
import { addText, playUiClickSound } from "../utils/UiHelpers.js";
import { optimiseImageForStorage } from "../utils/ImageStorage.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { RewardCatalog } from "../domain/rewards/RewardCatalog.js";
import { MonsterDropEditorPanel } from "../ui/editor/MonsterDropEditorPanel.js";

const GRADE_FILTERS = ["全部", "普通", "精英", "首领", "领主", "传说"];
const MONSTER_GRADES = GRADE_FILTERS.slice(1);
const ELEMENTS = ["无", "金", "木", "水", "火", "土", "风", "雷", "冰", "神", "魔"];
const EDITOR_PAGES = [["basic", "基本信息"], ["combat", "战斗数值"], ["skills", "技能与掉落"], ["appearance", "外观与音效"]];

/** 与物品管理采用同一套资料库、页签与工作区布局；模板数据与存档规则保持不变。 */
export class MonsterEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.MONSTER_EDITOR); }

  preload() { this.load.image("monster-editor-default-preview", "./public/assets/images/battle/swordsman.png"); }

  create() {
    configureFullHdScene(this);
    rememberEditorRoute(SceneKeys.MONSTER_EDITOR);
    this.templates = getMonsterTemplates();
    this.selectedId = this.templates[0]?.id || null;
    this.page = "basic";
    this.gradeFilter = "全部";
    this.searchKeyword = "";
    this.listStartIndex = 0;
    this.loadingMonsterTextureKeys = new Set();
    this.domInputs = [];
    this.ui = this.add.container();
    this.itemCatalog = new ItemCatalog();
    this.rewardCatalog = new RewardCatalog({ itemCatalog: this.itemCatalog });
    this.dropEditor = new MonsterDropEditorPanel({ scene: this, rewardCatalog: this.rewardCatalog });
    this.windowResizeHandler = () => this.layoutDomInputs();
    this.wheelHandler = (pointer, _objects, _deltaX, deltaY) => {
      if (pointer.x >= 8 && pointer.x <= 344 && pointer.y >= 218 && pointer.y <= 990 && deltaY !== 0) this.scrollMonsterList(deltaY > 0 ? 1 : -1);
    };
    window.addEventListener("resize", this.windowResizeHandler);
    this.input.on("wheel", this.wheelHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("resize", this.windowResizeHandler);
      this.input.off("wheel", this.wheelHandler);
      this.clearDomInputs();
    });
    this.refresh();
  }

  get selected() { return this.templates.find((monster) => monster.id === this.selectedId); }
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
    this.text(31, 26, "怪物管理", 25, "#f4d5a4");
    this.text(292, 26, `${this.templates.length}只`, 23, "#f4d5a4");
    EDITOR_PAGES.forEach(([key, label], index) => {
      const x = 382 + index * 145;
      const active = key === this.page;
      const hit = this.track(this.add.rectangle(x + 62, 35, 124, 70, active ? 0x4b321d : 0x211711, active ? 1 : 0.01).setInteractive({ useHandCursor: true }));
      this.text(x + 62, 35, label, 17, active ? "#f4cf56" : "#aaa096", { strokeThickness: 1 }).setOrigin(0.5);
      if (active) this.track(this.add.rectangle(x + 62, 67, 124, 3, 0xf0ca5c));
      hit.on("pointerdown", () => { playUiClickSound(this); this.page = key; this.refresh(); });
    });
    this.button(1754, 15, 106, "返回", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), {
      height: 40, size: 16, fill: 0x4b3928, hover: 0x654b31, stroke: 0x80613d,
    });
  }

  drawSidebar() {
    this.box(14, 84, 322, 44, 0x282624, 0x45403b, 4, 1);
    this.domInput(14, 84, 322, 44, this.searchKeyword, (value) => {
      this.searchKeyword = value; this.listStartIndex = 0; this.refresh();
    }, { placeholder: "搜索怪物名称或五行属性..." });
    GRADE_FILTERS.forEach((filter, index) => {
      const x = 14 + (index % 3) * 108;
      const y = index < 3 ? 138 : 177;
      const active = filter === this.gradeFilter;
      this.button(x, y, 100, filter, () => { this.gradeFilter = filter; this.listStartIndex = 0; this.refresh(); }, {
        height: 31, size: 14, fill: active ? 0x9b7431 : 0x39302a, hover: active ? 0xae8740 : 0x4a3c31,
        stroke: active ? 0xf0c85c : 0x655246, lineWidth: 1, color: active ? "#fff0c7" : "#d8c7ad",
      });
    });
    const monsters = this.getSidebarMonsters();
    const visibleCount = 8;
    const maxStart = Math.max(0, monsters.length - visibleCount);
    this.listStartIndex = Phaser.Math.Clamp(this.listStartIndex, 0, maxStart);
    monsters.slice(this.listStartIndex, this.listStartIndex + visibleCount).forEach((monster, index) => this.drawMonsterCard(monster, index));
    if (monsters.length > visibleCount) this.drawListScrollbar(monsters.length, visibleCount, maxStart);
    this.button(14, 1007, 322, "＋ 新建怪物", () => this.createMonster(), {
      height: 56, fill: 0x365d39, hover: 0x467847, stroke: 0x5f9561, size: 19,
    });
  }

  getSidebarMonsters() {
    const keyword = this.searchKeyword.trim();
    return this.templates
      .filter((monster) => this.gradeFilter === "全部" || monster.grade === this.gradeFilter)
      .filter((monster) => !keyword || monster.name.includes(keyword) || monster.element.includes(keyword) || monster.realm.includes(keyword));
  }

  scrollMonsterList(direction) {
    const maxStart = Math.max(0, this.getSidebarMonsters().length - 8);
    const next = Phaser.Math.Clamp(this.listStartIndex + direction, 0, maxStart);
    if (next === this.listStartIndex) return;
    this.listStartIndex = next;
    playUiClickSound(this);
    this.refresh();
  }

  drawListScrollbar(total, visible, maxStart) {
    const top = 218; const height = 752;
    const track = this.track(this.add.rectangle(329, top + height / 2, 5, height, 0x171411, 0.9));
    const thumbHeight = Math.max(70, height * (visible / total));
    const thumbY = top + thumbHeight / 2 + ((height - thumbHeight) * (this.listStartIndex / maxStart));
    const thumb = this.track(this.add.rectangle(329, thumbY, 7, thumbHeight, 0x8d6b3f, 0.95).setInteractive({ useHandCursor: true }));
    const up = this.text(310, 205, "▲", 13, "#d2b379", { strokeThickness: 0 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const down = this.text(310, 987, "▼", 13, "#d2b379", { strokeThickness: 0 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    up.on("pointerdown", () => this.scrollMonsterList(-1));
    down.on("pointerdown", () => this.scrollMonsterList(1));
    thumb.on("pointerdown", () => track.setFillStyle(0x3a2a1c));
  }

  drawMonsterCard(monster, index) {
    const y = 218 + index * 96;
    const active = monster.id === this.selectedId;
    const card = this.track(this.add.rectangle(175, y + 39, 322, 80, active ? 0x4a311b : 0x292827)
      .setStrokeStyle(2, active ? 0xd8ad58 : 0x3f3c38).setInteractive({ useHandCursor: true }));
    this.track(this.add.rectangle(58, y + 39, 60, 60, this.gradeColor(monster.grade)).setStrokeStyle(2, 0x65503a));
    this.drawMonsterImage(monster, 58, y + 39, 46);
    this.text(109, y + 18, monster.name || "未命名怪物", 20, "#f2ce4a", { strokeThickness: 1 });
    this.text(109, y + 48, `${monster.grade} · ${monster.realm} · ${monster.element}`, 14, this.gradeTextColor(monster.grade), { strokeThickness: 0 });
    card.on("pointerdown", () => { playUiClickSound(this); this.selectedId = monster.id; this.refresh(); });
  }

  drawContent() {
    this.box(367, 84, 1530, 980, 0x262525, 0x45413d, 8, 2);
    if (!this.selected) { this.text(1132, 510, "请新建一个怪物模板", 28, "#d7c6a5").setOrigin(0.5); return; }
    if (this.page === "basic") this.drawBasicPage();
    if (this.page === "combat") this.drawCombatPage();
    if (this.page === "skills") this.drawSkillsPage();
    if (this.page === "appearance") this.drawAppearancePage();
    this.drawFooter();
  }

  section(value, x = 389, y = 100) { this.text(x, y, value, 20, "#f0ce57", { strokeThickness: 1 }); }
  gradeColor(grade) { return ({ "普通": 0x414040, "精英": 0x285c45, "首领": 0x70471d, "领主": 0x653962, "传说": 0x9a6920 })[grade] || 0x414040; }
  gradeTextColor(grade) { return ({ "普通": "#c8c1b7", "精英": "#63cfa0", "首领": "#d7a052", "领主": "#d183dc", "传说": "#f2cf6c" })[grade] || "#c8c1b7"; }

  drawBasicPage() {
    const monster = this.selected;
    this.section("怪物立绘");
    this.box(800, 145, 260, 255, 0x1d1d1c, 0x4b4945, 10, 2);
    this.drawMonsterImage(monster, 930, 257, 205);
    this.button(1100, 208, 230, "上传怪物图片", () => this.pickImageFile(), { height: 45, fill: 0x9d8248, hover: 0xb09255, stroke: 0x9d8248 });
    this.button(1100, 270, 230, "清除自定义图片", () => this.clearCustomImage(), { height: 42, fill: 0x383838, hover: 0x4c4c4c, stroke: 0x383838, color: "#b6b1a9" });
    this.text(930, 422, monster.imageData ? "已使用自定义怪物立绘" : "未选择图片时使用默认立绘", 16, "#aaa39b", { strokeThickness: 0 }).setOrigin(0.5);
    this.section("基本信息", 389, 475);
    this.box(388, 510, 925, 320, 0x242322, 0x3d3935, 8, 2);
    const fields = [
      ["模板 ID", monster.id, () => {}, "readonly"], ["名称", monster.name, (value) => { monster.name = value || "未命名怪物"; }],
      ["品阶", monster.grade, (value) => { monster.grade = value; this.refresh(); }, "select", MONSTER_GRADES],
      ["推荐境界", monster.realm, (value) => { monster.realm = value || "炼气初期"; }], ["五行属性", monster.element, (value) => { monster.element = value; }, "select", ELEMENTS],
    ];
    fields.forEach(([label, value, commit, kind, choices], index) => {
      const row = index % 3; const column = Math.floor(index / 3); const labelX = 425 + column * 450; const fieldX = 520 + column * 450; const y = 545 + row * 70;
      this.text(labelX, y + 9, label, 16, "#bcb5ad", { strokeThickness: 0 });
      this.field(fieldX, y, 290, value, commit, { readonly: kind === "readonly", select: kind === "select", choices });
    });
    this.section("模板说明", 1390, 475);
    this.box(1388, 510, 410, 320, 0x242322, 0x3d3935, 8, 2);
    this.text(1420, 550, "怪物模板会在地图编辑器中作为放置单位。", 16, "#aaa39b", { strokeThickness: 0, wordWrap: { width: 340 }, lineSpacing: 8 });
    this.text(1420, 650, "修改并保存后，地图与战斗会读取这份最新数据。", 16, "#c8bfb4", { strokeThickness: 0, wordWrap: { width: 340 }, lineSpacing: 8 });
  }

  drawCombatPage() {
    const monster = this.selected;
    this.section("战斗数值");
    this.box(388, 145, 920, 470, 0x242322, 0x3d3935, 8, 2);
    [["最大生命", "maxHp", "战斗中可承受的伤害上限"], ["初始灵气", "qi", "施放技能的资源"], ["攻击", "attack", "基础攻击造成的伤害"], ["防御", "defense", "承受伤害时提供减免"]].forEach(([label, key, hint], index) => {
      const y = 190 + index * 94;
      this.text(435, y + 10, label, 18, "#c8bfb4", { strokeThickness: 0 });
      this.numberField(575, y, 220, monster[key], (value) => { monster[key] = value; });
      this.text(835, y + 10, hint, 16, "#9e978f", { strokeThickness: 0 });
      if (index < 3) this.track(this.add.rectangle(848, y + 61, 765, 1, 0x3a3733));
    });
    this.section("战斗预览", 1420, 100);
    this.box(1390, 145, 360, 470, 0x211a14, 0x705239, 10, 2);
    this.drawMonsterImage(monster, 1570, 255, 132);
    this.text(1570, 360, monster.name, 23, "#f3d16f").setOrigin(0.5);
    [`生命  ${monster.maxHp}`, `灵气  ${monster.qi}`, `攻击  ${monster.attack}`, `防御  ${monster.defense}`].forEach((line, index) => this.text(1460, 415 + index * 40, line, 18, "#d7c2a1", { strokeThickness: 0 }));
  }

  drawSkillsPage() {
    const monster = this.selected;
    this.section("技能列表");
    this.box(388, 145, 900, 630, 0x242322, 0x3d3935, 8, 2);
    this.text(425, 185, "技能会在战斗中按冷却与灵气消耗生效。", 16, "#aaa39b", { strokeThickness: 0 });
    if (monster.skills.length) monster.skills.forEach((skill, index) => {
      const y = 230 + index * 64;
      this.box(425, y, 825, 48, 0x1b1b1a, 0x403c37, 5, 1);
      this.text(450, y + 24, `${index + 1}`, 16, "#bda15f").setOrigin(0.5);
      this.text(495, y + 24, skill.name, 18, "#eee3ca", { strokeThickness: 0 }).setOrigin(0, 0.5);
      this.text(820, y + 24, `伤害 ${skill.damage}`, 16, "#d4c4a7", { strokeThickness: 0 }).setOrigin(0.5);
      this.text(990, y + 24, `耗灵 ${skill.qiCost}`, 16, "#d4c4a7", { strokeThickness: 0 }).setOrigin(0.5);
      this.text(1160, y + 24, `冷却 ${skill.cooldown} 回合`, 16, "#d4c4a7", { strokeThickness: 0 }).setOrigin(0.5);
    });
    else this.text(838, 400, "暂无技能，战斗将使用基础攻击。", 20, "#9e978f", { strokeThickness: 0 }).setOrigin(0.5);
    this.button(425, 700, 250, "编辑技能列表", () => this.editSkills(), { height: 44 });
    this.section("掉落列表", 1390, 100);
    this.box(1390, 145, 408, 630, 0x242322, 0x3d3935, 8, 2);
    this.text(1425, 190, "击败怪物后可获得的奖励", 16, "#aaa39b", { strokeThickness: 0 });
    const drops = monster.drops.length ? monster.drops : ["暂未配置掉落"];
    drops.forEach((drop, index) => {
      this.box(1425, 230 + index * 52, 338, 38, 0x1b1b1a, 0x403c37, 5, 1);
      this.text(1447, 249 + index * 52, `◆ ${drop}`, 16, index < monster.drops.length ? "#dfc687" : "#9e978f", { strokeThickness: 0 }).setOrigin(0, 0.5);
    });
    this.button(1425, 700, 338, "编辑掉落列表", () => this.editDrops(), { height: 44 });
  }

  drawAppearancePage() {
    const monster = this.selected;
    this.section("怪物立绘与音效");
    this.box(388, 145, 900, 620, 0x242322, 0x3d3935, 8, 2);
    this.box(475, 200, 300, 390, 0x1d1d1c, 0x4b4945, 10, 2);
    this.drawMonsterImage(monster, 625, 385, 305);
    this.text(625, 625, monster.imageData ? "已使用自定义立绘" : "默认怪物立绘", 16, "#aaa39b", { strokeThickness: 0 }).setOrigin(0.5);
    this.button(870, 260, 275, "上传怪物图片", () => this.pickImageFile(), { height: 45, fill: 0x9d8248, hover: 0xb09255, stroke: 0x9d8248 });
    this.button(870, 324, 275, "清除自定义图片", () => this.clearCustomImage(), { height: 42, fill: 0x383838, hover: 0x4c4c4c, stroke: 0x383838, color: "#b6b1a9" });
    this.text(870, 430, "音效地址", 18, "#c8bfb4", { strokeThickness: 0 });
    this.field(870, 465, 275, monster.soundUrl, (value) => { monster.soundUrl = value; }, { placeholder: "例如：assets/audio/wolf.mp3" });
    this.text(870, 525, "可填写怪物出场或攻击音效路径；留空时不会播放额外音效。", 15, "#9e978f", { strokeThickness: 0, wordWrap: { width: 280 }, lineSpacing: 8 });
    this.section("游戏内卡片预览", 1390, 100);
    this.box(1390, 145, 408, 620, 0x211a14, 0x705239, 10, 2);
    this.drawMonsterImage(monster, 1594, 290, 170);
    this.text(1594, 410, monster.name, 25, "#f3d16f").setOrigin(0.5);
    this.text(1594, 452, `${monster.grade} · ${monster.realm} · ${monster.element}`, 17, this.gradeTextColor(monster.grade), { strokeThickness: 0 }).setOrigin(0.5);
    this.text(1450, 525, `生命 ${monster.maxHp}    攻击 ${monster.attack}\n灵气 ${monster.qi}      防御 ${monster.defense}`, 18, "#d7c2a1", { strokeThickness: 0, lineSpacing: 12 });
  }

  drawFooter() {
    this.button(1350, 970, 130, "删除", () => this.deleteMonster(), { height: 44, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff6c57" });
    this.button(1495, 970, 145, "复制模板", () => this.duplicateMonster(), { height: 44 });
    this.button(1655, 970, 170, "保存全部", () => this.saveAll(), { height: 44, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360, size: 18 });
  }

  drawMonsterImage(monster, x, y, maxSize) {
    const key = this.monsterTextureKey(monster.id);
    if (monster.imageData && !this.textures.exists(key)) this.loadMonsterTexture(monster, key);
    const texture = monster.imageData && this.textures.exists(key) ? key : "monster-editor-default-preview";
    if (!this.textures.exists(texture)) return;
    const image = this.track(this.add.image(x, y, texture));
    image.setScale(Math.min(maxSize / image.width, maxSize / image.height, 1));
  }

  loadMonsterTexture(monster, key) {
    if (this.loadingMonsterTextureKeys.has(key)) return;
    this.loadingMonsterTextureKeys.add(key);
    const imageData = monster.imageData;
    // 项目文件仓库保存后是 /assets/... 路径；旧浏览器资料才是 Base64。两者都要能预览。
    if (!imageData.startsWith("data:")) {
      const image = new Image();
      image.onload = () => {
        this.loadingMonsterTextureKeys.delete(key);
        if (this.textures.exists(key)) this.textures.remove(key);
        this.textures.addImage(key, image);
        if (this.selectedId === monster.id) this.refresh();
      };
      image.onerror = () => {
        this.loadingMonsterTextureKeys.delete(key);
        if (this.selectedId === monster.id) this.showNotice("项目中的怪物图片读取失败，请重新上传后保存。", "error");
      };
      image.src = imageData;
      return;
    }
    const handleLoad = (loadedKey) => {
      if (loadedKey !== key) return;
      cleanup();
      // 读取大图期间用户可能又选了一张新图。旧回调不能覆盖较新的上传结果。
      if (monster.imageData !== imageData) {
        if (this.textures.exists(key)) this.textures.remove(key);
        if (monster.imageData) this.loadMonsterTexture(monster, key);
        return;
      }
      if (this.selectedId === monster.id) this.refresh();
    };
    const handleError = (failedKey) => {
      if (failedKey !== key) return;
      cleanup();
      if (this.selectedId === monster.id) this.showNotice("怪物图片解码失败，请改用 PNG、JPG 或 WebP 图片。", "error");
    };
    const cleanup = () => {
      this.loadingMonsterTextureKeys.delete(key);
      this.textures.off(Phaser.Textures.Events.LOAD, handleLoad);
      this.textures.off(Phaser.Textures.Events.ERROR, handleError);
    };

    // addBase64 是异步方法且没有回调参数，必须监听纹理管理器的 LOAD / ERROR 事件。
    this.textures.on(Phaser.Textures.Events.LOAD, handleLoad);
    this.textures.on(Phaser.Textures.Events.ERROR, handleError);
    this.textures.addBase64(key, imageData);
  }

  monsterTextureKey(monsterId) { return `monster-editor-${monsterId}`; }

  /** 每只怪物独立清理自己的旧纹理，防止再次上传后 Phaser 复用上一张预览图。 */
  clearMonsterTexture(monsterId) {
    const key = this.monsterTextureKey(monsterId);
    if (this.textures.exists(key)) this.textures.remove(key);
  }

  clearDomInputs() { this.domInputs.forEach((entry) => entry.element.remove()); this.domInputs = []; }

  /** 点击 Phaser 按钮时，浏览器输入框不一定会先触发 blur，因此保存前统一提交一次。 */
  commitDomInputs() { this.domInputs.forEach((entry) => entry.commit?.()); }

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
    element.type = options.type || "text"; element.value = String(value ?? ""); element.autocomplete = "off"; element.placeholder = options.placeholder || ""; element.readOnly = Boolean(options.readonly);
    element.style.cssText = "position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:0 16px;border:1px solid transparent;border-radius:5px;outline:none;background:transparent;color:#ddd7cf;font-family:Microsoft YaHei,Noto Sans SC,sans-serif;text-align:left;";
    if (options.readonly) element.style.color = "#9e978f";
    const entry = { element, x, y, width, height, fontSize: options.fontSize || 15 };
    let committed = element.value;
    entry.commit = () => { const next = element.value.trim(); if (next !== committed && onCommit(next) !== false) committed = next; };
    element.addEventListener("focus", () => { if (!options.readonly) element.style.borderColor = "#b79754"; });
    element.addEventListener("blur", () => { element.style.borderColor = "transparent"; entry.commit(); });
    element.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); element.blur(); } event.stopPropagation(); });
    document.body.appendChild(element); this.domInputs.push(entry); this.layoutDomInputs(); return element;
  }

  field(x, y, width, value, onCommit, options = {}) {
    this.box(x, y, width, 36, 0x1b1b1a, 0x393735, 5, 1);
    if (!options.select) return this.domInput(x, y, width, 36, value, onCommit, options);
    const select = document.createElement("select");
    (options.choices || []).forEach((choice) => { const option = document.createElement("option"); option.value = choice; option.textContent = choice; select.appendChild(option); });
    select.value = value;
    select.style.cssText = "position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:0 16px;border:1px solid transparent;border-radius:5px;outline:none;background:#1A1A1A;color:#ddd7cf;font-family:Microsoft YaHei,Noto Sans SC,sans-serif;color-scheme:dark;";
    const entry = { element: select, x, y, width, height: 36, fontSize: 15, commit: () => onCommit(select.value) };
    select.addEventListener("change", entry.commit); select.addEventListener("keydown", (event) => event.stopPropagation());
    document.body.appendChild(select); this.domInputs.push(entry); this.layoutDomInputs(); return select;
  }

  numberField(x, y, width, value, onCommit) {
    this.field(x, y, width, value, (raw) => {
      if (raw === "" || !Number.isFinite(Number(raw))) { this.showNotice("请输入有效数字"); return false; }
      onCommit(Math.max(0, Math.round(Number(raw)))); return true;
    }, { type: "number" });
  }

  createMonster() {
    const monster = normalizeMonster({ name: "新怪物", grade: this.gradeFilter === "全部" ? "普通" : this.gradeFilter });
    this.templates.push(monster); this.selectedId = monster.id; this.searchKeyword = ""; this.refresh();
  }

  duplicateMonster() {
    if (!this.selected) return;
    const copy = normalizeMonster({ ...this.selected, id: "", name: `${this.selected.name}（副本）`, skills: this.selected.skills.map((skill) => ({ ...skill })), drops: [...this.selected.drops] });
    this.templates.push(copy); this.selectedId = copy.id; this.refresh();
  }

  deleteMonster() {
    if (!this.selected || !window.confirm(`确定删除怪物模板“${this.selected.name}”吗？`)) return;
    this.templates = this.templates.filter((monster) => monster.id !== this.selectedId); this.selectedId = this.templates[0]?.id || null; this.refresh();
  }

  editSkills() {
    if (!this.selected) return;
    const example = "撕咬|8|0|0";
    const current = this.selected.skills.map((skill) => `${skill.name}|${skill.damage}|${skill.qiCost}|${skill.cooldown}`).join("\n");
    const raw = window.prompt(`每行一个技能，格式：名称|伤害|耗灵|冷却回合\n例如：${example}`, current || example);
    if (raw === null) return;
    this.selected.skills = raw.split("\n").map((line) => {
      const [name, damage, qiCost, cooldown] = line.split("|").map((item) => item.trim());
      return { name, damage, qiCost, cooldown };
    }).filter((skill) => skill.name).map((skill) => normalizeMonster({ skills: [skill] }).skills[0]);
    this.refresh();
  }

  editDrops() {
    if (!this.selected) return;
    this.dropEditor.open({ drops: this.selected.drops, onApply: (drops) => { this.selected.drops = drops; this.refresh(); } });
  }

  pickImageFile() {
    if (!this.selected) return;
    // 在打开系统文件选择框前固定目标 ID，避免用户切换模板后把图片写到别的怪物上。
    const targetId = this.selectedId;
    const picker = document.createElement("input"); picker.type = "file"; picker.accept = "image/png,image/jpeg,image/webp";
    picker.onchange = () => {
      const file = picker.files?.[0]; if (!file) return;
      const reader = new FileReader();
      this.showNotice("正在整理并保存怪物图片…", "pending");
      reader.onload = async () => {
        const target = this.templates.find((monster) => monster.id === targetId);
        if (!target) return;
        this.commitDomInputs();
        const previousImageData = target.imageData;
        target.imageData = String(reader.result);
        // 新图片和旧模板图片一起转为 WebP 后写入项目 assets 文件夹。
        const saved = await this.saveTemplatesWithCompressedImages();
        if (this.selectedId === targetId) {
          if (saved) {
            this.refreshWithReplacedMonsterTexture(targetId);
            this.showNotice(`已更新并保存「${target.name}」的怪物立绘。`, "success");
          } else {
            // 保存失败时恢复旧图，绝不能把未经压缩的原始大图交给 Phaser 纹理管理器。
            const current = this.templates.find((monster) => monster.id === targetId);
            if (current) current.imageData = previousImageData;
            this.refresh();
            this.showNotice("图片保存失败：无法写入项目文件夹，请确认通过启动游戏.bat运行。", "error");
          }
        }
      };
      reader.onerror = () => this.showNotice("图片读取失败，请改用 PNG、JPG 或 WebP 图片。", "error");
      reader.readAsDataURL(file);
    };
    picker.click();
  }

  async clearCustomImage() {
    if (!this.selected) return;
    this.commitDomInputs();
    const targetId = this.selected.id;
    const previousImageData = this.selected.imageData;
    this.selected.imageData = "";
    const saved = await this.saveTemplatesWithCompressedImages();
    if (saved) {
      this.refreshWithReplacedMonsterTexture(targetId);
      this.showNotice("已清除并保存当前怪物立绘。", "success");
    } else {
      const current = this.templates.find((monster) => monster.id === targetId);
      if (current) current.imageData = previousImageData;
      this.refresh();
      this.showNotice("立绘清除失败：无法写入项目文件夹。", "error");
    }
  }

  /** 先销毁仍引用旧纹理的显示对象，再替换纹理，避免 WebGL 画布进入空白状态。 */
  refreshWithReplacedMonsterTexture(monsterId) {
    this.clearDomInputs();
    this.ui.removeAll(true);
    this.clearMonsterTexture(monsterId);
    this.refresh();
  }

  async saveAll() {
    this.commitDomInputs();
    this.templates = this.templates.map(normalizeMonster);
    this.showNotice("正在整理图片并保存…", "pending");
    const saved = await this.saveTemplatesWithCompressedImages();
    // 先重绘页面，再创建提示层；否则提示会被 refresh() 新绘制的工作区遮挡。
    this.refresh();
    if (saved) this.showNotice("保存成功：怪物资料与图片已写入项目文件夹。", "success");
    else this.showNotice("保存失败：无法写入项目文件夹，请确认本地服务器正在运行。", "error");
  }

  /**
   * 怪物立绘会用于编辑器、地图和战斗，保留比物品图标更高的分辨率。
   * 保存时逐级减小图片；旧版遗留的大图也会一并迁移至项目 assets 文件夹。
   */
  async saveTemplatesWithCompressedImages() {
    const prepared = this.templates.map(normalizeMonster);
    const savingOptions = [[768, 0.84], [640, 0.8], [512, 0.76], [384, 0.7]];
    for (const [maxSide, quality] of savingOptions) {
      try {
        const compressed = await Promise.all(prepared.map(async (monster) => ({
          ...monster,
          imageData: monster.imageData
            ? await this.optimiseImageForStorage(monster.imageData, maxSide, quality)
            : "",
        })));
        if (saveMonsterTemplates(compressed)) {
          this.templates = compressed;
          return true;
        }
      } catch (error) {
        // 当前档失败后继续尝试更轻的尺寸和质量。
      }
    }
    return false;
  }

  /** 在浏览器内等比缩放并转为 WebP，不修改用户选择的原始文件。 */
  optimiseImageForStorage(sourceData, maxSide, quality) {
    return optimiseImageForStorage(sourceData, maxSide, quality);
  }

  showNotice(message, type = "pending") {
    this.notice?.destroy();
    this.noticeBack?.destroy();
    const theme = {
      success: { background: 0x274831, text: "#d0f0c6", stroke: 0x71aa77 },
      error: { background: 0x522a28, text: "#ffd0c8", stroke: 0xbf7067 },
      pending: { background: 0x4b3b20, text: "#ffe5a2", stroke: 0xc69d54 },
    }[type] || { background: 0x4b3b20, text: "#ffe5a2", stroke: 0xc69d54 };
    this.noticeBack = this.add.rectangle(1132, 925, 650, 42, theme.background, 0.98)
      .setStrokeStyle(1, theme.stroke)
      .setDepth(20);
    const notice = this.notice = addText(this, 1132, 925, message, 17, theme.text, { strokeThickness: 1 })
      .setOrigin(0.5)
      .setDepth(21);
    this.time.delayedCall(3200, () => {
      if (this.notice !== notice) return;
      this.notice?.destroy();
      this.noticeBack?.destroy();
      this.notice = null;
      this.noticeBack = null;
    });
  }
}

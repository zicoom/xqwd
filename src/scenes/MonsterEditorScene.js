import { getMonsterTemplates, normalizeMonster, saveMonsterTemplates } from "../core/MonsterStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addButton, addText, addTitle } from "../utils/UiHelpers.js";
import { ItemCatalog } from "../domain/items/ItemCatalog.js";
import { RewardCatalog } from "../domain/rewards/RewardCatalog.js";
import { MonsterDropEditorPanel } from "../ui/editor/MonsterDropEditorPanel.js";

/**
 * 怪物编辑器第一版。
 * 为了让零基础玩家也能立即使用，本版采用“选中模板 + 点击项目修改”的操作方式。
 * 数据保存在浏览器本地，地图编辑器和战斗场景会自动读取最新保存的模板。
 */
export class MonsterEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.MONSTER_EDITOR); }

  preload() {
    this.load.image("monster-editor-default-preview", "./public/assets/images/battle/swordsman.png");
  }

  create() {
    rememberEditorRoute(SceneKeys.MONSTER_EDITOR);
    this.templates = getMonsterTemplates();
    this.selectedId = this.templates[0]?.id || null;
    this.itemCatalog = new ItemCatalog();
    this.rewardCatalog = new RewardCatalog({ itemCatalog: this.itemCatalog });
    this.dropEditor = new MonsterDropEditorPanel({ scene: this, rewardCatalog: this.rewardCatalog });
    this.add.rectangle(960, 540, 1920, 1080, 0x10192c);
    addTitle(this, "怪物编辑器", "先创建怪物模板，再到地图编辑器中选择模板进行放置");
    this.createLeftList();
    this.createDetailPanel();
    this.refreshAll();
  }

  /** 左侧模板列表：点击一张卡片即可切换正在编辑的怪物。 */
  createLeftList() {
    this.add.rectangle(165, 402, 320, 616, 0x17223a, 0.96).setStrokeStyle(2, 0x506b9d);
    this.listTitle = addText(this, 30, 103, "怪物模板列表", 22, "#ffe3a1");
    this.listContainer = this.add.container(0, 0);
    addButton(this, 165, 665, 260, "＋ 新建怪物", () => this.createMonster(), { height: 42, size: 17 });
    addButton(this, 165, 614, 125, "复制模板", () => this.duplicateMonster(), { height: 38, size: 15 });
    addButton(this, 305, 614, 125, "删除模板", () => this.deleteMonster(), { height: 38, size: 15 });
  }

  /** 中间属性区：每一个按钮只修改一种内容，避免出现看不懂的大型表单。 */
  createDetailPanel() {
    this.add.rectangle(675, 402, 650, 616, 0x17223a, 0.96).setStrokeStyle(2, 0x506b9d);
    this.detailTitle = addText(this, 390, 105, "请选择左侧怪物", 28, "#ffe4a1");
    this.detailText = addText(this, 400, 150, "", 18, "#e8edf5", { lineSpacing: 13, wordWrap: { width: 500 } });
    const buttons = [
      ["编辑名称", () => this.editText("名称", "name")],
      ["品阶 / 境界", () => this.editGradeAndRealm()],
      ["五行属性", () => this.editText("五行属性（金、木、水、火、土、风、雷、冰、魔、神或无）", "element")],
      ["战斗数值", () => this.editStats()],
      ["技能列表", () => this.editSkills()],
      ["掉落列表", () => this.editDrops()],
      ["选择怪物图片", () => this.pickImageFile()],
      ["音效地址", () => this.editText("音效文件地址（暂不需要可留空）", "soundUrl")],
    ];
    buttons.forEach(([label, callback], index) => {
      addButton(this, 482 + (index % 2) * 188, 460 + Math.floor(index / 2) * 56, 170, label, callback, { height: 42, size: 15 });
    });
    addButton(this, 675, 675, 250, "保存所有怪物模板", () => this.saveAll(), { height: 45, size: 18 });

    this.add.rectangle(1085, 402, 165, 616, 0x17223a, 0.96).setStrokeStyle(2, 0x506b9d);
    addText(this, 1085, 120, "图片预览", 20, "#ffe4a1", { origin: 0.5 });
    this.previewFrame = this.add.rectangle(1085, 302, 136, 205, 0x0b111f, 1).setStrokeStyle(2, 0xb49357);
    this.previewHint = addText(this, 1085, 438, "未选择图片时\n使用默认立绘", 14, "#cbd7dd", { origin: 0.5, align: "center" });
    addButton(this, 1085, 665, 135, "返回控制台", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), { height: 42, size: 14 });
  }

  get selected() { return this.templates.find((item) => item.id === this.selectedId); }

  refreshAll() {
    this.refreshList();
    this.refreshDetail();
  }

  refreshList() {
    this.listContainer.removeAll(true);
    this.listTitle.setText(`怪物模板列表（${this.templates.length}）`);
    this.templates.forEach((monster, index) => {
      const y = 154 + index * 82;
      const active = monster.id === this.selectedId;
      const card = this.add.rectangle(165, y, 280, 68, active ? 0x3c4f69 : 0x202d46, 1)
        .setStrokeStyle(2, active ? 0xe6bb69 : 0x486081)
        .setInteractive({ useHandCursor: true });
      const name = addText(this, 42, y - 24, monster.name, 18, active ? "#ffe6a7" : "#f2f5fc");
      const info = addText(this, 42, y + 4, `${monster.grade} · ${monster.realm} · ${monster.element}`, 14, "#b9cde0");
      card.on("pointerdown", () => { this.selectedId = monster.id; this.refreshAll(); });
      this.listContainer.add([card, name, info]);
    });
  }

  refreshDetail() {
    const monster = this.selected;
    if (!monster) return;
    this.detailTitle.setText(monster.name);
    const skills = monster.skills.length
      ? monster.skills.map((skill) => `• ${skill.name}：伤害 ${skill.damage}，耗灵 ${skill.qiCost}，冷却 ${skill.cooldown} 回合`).join("\n")
      : "• 暂无技能（战斗时将使用基础攻击）";
    this.detailText.setText(
      `模板编号：${monster.id}\n` +
      `品阶：${monster.grade}    推荐境界：${monster.realm}\n` +
      `五行属性：${monster.element}\n\n` +
      `生命：${monster.maxHp}    灵气：${monster.qi}\n攻击：${monster.attack}    防御：${monster.defense}\n\n` +
      `技能：\n${skills}\n\n掉落：${monster.drops.join("、") || "暂无"}\n音效：${monster.soundUrl || "未设置"}`,
    );
    if (this.preview) this.preview.destroy();
    // 自定义图片保存为 Base64 后，Phaser 可以直接作为纹理显示，无需服务器上传。
    if (monster.imageData) {
      const key = `monster-preview-${monster.id}`;
      if (this.textures.exists(key)) this.preview = this.add.image(1085, 300, key).setDisplaySize(125, 175);
      else this.textures.addBase64(key, monster.imageData, () => this.refreshDetail());
      this.previewHint.setText("已使用自定义图片");
    } else {
      this.preview = this.add.image(1085, 310, "monster-editor-default-preview").setScale(0.38);
      this.previewHint.setText("未选择图片时\n使用默认立绘");
    }
  }

  createMonster() {
    const name = window.prompt("请输入新怪物名称：", "新怪物");
    if (!name) return;
    const monster = normalizeMonster({ name });
    this.templates.push(monster);
    this.selectedId = monster.id;
    this.refreshAll();
  }

  duplicateMonster() {
    if (!this.selected) return;
    const copy = normalizeMonster({ ...this.selected, id: "", name: `${this.selected.name}（副本）`, skills: this.selected.skills.map((skill) => ({ ...skill })) });
    this.templates.push(copy);
    this.selectedId = copy.id;
    this.refreshAll();
  }

  deleteMonster() {
    if (!this.selected || !window.confirm(`确定删除怪物模板“${this.selected.name}”吗？`)) return;
    this.templates = this.templates.filter((item) => item.id !== this.selectedId);
    this.selectedId = this.templates[0]?.id || null;
    this.refreshAll();
  }

  editText(label, field) {
    if (!this.selected) return;
    const value = window.prompt(`请输入${label}：`, this.selected[field] || "");
    if (value === null) return;
    this.selected[field] = value.trim();
    this.refreshAll();
  }

  editGradeAndRealm() {
    if (!this.selected) return;
    const grade = window.prompt("请输入品阶（普通、精英、首领、领主、传说）：", this.selected.grade);
    if (grade === null) return;
    const realm = window.prompt("请输入推荐境界：", this.selected.realm);
    if (realm === null) return;
    this.selected.grade = grade.trim() || "普通";
    this.selected.realm = realm.trim() || "炼气初期";
    this.refreshAll();
  }

  editStats() {
    if (!this.selected) return;
    const fields = [["生命", "maxHp"], ["灵气", "qi"], ["攻击", "attack"], ["防御", "defense"]];
    for (const [label, field] of fields) {
      const value = window.prompt(`请输入${label}：`, this.selected[field]);
      if (value === null) return;
      this.selected[field] = Number(value);
    }
    Object.assign(this.selected, normalizeMonster(this.selected));
    this.refreshAll();
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
    this.refreshAll();
  }

  editDrops() {
    if (!this.selected) return;
    this.dropEditor.open({
      drops: this.selected.drops,
      onApply: (drops) => {
        this.selected.drops = drops;
        this.refreshAll();
      },
    });
  }

  /** 使用系统文件选择窗口读取图片，并把图片存进当前浏览器的怪物模板。 */
  pickImageFile() {
    if (!this.selected) return;
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/png,image/jpeg,image/webp";
    picker.onchange = () => {
      const file = picker.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.selected.imageData = String(reader.result);
        this.refreshDetail();
      };
      reader.readAsDataURL(file);
    };
    picker.click();
  }

  saveAll() {
    // normalizeMonster 会再次检查数值，避免输入错误把坏数据写进存档。
    this.templates = this.templates.map(normalizeMonster);
    if (saveMonsterTemplates(this.templates)) this.showSavedNotice();
    this.refreshAll();
  }

  showSavedNotice() {
    if (this.savedText) this.savedText.destroy();
    this.savedText = addText(this, 675, 635, "已保存：地图编辑器与游戏会立即读取新模板。", 16, "#bdeab4", { origin: 0.5 });
    this.time.delayedCall(1800, () => this.savedText?.destroy());
  }
}

import { getBuildingTemplates, normalizeBuilding, saveBuildingTemplates } from "../core/WorldTemplateStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addButton, addText, addTitle } from "../utils/UiHelpers.js";

/** 建筑编辑器第一版：配置名称、类型、阻挡规则、交互说明和图片。 */
export class BuildingEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.BUILDING_EDITOR); }
  create() {
    rememberEditorRoute(SceneKeys.BUILDING_EDITOR);
    this.items = getBuildingTemplates(); this.selectedId = this.items[0]?.id;
    this.add.rectangle(960, 540, 1920, 1080, 0x10192c); addTitle(this, "建筑编辑器", "创建建筑模板；地图编辑器只负责选择模板并摆放");
    this.list = this.add.container(); this.add.rectangle(175, 405, 330, 610, 0x17223a).setStrokeStyle(2, 0x506b9d); this.add.rectangle(710, 405, 700, 610, 0x17223a).setStrokeStyle(2, 0x506b9d);
    addButton(this, 175, 662, 270, "＋ 新建建筑", () => this.addItem(), { height: 42, size: 17 }); addButton(this, 90, 610, 130, "删除", () => this.deleteItem(), { height: 38, size: 15 }); addButton(this, 260, 610, 130, "保存", () => this.save(), { height: 38, size: 15 });
    [["名称 / 类型", () => this.editNameAndType()], ["交互说明", () => this.editText()], ["切换阻挡", () => { this.selected.blocked = !this.selected.blocked; this.refresh(); }], ["返回控制台", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE)]].forEach(([label, fn], i) => addButton(this, 500 + (i % 2) * 235, 548 + Math.floor(i / 2) * 58, 200, label, fn, { height: 42, size: 16 })); this.refresh();
  }
  get selected() { return this.items.find((item) => item.id === this.selectedId); }
  refresh() { this.list.removeAll(true); addText(this, 45, 108, `建筑模板（${this.items.length}）`, 21, "#ffe4a1"); this.items.forEach((item, i) => { const y = 155 + i * 75; const active = item.id === this.selectedId; const card = this.add.rectangle(175, y, 280, 60, active ? 0x3c4f69 : 0x202d46).setStrokeStyle(2, active ? 0xe6bb69 : 0x486081).setInteractive({ useHandCursor: true }); const name = addText(this, 45, y - 18, item.name, 18, "#fff0c1"); const desc = addText(this, 45, y + 8, `${item.type} · ${item.blocked ? "阻挡移动" : "可穿过"}`, 13, "#c2d3e0"); card.on("pointerdown", () => { this.selectedId = item.id; this.refresh(); }); this.list.add([card, name, desc]); }); const item = this.selected; if (!item) return; if (this.detail) this.detail.destroy(); this.detail = addText(this, 430, 145, `名称：${item.name}\n类型：${item.type}\n移动规则：${item.blocked ? "阻挡角色通过" : "角色可以穿过"}\n\n交互说明：\n${item.interactionText}\n\n说明：下一步会把图片选择、建筑碰撞范围和商店/洞府等具体互动继续接入。`, 19, "#e8edf5", { wordWrap: { width: 560 }, lineSpacing: 15 }); }
  addItem() { const name = window.prompt("建筑名称：", "新建筑"); if (!name) return; const item = normalizeBuilding({ name }); this.items.push(item); this.selectedId = item.id; this.refresh(); }
  deleteItem() { if (!this.selected || !window.confirm(`删除 ${this.selected.name}？`)) return; this.items = this.items.filter((item) => item.id !== this.selectedId); this.selectedId = this.items[0]?.id; this.refresh(); }
  editNameAndType() { const name = window.prompt("建筑名称：", this.selected.name); if (name === null) return; const type = window.prompt("建筑类型（民居、商店、洞府、门派等）：", this.selected.type); if (type === null) return; this.selected.name = name.trim() || this.selected.name; this.selected.type = type.trim() || this.selected.type; this.refresh(); }
  editText() { const value = window.prompt("角色按 E 互动时显示的说明：", this.selected.interactionText); if (value !== null) { this.selected.interactionText = value; this.refresh(); } }
  save() { this.items = this.items.map(normalizeBuilding); saveBuildingTemplates(this.items); this.refresh(); }
}

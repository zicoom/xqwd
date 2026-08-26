import { getBuildingTemplates, normalizeBuilding, saveBuildingTemplates } from "../core/WorldTemplateStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addText } from "../utils/UiHelpers.js";
import { detectImageCollisionOutline, prepareImageForStorage } from "../utils/ImageStorage.js";

const BUILDING_TYPES = ["民居", "商店", "洞府", "门派", "场景入口", "传送点", "装饰建筑", "其他"];
const INTERACTION_TYPES = [
  { value: "dialogue", label: "查看说明 / 对话" },
  { value: "shop", label: "商店（后续接入）" },
  { value: "teleport", label: "传送（后续接入）" },
  { value: "scene", label: "进入场景（后续接入）" },
  { value: "sect", label: "门派入口（后续接入）" },
];

/** 建筑模板工作台：模板只保存资料，地图只保存模板 ID 和摆放坐标。 */
export class BuildingEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.BUILDING_EDITOR); }

  create() {
    rememberEditorRoute(SceneKeys.BUILDING_EDITOR);
    this.items = getBuildingTemplates();
    this.selectedId = this.items[0]?.id;
    this.page = "basic";
    // 默认是移动现有顶点。只有玩家明确选择“添加顶点”后，点击图片才会新增点，
    // 这样误点图片不会把碰撞边界越画越乱。
    this.collisionTool = "move";
    this.collisionDrag = null;
    this.collisionCanvasState = null;
    this.domInputs = [];
    this.ui = this.add.container();
    this.input.on("pointermove", this.onCollisionPointerMove, this);
    this.input.on("pointerup", this.onCollisionPointerUp, this);
    this.windowResizeHandler = () => this.layoutDomInputs();
    window.addEventListener("resize", this.windowResizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("resize", this.windowResizeHandler);
      this.input.off("pointermove", this.onCollisionPointerMove, this);
      this.input.off("pointerup", this.onCollisionPointerUp, this);
      this.clearDomInputs();
    });
    this.refresh();
  }

  get selected() { return this.items.find((item) => item.id === this.selectedId); }
  track(display) { this.ui.add(display); return display; }

  refresh() {
    this.collisionDrag = null;
    this.collisionCanvasState = null;
    this.clearDomInputs();
    this.ui.removeAll(true);
    this.drawBackground();
    this.drawHeader();
    this.drawSidebar();
    this.drawWorkspace();
  }

  clearDomInputs() { this.domInputs.forEach((entry) => entry.element.remove()); this.domInputs = []; }
  commitAllDomInputs() { this.domInputs.forEach((entry) => entry.commit?.()); }

  layoutDomInputs() {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / 1920;
    const scaleY = rect.height / 1080;
    this.domInputs.forEach((entry) => {
      entry.element.style.left = `${rect.left + entry.x * scaleX}px`;
      entry.element.style.top = `${rect.top + entry.y * scaleY}px`;
      entry.element.style.width = `${entry.width * scaleX}px`;
      entry.element.style.height = `${entry.height * scaleY}px`;
      entry.element.style.fontSize = `${entry.fontSize * Math.min(scaleX, scaleY)}px`;
    });
  }

  drawBackground() {
    this.track(this.add.rectangle(960, 540, 1920, 1080, 0x171310));
    this.track(this.add.rectangle(174, 540, 348, 1080, 0x211812));
    this.track(this.add.rectangle(960, 35, 1920, 70, 0x211711));
    this.track(this.add.rectangle(960, 70, 1920, 1, 0x76512e, 0.75));
  }

  drawHeader() {
    this.text(31, 26, "建筑管理", 25, "#f4d5a4", { strokeThickness: 2 });
    this.text(291, 26, `${this.items.length}座`, 23, "#f4d5a4", { strokeThickness: 2 });
    [["basic", "基本信息"], ["collision", "碰撞绘制"], ["interaction", "交互设置"], ["preview", "预览"]].forEach(([key, label], index) => {
      const x = 382 + index * 135;
      const active = key === this.page;
      const hit = this.track(this.add.rectangle(x + 56, 35, 112, 70, active ? 0x4b321d : 0x211711, active ? 1 : 0.01).setInteractive({ useHandCursor: true }));
      this.text(x + 56, 35, label, 17, active ? "#f4cf56" : "#aaa096", { strokeThickness: 2 }).setOrigin(0.5);
      if (active) this.track(this.add.rectangle(x + 56, 67, 112, 3, 0xf0ca5c));
      hit.on("pointerdown", () => { this.page = key; this.refresh(); });
    });
    this.button(1770, 15, 90, "返回", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), { height: 40, size: 16, fill: 0x4b3928, hover: 0x654b31, stroke: 0x80613d });
  }

  drawSidebar() {
    this.roundedBox(14, 84, 322, 44, 0x282624, 0x45403b, 4, 1);
    const search = this.domInput(14, 84, 322, 44, this.searchKeyword || "", (value) => {
      this.searchKeyword = value;
      this.filteredItems = value ? this.items.filter((item) => `${item.name} ${item.type}`.includes(value)) : null;
      this.refresh();
    }, { fontSize: 15 });
    search.placeholder = "搜索建筑名称或类型...";
    (this.filteredItems || this.items).slice(0, 9).forEach((item, index) => this.drawBuildingCard(item, index));
    this.button(14, 1007, 322, "＋ 新建建筑", () => this.addItem(), { height: 56, fill: 0x365d39, hover: 0x467847, stroke: 0x5f9561, size: 19 });
  }

  drawBuildingCard(item, index) {
    const y = 145 + index * 96;
    const active = item.id === this.selectedId;
    const card = this.track(this.add.rectangle(175, y + 39, 322, 80, active ? 0x4a311b : 0x292827, 1).setStrokeStyle(2, active ? 0xd8ad58 : 0x3f3c38).setInteractive({ useHandCursor: true }));
    this.track(this.add.rectangle(58, y + 39, 60, 60, 0x1b1b19, 1).setStrokeStyle(1, 0x665d51));
    this.drawBuildingImage(item, 58, y + 39, 54, 54, true);
    this.text(108, y + 19, item.name, 19, "#f2ce4a", { strokeThickness: 2 });
    const collision = item.collision?.enabled ? `碰撞 ${item.collision.points?.length || 0} 点` : "可穿过";
    this.text(108, y + 48, `${item.type} · ${collision}`, 13, "#9f9991", { strokeThickness: 1 });
    card.on("pointerdown", () => { this.selectedId = item.id; this.filteredItems = null; this.refresh(); });
  }

  drawWorkspace() {
    this.roundedBox(367, 84, 1530, 980, 0x262525, 0x45413d, 8, 2);
    if (!this.selected) { this.text(1132, 510, "请新建一座建筑", 28, "#d7c6a5").setOrigin(0.5); return; }
    if (this.page === "basic") this.drawBasicPage();
    if (this.page === "collision") this.drawCollisionPage();
    if (this.page === "interaction") this.drawInteractionPage();
    if (this.page === "preview") this.drawPreviewPage();
  }

  drawBasicPage() {
    const item = this.selected;
    this.sectionTitle("建筑图片");
    this.roundedBox(755, 135, 300, 334, 0x1d1d1c, 0x4b4945, 12, 2);
    this.drawBuildingImage(item, 905, 292, 268, 268, false);
    this.text(905, 452, item.imageData ? "已使用自定义建筑图片" : "尚未上传图片：地图将显示建筑标记", 15, "#aaa39b", { strokeThickness: 1 }).setOrigin(0.5);
    this.button(1125, 227, 245, "上传建筑图片", () => this.pickImage(), { height: 46, fill: 0x9d8248, hover: 0xb09255, stroke: 0x9d8248 });
    this.button(1125, 287, 245, "清除自定义图片", () => { item.imageData = ""; this.refresh(); }, { height: 42, fill: 0x3b3a39, hover: 0x51504e, stroke: 0x3b3a39, color: "#ddd7cf" });
    this.text(1247, 347, "上传一张建筑图即可用于\n预览、地图摆放与碰撞绘制。", 16, "#8f8a83", { align: "center", lineSpacing: 7, strokeThickness: 1 }).setOrigin(0.5);

    this.sectionTitle("基本信息", 389, 520);
    this.roundedBox(389, 554, 710, 290, 0x242322, 0x3d3935, 8, 2);
    [["模板 ID", item.id, (value) => this.commitId(value, item)], ["建筑名称", item.name, (value) => { item.name = value || item.name; }]].forEach(([label, value, commit], index) => {
      const y = 585 + index * 52;
      this.text(425, y + 8, label, 16, "#bcb5ad", { strokeThickness: 1 }); this.valueField(520, y, 460, value, commit, 15);
    });
    this.text(425, 697, "建筑类型", 16, "#bcb5ad", { strokeThickness: 1 }); this.selectField(520, 689, 460, item.type, BUILDING_TYPES, (value) => { item.type = value; }, 15);
    this.text(425, 756, "显示尺寸", 16, "#bcb5ad", { strokeThickness: 1 });
    this.valueField(520, 748, 150, item.display.width, (value) => this.commitNumber(value, (number) => { item.display.width = number; }), 15, "number");
    this.text(683, 756, "×", 18, "#8e877d", { strokeThickness: 0 });
    this.valueField(710, 748, 150, item.display.height, (value) => this.commitNumber(value, (number) => { item.display.height = number; }), 15, "number");
    this.text(878, 756, "像素", 15, "#8e877d", { strokeThickness: 0 });
    this.text(425, 806, "摆放锚点", 16, "#bcb5ad", { strokeThickness: 1 }); this.selectField(520, 798, 250, item.display.anchor, [{ value: "bottom", label: "底部（推荐）" }, { value: "center", label: "中心" }], (value) => { item.display.anchor = value; }, 15);

    this.sectionTitle("地图行为", 1125, 520);
    this.roundedBox(1125, 554, 710, 290, 0x242322, 0x3d3935, 8, 2);
    this.text(1160, 590, "碰撞范围", 19, "#f0ce57", { strokeThickness: 2 });
    this.text(1160, 630, item.collision.enabled ? `已启用 · ${item.collision.points.length} 个顶点` : "未启用 · 玩家可直接穿过", 16, item.collision.enabled ? "#a8c994" : "#a49a8a", { strokeThickness: 1 });
    this.button(1540, 576, 255, item.collision.enabled ? "关闭碰撞" : "启用碰撞", () => { item.collision.enabled = !item.collision.enabled; item.blocked = item.collision.enabled; this.refresh(); }, { height: 42, fill: item.collision.enabled ? 0x694233 : 0x365d39, hover: item.collision.enabled ? 0x855445 : 0x477849, stroke: 0x80613d, size: 16 });
    this.text(1160, 696, "交互方式", 19, "#f0ce57", { strokeThickness: 2 });
    this.text(1160, 736, item.interaction.enabled ? INTERACTION_TYPES.find((entry) => entry.value === item.interaction.kind)?.label : "无交互", 16, "#d2c5a6", { strokeThickness: 1 });
    this.button(1540, 682, 255, "编辑交互设置", () => { this.page = "interaction"; this.refresh(); }, { height: 42, size: 16 });
    this.text(1160, 798, "提示：碰撞边界在“碰撞绘制”页按图片手绘，\n保存后地图实例只通过模板 ID 自动读取。", 15, "#8f8a83", { lineSpacing: 7, strokeThickness: 1 });
    this.drawBottomActions();
  }

  drawCollisionPage() {
    const item = this.selected;
    this.sectionTitle("碰撞范围绘制"); this.text(389, 132, "默认可直接拖动橙色节点调整范围；只有切换到“添加顶点”后，点击图片才会新增顶点。", 16, "#aaa39b", { strokeThickness: 1 });
    this.roundedBox(389, 168, 990, 774, 0x161719, 0x44413c, 10, 2); this.roundedBox(1410, 168, 425, 774, 0x22211f, 0x44413c, 10, 2);
    this.drawCollisionCanvas(item);
    this.text(1440, 202, "碰撞设置", 20, "#f0ce57", { strokeThickness: 2 }); this.text(1440, 249, "状态", 16, "#bcb5ad", { strokeThickness: 1 });
    this.button(1440, 276, 365, item.collision.enabled ? "已启用：角色不可穿过" : "未启用：角色可穿过", () => { item.collision.enabled = !item.collision.enabled; item.blocked = item.collision.enabled; this.refresh(); }, { height: 42, size: 16, fill: item.collision.enabled ? 0x365d39 : 0x4b3928, hover: item.collision.enabled ? 0x477849 : 0x654b31, stroke: item.collision.enabled ? 0x5d9360 : 0x80613d });
    this.text(1440, 349, "绘制工具", 16, "#bcb5ad", { strokeThickness: 1 });
    this.button(1440, 376, 176, "拖动编辑", () => { this.collisionTool = "move"; this.refresh(); }, { height: 40, size: 15, fill: this.collisionTool === "move" ? 0x365d39 : 0x373532, hover: 0x477849, stroke: this.collisionTool === "move" ? 0x5d9360 : 0xe6bd61 });
    this.button(1629, 376, 176, this.collisionTool === "add" ? "请点击图片" : "插入一个顶点", () => { this.collisionTool = "add"; item.collision.shape = "polygon"; this.refresh(); }, { height: 40, size: 14, fill: this.collisionTool === "add" ? 0x76552c : 0x373532, hover: 0x76552c });
    this.text(1440, 446, "常用范围", 16, "#bcb5ad", { strokeThickness: 1 });
    this.button(1440, 472, 176, "底部矩形", () => this.applyRectangleCollision(), { height: 38, size: 15, fill: item.collision.shape === "rectangle" ? 0x76552c : 0x373532, hover: 0x76552c });
    this.button(1629, 472, 176, "重新识别轮廓", () => this.autoGenerateCollisionFromImage(item), { height: 38, size: 14, fill: 0x373532, hover: 0x76552c });
    this.text(1440, 535, `顶点列表（${item.collision.points.length}）`, 16, "#bcb5ad", { strokeThickness: 1 });
    if (!item.collision.points.length) this.text(1623, 618, "先点“底部矩形”快速生成，\n再拖动四个节点微调即可。", 17, "#8f8a83", { align: "center", lineSpacing: 8, strokeThickness: 1 }).setOrigin(0.5);
    item.collision.points.slice(0, 9).forEach((point, index) => { const y = 562 + index * 30; this.text(1450, y + 5, String(index + 1).padStart(2, "0"), 13, "#a99e86", { strokeThickness: 0 }); this.text(1500, y + 5, `X ${Math.round(point.x * 100)}%`, 13, "#d7cbb1", { strokeThickness: 0 }); this.text(1605, y + 5, `Y ${Math.round(point.y * 100)}%`, 13, "#d7cbb1", { strokeThickness: 0 }); this.button(1730, y, 62, "×", () => { item.collision.points.splice(index, 1); this.refresh(); }, { height: 26, size: 16, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff7867" }); });
    if (item.collision.points.length > 9) this.text(1623, 836, `另有 ${item.collision.points.length - 9} 个顶点，请直接在左图拖动或删除。`, 13, "#a99e86", { align: "center", strokeThickness: 0 }).setOrigin(0.5);
    this.button(1440, 855, 175, "撤销上一点", () => { item.collision.points.pop(); this.refresh(); }, { height: 42, size: 16, fill: 0x4b3928, hover: 0x654b31 }); this.button(1630, 855, 175, "清空全部", () => { item.collision.points = []; item.collision.shape = "polygon"; this.collisionTool = "move"; this.refresh(); }, { height: 42, size: 16, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff7867" });
    this.text(1623, 925, "红线为碰撞边界；绿色半透明区域\n为角色不可进入的实际范围。", 15, "#8f8a83", { align: "center", lineSpacing: 7, strokeThickness: 1 }).setOrigin(0.5); this.drawBottomActions();
  }

  drawCollisionCanvas(item) {
    const frame = { x: 430, y: 205, width: 910, height: 700 };
    this.track(this.add.rectangle(frame.x + frame.width / 2, frame.y + frame.height / 2, frame.width, frame.height, 0x101115, 1).setStrokeStyle(1, 0x343944));
    for (let x = frame.x + 30; x < frame.x + frame.width; x += 30) this.track(this.add.rectangle(x, frame.y + frame.height / 2, 1, frame.height, 0x222832, 0.52));
    for (let y = frame.y + 30; y < frame.y + frame.height; y += 30) this.track(this.add.rectangle(frame.x + frame.width / 2, y, frame.width, 1, 0x222832, 0.52));
    const imageBounds = this.getPreviewBounds(item, frame);
    this.track(this.add.rectangle(imageBounds.x + imageBounds.width / 2, imageBounds.y + imageBounds.height / 2, imageBounds.width, imageBounds.height, 0x211d17, 0.9).setStrokeStyle(1, 0x85683b)); this.drawBuildingImage(item, imageBounds.x + imageBounds.width / 2, imageBounds.y + imageBounds.height / 2, imageBounds.width, imageBounds.height, false);
    // 先建立图片的点击层，再把顶点控制点放到最上层。旧版点击层盖住顶点，导致顶点看得到却无法拖动。
    const hit = this.track(this.add.rectangle(imageBounds.x + imageBounds.width / 2, imageBounds.y + imageBounds.height / 2, imageBounds.width, imageBounds.height, 0xffffff, 0.001).setInteractive({ useHandCursor: true }));
    hit.on("pointerdown", (pointer) => this.onCollisionCanvasPointerDown(pointer, item, imageBounds));
    const overlay = this.track(this.add.graphics());
    const vertexDisplays = item.collision.points.map((point, index) => {
      const position = this.relativePointToCanvas(point, imageBounds);
      const handle = this.track(this.add.circle(position.x, position.y, 10, 0xffc36c).setStrokeStyle(2, 0x592a1e).setInteractive({ useHandCursor: true }));
      const label = this.text(position.x, position.y, String(index + 1), 12, "#24150c", { strokeThickness: 0 }).setOrigin(0.5);
      handle.on("pointerdown", (pointer) => this.startCollisionVertexDrag(pointer, item, index, imageBounds));
      handle.on("pointerover", () => handle.setFillStyle(0xffe09a));
      handle.on("pointerout", () => handle.setFillStyle(0xffc36c));
      return { handle, label };
    });
    this.collisionCanvasState = { itemId: item.id, imageBounds, overlay, vertexDisplays };
    this.renderCollisionCanvasState();
    const helper = this.collisionTool === "add"
      ? "插入一个顶点：点击边界附近的位置，系统会自动插到最近的边上，随后回到拖动编辑。"
      : "拖动编辑模式：按住橙色编号节点直接移动；误点图片不会新增顶点。";
    this.text(frame.x + 18, frame.y + 16, item.imageData ? helper : "未上传建筑图：先用“底部矩形”生成范围，再拖动节点调整；上传后坐标会自动保留。", 15, "#b2a88e", { strokeThickness: 1 });
  }

  relativePointToCanvas(point, imageBounds) { return new Phaser.Geom.Point(imageBounds.x + point.x * imageBounds.width, imageBounds.y + point.y * imageBounds.height); }
  renderCollisionCanvasState() {
    const state = this.collisionCanvasState;
    const item = state && this.items.find((entry) => entry.id === state.itemId);
    if (!state || !item || !state.overlay.active) return;
    const points = item.collision.points.map((point) => this.relativePointToCanvas(point, state.imageBounds));
    state.overlay.clear();
    if (points.length >= 3) { state.overlay.fillStyle(item.collision.enabled ? 0x4e8456 : 0x886b39, 0.26); state.overlay.beginPath(); state.overlay.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => state.overlay.lineTo(point.x, point.y)); state.overlay.closePath(); state.overlay.fillPath(); }
    if (points.length >= 2) { state.overlay.lineStyle(3, 0xff7f63, 0.95); state.overlay.beginPath(); state.overlay.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => state.overlay.lineTo(point.x, point.y)); if (points.length >= 3) state.overlay.lineTo(points[0].x, points[0].y); state.overlay.strokePath(); }
    state.vertexDisplays.forEach((display, index) => { const point = points[index]; if (!point) return; display.handle.setPosition(point.x, point.y); display.label.setPosition(point.x, point.y); });
  }
  onCollisionCanvasPointerDown(pointer, item, imageBounds) {
    if (this.collisionTool !== "add") { this.showNotice("请拖动橙色节点调整；需要新增点时先选择“添加顶点”"); return; }
    const x = Phaser.Math.Clamp((pointer.x - imageBounds.x) / imageBounds.width, 0, 1);
    const y = Phaser.Math.Clamp((pointer.y - imageBounds.y) / imageBounds.height, 0, 1);
    item.collision.shape = "polygon";
    this.insertCollisionPointAtNearestEdge(item.collision.points, { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    // 只插入一个点就退出该工具，防止一次误操作连续加入大量顶点。
    this.collisionTool = "move";
    this.refresh();
  }
  insertCollisionPointAtNearestEdge(points, point) {
    if (points.length < 2) { points.push(point); return; }
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      const progress = lengthSquared > 0 ? Phaser.Math.Clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1) : 0;
      const nearX = start.x + dx * progress;
      const nearY = start.y + dy * progress;
      const distance = (point.x - nearX) ** 2 + (point.y - nearY) ** 2;
      if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
    }
    points.splice(bestIndex + 1, 0, point);
  }
  startCollisionVertexDrag(pointer, item, index, imageBounds) {
    if (this.collisionTool === "add") { this.showNotice("当前是添加顶点模式；切回“拖动编辑”后可移动节点"); return; }
    pointer.event?.stopPropagation();
    this.collisionDrag = { itemId: item.id, index, imageBounds };
  }
  onCollisionPointerMove(pointer) {
    const drag = this.collisionDrag;
    if (!drag) return;
    const item = this.items.find((entry) => entry.id === drag.itemId);
    if (!item?.collision.points[drag.index]) return;
    const x = Phaser.Math.Clamp((pointer.x - drag.imageBounds.x) / drag.imageBounds.width, 0, 1);
    const y = Phaser.Math.Clamp((pointer.y - drag.imageBounds.y) / drag.imageBounds.height, 0, 1);
    item.collision.points[drag.index] = { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) };
    this.renderCollisionCanvasState();
  }
  onCollisionPointerUp() { if (!this.collisionDrag) return; this.collisionDrag = null; this.refresh(); }
  getPreviewBounds(item, frame) { const source = this.getImageSource(item); const ratio = source ? source.width / source.height : 1; const maxWidth = frame.width - 96; const maxHeight = frame.height - 100; const width = Math.min(maxWidth, maxHeight * ratio); const height = width / ratio; return { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2 + 18, width, height }; }
  applyRectangleCollision() { const item = this.selected; item.collision.shape = "rectangle"; item.collision.points = [{ x: 0.14, y: 0.55 }, { x: 0.86, y: 0.55 }, { x: 0.86, y: 0.95 }, { x: 0.14, y: 0.95 }]; this.collisionTool = "move"; this.refresh(); }

  drawInteractionPage() {
    const item = this.selected; const interaction = item.interaction;
    this.sectionTitle("交互设置"); this.text(389, 133, "当前第一章会在角色靠近建筑并按 E 后显示交互说明；其他类型字段已预留，后续接入系统时无需重做模板。", 16, "#aaa39b", { strokeThickness: 1 }); this.roundedBox(389, 170, 1410, 625, 0x242322, 0x3d3935, 10, 2);
    this.text(430, 215, "交互状态", 18, "#bcb5ad", { strokeThickness: 1 }); this.button(596, 200, 238, interaction.enabled ? "已启用交互" : "未启用交互", () => { interaction.enabled = !interaction.enabled; this.refresh(); }, { height: 44, size: 16, fill: interaction.enabled ? 0x365d39 : 0x4b3928, hover: interaction.enabled ? 0x477849 : 0x654b31, stroke: interaction.enabled ? 0x5d9360 : 0x80613d });
    this.text(430, 286, "交互类型", 18, "#bcb5ad", { strokeThickness: 1 }); this.selectField(596, 275, 490, interaction.kind, INTERACTION_TYPES, (value) => { interaction.kind = value; }, 16);
    this.text(430, 357, "交互标题", 18, "#bcb5ad", { strokeThickness: 1 }); this.valueField(596, 345, 786, interaction.title, (value) => { interaction.title = value; }, 16, "text", 42);
    this.text(430, 428, "说明文字", 18, "#bcb5ad", { strokeThickness: 1 }); this.textareaField(596, 415, 786, 164, interaction.prompt, (value) => { interaction.prompt = value; item.interactionText = value; });
    this.text(430, 627, "目标 ID", 18, "#bcb5ad", { strokeThickness: 1 }); this.valueField(596, 615, 786, interaction.targetId, (value) => { interaction.targetId = value; }, 16, "text", 42);
    this.text(596, 676, "商店、传送、场景入口与门派入口将按该 ID 连接后续编辑器；当前可先留空。", 15, "#8f8a83", { strokeThickness: 1 }); this.drawBottomActions();
  }

  drawPreviewPage() {
    const item = this.selected; this.sectionTitle("建筑预览"); this.roundedBox(442, 165, 1000, 650, 0x171717, 0x4c4640, 12, 2); this.drawBuildingImage(item, 942, 470, 760, 535, false); this.roundedBox(1474, 165, 325, 650, 0x242322, 0x3d3935, 10, 2);
    this.text(1510, 205, item.name, 24, "#f4d56b", { strokeThickness: 3 }); this.text(1510, 253, `类型：${item.type}`, 17, "#d7c8a8", { strokeThickness: 1 }); this.text(1510, 290, `显示：${item.display.width} × ${item.display.height}`, 17, "#d7c8a8", { strokeThickness: 1 }); this.text(1510, 340, "地图规则", 18, "#f0ce57", { strokeThickness: 2 }); this.text(1510, 378, item.collision.enabled ? `阻挡移动 · ${item.collision.points.length} 点多边形` : "可自由通过", 16, item.collision.enabled ? "#a8c994" : "#aaa39b", { wordWrap: { width: 250 }, lineSpacing: 5, strokeThickness: 1 }); this.text(1510, 463, "交互说明", 18, "#f0ce57", { strokeThickness: 2 }); this.text(1510, 503, item.interaction.enabled ? item.interaction.prompt : "未启用交互", 16, "#d8d0c4", { wordWrap: { width: 250 }, lineSpacing: 8, strokeThickness: 1 }); this.drawBottomActions();
  }

  drawBottomActions() { this.button(1375, 975, 180, "删除建筑", () => this.deleteItem(), { height: 46, fill: 0x4a2921, hover: 0x69372b, stroke: 0x6d493c, color: "#ff7867", size: 17 }); this.button(1575, 975, 260, "保存全部建筑模板", () => this.save(), { height: 46, fill: 0x365d39, hover: 0x477849, stroke: 0x5d9360, size: 17 }); }

  drawBuildingImage(item, x, y, width, height, compact) {
    const key = `building-editor-${item.id}`; if (item.imageData && !this.textures.exists(key)) this.loadBuildingTexture(item, false); const canDraw = item.imageData && this.textures.exists(key);
    if (!canDraw) { const size = compact ? 28 : 66; this.text(x, y - 8, "建", size, "#887044", { fontStyle: "bold", stroke: "#21190e", strokeThickness: 4 }).setOrigin(0.5); if (!compact) this.text(x, y + 52, "等待上传建筑图片", 16, "#918878", { strokeThickness: 1 }).setOrigin(0.5); return; }
    const image = this.track(this.add.image(x, y, key)); const source = image.frame; const scale = Math.min(width / source.width, height / source.height); image.setDisplaySize(source.width * scale, source.height * scale).setOrigin(0.5);
  }

  getImageSource(item) { const key = `building-editor-${item.id}`; return item.imageData && this.textures.exists(key) ? this.textures.get(key).getSourceImage() : null; }
  pickImage() { const input = document.createElement("input"); input.type = "file"; input.accept = "image/png,image/jpeg,image/webp"; input.style.display = "none"; document.body.appendChild(input); input.onchange = () => { const file = input.files?.[0]; input.remove(); if (!file) return; const item = this.selected; this.showNotice("正在转换图片并生成碰撞轮廓…"); prepareImageForStorage(file, { maxSide: 1024, quality: 0.84 }).then(async (data) => { item.imageData = data; await this.autoGenerateCollisionFromImage(item, true); this.loadBuildingTexture(item, true); }).catch(() => this.showNotice("图片处理失败，请使用 PNG、JPG 或 WEBP")); }; input.click(); }
  async autoGenerateCollisionFromImage(item, fromUpload = false) {
    if (!item?.imageData) { this.showNotice("请先上传建筑图片"); return; }
    try {
      const result = await detectImageCollisionOutline(item.imageData);
      if (result.points.length < 3) throw new Error("未找到有效轮廓");
      item.collision.shape = "polygon";
      item.collision.points = result.points;
      item.collision.enabled = true;
      item.blocked = true;
      this.collisionTool = "move";
      if (!fromUpload) this.refresh();
      this.showNotice(result.usesTransparency ? `已按图片轮廓生成 ${result.points.length} 点，可拖动微调` : "图片无透明背景：已按图片边缘生成范围，可拖动微调");
    } catch (error) {
      this.showNotice("无法识别图片轮廓，请使用底部矩形后手动微调");
    }
  }
  loadBuildingTexture(item, replace = false) { const key = `building-editor-${item.id}`; if (!item.imageData || (!replace && this.textures.exists(key))) return; const image = new Image(); image.onload = () => { if (this.textures.exists(key)) this.textures.remove(key); this.textures.addImage(key, image); if (this.selectedId === item.id) this.refresh(); }; image.onerror = () => this.showNotice("图片读取失败，请更换图片"); image.src = item.imageData; }
  addItem() { const item = normalizeBuilding({ name: "新建筑", type: "建筑", interactionText: "" }); this.items.push(item); this.selectedId = item.id; this.filteredItems = null; this.refresh(); }
  deleteItem() { const item = this.selected; if (!item) return; if (!window.confirm(`确定删除建筑模板「${item.name}」吗？已摆放在地图上的实例不会删除，但会失去模板资料。`)) return; this.items = this.items.filter((entry) => entry.id !== item.id); this.selectedId = this.items[0]?.id; this.filteredItems = null; this.refresh(); }
  commitId(value, item) { const id = value.trim(); if (!id) { this.showNotice("模板 ID 不能为空"); return false; } if (this.items.some((entry) => entry !== item && entry.id === id)) { this.showNotice("该模板 ID 已存在"); return false; } item.id = id; this.selectedId = id; return true; }
  commitNumber(raw, setValue) { const value = Number(raw); if (!Number.isFinite(value) || value < 48 || value > 1024) { this.showNotice("显示尺寸需在 48 至 1024 之间"); return false; } setValue(Math.round(value)); return true; }
  save() { this.commitAllDomInputs(); const prepared = this.items.map(normalizeBuilding); if (!saveBuildingTemplates(prepared)) { this.showNotice("保存失败：无法写入项目文件夹，请确认本地服务器正在运行"); return; } this.items = prepared; this.refresh(); this.showNotice("建筑模板与图片已写入项目文件夹，地图编辑器会读取最新资料"); }

  domInput(x, y, width, height, value, onCommit, options = {}) { const element = document.createElement("input"); element.type = options.type || "text"; element.value = String(value ?? ""); element.autocomplete = "off"; element.spellcheck = false; element.style.cssText = `position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:0 ${options.padding ?? 16}px;border:1px solid transparent;border-radius:5px;outline:none;background:transparent;color:${options.color || "#ddd7cf"};font-family:Microsoft YaHei,Noto Sans SC,sans-serif;text-align:${options.align || "left"};`; const entry = { element, x, y, width, height, fontSize: options.fontSize || 15 }; let committed = element.value; entry.commit = () => { const valueToCommit = element.value.trim(); if (valueToCommit === committed) return; if (onCommit(valueToCommit) === false) { element.value = committed; return; } committed = valueToCommit; }; element.addEventListener("focus", () => { element.style.borderColor = "#b79754"; }); element.addEventListener("blur", () => { element.style.borderColor = "transparent"; entry.commit(); }); element.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); element.blur(); } event.stopPropagation(); }); document.body.appendChild(element); this.domInputs.push(entry); this.layoutDomInputs(); return element; }
  domSelect(x, y, width, height, value, choices, onCommit, options = {}) { const element = document.createElement("select"); const optionsList = choices.map((choice) => typeof choice === "string" ? { value: choice, label: choice } : choice); optionsList.forEach((choice) => { const option = document.createElement("option"); option.value = choice.value; option.textContent = choice.label; option.style.background = "#1b1b1a"; option.style.color = "#ddd7cf"; element.appendChild(option); }); element.value = optionsList.some((choice) => choice.value === value) ? value : optionsList[0]?.value || ""; element.style.cssText = "position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:0 34px 0 16px;border:1px solid transparent;border-radius:5px;outline:none;background:transparent;color:#ddd7cf;font-family:Microsoft YaHei,Noto Sans SC,sans-serif;"; const entry = { element, x, y, width, height, fontSize: options.fontSize || 15, commit: () => onCommit(element.value) }; element.addEventListener("focus", () => { element.style.borderColor = "#b79754"; }); element.addEventListener("blur", () => { element.style.borderColor = "transparent"; }); element.addEventListener("change", entry.commit); element.addEventListener("keydown", (event) => event.stopPropagation()); document.body.appendChild(element); this.domInputs.push(entry); this.layoutDomInputs(); }
  domTextarea(x, y, width, height, value, onChange) { const element = document.createElement("textarea"); element.value = String(value ?? ""); element.spellcheck = false; element.style.cssText = "position:fixed;z-index:20;box-sizing:border-box;margin:0;padding:13px 16px;border:1px solid transparent;border-radius:7px;outline:none;resize:none;background:transparent;color:#eee5d7;font-family:Microsoft YaHei,Noto Sans SC,sans-serif;font-size:16px;line-height:1.6;"; const entry = { element, x, y, width, height, fontSize: 16, commit: () => onChange(element.value) }; element.addEventListener("input", entry.commit); element.addEventListener("focus", () => { element.style.borderColor = "#b79754"; }); element.addEventListener("blur", () => { element.style.borderColor = "transparent"; }); element.addEventListener("keydown", (event) => event.stopPropagation()); document.body.appendChild(element); this.domInputs.push(entry); this.layoutDomInputs(); }
  text(x, y, value, size = 20, color = "#eee3ca", style = {}) { return this.track(addText(this, x, y, value, size, color, { fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif", stroke: "#19130f", strokeThickness: 3, ...style })); }
  roundedBox(x, y, width, height, fill, stroke = null, radius = 10, lineWidth = 2) { const box = this.track(this.add.graphics()); box.fillStyle(fill, 1); box.fillRoundedRect(x, y, width, height, radius); if (stroke !== null) { box.lineStyle(lineWidth, stroke, 1); box.strokeRoundedRect(x, y, width, height, radius); } return box; }
  sectionTitle(value, x = 389, y = 100) { this.text(x, y, value, 20, "#f0ce57", { strokeThickness: 2 }); }
  button(x, y, width, label, action, options = {}) { const height = options.height ?? 46; const normal = options.fill ?? 0x4b3627; const hover = options.hover ?? 0x64472f; const background = this.track(this.add.rectangle(x + width / 2, y + height / 2, width, height, normal, 1).setStrokeStyle(2, options.stroke ?? 0xe6bd61).setInteractive({ useHandCursor: true })); const labelText = this.text(x + width / 2, y + height / 2, label, options.size ?? 18, options.color ?? "#f5e5b7", { strokeThickness: 3 }).setOrigin(0.5); background.on("pointerover", () => background.setFillStyle(hover)); background.on("pointerout", () => background.setFillStyle(normal)); background.on("pointerdown", action); return [background, labelText]; }
  valueField(x, y, width, value, onCommit, size = 15, type = "text", height = 33) { this.roundedBox(x, y, width, height, 0x1b1b1a, 0x393735, 5, 1); this.domInput(x, y, width, height, value, onCommit, { type, fontSize: size, padding: width <= 160 ? 9 : 16, align: width <= 160 ? "center" : "left" }); }
  selectField(x, y, width, value, choices, onCommit, size = 15) { this.roundedBox(x, y, width, 33, 0x1b1b1a, 0x393735, 5, 1); this.text(x + width - 18, y + 7, "▾", 14, "#aaa39b", { strokeThickness: 0 }).setOrigin(0.5, 0); this.domSelect(x, y, width, 33, value, choices, onCommit, { fontSize: size }); }
  textareaField(x, y, width, height, value, onChange) { this.roundedBox(x, y, width, height, 0x1b1b1a, 0x393735, 7, 1); this.domTextarea(x, y, width, height, value, onChange); }
  showNotice(message) { const notice = this.add.container(1600, 930); const bg = this.add.rectangle(0, 0, 340, 48, 0x365d39, 0.98).setStrokeStyle(1, 0x7bac70); const text = addText(this, 0, 0, message, 16, "#f1f0d7", { strokeThickness: 2 }).setOrigin(0.5); notice.add([bg, text]); this.tweens.add({ targets: notice, alpha: 0, delay: 1350, duration: 400, onComplete: () => notice.destroy() }); }
}

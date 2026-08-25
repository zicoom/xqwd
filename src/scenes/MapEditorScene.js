import { createMapObject, getMapObjects, MAP_OBJECT_TYPES, saveMapObjects } from "../core/MapContentStore.js";
import { MAP_DEFINITIONS, getMapDefinition } from "../core/MapCatalog.js";
import { getMonsterTemplates } from "../core/MonsterStore.js";
import { getBuildingTemplates, getNpcTemplates } from "../core/WorldTemplateStore.js";
import { getMonsterAppearanceTextureKey, resolveMonsterAppearance } from "../core/MonsterAppearance.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addText } from "../utils/UiHelpers.js";

const CATEGORIES = [
  ["building", "建筑"], ["npc", "NPC"], ["monster", "怪物"], ["herb", "灵草"],
  ["mineral", "矿石"], ["portal", "传送"], ["trigger", "触发"],
];

/** 左侧素材库 + 中央地图画布 + 多地图切换 + 全局视图的可视化编辑器。 */
export class MapEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.MAP_EDITOR); }

  preload() {
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      this.load.image(this.tileKey("qingyun-mountain", x, y), this.tilePath(x, y));
    }
    this.load.spritesheet("editor-npc-preview", "./public/assets/images/characters/player-idle-5dir.png", { frameWidth: 256, frameHeight: 256 });
    this.load.image("editor-monster-preview", "./public/assets/images/battle/swordsman.png");
  }

  create() {
    rememberEditorRoute(SceneKeys.MAP_EDITOR);
    this.activeMapId = "qingyun-mountain";
    this.mapConfig = getMapDefinition(this.activeMapId);
    this.mapDrafts = new Map();
    this.historyByMap = new Map();
    this.redoByMap = new Map();
    this.tiles = new Map();
    this.loadingTiles = new Set();
    this.markers = new Map();
    this.worldDecorations = [];
    this.uiObjects = [];
    this.monsters = getMonsterTemplates();
    this.npcs = getNpcTemplates();
    this.buildings = getBuildingTemplates();
    this.selectedTemplateIds = {
      monster: this.monsters[0]?.id || null,
      npc: this.npcs[0]?.id || null,
      building: this.buildings[0]?.id || null,
    };
    this.selectedCategory = "monster";
    this.selectedObjectId = null;
    this.streamElapsed = 0;

    this.mapCamera = this.cameras.main.setViewport(282, 0, 1638, 1080).setBackgroundColor("#223a38");
    this.uiCamera = this.cameras.add(0, 0, 1920, 1080).setScroll(0, 0).setZoom(1);
    this.loadMap(this.activeMapId, false);
    this.buildUi();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,DELETE,ESC");
    this.input.on("pointerdown", (pointer) => this.pointerDown(pointer));
    this.input.on("pointermove", (pointer) => this.pointerMove(pointer));
    this.input.on("pointerup", () => { this.panning = false; });
    this.input.on("wheel", (pointer, _objects, _dx, deltaY) => this.zoomAt(pointer, deltaY));
    this.keys.DELETE.on("down", () => this.deleteSelected());
    this.keys.ESC.on("down", () => this.cancelSelection());
    this.input.keyboard.on("keydown-Z", (event) => { if (event.ctrlKey) this.undo(); });
    this.input.keyboard.on("keydown-Y", (event) => { if (event.ctrlKey) this.redo(); });
  }

  clone(value) { return JSON.parse(JSON.stringify(value)); }
  tileKey(mapId, x, y) { return `editor-${mapId}-tile-x${x}-y${y}`; }
  tilePath(x, y) { return `./public/assets/images/maps/qingyun-mountain/tiles/tile-x${y}-y${x}.webp`; }
  fitZoom() { return Math.min(1638 / this.mapConfig.worldWidth, 1080 / this.mapConfig.worldHeight); }
  coverZoom() { return Math.max(1638 / this.mapConfig.worldWidth, 1080 / this.mapConfig.worldHeight); }

  loadMap(mapId, remember = true) {
    if (remember && this.mapObjects) this.mapDrafts.set(this.activeMapId, this.clone(this.mapObjects));
    this.clearWorld();
    this.activeMapId = mapId;
    this.mapConfig = getMapDefinition(mapId);
    this.mapObjects = this.mapDrafts.has(mapId) ? this.clone(this.mapDrafts.get(mapId)) : getMapObjects(mapId);
    this.mapCamera.setBounds(0, 0, this.mapConfig.worldWidth, this.mapConfig.worldHeight);
    // 进入地图时铺满编辑画布；“全局视图”按钮仍可缩放到完整地图。
    this.mapCamera.setZoom(this.coverZoom()).centerOn(this.mapConfig.worldWidth / 2, this.mapConfig.worldHeight / 2);
    this.clampCamera();
    if (this.mapConfig.kind === "tiles") {
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.showTile(x, y);
      this.refreshTiles();
    } else this.drawLuanxingPlaceholder();
    this.renderMarkers();
    if (remember) {
      this.buildUi();
      this.notice(`已切换到「${this.mapConfig.name}」，本图对象独立保存。`, "#dff0c7");
    }
  }

  clearWorld() {
    for (const object of this.tiles.values()) object.destroy();
    for (const object of this.markers.values()) object.destroy();
    this.worldDecorations.forEach((object) => object.destroy());
    this.tiles.clear(); this.markers.clear(); this.worldDecorations = [];
  }

  drawLuanxingPlaceholder() {
    const { worldWidth: width, worldHeight: height, backgroundColor } = this.mapConfig;
    const background = this.add.rectangle(0, 0, width, height, backgroundColor).setOrigin(0).setDepth(-20);
    const grid = this.add.graphics().setDepth(-19).lineStyle(4, 0x9bc6c2, 0.18);
    for (let x = 0; x <= width; x += 600) grid.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 600) grid.lineBetween(0, y, width, y);
    const title = addText(this, width / 2, height / 2 - 80, "乱星海", 150, "#d8eee8", { origin: 0.5, strokeThickness: 8 });
    const hint = addText(this, width / 2, height / 2 + 90, "第二张大地图已建立 · 等待导入乱星海底图", 48, "#c1deda", { origin: 0.5 });
    this.worldDecorations.push(background, grid, title, hint);
    this.worldDecorations.forEach((object) => this.uiCamera.ignore(object));
  }

  showTile(x, y) {
    const key = this.tileKey(this.activeMapId, x, y);
    if (this.tiles.has(key) || !this.textures.exists(key)) return;
    const tile = this.add.image(x * this.mapConfig.tileSize, y * this.mapConfig.tileSize, key)
      .setOrigin(0).setScale(this.mapConfig.displayScale).setDepth(-10);
    this.tiles.set(key, tile); this.uiCamera.ignore(tile);
  }

  requestTile(x, y) {
    const mapId = this.activeMapId;
    const key = this.tileKey(mapId, x, y);
    if (this.textures.exists(key)) return this.showTile(x, y);
    if (this.loadingTiles.has(key)) return;
    this.loadingTiles.add(key);
    this.load.once(`filecomplete-image-${key}`, () => {
      this.loadingTiles.delete(key);
      if (this.activeMapId === mapId) this.showTile(x, y);
    });
    this.load.image(key, this.tilePath(x, y)); this.load.start();
  }

  refreshTiles() {
    if (this.mapConfig.kind !== "tiles") return;
    const camera = this.mapCamera;
    const minX = Phaser.Math.Clamp(Math.floor(camera.scrollX / this.mapConfig.tileSize) - 1, 0, this.mapConfig.columns - 1);
    const minY = Phaser.Math.Clamp(Math.floor(camera.scrollY / this.mapConfig.tileSize) - 1, 0, this.mapConfig.rows - 1);
    const maxX = Phaser.Math.Clamp(Math.ceil((camera.scrollX + camera.width / camera.zoom) / this.mapConfig.tileSize), 0, this.mapConfig.columns - 1);
    const maxY = Phaser.Math.Clamp(Math.ceil((camera.scrollY + camera.height / camera.zoom) / this.mapConfig.tileSize), 0, this.mapConfig.rows - 1);
    for (let x = minX; x <= maxX; x += 1) for (let y = minY; y <= maxY; y += 1) this.requestTile(x, y);
  }

  pin(object, depth = 100) {
    object.setDepth(depth); this.mapCamera.ignore(object); this.uiObjects.push(object); return object;
  }

  text(x, y, value, size = 14, color = "#eee1c9") {
    return this.pin(addText(this, x, y, value, size, color, { strokeThickness: 1 }), 102);
  }

  button(x, y, width, height, label, action, options = {}) {
    const fill = options.fill ?? 0x33261e;
    const bg = this.pin(this.add.rectangle(x + width / 2, y + height / 2, width, height, fill)
      .setStrokeStyle(1, options.stroke ?? 0x59473a).setInteractive({ useHandCursor: true }), 101);
    const labelText = this.text(x + width / 2, y + height / 2, label, options.size ?? 14, options.color ?? "#eee1c9").setOrigin(0.5);
    bg.on("pointerdown", () => action());
    bg.on("pointerover", () => bg.setFillStyle(options.hover ?? 0x59402d));
    bg.on("pointerout", () => bg.setFillStyle(fill));
    return { bg, labelText };
  }

  buildUi() {
    this.uiObjects.forEach((object) => object.destroy()); this.uiObjects = [];
    this.pin(this.add.rectangle(141, 540, 282, 1080, 0x20150f, 0.98).setStrokeStyle(2, 0x6f4a29), 100);
    this.text(141, 26, "地图编辑器", 24, "#f1c853").setOrigin(0.5);
    this.text(141, 55, `${this.mapConfig.name} · 创造模式`, 13, "#bda681").setOrigin(0.5);
    CATEGORIES.forEach(([key, label], index) => {
      const active = key === this.selectedCategory;
      const x = 7 + index * 39;
      this.button(x, 72, 36, 39, label[0], () => this.selectCategory(key), { fill: active ? 0x60401e : 0x201712, stroke: active ? 0xd3a348 : 0x3e3027, size: 13 });
      this.text(x + 18, 119, label, 10, active ? "#f3cd55" : "#b4a99d").setOrigin(0.5);
    });
    this.text(10, 144, `选择${this.categoryName()}模板：`, 14, "#d9c6a9");
    this.buildTemplateGrid();
    this.buildStats();
    this.button(8, 828, 128, 34, "↶ 撤销", () => this.undo(), { fill: 0x28313a });
    this.button(146, 828, 128, 34, "↷ 重做", () => this.redo(), { fill: 0x28313a });
    this.button(8, 872, 128, 34, "删除", () => this.deleteSelected(), { fill: 0x48282a });
    this.button(146, 872, 128, 34, "取消选择", () => this.cancelSelection(), { fill: 0x332d2b });
    this.button(8, 916, 128, 36, "保存到游戏", () => this.save(), { fill: 0x365d39 });
    this.button(146, 916, 128, 36, "导出配置", () => this.exportConfig(), { fill: 0x4c4033 });
    this.button(8, 960, 266, 36, "全局视图", () => this.focusWholeMap(), { fill: 0x3b3027 });
    this.button(8, 1005, 266, 44, "返回开发者控制台", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), { fill: 0x49351f });

    MAP_DEFINITIONS.forEach((map, index) => {
      const active = map.id === this.activeMapId;
      this.button(300 + index * 100, 1028, 92, 42, map.name, () => this.loadMap(map.id), {
        fill: active ? 0x88651e : 0x26302d, stroke: active ? 0xf0c34f : 0x50615b, size: 16,
      });
    });
    this.buildMiniMap();
  }

  categoryName() { return CATEGORIES.find(([key]) => key === this.selectedCategory)?.[1] || "对象"; }

  selectCategory(category) {
    this.selectedCategory = category; this.selectedObjectId = null; this.buildUi();
    if (["herb", "mineral", "trigger"].includes(category)) this.notice(`${this.categoryName()}模板入口已预留，等待对应内容编辑器。`, "#ffd08a");
  }

  templatesForCategory() {
    if (this.selectedCategory === "monster") return this.monsters;
    if (this.selectedCategory === "npc") return this.npcs;
    if (this.selectedCategory === "building") return this.buildings;
    if (this.selectedCategory === "portal") return [{ id: "portal-default", name: "传送点" }];
    return [];
  }

  buildTemplateGrid() {
    const templates = this.templatesForCategory().slice(0, 12);
    templates.forEach((template, index) => {
      const x = 8 + (index % 3) * 91;
      const y = 166 + Math.floor(index / 3) * 82;
      const active = this.selectedTemplateIds[this.selectedCategory] === template.id;
      this.button(x, y, 83, 72, template.name, () => {
        this.selectedTemplateIds[this.selectedCategory] = template.id; this.selectedObjectId = null; this.buildUi();
      }, { fill: active ? 0x4f3c25 : 0x292321, stroke: active ? 0xe4bb57 : 0x514942, size: 12 });
    });
    if (!templates.length) this.text(18, 190, "当前分类暂无模板", 14, "#988d82");
  }

  buildStats() {
    const counts = Object.keys(MAP_OBJECT_TYPES).map((type) => `${MAP_OBJECT_TYPES[type].name}${this.mapObjects.filter((item) => item.type === type).length}`);
    this.text(8, 758, counts.join("｜"), 12, "#aaa194");
    const selected = this.mapObjects.find((object) => object.id === this.selectedObjectId);
    this.text(8, 784, selected ? `已选：${selected.name} (${selected.x}, ${selected.y})` : `对象 ${this.mapObjects.length}｜未选择对象`, 13, selected ? "#f3cf74" : "#aaa194");
  }

  buildMiniMap() {
    const x = 1728; const y = 900; const width = 330; const height = 180;
    this.pin(this.add.rectangle(x, y, width, height, 0x102322, 0.92).setStrokeStyle(2, 0xb38942), 100);
    this.text(x, y - 72, `全局视图 · ${this.mapConfig.name}`, 14, "#e5c46f").setOrigin(0.5);
    const innerW = 280; const innerH = 120;
    this.pin(this.add.rectangle(x, y + 12, innerW, innerH, this.mapConfig.backgroundColor, 0.8).setStrokeStyle(1, 0x718b79), 101);
    const visibleW = this.mapCamera.width / this.mapCamera.zoom;
    const visibleH = this.mapCamera.height / this.mapCamera.zoom;
    const viewW = Math.max(10, innerW * Math.min(1, visibleW / this.mapConfig.worldWidth));
    const viewH = Math.max(10, innerH * Math.min(1, visibleH / this.mapConfig.worldHeight));
    const rangeX = Math.max(1, this.mapConfig.worldWidth - visibleW);
    const rangeY = Math.max(1, this.mapConfig.worldHeight - visibleH);
    const viewX = x - innerW / 2 + viewW / 2 + (innerW - viewW) * (this.mapCamera.scrollX / rangeX);
    const viewY = y + 12 - innerH / 2 + viewH / 2 + (innerH - viewH) * (this.mapCamera.scrollY / rangeY);
    this.pin(this.add.rectangle(viewX, viewY, viewW, viewH, 0xffffff, 0.04).setStrokeStyle(2, 0xffd64e), 103);
    this.button(1572, 995, 42, 32, "−", () => this.setZoom(this.mapCamera.zoom - 0.08), { fill: 0x26302d, size: 18 });
    this.text(1660, 1011, `${Math.round(this.mapCamera.zoom * 100)}%`, 14, "#e7d39c").setOrigin(0.5);
    this.button(1706, 995, 42, 32, "+", () => this.setZoom(this.mapCamera.zoom + 0.08), { fill: 0x26302d, size: 18 });
  }

  pushHistory() {
    const history = this.historyByMap.get(this.activeMapId) || [];
    history.push(this.clone(this.mapObjects)); if (history.length > 40) history.shift();
    this.historyByMap.set(this.activeMapId, history); this.redoByMap.set(this.activeMapId, []);
  }

  undo() {
    const history = this.historyByMap.get(this.activeMapId) || [];
    if (!history.length) return this.notice("没有可撤销的操作。", "#d7c8a8");
    const redo = this.redoByMap.get(this.activeMapId) || [];
    redo.push(this.clone(this.mapObjects)); this.redoByMap.set(this.activeMapId, redo);
    this.mapObjects = history.pop(); this.selectedObjectId = null; this.renderMarkers(); this.buildUi();
  }

  redo() {
    const redo = this.redoByMap.get(this.activeMapId) || [];
    if (!redo.length) return this.notice("没有可重做的操作。", "#d7c8a8");
    const history = this.historyByMap.get(this.activeMapId) || [];
    history.push(this.clone(this.mapObjects)); this.historyByMap.set(this.activeMapId, history);
    this.mapObjects = redo.pop(); this.selectedObjectId = null; this.renderMarkers(); this.buildUi();
  }

  pointerDown(pointer) {
    // 左侧素材库和底部地图标签属于固定 UI，不能穿透到地图放置对象。
    if (pointer.x < 282 || pointer.y >= 1018) return;
    if (pointer.button === 1 || pointer.middleButtonDown()) {
      this.panning = true;
      this.panStart = { x: pointer.x, y: pointer.y, scrollX: this.mapCamera.scrollX, scrollY: this.mapCamera.scrollY };
      return;
    }
    if (pointer.x > 1545 && pointer.y > 790) return;
    const world = this.mapCamera.getWorldPoint(pointer.x, pointer.y);
    this.mapClick(world.x, world.y);
  }

  mapClick(x, y) {
    const nearest = this.nearestObject(x, y);
    if (nearest >= 0 && Phaser.Math.Distance.Between(x, y, this.mapObjects[nearest].x, this.mapObjects[nearest].y) < 55) {
      this.selectedObjectId = this.mapObjects[nearest].id; this.renderMarkers(); this.buildUi(); return;
    }
    if (["herb", "mineral", "trigger"].includes(this.selectedCategory)) return;
    const type = this.selectedCategory;
    if (!MAP_OBJECT_TYPES[type]) return;
    let name = MAP_OBJECT_TYPES[type].name; let extra = {};
    if (type === "monster") {
      const template = this.monsters.find((item) => item.id === this.selectedTemplateIds.monster);
      if (!template) return this.notice("请先选择怪物模板。", "#ffd08a");
      name = template.name; extra = { monsterTemplateId: template.id };
    } else if (type === "npc") {
      const template = this.npcs.find((item) => item.id === this.selectedTemplateIds.npc);
      if (!template) return this.notice("请先选择 NPC 模板。", "#ffd08a");
      name = template.name; extra = { npcTemplateId: template.id };
    } else if (type === "building") {
      const template = this.buildings.find((item) => item.id === this.selectedTemplateIds.building);
      if (!template) return this.notice("请先选择建筑模板。", "#ffd08a");
      name = template.name; extra = { buildingTemplateId: template.id };
    }
    this.pushHistory();
    const object = createMapObject(type, x, y, name, extra);
    this.mapObjects.push(object); this.selectedObjectId = object.id; this.renderMarkers(); this.buildUi();
  }

  nearestObject(x, y) {
    let index = -1; let distance = 70;
    this.mapObjects.forEach((object, objectIndex) => {
      const next = Phaser.Math.Distance.Between(x, y, object.x, object.y);
      if (next < distance) { distance = next; index = objectIndex; }
    });
    return index;
  }

  renderMarkers() {
    for (const marker of this.markers.values()) marker.destroy(); this.markers.clear();
    this.mapObjects.forEach((object) => this.renderMarker(object));
  }

  renderMarker(object) {
    const info = MAP_OBJECT_TYPES[object.type] || MAP_OBJECT_TYPES.npc;
    const marker = this.add.container(object.x, object.y).setDepth(8);
    const selected = object.id === this.selectedObjectId;
    const ring = this.add.circle(0, -5, 48, 0xffdc55, selected ? 0.16 : 0).setStrokeStyle(selected ? 3 : 0, 0xffd54d);
    const shadow = this.add.ellipse(0, 5, 48, 13, 0x17221e, 0.35);
    let preview;
    if (object.type === "npc") preview = this.add.image(0, 0, "editor-npc-preview", 0).setOrigin(0.5, 0.86).setScale(0.3);
    else if (object.type === "monster") {
      preview = this.add.image(0, 0, "editor-monster-preview").setOrigin(0.5, 0.87).setScale(0.32).setTint(0xe9b4b4);
      const template = this.monsters.find((item) => item.id === object.monsterTemplateId);
      const appearance = resolveMonsterAppearance(template);
      if (appearance.staticImageData) this.loadMarkerImage(preview, appearance.staticImageData, getMonsterAppearanceTextureKey(template, "map-editor-monster"));
    } else preview = this.add.circle(0, -4, 22, info.color, 0.92).setStrokeStyle(3, 0xfff3c4);
    const label = addText(this, 0, -53, object.name, 15, "#fff7dc", { origin: 0.5 });
    marker.add([ring, shadow, preview, label]); this.markers.set(object.id, marker); this.uiCamera.ignore(marker);
  }

  loadMarkerImage(preview, data, key) {
    const apply = () => {
      if (!preview.active || !this.textures.exists(key)) return;
      const source = this.textures.get(key).getSourceImage();
      const scale = Math.min(86 / source.width, 86 / source.height);
      preview.setTexture(key).clearTint().setDisplaySize(source.width * scale, source.height * scale);
    };
    if (this.textures.exists(key)) return apply();
    const image = new Image();
    image.onload = () => { if (!this.textures.exists(key)) this.textures.addImage(key, image); apply(); };
    image.src = data;
  }

  deleteSelected() {
    const index = this.mapObjects.findIndex((object) => object.id === this.selectedObjectId);
    if (index < 0) return this.notice("请先点击地图中的对象。", "#ffd08a");
    this.pushHistory(); this.mapObjects.splice(index, 1); this.selectedObjectId = null; this.renderMarkers(); this.buildUi();
  }

  cancelSelection() { this.selectedObjectId = null; this.renderMarkers(); this.buildUi(); }

  save() {
    this.mapDrafts.set(this.activeMapId, this.clone(this.mapObjects));
    if (saveMapObjects(this.activeMapId, this.mapObjects)) this.notice(`已保存「${this.mapConfig.name}」的 ${this.mapObjects.length} 个对象。`, "#d9f2c9");
    else this.notice("保存失败：浏览器本地空间不足。", "#ff9c8b");
  }

  exportConfig() {
    const json = JSON.stringify({ mapId: this.activeMapId, mapName: this.mapConfig.name, objects: this.mapObjects }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${this.mapConfig.name}-地图配置.json`; link.click();
    URL.revokeObjectURL(url); this.notice("地图配置已导出。", "#d9f2c9");
  }

  notice(message, color) {
    this.noticeText?.destroy();
    this.noticeText = this.pin(addText(this, 960, 42, message, 20, color, { origin: 0.5, backgroundColor: "#1b1916", padding: { x: 16, y: 8 } }), 150);
    this.time.delayedCall(2600, () => this.noticeText?.destroy());
  }

  pointerMove(pointer) {
    if (!this.panning || !pointer.middleButtonDown()) return;
    this.mapCamera.scrollX = this.panStart.scrollX - (pointer.x - this.panStart.x) / this.mapCamera.zoom;
    this.mapCamera.scrollY = this.panStart.scrollY - (pointer.y - this.panStart.y) / this.mapCamera.zoom;
    this.clampCamera();
  }

  zoomAt(pointer, deltaY) { if (pointer.x >= 282) this.setZoom(this.mapCamera.zoom + (deltaY > 0 ? -0.055 : 0.055)); }
  setZoom(value) { this.mapCamera.setZoom(Phaser.Math.Clamp(value, this.fitZoom(), 1.3)); this.clampCamera(); this.refreshTiles(); this.buildUi(); }
  focusWholeMap() { this.mapCamera.setZoom(this.fitZoom()).centerOn(this.mapConfig.worldWidth / 2, this.mapConfig.worldHeight / 2); this.clampCamera(); this.refreshTiles(); this.buildUi(); }

  clampCamera() {
    const maxX = Math.max(0, this.mapConfig.worldWidth - this.mapCamera.width / this.mapCamera.zoom);
    const maxY = Math.max(0, this.mapConfig.worldHeight - this.mapCamera.height / this.mapCamera.zoom);
    this.mapCamera.scrollX = Phaser.Math.Clamp(this.mapCamera.scrollX, 0, maxX);
    this.mapCamera.scrollY = Phaser.Math.Clamp(this.mapCamera.scrollY, 0, maxY);
  }

  update(_time, delta) {
    const speed = 650 * delta / 1000 / this.mapCamera.zoom;
    let dx = 0; let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += speed;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += speed;
    if (dx || dy) { this.mapCamera.scrollX += dx; this.mapCamera.scrollY += dy; this.clampCamera(); }
    this.streamElapsed += delta;
    if (this.streamElapsed >= 300) { this.streamElapsed = 0; this.refreshTiles(); }
  }
}

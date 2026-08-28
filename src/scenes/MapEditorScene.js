import { createMapObject, getMapObjects, MAP_OBJECT_TYPES, saveMapObjects } from "../core/MapContentStore.js";
import { MAP_DEFINITIONS, getMapDefinition } from "../core/MapCatalog.js";
import { getMonsterTemplates } from "../core/MonsterStore.js";
import { getBuildingTemplates, getNpcTemplates } from "../core/WorldTemplateStore.js";
import { getMonsterAppearanceTextureKey, resolveMonsterAppearance } from "../core/MonsterAppearance.js";
import { getBuildingAppearanceTextureKey, resolveBuildingAppearance } from "../core/BuildingAppearance.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addText } from "../utils/UiHelpers.js";

const CATEGORIES = [
  ["building", "建筑"], ["npc", "NPC"], ["monster", "怪物"], ["herb", "灵草"],
  ["mineral", "矿石"], ["portal", "传送"], ["trigger", "触发"],
];

const SIDEBAR_WIDTH = 348;
const MAP_VIEW_WIDTH = 1920 - SIDEBAR_WIDTH;
const TEMPLATE_CARD_HEIGHT = 88;
const VISIBLE_TEMPLATE_COUNT = 5;

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
      monster: null,
      npc: null,
      building: null,
      portal: null,
    };
    this.selectedCategory = "monster";
    this.templateListStart = 0;
    this.selectedObjectId = null;
    this.streamElapsed = 0;

    this.mapCamera = this.cameras.main.setViewport(SIDEBAR_WIDTH, 0, MAP_VIEW_WIDTH, 1080).setBackgroundColor("#223a38");
    this.uiCamera = this.cameras.add(0, 0, 1920, 1080).setScroll(0, 0).setZoom(1);
    this.loadMap(this.activeMapId, false);
    this.buildUi();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,DELETE,ESC");
    this.input.on("pointerdown", (pointer) => this.pointerDown(pointer));
    this.input.on("pointermove", (pointer) => this.pointerMove(pointer));
    this.input.on("pointerup", () => this.endPointerAction());
    this.input.on("wheel", (pointer, _objects, _dx, deltaY) => this.handleWheel(pointer, deltaY));
    this.keys.DELETE.on("down", () => this.deleteSelected());
    this.keys.ESC.on("down", () => this.cancelSelection());
    this.input.keyboard.on("keydown-Z", (event) => { if (event.ctrlKey) this.undo(); });
    this.input.keyboard.on("keydown-Y", (event) => { if (event.ctrlKey) this.redo(); });
  }

  clone(value) { return JSON.parse(JSON.stringify(value)); }
  clearPendingTemplateSelection() {
    Object.keys(this.selectedTemplateIds || {}).forEach((type) => { this.selectedTemplateIds[type] = null; });
  }
  tileKey(mapId, x, y) { return `editor-${mapId}-tile-x${x}-y${y}`; }
  tilePath(x, y) { return `./public/assets/images/maps/qingyun-mountain/tiles/tile-x${y}-y${x}.webp`; }
  fitZoom() { return Math.min(MAP_VIEW_WIDTH / this.mapConfig.worldWidth, 1080 / this.mapConfig.worldHeight); }
  coverZoom() { return Math.max(MAP_VIEW_WIDTH / this.mapConfig.worldWidth, 1080 / this.mapConfig.worldHeight); }

  /**
   * 编辑器世界对象的显示层级。
   *
   * 建筑图片通常覆盖面积很大，若所有对象只按 Y 坐标排序，建筑图片的非透明像素就会把
   * NPC 遮住。这里把 NPC 放入最高的世界对象层级；其他对象仍保留脚底 Y 坐标带来的
   * 细微排序，因此同类型对象前后移动时不会失去自然的遮挡关系。
   */
  markerDepth(object) {
    const depthByType = { building: 6, npc: 12 };
    const baseDepth = depthByType[object?.type] ?? 8;
    return baseDepth + (Number(object?.y) || 0) / 100000;
  }

  loadMap(mapId, remember = true) {
    if (remember && this.mapObjects) this.mapDrafts.set(this.activeMapId, this.clone(this.mapObjects));
    if (remember) this.clearPendingTemplateSelection();
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

  text(x, y, value, size = 14, color = "#eee1c9", style = {}) {
    return this.pin(addText(this, x, y, value, size, color, { strokeThickness: 1, ...style }), 102);
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
    this.pin(this.add.rectangle(SIDEBAR_WIDTH / 2, 540, SIDEBAR_WIDTH, 1080, 0x20150f, 0.98).setStrokeStyle(2, 0x6f4a29), 100);
    this.text(SIDEBAR_WIDTH / 2, 27, "地图编辑器", 25, "#f1c853").setOrigin(0.5);
    this.text(SIDEBAR_WIDTH / 2, 56, `${this.mapConfig.name} · 创造模式`, 13, "#bda681").setOrigin(0.5);
    CATEGORIES.forEach(([key, label], index) => {
      const active = key === this.selectedCategory;
      const secondRow = index >= 4;
      const x = 14 + (secondRow ? index - 4 : index) * 82;
      const y = secondRow ? 121 : 82;
      this.button(x, y, 74, 31, label, () => this.selectCategory(key), {
        fill: active ? 0x8f6829 : 0x39302a,
        stroke: active ? 0xf0c85c : 0x655246,
        color: active ? "#fff0c7" : "#d8c7ad",
        size: 14,
      });
    });
    this.text(14, 166, `选择${this.categoryName()}模板：`, 15, "#d9c6a9");
    this.buildTemplateList();
    this.buildStats();
    this.button(14, 786, 154, 34, "↶ 撤销", () => this.undo(), { fill: 0x28313a });
    this.button(180, 786, 154, 34, "↷ 重做", () => this.redo(), { fill: 0x28313a });
    this.button(14, 830, 154, 34, "删除", () => this.deleteSelected(), { fill: 0x48282a });
    this.button(180, 830, 154, 34, "取消选择", () => this.cancelSelection(), { fill: 0x332d2b });
    this.button(14, 874, 154, 36, "保存到游戏", () => this.save(), { fill: 0x365d39 });
    this.button(180, 874, 154, 36, "导出配置", () => this.exportConfig(), { fill: 0x4c4033 });
    this.button(14, 920, 320, 36, "全局视图", () => this.focusWholeMap(), { fill: 0x3b3027 });
    this.button(14, 966, 320, 42, "返回开发者控制台", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), { fill: 0x49351f });

    MAP_DEFINITIONS.forEach((map, index) => {
      const active = map.id === this.activeMapId;
      this.button(SIDEBAR_WIDTH + 18 + index * 100, 1028, 92, 42, map.name, () => this.loadMap(map.id), {
        fill: active ? 0x88651e : 0x26302d, stroke: active ? 0xf0c34f : 0x50615b, size: 16,
      });
    });
    this.buildMiniMap();
  }

  categoryName() { return CATEGORIES.find(([key]) => key === this.selectedCategory)?.[1] || "对象"; }

  selectCategory(category) {
    this.clearPendingTemplateSelection();
    this.selectedCategory = category; this.selectedObjectId = null; this.templateListStart = 0; this.buildUi();
    if (["herb", "mineral", "trigger"].includes(category)) this.notice(`${this.categoryName()}模板入口已预留，等待对应内容编辑器。`, "#ffd08a");
  }

  templatesForCategory() {
    if (this.selectedCategory === "monster") return this.monsters;
    if (this.selectedCategory === "npc") return this.npcs;
    if (this.selectedCategory === "building") return this.buildings;
    if (this.selectedCategory === "portal") return [{ id: "portal-default", name: "传送点" }];
    return [];
  }

  buildTemplateList() {
    const templates = this.templatesForCategory();
    const maxStart = Math.max(0, templates.length - VISIBLE_TEMPLATE_COUNT);
    this.templateListStart = Phaser.Math.Clamp(this.templateListStart || 0, 0, maxStart);
    templates.slice(this.templateListStart, this.templateListStart + VISIBLE_TEMPLATE_COUNT)
      .forEach((template, index) => this.drawTemplateCard(template, index));
    if (!templates.length) this.text(22, 216, "当前分类暂无模板", 15, "#988d82");
    if (templates.length > VISIBLE_TEMPLATE_COUNT) {
      const up = this.text(320, 174, "▲", 13, "#d2b379", { strokeThickness: 0 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const down = this.text(320, 688, "▼", 13, "#d2b379", { strokeThickness: 0 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      up.on("pointerdown", () => this.scrollTemplateList(-1));
      down.on("pointerdown", () => this.scrollTemplateList(1));
    }
  }

  drawTemplateCard(template, index) {
    const y = 190 + index * 98;
    const active = this.selectedTemplateIds[this.selectedCategory] === template.id;
    const card = this.pin(this.add.rectangle(174, y + TEMPLATE_CARD_HEIGHT / 2, 320, TEMPLATE_CARD_HEIGHT, active ? 0x4a311b : 0x292827)
      .setStrokeStyle(2, active ? 0xd8ad58 : 0x3f3c38).setInteractive({ useHandCursor: true }), 101);
    this.pin(this.add.rectangle(62, y + TEMPLATE_CARD_HEIGHT / 2, 72, 72, 0x1d1d1c)
      .setStrokeStyle(2, active ? 0xd8ad58 : 0x65503a), 102);
    this.drawTemplatePreview(template, 62, y + TEMPLATE_CARD_HEIGHT / 2, 66);
    this.text(112, y + 18, String(template.name || "未命名模板").slice(0, 13), 19, "#f2ce4a", { strokeThickness: 1 });
    this.text(112, y + 51, this.templateSummary(template), 13, active ? "#7dd9af" : "#bdb2a5", { strokeThickness: 0 });
    card.on("pointerdown", () => {
      // 模板只进入一次性放置状态；再次点击高亮卡片可以主动取消。
      this.selectedTemplateIds[this.selectedCategory] = active ? null : template.id;
      this.selectedObjectId = null;
      this.buildUi();
    });
  }

  templateSummary(template) {
    if (this.selectedCategory === "monster") return `${template.grade || "普通"} · ${template.realm || "未知境界"} · ${template.element || "无"}`;
    if (this.selectedCategory === "npc") return `${template.profile?.realm || "未知境界"} · ${template.profile?.identity || "NPC"}`;
    if (this.selectedCategory === "building") return `${template.type || "建筑"} · ${template.display?.width || 256}×${template.display?.height || 256}`;
    if (this.selectedCategory === "portal") return "地图传送点";
    return this.categoryName();
  }

  templateImageData(template) {
    if (this.selectedCategory === "monster") return resolveMonsterAppearance(template).staticImageData;
    if (this.selectedCategory === "npc") return template.portraitData || template.imageData || template.avatarData || "";
    if (this.selectedCategory === "building") return template.imageData || "";
    return "";
  }

  templateTextureKey(template, data, category = this.selectedCategory) {
    if (category === "monster") return getMonsterAppearanceTextureKey(template, "map-editor-card-monster");
    if (category === "building") return getBuildingAppearanceTextureKey(template, "map-editor-card-building");
    let hash = 2166136261;
    const step = Math.max(1, Math.floor(data.length / 128));
    for (let index = 0; index < data.length; index += step) {
      hash ^= data.charCodeAt(index); hash = Math.imul(hash, 16777619);
    }
    return `map-editor-card-${category}-${template.id}-${(hash >>> 0).toString(36)}`;
  }

  drawTemplatePreview(template, x, y, maxSize) {
    const data = this.templateImageData(template);
    let fallback = null; let frame;
    if (this.selectedCategory === "monster") fallback = "editor-monster-preview";
    if (this.selectedCategory === "npc") { fallback = "editor-npc-preview"; frame = 0; }
    const key = data ? this.templateTextureKey(template, data) : fallback;
    if (!key || (!data && !this.textures.exists(key))) {
      this.text(x, y, this.categoryName()[0], 25, "#d8c49a", { strokeThickness: 0 }).setOrigin(0.5);
      return;
    }
    const preview = this.pin(this.add.image(x, y, this.textures.exists(key) ? key : fallback, frame), 103);
    const fit = () => {
      if (!preview.active) return;
      const source = preview.frame;
      const scale = Math.min(maxSize / source.width, maxSize / source.height);
      preview.setDisplaySize(source.width * scale, source.height * scale);
    };
    fit();
    if (!data || this.textures.exists(key)) return;
    const image = new Image();
    image.onload = () => {
      if (!this.textures.exists(key)) this.textures.addImage(key, image);
      if (!preview.active) return;
      preview.setTexture(key); fit();
    };
    image.src = data;
  }

  scrollTemplateList(direction) {
    const maxStart = Math.max(0, this.templatesForCategory().length - VISIBLE_TEMPLATE_COUNT);
    const next = Phaser.Math.Clamp((this.templateListStart || 0) + direction, 0, maxStart);
    if (next === this.templateListStart) return;
    this.templateListStart = next; this.buildUi();
  }

  buildStats() {
    const counts = Object.keys(MAP_OBJECT_TYPES).map((type) => `${MAP_OBJECT_TYPES[type].name}${this.mapObjects.filter((item) => item.type === type).length}`);
    this.text(14, 704, counts.join("｜"), 12, "#aaa194", { wordWrap: { width: 320 } });
    const selected = this.mapObjects.find((object) => object.id === this.selectedObjectId);
    const templateId = this.selectedTemplateIds[this.selectedCategory];
    const template = this.templatesForCategory().find((item) => item.id === templateId);
    const status = selected
      ? `已选：${String(selected.name).slice(0, 12)} (${selected.x}, ${selected.y})`
      : (template ? `待放置：${String(template.name).slice(0, 15)}` : "未选择模板，点击上方卡片后再放置");
    this.text(14, 728, status, 13, selected || template ? "#f3cf74" : "#d7a777", { wordWrap: { width: 320 } });
    if (selected) {
      this.button(14, 748, 96, 30, "－ 缩小", () => this.scaleSelected(-0.25), { fill: 0x30383b, size: 13 });
      this.button(116, 748, 116, 30, `${Math.round((selected.scale || 1) * 100)}%`, () => this.resetSelectedScale(), { fill: 0x4a3b29, size: 13 });
      this.button(238, 748, 96, 30, "＋ 放大", () => this.scaleSelected(0.25), { fill: 0x30383b, size: 13 });
    } else {
      this.text(14, 758, "选中地图对象后可单独缩放", 12, "#8f877d");
    }
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
    this.pushHistorySnapshot(this.mapObjects);
  }

  pushHistorySnapshot(snapshot) {
    const history = this.historyByMap.get(this.activeMapId) || [];
    history.push(this.clone(snapshot)); if (history.length > 40) history.shift();
    this.historyByMap.set(this.activeMapId, history); this.redoByMap.set(this.activeMapId, []);
  }

  undo() {
    const history = this.historyByMap.get(this.activeMapId) || [];
    if (!history.length) return this.notice("没有可撤销的操作。", "#d7c8a8");
    const redo = this.redoByMap.get(this.activeMapId) || [];
    redo.push(this.clone(this.mapObjects)); this.redoByMap.set(this.activeMapId, redo);
    this.mapObjects = history.pop(); this.selectedObjectId = null; this.clearPendingTemplateSelection(); this.renderMarkers(); this.buildUi();
  }

  redo() {
    const redo = this.redoByMap.get(this.activeMapId) || [];
    if (!redo.length) return this.notice("没有可重做的操作。", "#d7c8a8");
    const history = this.historyByMap.get(this.activeMapId) || [];
    history.push(this.clone(this.mapObjects)); this.historyByMap.set(this.activeMapId, history);
    this.mapObjects = redo.pop(); this.selectedObjectId = null; this.clearPendingTemplateSelection(); this.renderMarkers(); this.buildUi();
  }

  pointerDown(pointer) {
    // 左侧素材库和底部地图标签属于固定 UI，不能穿透到地图放置对象。
    if (pointer.x < SIDEBAR_WIDTH || pointer.y >= 1018) return;
    if (pointer.button === 1 || pointer.middleButtonDown()) {
      this.panning = true;
      this.panStart = { x: pointer.x, y: pointer.y, scrollX: this.mapCamera.scrollX, scrollY: this.mapCamera.scrollY };
      return;
    }
    if (pointer.x > 1545 && pointer.y > 790) return;
    const world = this.mapCamera.getWorldPoint(pointer.x, pointer.y);
    const objectIndex = this.objectAt(world.x, world.y);
    if (objectIndex >= 0) {
      const object = this.mapObjects[objectIndex];
      // 一旦开始选择或拖动已有对象，就立即退出模板放置状态，防止松手后误点空白又复制一份。
      this.clearPendingTemplateSelection();
      this.selectedObjectId = object.id;
      this.draggingObjectId = object.id;
      this.dragStartSnapshot = this.clone(this.mapObjects);
      this.dragStartPosition = { x: object.x, y: object.y };
      this.dragOffset = { x: object.x - world.x, y: object.y - world.y };
      this.dragHasMoved = false;
      this.renderMarkers(); this.buildUi();
      return;
    }
    this.mapClick(world.x, world.y);
  }

  mapClick(x, y) {
    if (["herb", "mineral", "trigger"].includes(this.selectedCategory)) return;
    const type = this.selectedCategory;
    if (!MAP_OBJECT_TYPES[type]) return;
    const templateId = this.selectedTemplateIds[type];
    const template = this.templatesForCategory().find((item) => item.id === templateId);
    if (!template) {
      // 已放置对象保持选中时，点击地图空白只负责取消选择，不会再次创建对象。
      if (this.selectedObjectId) return this.cancelSelection();
      return this.notice(`请先选择${this.categoryName()}模板。`, "#ffd08a");
    }
    let name = MAP_OBJECT_TYPES[type].name; let extra = {};
    if (type === "monster") {
      name = template.name; extra = { monsterTemplateId: template.id };
    } else if (type === "npc") {
      name = template.name; extra = { npcTemplateId: template.id };
    } else if (type === "building") {
      name = template.name; extra = { buildingTemplateId: template.id };
    } else if (type === "portal") {
      name = template.name; extra = { portalTemplateId: template.id };
    }
    this.pushHistory();
    const object = createMapObject(type, x, y, name, extra);
    this.mapObjects.push(object);
    this.selectedObjectId = object.id;
    this.clearPendingTemplateSelection();
    this.renderMarkers(); this.buildUi();
    this.notice(`已放置「${object.name}」，并自动退出放置模式。`, "#dff0c7");
  }

  objectAt(x, y) {
    // 命中顺序必须与实际显示层级一致：NPC 显示在建筑上方时，点击重叠区域也应先选中 NPC。
    // 深度相同时仍优先选择后放置的对象，保持原有编辑习惯。
    const objectsFrontToBack = this.mapObjects
      .map((object, index) => ({ object, index }))
      .sort((left, right) => this.markerDepth(right.object) - this.markerDepth(left.object) || right.index - left.index);
    for (const { object, index } of objectsFrontToBack) {
      const instanceScale = Number(object.scale) || 1;
      if (object.type === "building") {
        const template = this.buildings.find((item) => item.id === object.buildingTemplateId);
        const appearance = resolveBuildingAppearance(template);
        const width = appearance.width * instanceScale;
        const height = appearance.height * instanceScale;
        const left = object.x - width / 2;
        const top = appearance.anchor === "center" ? object.y - height / 2 : object.y - height;
        if (x >= left && x <= left + width && y >= top && y <= top + height) return index;
      } else if (Phaser.Math.Distance.Between(x, y, object.x, object.y) < Math.max(28, 70 * instanceScale)) return index;
    }
    return -1;
  }

  renderMarkers() {
    for (const marker of this.markers.values()) marker.destroy(); this.markers.clear();
    this.mapObjects.forEach((object) => this.renderMarker(object));
  }

  renderMarker(object) {
    const info = MAP_OBJECT_TYPES[object.type] || MAP_OBJECT_TYPES.npc;
    const instanceScale = Number(object.scale) || 1;
    // 整个容器一起提层，确保 NPC 立绘、名称和选中标记都不会被建筑图片覆盖。
    const marker = this.add.container(object.x, object.y).setDepth(this.markerDepth(object));
    const selected = object.id === this.selectedObjectId;
    const ring = this.add.circle(0, -5 * instanceScale, 48, 0xffdc55, selected ? 0.16 : 0).setStrokeStyle(selected ? 3 : 0, 0xffd54d).setScale(instanceScale);
    const shadow = this.add.ellipse(0, 5 * instanceScale, 48, 13, 0x17221e, 0.35).setScale(instanceScale);
    let preview; let labelY = -53 * instanceScale; let selectionBox = null;
    if (object.type === "npc") preview = this.add.image(0, 0, "editor-npc-preview", 0).setOrigin(0.5, 0.86).setScale(0.3 * instanceScale);
    else if (object.type === "monster") {
      preview = this.add.image(0, 0, "editor-monster-preview").setOrigin(0.5, 0.87).setScale(0.32 * instanceScale).setTint(0xe9b4b4);
      const template = this.monsters.find((item) => item.id === object.monsterTemplateId);
      const appearance = resolveMonsterAppearance(template);
      if (appearance.staticImageData) this.loadMarkerImage(preview, appearance.staticImageData, getMonsterAppearanceTextureKey(template, "map-editor-monster"), {
        width: 86 * instanceScale, height: 86 * instanceScale,
      });
    } else if (object.type === "building") {
      const template = this.buildings.find((item) => item.id === object.buildingTemplateId);
      const appearance = resolveBuildingAppearance(template);
      const width = appearance.width * instanceScale;
      const height = appearance.height * instanceScale;
      const originY = appearance.anchor === "center" ? 0.5 : 1;
      const boxY = appearance.anchor === "center" ? 0 : -height / 2;
      ring.setVisible(false); shadow.setVisible(false);
      preview = this.add.image(0, 0, "__WHITE").setOrigin(0.5, originY).setTint(info.color)
        .setDisplaySize(appearance.imageData ? width : 58 * instanceScale, appearance.imageData ? height : 58 * instanceScale);
      selectionBox = this.add.rectangle(0, boxY, width + 14, height + 14, 0xffd64e, selected ? 0.05 : 0)
        .setStrokeStyle(selected ? 4 : 0, 0xffd64e);
      labelY = appearance.anchor === "center" ? -height / 2 - 25 : -height - 25;
      if (appearance.imageData) {
        this.loadMarkerImage(preview, appearance.imageData, getBuildingAppearanceTextureKey(template, "map-editor-building"), {
          width, height, exact: true,
        });
      }
    } else preview = this.add.circle(0, -4 * instanceScale, 22, info.color, 0.92).setStrokeStyle(3, 0xfff3c4).setScale(instanceScale);
    const label = addText(this, 0, labelY, object.name, 15, "#fff7dc", { origin: 0.5 });
    marker.add([ring, shadow, preview, selectionBox, label].filter(Boolean)); this.markers.set(object.id, marker); this.uiCamera.ignore(marker);
  }

  loadMarkerImage(preview, data, key, options = {}) {
    const apply = () => {
      if (!preview.active || !this.textures.exists(key)) return;
      const source = this.textures.get(key).getSourceImage();
      const width = options.width || 86; const height = options.height || 86;
      preview.setTexture(key).clearTint().setAlpha(1);
      if (options.exact) preview.setDisplaySize(width, height);
      else {
        const scale = Math.min(width / source.width, height / source.height);
        preview.setDisplaySize(source.width * scale, source.height * scale);
      }
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

  scaleSelected(delta) {
    const selected = this.mapObjects.find((object) => object.id === this.selectedObjectId);
    if (!selected) return this.notice("请先点击地图中的对象。", "#ffd08a");
    const current = Number(selected.scale) || 1;
    const next = Math.round(Phaser.Math.Clamp(current + delta, 0.25, 4) * 100) / 100;
    if (next === current) return this.notice(next >= 4 ? "已达到最大 400%。" : "已达到最小 25%。", "#ffd08a");
    this.pushHistory();
    selected.scale = next;
    this.mapDrafts.set(this.activeMapId, this.clone(this.mapObjects));
    this.renderMarkers(); this.buildUi();
    this.notice(`「${selected.name}」已缩放为 ${Math.round(next * 100)}%，保存后在游戏中生效。`, "#dff0c7");
  }

  resetSelectedScale() {
    const selected = this.mapObjects.find((object) => object.id === this.selectedObjectId);
    if (!selected) return this.notice("请先点击地图中的对象。", "#ffd08a");
    if ((Number(selected.scale) || 1) === 1) return;
    this.pushHistory();
    selected.scale = 1;
    this.mapDrafts.set(this.activeMapId, this.clone(this.mapObjects));
    this.renderMarkers(); this.buildUi();
    this.notice(`「${selected.name}」已恢复为 100%，保存后在游戏中生效。`, "#dff0c7");
  }

  cancelSelection() { this.selectedObjectId = null; this.clearPendingTemplateSelection(); this.renderMarkers(); this.buildUi(); }

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
    if (this.draggingObjectId && pointer.leftButtonDown()) {
      const object = this.mapObjects.find((item) => item.id === this.draggingObjectId);
      if (!object) return;
      const world = this.mapCamera.getWorldPoint(pointer.x, pointer.y);
      object.x = Math.round(Phaser.Math.Clamp(world.x + this.dragOffset.x, 0, this.mapConfig.worldWidth));
      object.y = Math.round(Phaser.Math.Clamp(world.y + this.dragOffset.y, 0, this.mapConfig.worldHeight));
      this.dragHasMoved = this.dragHasMoved
        || Phaser.Math.Distance.Between(object.x, object.y, this.dragStartPosition.x, this.dragStartPosition.y) > 3;
      this.markers.get(object.id)?.setPosition(object.x, object.y).setDepth(this.markerDepth(object));
      return;
    }
    if (!this.panning || !pointer.middleButtonDown()) return;
    this.mapCamera.scrollX = this.panStart.scrollX - (pointer.x - this.panStart.x) / this.mapCamera.zoom;
    this.mapCamera.scrollY = this.panStart.scrollY - (pointer.y - this.panStart.y) / this.mapCamera.zoom;
    this.clampCamera();
  }

  endPointerAction() {
    this.panning = false;
    if (!this.draggingObjectId) return;
    if (this.dragHasMoved && this.dragStartSnapshot) {
      this.pushHistorySnapshot(this.dragStartSnapshot);
      this.mapDrafts.set(this.activeMapId, this.clone(this.mapObjects));
      this.buildUi();
      this.notice("位置已调整，点击“保存到游戏”后生效。", "#dff0c7");
    }
    this.draggingObjectId = null;
    this.dragStartSnapshot = null;
    this.dragStartPosition = null;
    this.dragOffset = null;
    this.dragHasMoved = false;
  }

  handleWheel(pointer, deltaY) {
    if (pointer.x < SIDEBAR_WIDTH && pointer.y >= 180 && pointer.y <= 700) {
      this.scrollTemplateList(deltaY > 0 ? 1 : -1); return;
    }
    this.zoomAt(pointer, deltaY);
  }

  zoomAt(pointer, deltaY) { if (pointer.x >= SIDEBAR_WIDTH) this.setZoom(this.mapCamera.zoom + (deltaY > 0 ? -0.055 : 0.055)); }
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

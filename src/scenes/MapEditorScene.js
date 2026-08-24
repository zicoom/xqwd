import { createMapObject, getMapObjects, MAP_OBJECT_TYPES, saveMapObjects } from "../core/MapContentStore.js";
import { getMonsterTemplates } from "../core/MonsterStore.js";
import { getBuildingTemplates, getNpcTemplates } from "../core/WorldTemplateStore.js";
import { SceneKeys } from "../core/SceneKeys.js";
import { rememberEditorRoute } from "../core/EditorRoute.js";
import { addButton, addText } from "../utils/UiHelpers.js";

/**
 * 青云山地图编辑器第一版。
 * 操作：鼠标中键拖动平移；滚轮缩放；选择一种对象后，点击地图即可放置；点击保存后写入本地数据。
 */
export class MapEditorScene extends Phaser.Scene {
  constructor() { super(SceneKeys.MAP_EDITOR); }

  preload() {
    // 初次只加载左上角四个地图块；其他地图块会随编辑镜头移动按需加载。
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      this.load.image(this.getTileKey(x, y), this.getTilePath(x, y));
    }
    // 编辑器预览与游戏内共用同一批素材，放置后能立刻看到大致效果。
    this.load.spritesheet("editor-npc-preview", "./public/assets/images/characters/player-idle-5dir.png", {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.image("editor-monster-preview", "./public/assets/images/battle/swordsman.png");
  }

  create() {
    rememberEditorRoute(SceneKeys.MAP_EDITOR);
    this.mapConfig = { id: "qingyun-mountain", columns: 5, rows: 5, tileSize: 1200, displayScale: 0.6 };
    this.worldSize = { width: 6000, height: 6000 };
    this.mapTileObjects = new Map();
    this.mapTilesLoading = new Set();
    this.markerObjects = new Map();
    this.mapObjects = getMapObjects(this.mapConfig.id);
    this.monsterTemplates = getMonsterTemplates();
    this.npcTemplates = getNpcTemplates();
    this.buildingTemplates = getBuildingTemplates();
    this.selectedMonsterTemplateId = this.monsterTemplates[0]?.id || null;
    this.selectedNpcTemplateId = this.npcTemplates[0]?.id || null;
    this.selectedBuildingTemplateId = this.buildingTemplates[0]?.id || null;
    this.selectedTool = "npc";
    this.mapStreamElapsed = 0;

    // 使用两台相机：左侧地图相机可以缩放/平移；右侧 UI 相机保持固定大小，
    // 因此缩小到全地图时，工具栏不会跟着缩小或飞走。
    this.mapCamera = this.cameras.main;
    this.mapCamera.setOrigin(0, 0);
    this.mapCamera.setViewport(0, 0, 1455, 1080);
    this.mapCamera.setBackgroundColor("#172b29");
    this.mapCamera.setBounds(0, 0, this.worldSize.width, this.worldSize.height);
    this.mapCamera.setZoom(0.18);
    this.uiCamera = this.cameras.add(1455, 0, 465, 1080);
    this.uiCamera.setScroll(1455, 0);
    this.uiCamera.setOrigin(0, 0).setZoom(1);

    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.showMapTile(x, y);
    this.renderAllMarkers();
    this.createEditorPanel();
    this.refreshNearbyMapTiles();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D");
    this.input.on("pointerdown", (pointer) => this.startPointerAction(pointer));
    this.input.on("pointermove", (pointer) => this.updateMiddlePan(pointer));
    this.input.on("pointerup", () => { this.isMiddlePanning = false; });
    this.input.on("wheel", (pointer, _, __, deltaY) => this.zoomMap(pointer, deltaY));
  }

  /** 地图块资源名独立于游戏场景，避免编辑器与游戏同时存在时互相删除纹理。 */
  getTileKey(x, y) { return `editor-qingyun-tile-x${x}-y${y}`; }

  /** 用户素材是“行_列”排序，所以读取图片路径时需要交换世界的 x/y。 */
  getTilePath(x, y) {
    return `./public/assets/images/maps/qingyun-mountain/tiles/tile-x${y}-y${x}.webp`;
  }

  showMapTile(x, y) {
    const key = this.getTileKey(x, y);
    if (this.mapTileObjects.has(key) || !this.textures.exists(key)) return;
    const tile = this.add.image(x * this.mapConfig.tileSize, y * this.mapConfig.tileSize, key)
      .setOrigin(0, 0)
      .setScale(this.mapConfig.displayScale)
      .setDepth(-10);
    this.mapTileObjects.set(key, tile);
    this.uiCamera?.ignore(tile);
  }

  /** 根据实际可见区域加载地图块：缩小到全图时会加载 25 块，放大后只保留附近地图块。 */
  refreshNearbyMapTiles() {
    const camera = this.mapCamera;
    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;
    const minX = Phaser.Math.Clamp(Math.floor(camera.scrollX / this.mapConfig.tileSize) - 1, 0, this.mapConfig.columns - 1);
    const minY = Phaser.Math.Clamp(Math.floor(camera.scrollY / this.mapConfig.tileSize) - 1, 0, this.mapConfig.rows - 1);
    const maxX = Phaser.Math.Clamp(Math.ceil((camera.scrollX + visibleWidth) / this.mapConfig.tileSize), 0, this.mapConfig.columns - 1);
    const maxY = Phaser.Math.Clamp(Math.ceil((camera.scrollY + visibleHeight) / this.mapConfig.tileSize), 0, this.mapConfig.rows - 1);

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) this.requestMapTile(x, y);
    }

    for (const [key, tile] of this.mapTileObjects) {
      const match = key.match(/tile-x(\d+)-y(\d+)$/);
      if (!match) continue;
      const tileX = Number(match[1]);
      const tileY = Number(match[2]);
      if (tileX < minX - 1 || tileX > maxX + 1 || tileY < minY - 1 || tileY > maxY + 1) {
        tile.destroy();
        this.mapTileObjects.delete(key);
        this.textures.remove(key);
      }
    }
  }

  requestMapTile(x, y) {
    const key = this.getTileKey(x, y);
    if (this.textures.exists(key)) return this.showMapTile(x, y);
    if (this.mapTilesLoading.has(key)) return;
    this.mapTilesLoading.add(key);
    this.load.once(`filecomplete-image-${key}`, () => {
      this.mapTilesLoading.delete(key);
      this.showMapTile(x, y);
    });
    this.load.image(key, this.getTilePath(x, y));
    this.load.start();
  }

  createEditorPanel() {
    this.pinUi(this.add.rectangle(1688, 540, 465, 1080, 0x102121, 0.96).setStrokeStyle(3, 0xd2ad67), 20);
    this.pinUi(addText(this, 1688, 53, "青云山地图编辑器", 36, "#ffe4a3", { origin: 0.5 }), 21);
    this.pinUi(addText(this, 1688, 110, "中键拖动 · 滚轮缩放", 21, "#dce8d4", { origin: 0.5 }), 21);
    this.toolText = this.pinUi(addText(this, 1688, 168, "当前工具：NPC", 27, "#fff2c5", { origin: 0.5 }), 21);

    const toolEntries = [["npc", "放置 NPC"], ["monster", "放置怪物"], ["building", "放置建筑"], ["portal", "放置传送点"], ["delete", "删除对象"]];
    toolEntries.forEach(([tool, label], index) => {
      this.pinUi(addButton(this, 1688, 237 + index * 77, 330, label, () => this.selectTool(tool), { height: 60, size: 24 }), 21);
    });
    this.monsterSelectButton = this.pinUi(addButton(this, 1688, 630, 330, "选择怪物模板", () => this.showMonsterTemplatePicker(), { height: 54, size: 23 }), 21);
    this.pinUi(addButton(this, 1688, 668, 330, "保存到游戏", () => this.saveChanges(), { height: 72, size: 27 }), 21);
    this.pinUi(addButton(this, 1688, 758, 330, "清空本图对象", () => this.clearObjects(), { height: 63, size: 24 }), 21);
    this.pinUi(addButton(this, 1688, 983, 330, "返回开发者控制台", () => this.scene.start(SceneKeys.DEVELOPER_CONSOLE), { height: 63, size: 23 }), 21);
    this.pinUi(addText(this, 1688, 843, "首次会加载整张地图\n放大后中键拖动平移\n删除模式：点击已有标记", 21, "#d7e2d1", { origin: 0.5, align: "center", lineSpacing: 12 }), 21);
  }

  /** 将 UI 只交给右侧固定相机渲染，避免受到地图缩放与平移影响。 */
  pinUi(gameObject, depth) {
    gameObject.setDepth(depth);
    this.mapCamera.ignore(gameObject);
    return gameObject;
  }

  selectTool(tool) {
    this.selectedTool = tool;
    this.toolText.setText(`当前工具：${tool === "delete" ? "删除对象" : MAP_OBJECT_TYPES[tool].name}`);
    if (tool === "monster") this.showMonsterTemplatePicker();
    if (tool === "npc") this.showTemplatePicker("npc");
    if (tool === "building") this.showTemplatePicker("building");
  }

  handleMapClick(pointer) {
    // 右侧是编辑器按钮区，点击那里不应被当成“放置地图对象”。
    if (pointer.x >= 1455) return;
    if (this.selectedTool === "delete") {
      const nearestIndex = this.findNearestObject(pointer.worldX, pointer.worldY);
      if (nearestIndex >= 0) {
        this.mapObjects.splice(nearestIndex, 1);
        this.renderAllMarkers();
        this.showNotice("已删除对象，记得点击保存。", "#ffd49c");
      }
      return;
    }

    const typeInfo = MAP_OBJECT_TYPES[this.selectedTool];
    let name = `${typeInfo.name}${this.mapObjects.filter((item) => item.type === this.selectedTool).length + 1}`;
    let extra = {};
    if (this.selectedTool === "monster") {
      const template = this.monsterTemplates.find((item) => item.id === this.selectedMonsterTemplateId);
      if (!template) return this.showNotice("请先在怪物编辑器中创建怪物模板。", "#ffd49c");
      // 地图只保存模板编号，不复制生命、攻击等属性，模板更新后会自动同步。
      name = template.name;
      extra = { monsterTemplateId: template.id };
    }
    if (this.selectedTool === "npc") {
      const template = this.npcTemplates.find((item) => item.id === this.selectedNpcTemplateId);
      if (!template) return this.showNotice("请先在 NPC 编辑器中创建模板。", "#ffd49c");
      name = template.name;
      extra = { npcTemplateId: template.id };
    }
    if (this.selectedTool === "building") {
      const template = this.buildingTemplates.find((item) => item.id === this.selectedBuildingTemplateId);
      if (!template) return this.showNotice("请先在建筑编辑器中创建模板。", "#ffd49c");
      name = template.name;
      extra = { buildingTemplateId: template.id };
    }
    this.mapObjects.push(createMapObject(this.selectedTool, pointer.worldX, pointer.worldY, name, extra));
    this.renderAllMarkers();
    this.showNotice("已放置对象，记得点击保存。", "#d8f0cf");
  }

  /** 显示已创建怪物的选择列表。选择后地图点击会直接放置该模板。 */
  showMonsterTemplatePicker() {
    if (this.templatePicker) this.templatePicker.destroy();
    const items = this.monsterTemplates;
    this.templatePicker = this.add.container(1688, 420).setDepth(40);
    this.pinUi(this.templatePicker, 40);
    const height = Math.min(260, Math.max(90, items.length * 48 + 48));
    const bg = this.add.rectangle(0, 0, 414, height * 1.5, 0x0c1718, 0.98).setStrokeStyle(3, 0xe0b869);
    const title = addText(this, 0, -height * 0.75 + 27, "选择要放置的怪物", 24, "#ffe5a4", { origin: 0.5 });
    this.templatePicker.add([bg, title]);
    items.slice(0, 4).forEach((monster, index) => {
      const button = addButton(this, 0, -height * 0.75 + 75 + index * 71, 353, `${monster.name} · ${monster.grade}`, () => {
        this.selectedMonsterTemplateId = monster.id;
        this.toolText.setText(`当前工具：怪物 · ${monster.name}`);
        this.templatePicker.destroy();
        this.templatePicker = null;
      }, { height: 38, size: 14 });
      this.templatePicker.add(button);
    });
    const editorButton = addButton(this, 0, height * 0.75 - 30, 353, "进入怪物编辑器", () => this.scene.start(SceneKeys.MONSTER_EDITOR), { height: 51, size: 21 });
    this.templatePicker.add(editorButton);
  }

  /** NPC、建筑共用的小型模板选择面板。 */
  showTemplatePicker(type) {
    if (this.templatePicker) this.templatePicker.destroy();
    const isNpc = type === "npc";
    const items = isNpc ? this.npcTemplates : this.buildingTemplates;
    const editorScene = isNpc ? SceneKeys.NPC_EDITOR : SceneKeys.BUILDING_EDITOR;
    const title = isNpc ? "选择要放置的 NPC" : "选择要放置的建筑";
    this.templatePicker = this.add.container(1688, 420).setDepth(40);
    this.pinUi(this.templatePicker, 40);
    const height = Math.min(260, Math.max(90, items.length * 48 + 48));
    this.templatePicker.add([this.add.rectangle(0, 0, 414, height * 1.5, 0x0c1718, 0.98).setStrokeStyle(3, 0xe0b869), addText(this, 0, -height * 0.75 + 27, title, 24, "#ffe5a4", { origin: 0.5 })]);
    items.slice(0, 4).forEach((item, index) => {
      const button = addButton(this, 0, -height * 0.75 + 75 + index * 71, 353, item.name, () => {
        if (isNpc) this.selectedNpcTemplateId = item.id;
        else this.selectedBuildingTemplateId = item.id;
        this.toolText.setText(`当前工具：${isNpc ? "NPC" : "建筑"} · ${item.name}`);
        this.templatePicker.destroy(); this.templatePicker = null;
      }, { height: 38, size: 14 });
      this.templatePicker.add(button);
    });
    this.templatePicker.add(addButton(this, 0, height * 0.75 - 30, 353, "进入对应编辑器", () => this.scene.start(editorScene), { height: 51, size: 21 }));
  }

  /** 找到点击位置 70 像素范围内最近的对象，用于删除。 */
  findNearestObject(x, y) {
    let nearestIndex = -1;
    let nearestDistance = 70;
    this.mapObjects.forEach((object, index) => {
      const distance = Phaser.Math.Distance.Between(x, y, object.x, object.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  renderAllMarkers() {
    for (const marker of this.markerObjects.values()) marker.destroy();
    this.markerObjects.clear();
    this.mapObjects.forEach((object) => this.renderMarker(object));
  }

  /** 将数据对象绘制成地图上的真实预览图和名称。 */
  renderMarker(object) {
    const info = MAP_OBJECT_TYPES[object.type] || MAP_OBJECT_TYPES.npc;
    const marker = this.add.container(object.x, object.y).setDepth(8);
    const shadow = this.add.ellipse(0, 5, 48, 13, 0x17221e, 0.35);
    let preview;
    if (object.type === "npc") {
      preview = this.add.image(0, 0, "editor-npc-preview", 0).setOrigin(0.5, 0.86).setScale(0.3);
      // 地图编辑器预览与游戏地图共用 NPC 专属立绘，放置前就能确认角色外观。
      const template = this.npcTemplates.find((item) => item.id === object.npcTemplateId);
      if (template?.imageData) {
        const textureKey = `editor-npc-custom-${template.id}`;
        const applyNpcPreview = () => {
          const source = this.textures.get(textureKey).getSourceImage();
          const scale = Math.min(86 / source.width, 96 / source.height);
          if (preview.active) preview.setTexture(textureKey).setDisplaySize(source.width * scale, source.height * scale);
        };
        if (this.textures.exists(textureKey)) applyNpcPreview();
        else this.textures.addBase64(textureKey, template.imageData, applyNpcPreview);
      }
    } else if (object.type === "monster") {
      preview = this.add.image(0, 0, "editor-monster-preview").setOrigin(0.5, 0.87).setScale(0.32).setFlipX(true).setTint(0xe9b4b4);
      // 地图编辑器也要显示怪物模板的真实图片，不能所有怪物都使用同一个临时图标。
      // 未上传图片时，仍保留默认预览，保证新建怪物可立即放到地图上测试。
      const template = this.monsterTemplates.find((item) => item.id === object.monsterTemplateId);
      if (template?.imageData) {
        const textureKey = `editor-monster-custom-${template.id}`;
        const applyCustomPreview = () => {
          const source = this.textures.get(textureKey).getSourceImage();
          const scale = Math.min(86 / source.width, 86 / source.height);
          if (preview.active) preview.setTexture(textureKey).clearTint().setDisplaySize(source.width * scale, source.height * scale);
        };
        if (this.textures.exists(textureKey)) applyCustomPreview();
        else this.textures.addBase64(textureKey, template.imageData, applyCustomPreview);
      }
    } else {
      preview = this.add.circle(0, -4, 22, info.color, 0.92).setStrokeStyle(3, 0xfff3c4);
    }
    const label = addText(this, 0, -53, object.name, 15, "#fff7dc", { origin: 0.5 });
    marker.add([shadow, preview, label]);
    this.markerObjects.set(object.id, marker);
    this.uiCamera?.ignore(marker);
  }

  saveChanges() {
    if (saveMapObjects(this.mapConfig.id, this.mapObjects)) {
      this.showNotice(`已保存 ${this.mapObjects.length} 个地图对象。`, "#d8f0cf");
    }
  }

  clearObjects() {
    if (!this.mapObjects.length || !window.confirm("确定清空青云山中所有已放置对象吗？")) return;
    this.mapObjects = [];
    this.renderAllMarkers();
    this.showNotice("已清空，点击保存后才会写入游戏。", "#ffd49c");
  }

  showNotice(message, color) {
    if (this.noticeText) this.noticeText.destroy();
    this.noticeText = this.pinUi(addText(this, 1688, 915, message, 23, color, { origin: 0.5, align: "center", wordWrap: { width: 375 } }), 30);
  }

  /** 处理中键按下：记录开始拖动时的鼠标和镜头位置，不会触发放置对象。 */
  startPointerAction(pointer) {
    if (pointer.button === 1 || pointer.middleButtonDown()) {
      this.isMiddlePanning = true;
      this.panStart = { x: pointer.x, y: pointer.y, scrollX: this.mapCamera.scrollX, scrollY: this.mapCamera.scrollY };
      return;
    }
    this.handleMapClick(pointer);
  }

  /** 中键拖动时，用屏幕位移除以缩放倍率换算为地图位移。 */
  updateMiddlePan(pointer) {
    if (!this.isMiddlePanning || !pointer.middleButtonDown()) return;
    this.mapCamera.scrollX = this.panStart.scrollX - (pointer.x - this.panStart.x) / this.mapCamera.zoom;
    this.mapCamera.scrollY = this.panStart.scrollY - (pointer.y - this.panStart.y) / this.mapCamera.zoom;
    this.clampCameraScroll();
  }

  /** 在左侧地图范围滚动鼠标滚轮，可在全图和局部细节之间缩放。 */
  zoomMap(pointer, deltaY) {
    if (pointer.x >= 1455) return;
    const newZoom = Phaser.Math.Clamp(
      this.mapCamera.zoom + (deltaY > 0 ? -0.0375 : 0.0375),
      0.18,
      1.2,
    );
    this.mapCamera.setZoom(newZoom);
    this.clampCameraScroll();
    this.refreshNearbyMapTiles();
  }

  /** 防止镜头被拖出青云山边界。 */
  clampCameraScroll() {
    const maxX = Math.max(0, this.worldSize.width - this.mapCamera.width / this.mapCamera.zoom);
    const maxY = Math.max(0, this.worldSize.height - this.mapCamera.height / this.mapCamera.zoom);
    this.mapCamera.scrollX = Phaser.Math.Clamp(this.mapCamera.scrollX, 0, maxX);
    this.mapCamera.scrollY = Phaser.Math.Clamp(this.mapCamera.scrollY, 0, maxY);
  }

  update(_, delta) {
    const speed = 620 * delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += speed;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += speed;
    if (dx || dy) {
      this.mapCamera.scrollX += dx / this.mapCamera.zoom;
      this.mapCamera.scrollY += dy / this.mapCamera.zoom;
      this.clampCameraScroll();
    }
    this.mapStreamElapsed += delta;
    if (this.mapStreamElapsed >= 300) {
      this.mapStreamElapsed = 0;
      this.refreshNearbyMapTiles();
    }
  }
}

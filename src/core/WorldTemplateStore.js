/**
 * NPC 与建筑模板仓库。
 * 和怪物模板一样：编辑器负责定义模板，地图只保存模板编号与坐标。
 */
const NPC_KEY = "xuanqiong-wendao-npc-templates-v1";
const BUILDING_KEY = "xuanqiong-wendao-building-templates-v1";

const DEFAULT_NPCS = [{
  id: "npc-qixia-elder", name: "栖霞村村长", imageData: "", portraitData: "", avatarData: "",
  dialogue: ["村长：近来青云山异象频发。", "若你有余力，可去山脚看看。"],
  // 任务资料先跟随 NPC 模板保存。后续任务系统会读取这一段生成可接任务。
  quest: { enabled: false, title: "", description: "", target: "", reward: "" },
}, {
  // 商人同样从 NPC 管理与地图编辑器放置；merchant 标记决定资料卡的第三个按钮显示“购物”。
  id: "npc-qixia-merchant", name: "云游商人", merchant: true, imageData: "", portraitData: "", avatarData: "",
  dialogue: ["云游四方，偶得些灵草丹方。道友若有需要，尽可看看。"],
  profile: { gender: "男", realm: "炼气初期", sect: "散修", identity: "商人" },
  quest: { enabled: false, title: "", description: "", target: "", reward: "" },
}];
const DEFAULT_BUILDINGS = [{
  id: "building-qixia-house", name: "栖霞村民居", type: "民居", blocked: true, imageData: "",
  interactionText: "这是一间普通民居，屋内传来饭菜香。",
}];

function readTemplates(key, defaults, normalize) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(raw)) return raw.map(normalize);
    const initial = defaults.map(normalize);
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  } catch (error) {
    console.warn("世界模板读取失败：", error);
    return defaults.map(normalize);
  }
}

function writeTemplates(key, templates, normalize) {
  try {
    localStorage.setItem(key, JSON.stringify(templates.map(normalize)));
    return true;
  } catch (error) {
    console.warn("世界模板保存失败：", error);
    return false;
  }
}

export function normalizeNpc(npc = {}) {
  const oldImageData = npc.imageData || "";
  // 新版只维护一张 NPC 立绘；旧档若只有头像或 imageData，也会自动迁移为立绘。
  const portraitData = npc.portraitData || oldImageData || npc.avatarData || "";
  const profile = npc.profile || {};
  const roots = profile.roots || {};
  // 新建 NPC 是一张真正的空白表单；已有 NPC 与旧存档则继续沿用原来的默认资料。
  const isNew = Boolean(npc.isNew);
  const textValue = (value, fallback) => isNew
    ? String(value ?? "").trim()
    : String(value || fallback).trim();
  const numberValue = (value, fallback) => {
    if (isNew && (value === "" || value === null || value === undefined)) return "";
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const rawNodes = Array.isArray(npc.dialogueTree?.nodes) ? npc.dialogueTree.nodes : [];
  const usedNodeIds = new Set();
  const dialogueNodes = rawNodes.slice(0, 30).map((node, index) => {
    let id = String(node?.id || `node-${index + 1}`).trim() || `node-${index + 1}`;
    while (usedNodeIds.has(id)) id = `${id}-${index + 1}`;
    usedNodeIds.add(id);
    return {
      id,
      text: String(node?.text ?? "").trim(),
      choices: Array.isArray(node?.choices) ? node.choices.slice(0, 4).map((choice, choiceIndex) => ({
        id: String(choice?.id || `choice-${index + 1}-${choiceIndex + 1}`),
        text: String(choice?.text ?? "").trim(),
        nextId: String(choice?.nextId ?? "").trim(),
        action: String(choice?.action ?? "").trim(),
      })) : [],
    };
  });
  return {
    id: npc.id || `npc-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    isNew,
    merchant: Boolean(npc.merchant),
    name: isNew ? String(npc.name ?? "").trim() : (String(npc.name || "未命名 NPC").trim() || "未命名 NPC"),
    // 旧版本只有 imageData：迁移时同时当作立绘和头像，旧存档不会丢图。
    portraitData,
    avatarData: portraitData,
    // 地图中使用的角色立绘与对话半身像分开保存：尚未制作时由大地图显示问号标记。
    mapPortraitData: npc.mapPortraitData || "",
    // 地图中的 NPC 外观沿用头像数据，保留旧字段以兼容地图编辑器与已放置 NPC。
    imageData: portraitData,
    dialogue: Array.isArray(npc.dialogue) && npc.dialogue.length ? npc.dialogue.filter(Boolean) : (isNew ? [] : ["……"]),
    // 分支对话：每个 NPC 回复节点可挂多条主角选择，选择再跳往不同节点。
    dialogueTree: dialogueNodes.length ? {
      startId: dialogueNodes.some((node) => node.id === npc.dialogueTree?.startId) ? npc.dialogueTree.startId : dialogueNodes[0].id,
      nodes: dialogueNodes,
    } : null,
    // 人物技能预留十个槽位；当前 NPC 没有技能时保持空数组，避免自动带入示例技能。
    skills: Array.isArray(npc.skills) ? npc.skills.slice(0, 10).map((skill) => ({
      name: String(skill?.name || "").trim(),
      damage: Number(skill?.damage) || 0,
      qiCost: Number(skill?.qiCost) || 0,
      cooldown: Number(skill?.cooldown) || 0,
    })).filter((skill) => skill.name) : [],
    // NPC 管理面板的基础资料、灵根与战斗属性；均会随模板一起保存。
    profile: {
      gender: textValue(profile.gender, "男"),
      realm: textValue(profile.realm, "炼气初期"),
      sect: textValue(profile.sect, "栖霞村"),
      identity: textValue(profile.identity, "村民"),
      lifespan: numberValue(profile.lifespan, 110),
      qi: numberValue(profile.qi, 0),
      spirit: numberValue(profile.spirit, 0),
      attack: numberValue(profile.attack, 0),
      defense: numberValue(profile.defense, 0),
      agility: numberValue(profile.agility, 0),
      roots: Object.fromEntries(["金", "木", "水", "火", "土", "风", "雷", "冰", "魔", "神"].map((key) => [key, numberValue(roots[key], 0)])),
    },
    // 即使当前 NPC 没有任务，也保留同样的数据结构，后续添加任务不用修改旧存档。
    quest: {
      enabled: Boolean(npc.quest?.enabled),
      title: String(npc.quest?.title || "").trim(),
      description: String(npc.quest?.description || "").trim(),
      target: String(npc.quest?.target || "").trim(),
      reward: String(npc.quest?.reward || "").trim(),
    },
  };
}
export function getNpcTemplates() {
  const templates = readTemplates(NPC_KEY, DEFAULT_NPCS, normalizeNpc);
  // 已创建过 NPC 的旧存档不会自动合并默认模板；这里补入一次云游商人，地图编辑器马上可选择放置。
  if (!templates.some((item) => item.id === "npc-qixia-merchant")) {
    templates.push(normalizeNpc(DEFAULT_NPCS.find((item) => item.id === "npc-qixia-merchant")));
    writeTemplates(NPC_KEY, templates, normalizeNpc);
  }
  return templates;
}
export function saveNpcTemplates(items) { return writeTemplates(NPC_KEY, items, normalizeNpc); }
export function getNpcTemplate(id) { return getNpcTemplates().find((item) => item.id === id) || null; }

export function normalizeBuilding(building = {}) {
  const rawCollision = building.collision || {};
  const normalizedPoints = Array.isArray(rawCollision.points)
    ? rawCollision.points.slice(0, 64).map((point) => ({
      x: Math.min(1, Math.max(0, Number(point?.x))),
      y: Math.min(1, Math.max(0, Number(point?.y))),
    })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  const collisionEnabled = rawCollision.enabled ?? building.blocked ?? false;
  const interaction = building.interaction || {};
  return {
    id: building.id || `building-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: String(building.name || "未命名建筑").trim() || "未命名建筑",
    type: String(building.type || "建筑").trim() || "建筑",
    // 旧版的 blocked 仍保留，保证已放置建筑的移动规则不会丢失；新版以 collision 为唯一编辑入口。
    blocked: Boolean(collisionEnabled),
    imageData: building.imageData || "",
    display: {
      width: Math.min(1024, Math.max(48, Number(building.display?.width) || 256)),
      height: Math.min(1024, Math.max(48, Number(building.display?.height) || 256)),
      anchor: building.display?.anchor === "center" ? "center" : "bottom",
    },
    // 顶点使用 0 到 1 的相对坐标；无论地图上缩放多少，碰撞形状都能和建筑图片保持一致。
    collision: {
      enabled: Boolean(collisionEnabled),
      shape: rawCollision.shape === "rectangle" ? "rectangle" : "polygon",
      // 旧版只有“阻挡 / 可穿过”开关。第一次升级时给阻挡建筑一块可继续编辑的默认矩形，
      // 保证旧建筑不会因为尚未手绘而突然失去碰撞范围。
      points: normalizedPoints.length
        ? normalizedPoints
        : (collisionEnabled ? [{ x: 0.14, y: 0.55 }, { x: 0.86, y: 0.55 }, { x: 0.86, y: 0.95 }, { x: 0.14, y: 0.95 }] : []),
    },
    interaction: {
      enabled: interaction.enabled ?? Boolean(building.interactionText),
      kind: ["dialogue", "shop", "teleport", "scene", "sect"].includes(interaction.kind) ? interaction.kind : "dialogue",
      title: String(interaction.title || building.name || "建筑交互").trim(),
      prompt: String(interaction.prompt || building.interactionText || "这是一座建筑。").trim(),
      targetId: String(interaction.targetId || "").trim(),
    },
    // 保留给旧版 VillageScene 的读取字段；新版编辑器改动后会同步写回这里。
    interactionText: String(interaction.prompt || building.interactionText || "这是一座建筑。").trim(),
  };
}
export function getBuildingTemplates() { return readTemplates(BUILDING_KEY, DEFAULT_BUILDINGS, normalizeBuilding); }
export function saveBuildingTemplates(items) { return writeTemplates(BUILDING_KEY, items, normalizeBuilding); }
export function getBuildingTemplate(id) { return getBuildingTemplates().find((item) => item.id === id) || null; }

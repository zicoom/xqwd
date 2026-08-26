/**
 * 开发者控制台文件仓库。
 *
 * 模板资料写入 data/editor，上传的图片写入 public/assets/images/editor。
 * 所有图片会被替换为项目内可直接访问的 URL，避免 Base64 字符串继续占用浏览器空间。
 */
const fs = require("fs/promises");
const path = require("path");

const EDITOR_TYPES = Object.freeze({
  items: { file: "items.json", imageFields: ["imageData"] },
  monsters: { file: "monsters.json", imageFields: ["imageData", "appearance.staticFallback"] },
  npcs: { file: "npcs.json", imageFields: ["imageData", "portraitData", "avatarData", "mapPortraitData"] },
  buildings: { file: "buildings.json", imageFields: ["imageData"] },
  "map-content": { file: "map-content.json", imageFields: [] },
});

function safeFilePart(value) {
  return String(value || "template")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "template";
}

function readDataUrl(value) {
  const match = /^data:image\/(?:png|jpe?g|webp);base64,([a-zA-Z0-9+/=]+)$/i.exec(String(value || ""));
  return match ? Buffer.from(match[1], "base64") : null;
}

function getByPath(object, fieldPath) {
  return fieldPath.split(".").reduce((value, key) => value && value[key], object);
}

function setByPath(object, fieldPath, value) {
  const keys = fieldPath.split(".");
  const lastKey = keys.pop();
  let target = object;
  for (const key of keys) {
    if (!target[key] || typeof target[key] !== "object") target[key] = {};
    target = target[key];
  }
  target[lastKey] = value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEditorFileStorage({ dataRoot, imageRoot }) {
  async function read(type) {
    const definition = EDITOR_TYPES[type];
    if (!definition) throw new Error("不支持的编辑器资料类型");
    try {
      const content = await fs.readFile(path.join(dataRoot, definition.file), "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  async function write(type, value) {
    const definition = EDITOR_TYPES[type];
    if (!definition) throw new Error("不支持的编辑器资料类型");
    if ((type === "map-content" && (!value || Array.isArray(value) || typeof value !== "object"))
      || (type !== "map-content" && !Array.isArray(value))) {
      throw new Error("编辑器资料格式不正确");
    }

    const normalized = clone(value);
    if (Array.isArray(normalized)) {
      for (const template of normalized) {
        const imageCache = new Map();
        for (const fieldPath of definition.imageFields) {
          const source = getByPath(template, fieldPath);
          const data = readDataUrl(source);
          if (!data) continue;
          let assetUrl = imageCache.get(source);
          if (!assetUrl) {
            const templateId = safeFilePart(template.id || template.name);
            const fieldName = safeFilePart(fieldPath.replaceAll(".", "-"));
            const relativeFile = path.posix.join("public", "assets", "images", "editor", type, `${templateId}-${fieldName}.webp`);
            const outputFile = path.join(imageRoot, type, `${templateId}-${fieldName}.webp`);
            await fs.mkdir(path.dirname(outputFile), { recursive: true });
            await fs.writeFile(outputFile, data);
            assetUrl = `/${relativeFile}`;
            imageCache.set(source, assetUrl);
          }
          setByPath(template, fieldPath, assetUrl);
        }
      }
    }

    await fs.mkdir(dataRoot, { recursive: true });
    const outputFile = path.join(dataRoot, definition.file);
    const temporaryFile = `${outputFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    await fs.rename(temporaryFile, outputFile);
    return normalized;
  }

  return { read, write };
}

module.exports = { EDITOR_TYPES, createEditorFileStorage };

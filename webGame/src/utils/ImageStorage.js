/**
 * 编辑器图片统一处理工具。
 * 用户选择的原始 PNG / JPG / WebP 不会被修改；这里只在浏览器内生成轻量 WebP 数据，
 * 供 localStorage、Phaser 纹理和本地资料导出使用。
 */

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("图片文件读取失败"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

/** 等比缩放图片，并统一编码为 WebP。 */
export function optimiseImageForStorage(sourceData, maxSide = 512, quality = 0.8) {
  if (!sourceData) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const source = new Image();
    source.onerror = () => reject(new Error("图片无法解码"));
    source.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
        const width = Math.max(1, Math.round(source.width * scale));
        const height = Math.max(1, Math.round(source.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("浏览器不支持图片转换");
        context.drawImage(source, 0, 0, width, height);
        const imageData = canvas.toDataURL("image/webp", quality);
        if (!imageData.startsWith("data:image/webp") || imageData.length < 32) {
          throw new Error("浏览器无法生成 WebP 图片");
        }
        resolve(imageData);
      } catch (error) {
        reject(error);
      }
    };
    source.src = sourceData;
  });
}

/** 读取用户选择的原图后直接返回适合存储的 WebP。 */
export async function prepareImageForStorage(file, options = {}) {
  const sourceData = await readImageFile(file);
  return optimiseImageForStorage(sourceData, options.maxSide ?? 512, options.quality ?? 0.8);
}

/**
 * 从图片透明通道提取一个足够简单、可继续人工微调的建筑外包轮廓。
 *
 * 不追求把屋檐、树枝等细节全部变成几十个顶点：那样反而难编辑。这里按四个高度采样，
 * 生成最多八个点；透明 PNG/WebP 会贴合建筑轮廓，普通不透明 JPG 会自然退化为图片边缘矩形。
 */
export function buildCollisionOutlineFromAlpha(alpha, width, height, threshold = 18) {
  if (!alpha || width < 1 || height < 1 || alpha.length < width * height * 4) {
    return { points: [], usesTransparency: false };
  }
  const rows = [];
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    let left = width;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      if (alpha[(y * width + x) * 4 + 3] > threshold) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    rows[y] = right >= left ? { left, right } : null;
    if (rows[y]) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (bottom < top) return { points: [], usesTransparency: false };

  // 如果整张图都是不透明像素，说明没有可用透明轮廓；仍给可直接编辑的完整矩形。
  const usesTransparency = !(top === 0 && bottom === height - 1 && rows.every((row) => row?.left === 0 && row?.right === width - 1));
  const sampleY = [bottom, Math.round(top + (bottom - top) * 0.67), Math.round(top + (bottom - top) * 0.33), top];
  const nearestRow = (target) => {
    if (rows[target]) return { row: rows[target], y: target };
    for (let offset = 1; offset < height; offset += 1) {
      if (rows[target - offset]) return { row: rows[target - offset], y: target - offset };
      if (rows[target + offset]) return { row: rows[target + offset], y: target + offset };
    }
    return null;
  };
  const margin = 2;
  const samples = sampleY.map(nearestRow).filter(Boolean).map(({ row, y }) => ({
    left: Math.max(0, row.left - margin),
    right: Math.min(width - 1, row.right + margin),
    y,
  }));
  const rawPoints = [
    ...samples.map((sample) => ({ x: sample.left / (width - 1 || 1), y: sample.y / (height - 1 || 1) })),
    ...samples.slice().reverse().map((sample) => ({ x: sample.right / (width - 1 || 1), y: sample.y / (height - 1 || 1) })),
  ].filter((point, index, list) => index === 0 || Math.abs(point.x - list[index - 1].x) > 0.002 || Math.abs(point.y - list[index - 1].y) > 0.002);
  // 直线上没有转折意义的中间采样点不显示给玩家：矩形图片最终只保留四个角，
  // 有屋檐/山门等外扩结构时才保留对应的转折节点。
  const points = rawPoints.filter((point, index, list) => {
    if (list.length <= 3) return true;
    const previous = list[(index - 1 + list.length) % list.length];
    const next = list[(index + 1) % list.length];
    const cross = (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x);
    return Math.abs(cross) > 0.001;
  }).map((point) => ({ x: Number(point.x.toFixed(4)), y: Number(point.y.toFixed(4)) }));
  return { points, usesTransparency };
}

/** 读取已存储的图片数据并生成碰撞轮廓；仅用于编辑器显示与编辑，不属于游戏规则。 */
export function detectImageCollisionOutline(sourceData) {
  if (!sourceData) return Promise.resolve({ points: [], usesTransparency: false });
  return new Promise((resolve, reject) => {
    const source = new Image();
    source.onerror = () => reject(new Error("图片无法解码"));
    source.onload = () => {
      try {
        const longestSide = Math.max(source.width, source.height);
        const scale = Math.min(1, 256 / longestSide);
        const width = Math.max(1, Math.round(source.width * scale));
        const height = Math.max(1, Math.round(source.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("浏览器不支持图片轮廓识别");
        context.drawImage(source, 0, 0, width, height);
        resolve(buildCollisionOutlineFromAlpha(context.getImageData(0, 0, width, height).data, width, height));
      } catch (error) {
        reject(error);
      }
    };
    source.src = sourceData;
  });
}

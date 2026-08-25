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

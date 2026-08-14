/**
 * 图片上传基础设施：以小而清晰的 WebP 输出维持“橙皮工作台”的出版物阅读节奏，
 * 不引入第三方依赖，所有压缩均在作者浏览器中完成。
 */
export const ACCEPTED_CONTENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAXIMUM_IMAGE_DIMENSION = 2200;
export const TARGET_IMAGE_BYTES = 1.6 * 1024 * 1024;

export type PreparedContentImage = {
  file: File;
  originalBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  compressed: boolean;
};

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("无法解析此图片文件。"));
    };
    image.src = objectUrl;
  });
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("浏览器无法完成图片压缩。"));
    }, "image/webp", quality);
  });
}

function webpName(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]+/g, "-").slice(0, 140) || "image";
  return `${stem}.webp`;
}

export async function prepareContentImage(file: File): Promise<PreparedContentImage> {
  if (!ACCEPTED_CONTENT_IMAGE_TYPES.has(file.type)) throw new Error("仅支持 JPG、PNG 或 WebP 图片。");
  if (!file.size) throw new Error("图片文件为空。请选择一张有效图片。");

  const image = await loadImage(file);
  const scale = Math.min(1, MAXIMUM_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法初始化图片压缩。" );
  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToWebp(canvas, 0.84);
  for (const quality of [0.76, 0.68, 0.6, 0.54]) {
    if (blob.size <= TARGET_IMAGE_BYTES) break;
    blob = await canvasToWebp(canvas, quality);
  }

  const output = new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
  return {
    file: output,
    originalBytes: file.size,
    outputBytes: output.size,
    width,
    height,
    compressed: output.size < file.size || output.name !== file.name,
  };
}

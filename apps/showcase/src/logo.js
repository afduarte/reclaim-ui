// Logo → palette extraction: browser half (canvas sampling) around the pure
// quantizer in @reclaim/tokens.
import { quantizePixels } from "@reclaim/tokens";

export async function extractLogoPalette(file, k = 5) {
  const bitmap = await createImageBitmap(file);
  const size = 72; // sample small: logos are flat-color; speed > precision
  const scale = Math.min(size / bitmap.width, size / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return quantizePixels(ctx.getImageData(0, 0, w, h).data, k);
}

"use client";

/**
 * On-device privacy blur. Faces (and the heads of people further away) are found
 * with MediaPipe models running in the browser, then pixelated before upload.
 * The original photo never leaves the phone.
 */

export type Region = { x: number; y: number; w: number; h: number };

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const OBJECT_MODEL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite";

type Detectors = {
  face: import("@mediapipe/tasks-vision").FaceDetector;
  people: import("@mediapipe/tasks-vision").ObjectDetector;
};
let detectors: Promise<Detectors> | null = null;

function loadDetectors(): Promise<Detectors> {
  if (!detectors) {
    detectors = (async () => {
      const { FilesetResolver, FaceDetector, ObjectDetector } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM);
      const [face, people] = await Promise.all([
        FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.5,
        }),
        ObjectDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: OBJECT_MODEL, delegate: "CPU" },
          runningMode: "IMAGE",
          scoreThreshold: 0.35,
          maxResults: 25,
          categoryAllowlist: ["person"],
        }),
      ]);
      return { face, people };
    })().catch((e) => {
      detectors = null; // allow a retry next time
      throw e;
    });
  }
  return detectors;
}

/** Start downloading the models early (e.g. when the report page opens). */
export function preloadPrivacyModels() {
  loadDetectors().catch(() => {});
}

/** Head area of a detected person: top ~22% of the box, a bit wider than tall. */
export function headOf(p: Region): Region {
  const h = Math.max(p.h * 0.22, 8);
  const w = Math.min(p.w, h * 1.1);
  return { x: p.x + (p.w - w) / 2, y: p.y, w, h };
}

/** Grow a region by a margin and clamp it to the image. */
export function pad(r: Region, margin: number, W: number, H: number): Region {
  const x = Math.max(0, r.x - r.w * margin);
  const y = Math.max(0, r.y - r.h * margin);
  const x2 = Math.min(W, r.x + r.w * (1 + margin));
  const y2 = Math.min(H, r.y + r.h * (1 + margin));
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

/** Find areas to blur. Never throws: if the models can't load, returns []. */
export async function detectPrivateAreas(image: HTMLCanvasElement | ImageBitmap): Promise<{ regions: Region[]; ok: boolean }> {
  try {
    const { face, people } = await loadDetectors();
    const W = image.width, H = image.height;
    const regions: Region[] = [];
    for (const d of face.detect(image).detections) {
      const b = d.boundingBox;
      if (b) regions.push(pad({ x: b.originX, y: b.originY, w: b.width, h: b.height }, 0.25, W, H));
    }
    for (const d of people.detect(image).detections) {
      const b = d.boundingBox;
      if (b) regions.push(pad(headOf({ x: b.originX, y: b.originY, w: b.width, h: b.height }), 0.2, W, H));
    }
    return { regions: regions.filter((r) => r.w > 2 && r.h > 2), ok: true };
  } catch {
    return { regions: [], ok: false };
  }
}

/** Pixelate one region of the canvas (works on every browser, unlike ctx.filter). */
export function pixelate(ctx: CanvasRenderingContext2D, r: Region) {
  const block = Math.max(6, Math.round(Math.max(r.w, r.h) / 7));
  const sw = Math.max(1, Math.ceil(r.w / block));
  const sh = Math.max(1, Math.ceil(r.h / block));
  const tmp = document.createElement("canvas");
  tmp.width = sw; tmp.height = sh;
  const t = tmp.getContext("2d")!;
  t.imageSmoothingEnabled = true;
  t.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, sw, sh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, sw, sh, r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Draw the image with all regions pixelated. */
export function renderBlurred(canvas: HTMLCanvasElement, source: ImageBitmap, regions: Region[]) {
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  for (const r of regions) pixelate(ctx, r);
}

export async function canvasToFile(canvas: HTMLCanvasElement, name = "photo.jpg"): Promise<File> {
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not prepare the photo.");
  return new File([blob], name, { type: "image/jpeg" });
}

/** Full pipeline for photos with no editing step (e.g. "after" photos): blur faces automatically. */
export async function autoBlurFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const { regions } = await detectPrivateAreas(bitmap);
  if (regions.length === 0) { bitmap.close(); return file; }
  const canvas = document.createElement("canvas");
  renderBlurred(canvas, bitmap, regions);
  bitmap.close();
  return canvasToFile(canvas);
}

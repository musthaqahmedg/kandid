"use client";

import { useEffect, useRef } from "react";
import { renderBlurred, type Region } from "@/lib/privacy";

type Props = {
  source: ImageBitmap;
  regions: Region[];
  onAdd: (r: Region) => void;
};

/** Shows the photo with blurred areas. Tap anywhere to blur that spot too (e.g. a number plate). */
export default function BlurEditor({ source, regions, onAdd }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) renderBlurred(ref.current, source, regions);
  }, [source, regions]);

  function tap(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * (c.height / rect.height);
    // A number-plate-ish box around the tap, ~22% of the image width
    const w = c.width * 0.22, h = w * 0.45;
    onAdd({
      x: Math.max(0, Math.min(c.width - w, x - w / 2)),
      y: Math.max(0, Math.min(c.height - h, y - h / 2)),
      w, h,
    });
  }

  return <canvas ref={ref} className="preview blur-canvas" onPointerUp={tap} aria-label="Your photo. Tap to blur a spot." />;
}

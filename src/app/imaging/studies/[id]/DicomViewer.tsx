"use client";

import { useEffect, useRef, useState } from "react";

type Props = { assetId: string; name: string };

export default function DicomViewer({ assetId, name }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading image…");
  const [windowCenter, setWindowCenter] = useState(128);
  const [windowWidth, setWindowWidth] = useState(256);
  const [invert, setInvert] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/assets/${assetId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Unable to load asset (${response.status})`);
        const contentType = response.headers.get("content-type") || "";
        if (contentType.startsWith("image/")) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const image = new Image();
          image.onload = () => {
            if (cancelled) return;
            const canvas = canvasRef.current; if (!canvas) return;
            canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const ctx = canvas.getContext("2d"); if (!ctx) return;
            ctx.drawImage(image, 0, 0);
            setStatus(`${image.naturalWidth} × ${image.naturalHeight}`);
            URL.revokeObjectURL(url);
          };
          image.onerror = () => setStatus("The stored image could not be rendered.");
          image.src = url;
          return;
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        const dcmjs = await import("dcmjs");
        const dcmBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const dataSet = dcmjs.data.DicomMessage.readFile(dcmBuffer);
        const natural = dcmjs.data.DicomMetaDictionary.namifyDataset(dataSet.dict) as Record<string, any>;
        const rows = Number(natural.Rows); const columns = Number(natural.Columns);
        if (!rows || !columns) throw new Error("DICOM pixel dimensions are missing.");
        const bitsAllocated = Number(natural.BitsAllocated ?? 8);
        const pixelRepresentation = Number(natural.PixelRepresentation ?? 0);
        const samplesPerPixel = Number(natural.SamplesPerPixel ?? 1);
        const photometric = String(natural.PhotometricInterpretation ?? "MONOCHROME2");
        const pixelData = natural.PixelData;
        if (!pixelData) throw new Error("This DICOM object has no accessible PixelData.");
        if (samplesPerPixel !== 1 || (bitsAllocated !== 8 && bitsAllocated !== 16)) {
          throw new Error("This viewer currently renders monochrome 8/16-bit pixel data only.");
        }
        const frame = Array.isArray(pixelData) ? pixelData[0] : pixelData;
        const raw = frame instanceof Uint8Array || frame instanceof Uint16Array || frame instanceof Int16Array ? frame : new Uint8Array(frame);
        const values: number[] = [];
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < rows * columns; i++) {
          let value = bitsAllocated === 8 ? raw[i] : (pixelRepresentation ? new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getInt16(i * 2, true) : new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint16(i * 2, true));
          const slope = Number(natural.RescaleSlope ?? 1), intercept = Number(natural.RescaleIntercept ?? 0);
          value = value * slope + intercept; values.push(value); min = Math.min(min, value); max = Math.max(max, value);
        }
        if (cancelled) return;
        const canvas = canvasRef.current; if (!canvas) return;
        canvas.width = columns; canvas.height = rows;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        const image = ctx.createImageData(columns, rows);
        const wc = Number(natural.WindowCenter ?? ((min + max) / 2));
        const ww = Number(natural.WindowWidth ?? Math.max(1, max - min));
        setWindowCenter(wc); setWindowWidth(ww);
        for (let i = 0; i < values.length; i++) {
          let normalized = ((values[i] - (wc - ww / 2)) / ww) * 255;
          normalized = Math.max(0, Math.min(255, normalized));
          if (photometric === "MONOCHROME1") normalized = 255 - normalized;
          if (invert) normalized = 255 - normalized;
          image.data[i * 4] = normalized; image.data[i * 4 + 1] = normalized; image.data[i * 4 + 2] = normalized; image.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
        setStatus(`${columns} × ${rows} · ${bitsAllocated}-bit`);
      } catch (error) { if (!cancelled) setStatus(error instanceof Error ? error.message : "Unable to render study image."); }
    }
    load(); return () => { cancelled = true; };
  }, [assetId, invert, windowCenter, windowWidth]);

  return <div className="rounded-2xl bg-black p-4 text-white">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="truncate">{name}</span><span className="text-slate-300">{status}</span></div>
    <div className="overflow-auto rounded-xl bg-black p-3"><canvas ref={canvasRef} style={{ transform: `scale(${zoom})`, transformOrigin: "top left", maxWidth: "100%", height: "auto" }} /></div>
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <label className="text-xs">Window center<input className="mt-1 w-full rounded bg-slate-800 p-2" type="number" value={Math.round(windowCenter)} onChange={e=>setWindowCenter(Number(e.target.value))}/></label>
      <label className="text-xs">Window width<input className="mt-1 w-full rounded bg-slate-800 p-2" type="number" min="1" value={Math.round(windowWidth)} onChange={e=>setWindowWidth(Number(e.target.value))}/></label>
      <label className="text-xs">Zoom<input className="mt-1 w-full" type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
      <button className="rounded bg-slate-700 px-3 py-2 text-sm" onClick={()=>setInvert(v=>!v)}>Invert</button>
    </div>
    <p className="mt-3 text-xs text-slate-400">Viewer output is for authorized clinical review. Rendering does not constitute a diagnosis.</p>
  </div>;
}
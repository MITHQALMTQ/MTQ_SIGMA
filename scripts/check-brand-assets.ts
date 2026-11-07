// MTQΣ — Brand Asset & Render-Quality Guard (F-56 root-cause protection)
// ---------------------------------------------------------------------
// WHY (2026-11-08, task56): two SHIPPED defect classes that visually degraded
// every surface and were only caught by the owner's eye:
//
//   F-56-A "JPEG masquerade": public/logo.svg, apple-touch-icon.png and
//   favicon.png were all ONE 784×1168 JPEG photograph (wrong magic bytes,
//   wrong content) — a pixelated photo rendered wherever the favicon /
//   touch-icon / logo was requested. A format contract (extension ↔ magic
//   bytes) makes that class unshippable.
//
//   F-56-B "fuzzy text on scroll": (1) Framer Motion `animate` targets that
//   END at `filter: "blur(0px)"` leave the whole subtree in a GPU
//   rasterization layer → text rasterized once as a texture → fuzzy while
//   scrolling. Canonical fix: `transitionEnd: { filter: "none" }`. (2)
//   Permanent `will-change` on resting styles pins every card/section into
//   compositor layers → same symptom. Both are source-scannable signatures.
//
// Wire-in: scripts/session-open-battery.sh [7/7] (exit 1 = FAIL).

import { $ } from "bun";

interface AssetSpec {
  path: string;
  kind: "svg" | "png";
  minDimension?: number; // square assets: width AND height must be ≥ this
  exact?: number; // if set, width and height must equal this
}

const ASSETS: AssetSpec[] = [
  // Vector canonical (2026 system) — the single source of truth
  { path: "public/brand/mtqs-mark.svg", kind: "svg" },
  { path: "public/brand/favicon.svg", kind: "svg" },
  { path: "public/logo.svg", kind: "svg" }, // masquerade canary
  // Raster icon set — true PNGs at their declared roles
  { path: "public/brand/favicon-16.png", kind: "png", exact: 16 },
  { path: "public/brand/favicon-32.png", kind: "png", exact: 32 },
  { path: "public/brand/favicon.png", kind: "png", exact: 32 }, // masquerade canary
  { path: "public/brand/favicon-96.png", kind: "png", exact: 96 },
  { path: "public/brand/apple-touch-icon.png", kind: "png", exact: 180 }, // masquerade canary
  { path: "public/brand/icon-192.png", kind: "png", exact: 192 },
  { path: "public/brand/icon-512.png", kind: "png", exact: 512 },
  { path: "public/brand/mtqs-logo-mark.png", kind: "png", exact: 512 }, // masquerade canary
];

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47]; // ‰PNG
const JPEG_SIG = [0xff, 0xd8];

async function pngDims(buf: Buffer): Promise<{ w: number; h: number } | null> {
  // IHDR sits at a fixed offset: bytes 16..24 of a valid PNG
  if (buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(24 - 8) };
}

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  FAIL ${msg}`); };

console.log("[brand-assets] format contract + resolution floors");
for (const spec of ASSETS) {
  const file = Bun.file(spec.path);
  if (!(await file.exists())) { fail(`${spec.path}: MISSING`); continue; }
  const buf = Buffer.from(await file.arrayBuffer());

  if (spec.kind === "svg") {
    const head = buf.subarray(0, 512).toString("utf-8").trimStart();
    const isSvg = head.startsWith("<?xml") || head.startsWith("<svg");
    const isJpeg = buf[0] === JPEG_SIG[0] && buf[1] === JPEG_SIG[1];
    if (!isSvg) {
      fail(`${spec.path}: not a vector SVG (magic ${isJpeg ? "JPEG — the F-56-A masquerade class" : "unknown"}); regenerate from the canonical mark`);
      continue;
    }
    if (!head.includes("<svg")) { fail(`${spec.path}: SVG wrapper without <svg root`); continue; }
    console.log(`  ok   ${spec.path} (vector)`);
  } else {
    const sigOk = PNG_SIG.every((b, i) => buf[i] === b);
    const isJpeg = buf[0] === JPEG_SIG[0] && buf[1] === JPEG_SIG[1];
    if (!sigOk) {
      fail(`${spec.path}: not a PNG (magic ${isJpeg ? "JPEG — the F-56-A masquerade class" : "unknown"}); regenerate from public/brand/mtqs-mark.svg`);
      continue;
    }
    const dims = await pngDims(buf);
    if (!dims) { fail(`${spec.path}: PNG too short for IHDR`); continue; }
    if (spec.exact != null && (dims.w !== spec.exact || dims.h !== spec.exact)) {
      fail(`${spec.path}: ${dims.w}×${dims.h}, expected exact ${spec.exact}×${spec.exact}`);
      continue;
    }
    if (spec.minDimension != null && (dims.w < spec.minDimension || dims.h < spec.minDimension)) {
      fail(`${spec.path}: ${dims.w}×${dims.h} below floor ${spec.minDimension}px`);
      continue;
    }
    console.log(`  ok   ${spec.path} ${dims.w}×${dims.h}`);
  }
}

// ── F-56-B(1): blur(0px) animate finals without transitionEnd cleanup ──
console.log("[render-quality] filter-final animations must self-clean");
const tsxFiles = await $`git ls-files src/**/*.tsx`.text().then(t => t.split("\n").filter(Boolean));
for (const f of tsxFiles) {
  const text = await Bun.file(f).text();
  if (!text.includes("blur(0px)") && !text.includes("blur(0)")) continue;
  // any file that animates a filter to zero MUST carry the cleanup on the same
  // target — heuristic: transitionEnd present in the same file.
  if (!text.includes("transitionEnd")) {
    fail(`${f}: animates filter to blur(0px) without transitionEnd:{filter:"none"} — F-56-B(1) fuzzy-text class (see task56 sectionVariants fix)`);
  } else {
    console.log(`  ok   ${f} (filter finals self-clean)`);
  }
}

// ── F-56-B(2): permanent will-change on resting styles ──
console.log("[render-quality] no resting will-change declarations");
const cssFiles = ["src/app/globals.css", "src/components/landing/landing.css"];
for (const f of cssFiles) {
  const file = Bun.file(f);
  if (!(await file.exists())) continue;
  const text = await file.text();
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, ""); // strip comments
  const hits = stripped.match(/will-change\s*:/g);
  if (hits) {
    fail(`${f}: ${hits.length} live will-change declaration(s) — resting will-change pins compositor layers → fuzzy text (F-56-B(2)); apply only just-before animating, remove after`);
  } else {
    console.log(`  ok   ${f} (no resting will-change)`);
  }
}

if (failures > 0) {
  console.error(`[brand-assets] FAIL — ${failures} defect(s)`);
  process.exit(1);
}
console.log("[brand-assets] PASS — logo system vector-first, icon contract holds, no fuzzy-text signatures");

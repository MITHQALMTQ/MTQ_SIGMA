// MTQΣ WCAG 2.2 contrast auditor — Task 61b continuation instrument (v4)
// Reconstructed from the Task 61b in-browser auditor (worklog 10431).
// v4: INCREMENTAL STEP MODE — the app uses zero-JS scroll-driven reveals
//     (animation-timeline: view(); .mtqs-sd-reveal) plus inline-style reveal
//     wrappers (opacity:0 + translateY(12px)), so content below the fold is
//     at opacity 0 until scrolled. The driver scrolls through each section
//     and evals this instrument at every step; only elements whose cumulative
//     opacity >= 0.5 (revealed) are measured, each exactly once (WeakSet).
//     window.__mtqsAuditFinal = true switches to the finalizing pass (also
//     runs the non-text 1.4.11 sweep, opacity-independent) and returns the
//     aggregate JSON (stored on window.__mtqsAuditLast).
// v3 fixes kept: alpha recovery a = 1-(ow-ob)/(3*255) (v2 had it inverted);
//     background-clip:text gradient text measured as FOREGROUND; gradients
//     resolved through canvas fillStyle.
// Exclusions: sr-only, script/style/template, boxes <=1px, invisible
//     (visibility/display), unrevealed (opProd < 0.5 in step mode).
// Thresholds (WCAG 2.2 AA): normal text 4.5:1; large text (>=24px, or
// >=18.66px && weight>=700) 3:1; non-text UI 3:1. Tiny text: <9px.

(() => {
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 2;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const colCache = new Map();

  function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

  function parseColor(css) {
    if (!css) return null;
    css = String(css).trim();
    if (!css || css === 'none' || css === 'transparent') return null;
    if (colCache.has(css)) return colCache.get(css);
    let out = null;
    const m = css.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
    if (m) {
      out = { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    } else if (/^#[0-9a-f]{3,8}$/i.test(css)) {
      let h = css.slice(1);
      if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
      out = {
        r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    } else {
      try {
        cx.clearRect(0, 0, 2, 2); cx.fillStyle = '#000'; cx.fillRect(0, 0, 2, 2);
        cx.fillStyle = css; cx.fillRect(0, 0, 2, 2);
        const ob = cx.getImageData(0, 0, 1, 1).data;
        cx.clearRect(0, 0, 2, 2); cx.fillStyle = '#fff'; cx.fillRect(0, 0, 2, 2);
        cx.fillStyle = css; cx.fillRect(0, 0, 2, 2);
        const ow = cx.getImageData(0, 0, 1, 1).data;
        // over-black pixel = a*c ; over-white pixel = a*c + (1-a)*255
        // => a = 1 - (ow-ob)/255   (v2 bug: used (ow-ob)/255 = 1-a)
        const alpha = 1 - ((ow[0] - ob[0]) + (ow[1] - ob[1]) + (ow[2] - ob[2])) / (3 * 255);
        if (alpha >= 0.996) {
          out = { r: ob[0], g: ob[1], b: ob[2], a: 1 };
        } else if (alpha > 0.004) {
          out = { r: clamp255(ob[0] / alpha), g: clamp255(ob[1] / alpha), b: clamp255(ob[2] / alpha), a: alpha };
        } else {
          out = null; // effectively transparent
        }
      } catch (e) { out = null; }
    }
    colCache.set(css, out);
    return out;
  }

  function splitLayers(s) {
    const parts = []; let depth = 0, cur = '';
    for (const ch of String(s)) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.filter(p => p && p !== 'none');
  }

  function parseBgImage(layerCss) {
    if (!layerCss || layerCss === 'none') return null;
    const key = 'BGIMG::' + layerCss;
    if (colCache.has(key)) return colCache.get(key);
    let out = null;
    try {
      cv.width = 64; cv.height = 64;
      cx.clearRect(0, 0, 64, 64);
      cx.fillStyle = '#000'; cx.fillRect(0, 0, 64, 64);
      cx.fillStyle = layerCss; cx.fillRect(0, 0, 64, 64);
      const ob = cx.getImageData(32, 32, 1, 1).data;
      cx.clearRect(0, 0, 64, 64);
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, 64, 64);
      cx.fillStyle = layerCss; cx.fillRect(0, 0, 64, 64);
      const ow = cx.getImageData(32, 32, 1, 1).data;
      const alpha = 1 - ((ow[0] - ob[0]) + (ow[1] - ob[1]) + (ow[2] - ob[2])) / (3 * 255);
      if (alpha >= 0.996) out = { r: ob[0], g: ob[1], b: ob[2], a: 1 };
      else if (alpha > 0.004) out = { r: clamp255(ob[0] / alpha), g: clamp255(ob[1] / alpha), b: clamp255(ob[2] / alpha), a: alpha };
      else out = null;
      if (out) { out.isImage = !/gradient/.test(layerCss); }
    } catch (e) { out = null; }
    cv.width = 2; cv.height = 2;
    colCache.set(key, out);
    return out;
  }

  function over(top, bottom) {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
      g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
      b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
      a,
    };
  }

  function lum(c) {
    const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) {
    if (!a || !b) return null;
    const l1 = lum(a), l2 = lum(b);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  const hex = c => '#' + [c.r, c.g, c.b].map(v => clamp255(v).toString(16).padStart(2, '0')).join('') + (c.a < 1 ? ' a' + c.a.toFixed(2) : '');

  // opacity product over the ancestor chain (reveal animations included)
  function opacityProduct(el) {
    let p = 1, n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      const o = cs.opacity === '' ? 1 : parseFloat(cs.opacity);
      p *= isFinite(o) ? o : 1;
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      n = n.parentElement;
    }
    return p;
  }

  // Effective background walk. ignoreOpacity: non-text 1.4.11 pass measures
  // DESIGN contrast (reveal fades are transient motion, not the resting
  // state) — layer alphas then exclude element opacity.
  function effectiveBg(el, skipSelf, ignoreOpacity) {
    const chain = [];
    let node = skipSelf && el.parentElement ? el.parentElement : el, notes = [];
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.visibility === 'hidden' || cs.display === 'none') return { bg: null, notes };
      const op = cs.opacity === '' ? 1 : parseFloat(cs.opacity);
      chain.push({ el: node, cs, op });
      node = node.parentElement;
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (const rootEl of [document.documentElement, document.body]) {
      if (!rootEl) continue;
      const c = parseColor(getComputedStyle(rootEl).backgroundColor);
      if (c && c.a > 0) acc = over(c, acc);
    }
    let cumOp = 1;
    for (let i = chain.length - 1; i >= 0; i--) {
      const { cs, op } = chain[i];
      cumOp *= (isFinite(op) ? op : 1);
      const layerOp = ignoreOpacity ? 1 : cumOp;
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) {
        acc = over({ r: c.r, g: c.g, b: c.b, a: c.a * layerOp }, acc);
      }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        for (const layer of splitLayers(cs.backgroundImage)) {
          const g = parseBgImage(layer);
          if (g && g.a > 0 && !g.isImage) {
            acc = over({ r: g.r, g: g.g, b: g.b, a: g.a * layerOp }, acc);
            notes.push('gradient');
          }
        }
      }
    }
    return { bg: acc, notes };
  }

  function isSrOnly(el) {
    const cs = getComputedStyle(el);
    if (el.classList && el.classList.contains('sr-only')) return true;
    const r = el.getBoundingClientRect();
    if (cs.position === 'absolute' && (r.left <= -9000 || r.top <= -9000)) return true;
    if (cs.clipPath && /inset\(50%/.test(cs.clipPath)) return true;
    if ((cs.width === '1px' || cs.height === '1px') && cs.overflow === 'hidden') {
      if (cs.position === 'absolute') return true;
    }
    return false;
  }

  function weightNum(w) {
    if (w === 'bold') return 700;
    const n = parseInt(w, 10);
    return isFinite(n) ? n : 400;
  }

  const FINAL = !!window.__mtqsAuditFinal;
  if (!window.__mtqsAudit) {
    window.__mtqsAudit = {
      section: window.__mtqsAuditSection || 'unknown',
      nodes: 0, flags: [], tiny: [],
      nonText: { checked: 0, flags: [] },
      seen: new WeakSet(),
    };
  }
  const A = window.__mtqsAudit;
  if (A.section !== (window.__mtqsAuditSection || 'unknown')) {
    // section changed without explicit reset — reinit defensively
    window.__mtqsAudit = {
      section: window.__mtqsAuditSection || 'unknown',
      nodes: 0, flags: [], tiny: [],
      nonText: { checked: 0, flags: [] },
      seen: new WeakSet(),
    };
  }
  const R = window.__mtqsAudit;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = walker.nextNode())) {
    const raw = tn.textContent;
    if (!raw || !raw.trim()) continue;
    const el = tn.parentElement;
    if (!el) continue;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'NOSCRIPT') continue;
    if (R.seen.has(el)) continue;
    if (isSrOnly(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const opProd = opacityProduct(el);
    // v4.1: only measure FULLY revealed, fully settled elements — mid-reveal
    // (scroll-driven animation at 0.5-0.9) and mid-pulse states are transient
    // motion, not the resting design state. Requires the box to be fully
    // inside the viewport (past the reveal timeline's entry range).
    if (opProd < 0.95) continue;
    if (r.top < -8 || r.bottom > innerHeight + 8 || r.left < -8 || r.right > innerWidth + 8) continue;

    R.seen.add(el);
    R.nodes++;
    const fontSize = parseFloat(cs.fontSize) || 0;
    const weight = weightNum(cs.fontWeight);
    const clipText = (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text');
    // SVG <text> glyphs are painted by `fill`, not `color` — read the
    // computed fill first (falls back to color when fill is none/absent).
    let fg = null;
    if (el instanceof SVGElement) {
      const fill = cs.fill;
      if (fill && fill !== 'none') fg = parseColor(fill);
    }
    if (!fg) fg = parseColor(cs.color);
    const ebg = effectiveBg(el, clipText, false);
    let gradNote = false;
    if (clipText) {
      let gAcc = null;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        for (const layer of splitLayers(cs.backgroundImage)) {
          const g = parseBgImage(layer);
          if (g && g.a > 0) { gAcc = gAcc ? over(gAcc, g) : g; gradNote = true; }
        }
      }
      if (gAcc) fg = gAcc; else fg = null;
    }
    if (!fg || !ebg.bg) continue;
    const fgEff = opProd < 1 ? over({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * opProd }, ebg.bg) : fg;
    const ratio = contrast(fgEff, ebg.bg);
    if (ratio === null || !isFinite(ratio)) continue;
    const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
    const thr = large ? 3.0 : 4.5;
    const rec = () => ({
      t: raw.trim().slice(0, 48), fg: hex(fgEff), bg: hex(ebg.bg) + (ebg.notes.length ? '+' + [...new Set(ebg.notes)].join('/') : '') + (gradNote ? '+gtext' : ''),
      r: +ratio.toFixed(2), fs: +fontSize.toFixed(1), w: weight, large,
      cat: large ? 'large' : 'normal',
      sec: R.section, tag, cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 90),
    });
    if (ratio < thr) R.flags.push(rec());
    if (fontSize < 9) R.tiny.push(rec());
  }

  let summary = null;
  if (FINAL) {
    // Non-text 1.4.11 pass — design-state contrast (opacity-independent).
    const inter = document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    for (const el of inter) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const bgc = parseColor(cs.backgroundColor);
      const solid = bgc && bgc.a >= 0.85;
      let indicator = null;
      if (!solid) {
        const bw = parseFloat(cs.borderTopWidth) || 0;
        const bc = parseColor(cs.borderTopColor) || parseColor(cs.borderColor);
        if (bw >= 1 && bc && bc.a > 0.3) indicator = { kind: 'border', c: bc };
      }
      if (!indicator) {
        const svg = el.querySelector(':scope > svg, :scope > span > svg');
        if (svg) {
          const scs = getComputedStyle(svg);
          let fc = parseColor(scs.color);
          if (!fc || fc.a === 0) {
            const pth = svg.querySelector('path,circle,rect,line,polygon');
            if (pth) {
              const pcs = getComputedStyle(pth);
              fc = parseColor(pcs.fill) || parseColor(pcs.stroke) || parseColor(pcs.color);
            }
          }
          if (fc && fc.a > 0.3) indicator = { kind: 'icon', c: fc };
        }
      }
      if (!indicator) continue;
      R.nonText.checked++;
      const ebg = effectiveBg(el, false, true);
      if (!ebg.bg) continue;
      const ratio = contrast(indicator.c, ebg.bg);
      if (ratio !== null && isFinite(ratio) && ratio < 3.0) {
        R.nonText.flags.push({
          t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 36),
          kind: indicator.kind, fg: hex(indicator.c), bg: hex(ebg.bg), r: +ratio.toFixed(2),
          sec: R.section, cls: String(el.className).slice(0, 80),
        });
      }
    }
    const clone = { section: R.section, nodes: R.nodes, flags: R.flags, tiny: R.tiny, nonText: R.nonText };
    window.__mtqsAuditLast = clone;
    summary = {
      section: R.section, nodes: R.nodes,
      flagCount: R.flags.length,
      below36: R.flags.filter(f => f.r < 3.6).length,
      band36_45: R.flags.filter(f => !f.large && f.r >= 3.6 && f.r < 4.5).length,
      largeFail: R.flags.filter(f => f.large).length,
      tiny: R.tiny.length,
      nonTextChecked: R.nonText.checked, nonTextFlags: R.nonText.flags.length,
    };
    window.__mtqsAuditFinal = false;
  } else {
    summary = { section: R.section, stepNodes: R.nodes, stepFlags: R.flags.length };
  }
  return JSON.stringify(summary);
})()

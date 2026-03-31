const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const debounce = (f, wait, immediate) => {
  let timeout;
  return (...args) => {
    const later = () => {
      timeout = null;
      if (!immediate) f(...args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) f(...args);
  };
};

const lerp = (min, max, x) => x * (max - min) + min;
// Smooth cubic bezier approximation — feels like a natural page glide
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

// ═══════════════════════════════════════════════════════════════
// Page Curl Effect — Canvas 2D simulated page turn
// ═══════════════════════════════════════════════════════════════
class PageCurlEffect {
  #canvas;
  #ctx;
  #width = 0;
  #height = 0;
  #active = false;
  #direction = 1; // 1 = forward (next), -1 = backward (prev)
  #progress = 0; // 0 = flat, 1 = fully turned
  #cornerX = 0;
  #cornerY = 0;
  #animationId = null;
  #onComplete = null;
  #capturedCurrentPage = null;
  #capturedNextPage = null;
  #bgColor = '#1c1c1e';

  constructor(container) {
    this.#canvas = document.createElement('canvas');
    Object.assign(this.#canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '1000',
      pointerEvents: 'none',
      display: 'none',
    });
    container.appendChild(this.#canvas);
    this.#ctx = this.#canvas.getContext('2d');
  }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.#width = width;
    this.#height = height;
    this.#canvas.width = width * dpr;
    this.#canvas.height = height * dpr;
    this.#canvas.style.width = width + 'px';
    this.#canvas.style.height = height + 'px';
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  set bgColor(color) {
    this.#bgColor = color || '#1c1c1e';
  }

  get active() { return this.#active; }

  // Capture the current visible page as an image
  async capturePages(container, direction) {
    this.#direction = direction;
    const w = this.#width;
    const h = this.#height;

    // We'll render simplified colored rectangles as page bitmaps
    // The actual content is shown underneath; the curl canvas overlays
    // to create the illusion of a page lifting
    this.#capturedCurrentPage = { width: w, height: h };
    this.#capturedNextPage = { width: w, height: h };
  }

  start(touchX, touchY, direction, onComplete) {
    this.#active = true;
    this.#direction = direction;
    this.#onComplete = onComplete;
    this.#canvas.style.display = 'block';
    this.#canvas.style.pointerEvents = 'auto';

    // Initialize corner position at touch point
    this.#cornerX = touchX;
    this.#cornerY = touchY;
    this.#progress = 0;

    this.#draw();
  }

  update(touchX, touchY) {
    if (!this.#active) return;
    this.#cornerX = touchX;
    this.#cornerY = touchY;

    const w = this.#width;
    // Calculate progress based on how far the corner has moved
    if (this.#direction === 1) {
      // Forward: from right edge to left
      this.#progress = Math.max(0, Math.min(1, (w - touchX) / w));
    } else {
      // Backward: from left edge to right
      this.#progress = Math.max(0, Math.min(1, touchX / w));
    }

    this.#draw();
  }

  // Animate to completion or snap back
  async finish(velocity) {
    if (!this.#active) return false;

    const shouldComplete = this.#progress > 0.3 || Math.abs(velocity) > 0.3;
    const targetProgress = shouldComplete ? 1 : 0;

    return new Promise((resolve) => {
      const startProgress = this.#progress;
      const startCornerX = this.#cornerX;
      const w = this.#width;
      const duration = 300;
      let startTime = null;

      const step = (now) => {
        startTime ??= now;
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic

        this.#progress = startProgress + (targetProgress - startProgress) * eased;

        // Update corner position
        if (this.#direction === 1) {
          this.#cornerX = w - this.#progress * w;
        } else {
          this.#cornerX = this.#progress * w;
        }

        this.#draw();

        if (t < 1) {
          this.#animationId = requestAnimationFrame(step);
        } else {
          this.#cleanup();
          resolve(shouldComplete);
        }
      };

      this.#animationId = requestAnimationFrame(step);
    });
  }

  cancel() {
    if (this.#animationId) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }
    this.#cleanup();
  }

  #cleanup() {
    this.#active = false;
    this.#progress = 0;
    this.#canvas.style.display = 'none';
    this.#canvas.style.pointerEvents = 'none';
    this.#ctx.clearRect(0, 0, this.#width, this.#height);
    this.#capturedCurrentPage = null;
    this.#capturedNextPage = null;
  }

  #draw() {
    const ctx = this.#ctx;
    const w = this.#width;
    const h = this.#height;
    const progress = this.#progress;
    const dir = this.#direction;

    ctx.clearRect(0, 0, w, h);

    if (progress <= 0.001) return;

    // ── Calculate curl geometry ──
    // The "fold line" is where the page bends
    // Corner being dragged
    const cx = this.#cornerX;
    const cy = this.#cornerY;

    // The page curls from the edge
    const edgeX = dir === 1 ? w : 0;
    const midX = (cx + edgeX) / 2;

    // Fold line angle
    const angle = Math.atan2(cy - h / 2, cx - edgeX);
    const foldAngle = angle / 2;

    // ── Draw the shadow under the curling page ──
    ctx.save();
    const shadowWidth = Math.min(60, progress * 80);
    const shadowX = dir === 1 ? cx - shadowWidth : cx;

    const shadowGrad = ctx.createLinearGradient(
      dir === 1 ? cx - shadowWidth : cx,
      0,
      dir === 1 ? cx + 5 : cx + shadowWidth,
      0,
    );
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
    shadowGrad.addColorStop(0.5, `rgba(0,0,0,${0.3 * progress})`);
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = shadowGrad;
    ctx.fillRect(shadowX, 0, shadowWidth + 5, h);
    ctx.restore();

    // ── Draw the curled page (back side) ──
    ctx.save();

    // The visible "back" of the curled page
    const curlWidth = Math.abs(edgeX - cx);
    const backWidth = Math.min(curlWidth, w * 0.45);

    if (backWidth > 2) {
      const backX = dir === 1 ? cx : cx - backWidth;

      // Clip to the curl region
      ctx.beginPath();
      ctx.moveTo(backX, 0);
      ctx.lineTo(backX + backWidth, 0);
      ctx.lineTo(backX + backWidth, h);
      ctx.lineTo(backX, h);
      ctx.closePath();
      ctx.clip();

      // Page back color (slightly darker to simulate the back of paper)
      const pageBg = this.#bgColor;
      ctx.fillStyle = this.#adjustBrightness(pageBg, -15);
      ctx.fillRect(backX, 0, backWidth, h);

      // Add a subtle gradient for the curl effect (3D illusion)
      const curlGrad = ctx.createLinearGradient(backX, 0, backX + backWidth, 0);
      if (dir === 1) {
        curlGrad.addColorStop(0, 'rgba(0,0,0,0.08)');
        curlGrad.addColorStop(0.3, 'rgba(255,255,255,0.05)');
        curlGrad.addColorStop(0.7, 'rgba(255,255,255,0.02)');
        curlGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
      } else {
        curlGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
        curlGrad.addColorStop(0.3, 'rgba(255,255,255,0.02)');
        curlGrad.addColorStop(0.7, 'rgba(255,255,255,0.05)');
        curlGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
      }
      ctx.fillStyle = curlGrad;
      ctx.fillRect(backX, 0, backWidth, h);

      // Draw subtle horizontal lines to simulate paper texture
      ctx.strokeStyle = `rgba(128,128,128,${0.04 * progress})`;
      ctx.lineWidth = 0.5;
      for (let y = 30; y < h; y += 28) {
        ctx.beginPath();
        ctx.moveTo(backX + 10, y);
        ctx.lineTo(backX + backWidth - 10, y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── Edge highlight (the fold crease) ──
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * progress})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner shadow along the fold
    const innerShadowW = Math.min(15, progress * 20);
    const innerGrad = ctx.createLinearGradient(
      dir === 1 ? cx : cx - innerShadowW,
      0,
      dir === 1 ? cx + innerShadowW : cx,
      0,
    );
    if (dir === 1) {
      innerGrad.addColorStop(0, `rgba(0,0,0,${0.2 * progress})`);
      innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      innerGrad.addColorStop(0, 'rgba(0,0,0,0)');
      innerGrad.addColorStop(1, `rgba(0,0,0,${0.2 * progress})`);
    }
    ctx.fillStyle = innerGrad;
    ctx.fillRect(
      dir === 1 ? cx : cx - innerShadowW,
      0,
      innerShadowW,
      h,
    );
    ctx.restore();
  }

  #adjustBrightness(color, amount) {
    // Parse hex or rgb color and adjust brightness
    let r, g, b;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      r = parseInt(hex.substr(0, 2), 16) || 0;
      g = parseInt(hex.substr(2, 2), 16) || 0;
      b = parseInt(hex.substr(4, 2), 16) || 0;
    } else if (color.startsWith('rgb')) {
      const m = color.match(/(\d+)/g);
      if (m) { r = +m[0]; g = +m[1]; b = +m[2]; }
      else { r = g = b = 28; }
    } else {
      r = g = b = 28;
    }
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    return `rgb(${r},${g},${b})`;
  }

  destroy() {
    this.cancel();
    this.#canvas.remove();
  }
}

const animate = (a, b, duration, ease, render) =>
  new Promise((resolve) => {
    let start;
    const step = (now) => {
      if (document.hidden) {
        render(lerp(a, b, 1));
        return resolve();
      }
      start ??= now;
      const fraction = Math.min(1, (now - start) / duration);
      render(lerp(a, b, ease(fraction)));
      if (fraction < 1) requestAnimationFrame(step);
      else resolve();
    };
    if (document.hidden) {
      render(lerp(a, b, 1));
      return resolve();
    }
    requestAnimationFrame(step);
  });

// collapsed range doesn't return client rects sometimes (or always?)
// try make get a non-collapsed range or element
const uncollapse = (range) => {
  if (!range?.collapsed) return range;
  const { endOffset, endContainer } = range;
  if (endContainer.nodeType === 1) {
    const node = endContainer.childNodes[endOffset];
    if (node?.nodeType === 1) return node;
    return endContainer;
  }
  if (endOffset + 1 < endContainer.length) range.setEnd(endContainer, endOffset + 1);
  else if (endOffset > 1) range.setStart(endContainer, endOffset - 1);
  else return endContainer.parentNode;
  return range;
};

const makeRange = (doc, node, start, end = start) => {
  const range = doc.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
};

// use binary search to find an offset value in a text node
const bisectNode = (doc, node, cb, start = 0, end = node.nodeValue.length) => {
  if (end - start === 1) {
    const result = cb(makeRange(doc, node, start), makeRange(doc, node, end));
    return result < 0 ? start : end;
  }
  const mid = Math.floor(start + (end - start) / 2);
  const result = cb(makeRange(doc, node, start, mid), makeRange(doc, node, mid, end));
  return result < 0 ? bisectNode(doc, node, cb, start, mid) : result > 0 ? bisectNode(doc, node, cb, mid, end) : mid;
};

const { SHOW_ELEMENT, SHOW_TEXT, SHOW_CDATA_SECTION, FILTER_ACCEPT, FILTER_REJECT, FILTER_SKIP } = NodeFilter;

const filter = SHOW_ELEMENT | SHOW_TEXT | SHOW_CDATA_SECTION;

// needed cause there seems to be a bug in `getBoundingClientRect()` in Firefox
// where it fails to include rects that have zero width and non-zero height
// (CSSOM spec says "rectangles [...] of which the height or width is not zero")
// which makes the visible range include an extra space at column boundaries
const getBoundingClientRect = (target) => {
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const rect of target.getClientRects()) {
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  return new DOMRect(left, top, right - left, bottom - top);
};

const getVisibleRange = (doc, start, end, mapRect) => {
  // first get all visible nodes
  const acceptNode = (node) => {
    const name = node.localName?.toLowerCase();
    // ignore all scripts, styles, and their children
    if (name === "script" || name === "style") return FILTER_REJECT;
    if (node.nodeType === 1) {
      const { left, right } = mapRect(node.getBoundingClientRect());
      // no need to check child nodes if it's completely out of view
      if (right < start || left > end) return FILTER_REJECT;
      // elements must be completely in view to be considered visible
      // because you can't specify offsets for elements
      if (left >= start && right <= end) return FILTER_ACCEPT;
      // TODO: it should probably allow elements that do not contain text
      // because they can exceed the whole viewport in both directions
      // especially in scrolled mode
    } else {
      // ignore empty text nodes
      if (!node.nodeValue?.trim()) return FILTER_SKIP;
      // create range to get rect
      const range = doc.createRange();
      range.selectNodeContents(node);
      const { left, right } = mapRect(range.getBoundingClientRect());
      // it's visible if any part of it is in view
      if (right >= start && left <= end) return FILTER_ACCEPT;
    }
    return FILTER_SKIP;
  };
  const walker = doc.createTreeWalker(doc.body, filter, { acceptNode });
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);

  // we're only interested in the first and last visible nodes
  const from = nodes[0] ?? doc.body;
  const to = nodes[nodes.length - 1] ?? from;

  // find the offset at which visibility changes
  const startOffset =
    from.nodeType === 1
      ? 0
      : bisectNode(doc, from, (a, b) => {
        const p = mapRect(getBoundingClientRect(a));
        const q = mapRect(getBoundingClientRect(b));
        if (p.right < start && q.left > start) return 0;
        return q.left > start ? -1 : 1;
      });
  const endOffset =
    to.nodeType === 1
      ? 0
      : bisectNode(doc, to, (a, b) => {
        const p = mapRect(getBoundingClientRect(a));
        const q = mapRect(getBoundingClientRect(b));
        if (p.right < end && q.left > end) return 0;
        return q.left > end ? -1 : 1;
      });

  const range = doc.createRange();
  range.setStart(from, startOffset);
  range.setEnd(to, endOffset);
  return range;
};

const selectionIsBackward = (sel) => {
  const range = document.createRange();
  range.setStart(sel.anchorNode, sel.anchorOffset);
  range.setEnd(sel.focusNode, sel.focusOffset);
  return range.collapsed;
};

const setSelectionTo = (target, collapse) => {
  let range;
  if (target.startContainer) range = target.cloneRange();
  else if (target.nodeType) {
    range = document.createRange();
    range.selectNode(target);
  }
  if (range) {
    const sel = range.startContainer.ownerDocument.defaultView.getSelection();
    if (sel) {
      sel.removeAllRanges();
      if (collapse === -1) range.collapse(true);
      else if (collapse === 1) range.collapse();
      sel.addRange(range);
    }
  }
};

const getDirection = (doc) => {
  const { defaultView } = doc;
  const { writingMode, direction } = defaultView.getComputedStyle(doc.body);
  const vertical = writingMode === "vertical-rl" || writingMode === "vertical-lr";
  const rtl = doc.body.dir === "rtl" || direction === "rtl" || doc.documentElement.dir === "rtl";
  return { vertical, rtl };
};

const getBackground = (doc) => {
  const bodyStyle = doc.defaultView.getComputedStyle(doc.body);
  return bodyStyle.backgroundColor === "rgba(0, 0, 0, 0)" && bodyStyle.backgroundImage === "none"
    ? doc.defaultView.getComputedStyle(doc.documentElement).background
    : bodyStyle.background;
};

const makeMarginals = (length, part) =>
  Array.from({ length }, () => {
    const div = document.createElement("div");
    const child = document.createElement("div");
    div.append(child);
    child.setAttribute("part", part);
    return div;
  });

const setStylesImportant = (el, styles) => {
  const { style } = el;
  for (const [k, v] of Object.entries(styles)) style.setProperty(k, v, "important");
};

class View {
  #expandTimer = null;
  #debouncedExpand = () => {
    if (this.#expandTimer) clearTimeout(this.#expandTimer);
    this.#expandTimer = setTimeout(() => this.expand(), 100);
  };
  #observer = new ResizeObserver(() => this.#debouncedExpand());
  #element = document.createElement("div");
  #iframe = document.createElement("iframe");
  #contentRange = document.createRange();
  #overlayer;
  #vertical = false;
  #rtl = false;
  #column = true;
  #size;
  #layout = {};
  constructor({ container, onExpand }) {
    this.container = container;
    this.onExpand = onExpand;
    this.#iframe.setAttribute("part", "filter");
    this.#element.append(this.#iframe);
    Object.assign(this.#element.style, {
      boxSizing: "content-box",
      position: "relative",
      overflow: "hidden",
      flex: "0 0 auto",
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    });
    Object.assign(this.#iframe.style, {
      overflow: "hidden",
      border: "0",
      display: "none",
      width: "100%",
      height: "100%",
    });
    // `allow-scripts` is needed for events because of WebKit bug
    // https://bugs.webkit.org/show_bug.cgi?id=218086
    this.#iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
    this.#iframe.setAttribute("scrolling", "no");
  }
  get element() {
    return this.#element;
  }
  get document() {
    return this.#iframe.contentDocument;
  }
  async load(src, afterLoad, beforeRender) {
    if (typeof src !== "string") throw new Error(`${src} is not string`);
    return new Promise((resolve) => {
      this.#iframe.addEventListener(
        "load",
        () => {
          const doc = this.document;
          afterLoad?.(doc);

          // it needs to be visible for Firefox to get computed style
          this.#iframe.style.display = "block";
          const { vertical, rtl } = getDirection(doc);
          const background = getBackground(doc);
          this.#iframe.style.display = "none";

          this.#vertical = vertical;
          this.#rtl = rtl;

          this.#contentRange.selectNodeContents(doc.body);
          const layout = beforeRender?.({ vertical, rtl, background });
          this.#iframe.style.display = "block";
          this.render(layout);
          this.#observer.observe(doc.body);

          // the resize observer above doesn't work in Firefox
          // (see https://bugzilla.mozilla.org/show_bug.cgi?id=1832939)
          // until the bug is fixed we can at least account for font load
          doc.fonts.ready.then(() => this.expand());

          resolve();
        },
        { once: true },
      );
      this.#iframe.src = src;
    });
  }
  render(layout) {
    if (!layout) return;
    this.#column = layout.flow !== "scrolled";
    this.#layout = layout;
    if (this.#column) this.columnize(layout);
    else this.scrolled(layout);
  }
  scrolled({ gap, columnWidth }) {
    const vertical = this.#vertical;
    const doc = this.document;
    if (!doc?.documentElement) return;
    setStylesImportant(doc.documentElement, {
      "box-sizing": "border-box",
      padding: vertical ? `${gap}px 0` : `0 ${gap}px`,
      "column-width": "auto",
      height: "auto",
      width: "auto",
    });
    setStylesImportant(doc.body, {
      [vertical ? "max-height" : "max-width"]: `${columnWidth}px`,
      margin: "auto",
    });
    this.setImageSize();
    this.expand();
  }
  columnize({ width, height, gap, columnWidth }) {
    const vertical = this.#vertical;
    this.#size = vertical ? height : width;

    const doc = this.document;
    if (!doc || !doc.documentElement) return;
    setStylesImportant(doc.documentElement, {
      "box-sizing": "border-box",
      "column-width": `${Math.trunc(columnWidth)}px`,
      "column-gap": `${gap}px`,
      "column-fill": "auto",
      ...(vertical ? { width: `${width}px` } : { height: `${height}px` }),
      padding: vertical ? `${gap / 2}px 0` : `0 ${gap / 2}px`,
      overflow: "hidden",
      // force wrap long words
      "overflow-wrap": "break-word",
      // reset some potentially problematic props
      position: "static",
      border: "0",
      margin: "0",
      "max-height": "none",
      "max-width": "none",
      "min-height": "none",
      "min-width": "none",
      // fix glyph clipping in WebKit
      "-webkit-line-box-contain": "block glyphs replaced",
    });
    setStylesImportant(doc.body, {
      "max-height": "none",
      "max-width": "none",
      margin: "0",
    });
    this.setImageSize();
    this.expand();
  }
  setImageSize() {
    const { width, height, margin } = this.#layout;
    const vertical = this.#vertical;
    const doc = this.document;
    for (const el of doc.body.querySelectorAll("img, svg, video")) {
      // preserve max size if they are already set
      const { maxHeight, maxWidth } = doc.defaultView.getComputedStyle(el);
      setStylesImportant(el, {
        "max-height": vertical
          ? maxHeight !== "none" && maxHeight !== "0px"
            ? maxHeight
            : "100%"
          : `${height - margin * 2}px`,
        "max-width": vertical
          ? `${width - margin * 2}px`
          : maxWidth !== "none" && maxWidth !== "0px"
            ? maxWidth
            : "100%",
        "object-fit": "contain",
        "page-break-inside": "avoid",
        "break-inside": "avoid",
        "box-sizing": "border-box",
      });
    }
  }
  expand() {
    if (!this.document) return;
    const { documentElement } = this.document;
    if (this.#column) {
      const side = this.#vertical ? "height" : "width";
      const otherSide = this.#vertical ? "width" : "height";
      const contentRect = this.#contentRange.getBoundingClientRect();
      const rootRect = documentElement.getBoundingClientRect();
      // offset caused by column break at the start of the page
      // which seem to be supported only by WebKit and only for horizontal writing
      const contentStart = this.#vertical
        ? 0
        : this.#rtl
          ? rootRect.right - contentRect.right
          : contentRect.left - rootRect.left;
      const contentSize = contentStart + contentRect[side];
      const pageCount = Math.ceil(contentSize / this.#size);
      const expandedSize = pageCount * this.#size;
      this.#element.style.padding = "0";
      this.#iframe.style[side] = `${expandedSize}px`;
      this.#element.style[side] = `${expandedSize + this.#size * 2}px`;
      this.#iframe.style[otherSide] = "100%";
      this.#element.style[otherSide] = "100%";
      documentElement.style[side] = `${this.#size}px`;
      if (this.#overlayer) {
        this.#overlayer.element.style.margin = "0";
        this.#overlayer.element.style.left = this.#vertical ? "0" : `${this.#size}px`;
        this.#overlayer.element.style.top = this.#vertical ? `${this.#size}px` : "0";
        this.#overlayer.element.style[side] = `${expandedSize}px`;
        this.#overlayer.redraw();
      }
    } else {
      const side = this.#vertical ? "width" : "height";
      const otherSide = this.#vertical ? "height" : "width";
      const contentSize = documentElement.getBoundingClientRect()[side];
      const expandedSize = contentSize;
      const { margin } = this.#layout;
      const padding = this.#vertical ? `0 ${margin}px` : `${margin}px 0`;
      this.#element.style.padding = padding;
      this.#iframe.style[side] = `${expandedSize}px`;
      this.#element.style[side] = `${expandedSize}px`;
      this.#iframe.style[otherSide] = "100%";
      this.#element.style[otherSide] = "100%";
      if (this.#overlayer) {
        this.#overlayer.element.style.margin = padding;
        this.#overlayer.element.style.left = "0";
        this.#overlayer.element.style.top = "0";
        this.#overlayer.element.style[side] = `${expandedSize}px`;
        this.#overlayer.redraw();
      }
    }
    this.onExpand();
  }
  set overlayer(overlayer) {
    this.#overlayer = overlayer;
    this.#element.append(overlayer.element);
  }
  get overlayer() {
    return this.#overlayer;
  }
  destroy() {
    if (this.#expandTimer) clearTimeout(this.#expandTimer);
    if (this.document) this.#observer.unobserve(this.document.body);
  }
}

// NOTE: everything here assumes the so-called "negative scroll type" for RTL
export class Paginator extends HTMLElement {
  static observedAttributes = ["flow", "gap", "margin", "max-inline-size", "max-block-size", "max-column-count"];
  #root = this.attachShadow({ mode: "closed" });
  #renderTimeout = null;  // 添加节流定时器
  #observer = new ResizeObserver(() => this.#throttledRender());
  #top;
  #background;
  #container;
  // removed header/footer; managed externally in React
  #view;
  #vertical = false;
  #rtl = false;
  #margin = 0;
  #index = -1;
  #anchor = 0; // anchor view to a fraction (0-1), Range, or Element
  #justAnchored = false;
  #locked = false; // while true, prevent any further navigation
  #navigationLocked = false; // public flag: when true, disables touch/swipe page turns
  #styles;
  #styleMap = new WeakMap();
  #mediaQuery = matchMedia("(prefers-color-scheme: dark)");
  #mediaQueryListener;
  #scrollBounds;
  #touchState;
  #touchScrolled;
  #lastVisibleRange;
  #visibleRangeCache = { start: null, end: null, index: null, range: null };
  // ── Page curl effect ──
  #pageTurnStyle = 'slide'; // 'slide' | 'curl' | 'none'
  #curlEffect = null;
  #curlTouchState = null; // track curl-specific touch data
  constructor() {
    super();
    this.#root.innerHTML = `<style>
        *::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        *::-webkit-scrollbar-thumb {
            background: #afb0b3;
            border-radius: 10px;
        }

        *::-webkit-scrollbar-track {
            background: 0 0;
        }
            
        :host {
            display: block;
            container-type: size;
        }
        :host, #top {
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            width: 100%;
            height: 100%;
        }
        #top {
            --_gap: 7%;
            --_max-inline-size: 720px;
            --_max-block-size: 1440px;
            --_max-column-count: 2;
            --_max-column-count-portrait: 1;
            --_max-column-count-spread: var(--_max-column-count);
            --_half-gap: calc(var(--_gap) / 2);
            --_max-width: calc(var(--_max-inline-size) * var(--_max-column-count-spread));
            --_max-height: var(--_max-block-size);
            display: grid;
            grid-template-columns:
                minmax(var(--_half-gap), 1fr)
                var(--_half-gap)
                minmax(0, calc(var(--_max-width) - var(--_gap)))
                var(--_half-gap)
                minmax(var(--_half-gap), 1fr);
            grid-template-rows: minmax(0, var(--_max-height));
            &.vertical {
                --_max-column-count-spread: var(--_max-column-count-portrait);
                --_max-width: var(--_max-block-size);
                --_max-height: calc(var(--_max-inline-size) * var(--_max-column-count-spread));
            }
            @container (orientation: portrait) {
                & {
                    --_max-column-count-spread: var(--_max-column-count-portrait);
                }
                &.vertical {
                    --_max-column-count-spread: var(--_max-column-count);
                }
            }
        }
        #background {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
        }
        #container {
            grid-column: 2 / 5;
            grid-row: 1;
            overflow: hidden;
        }
        :host([flow="scrolled"]) #container {
            grid-column: 1 / -1;
            grid-row: 1 / -1;
            overflow: auto;
        }
        /* header/footer removed; spacing handled by host app */
        </style>
        <div id="top">
            <div id="background" part="filter"></div>
            <div id="container"></div>
        </div>
        `;

    this.#top = this.#root.getElementById("top");
    this.#background = this.#root.getElementById("background");
    this.#container = this.#root.getElementById("container");
    // header/footer elements removed

    this.#observer.observe(this.#container);
    this.#container.addEventListener("scroll", () => this.dispatchEvent(new Event("scroll")));
    this.#container.addEventListener(
      "scroll",
      debounce(() => {
        if (this.scrolled) {
          if (this.#justAnchored) this.#justAnchored = false;
          else this.#afterScroll("scroll");
        }
      }, 250),
    );

    const opts = { passive: false };
    this.addEventListener("touchstart", this.#onTouchStart.bind(this), opts);
    this.addEventListener("touchmove", this.#onTouchMove.bind(this), opts);
    this.addEventListener("touchend", this.#onTouchEnd.bind(this));
    this.addEventListener("load", ({ detail: { doc } }) => {
      doc.addEventListener("touchstart", this.#onTouchStart.bind(this), opts);
      doc.addEventListener("touchmove", this.#onTouchMove.bind(this), opts);
      doc.addEventListener("touchend", this.#onTouchEnd.bind(this));
    });

    this.addEventListener("relocate", ({ detail }) => {
      if (detail.reason === "selection") setSelectionTo(this.#anchor, 0);
      else if (detail.reason === "navigation") {
        if (this.#anchor === 1) setSelectionTo(detail.range, 1);
        else if (typeof this.#anchor === "number") setSelectionTo(detail.range, -1);
        else setSelectionTo(this.#anchor, -1);
      }
    });
    const checkPointerSelection = debounce((range, sel) => {
      if (this.#navigationLocked) return;
      if (!sel.rangeCount) return;
      const selRange = sel.getRangeAt(0);
      const backward = selectionIsBackward(sel);
      if (backward && selRange.compareBoundaryPoints(Range.START_TO_START, range) < 0) this.prev();
      else if (!backward && selRange.compareBoundaryPoints(Range.END_TO_END, range) > 0) this.next();
    }, 700);
    this.addEventListener("load", ({ detail: { doc } }) => {
      let isPointerSelecting = false;
      doc.addEventListener("pointerdown", () => (isPointerSelecting = true));
      doc.addEventListener("pointerup", () => (isPointerSelecting = false));
      let isKeyboardSelecting = false;
      doc.addEventListener("keydown", () => (isKeyboardSelecting = true));
      doc.addEventListener("keyup", () => (isKeyboardSelecting = false));
      doc.addEventListener("selectionchange", () => {
        if (this.scrolled) return;
        const range = this.#lastVisibleRange;
        if (!range) return;
        const sel = doc.getSelection();
        if (!sel.rangeCount) return;
        if (isPointerSelecting && sel.type === "Range") checkPointerSelection(range, sel);
        else if (isKeyboardSelecting) {
          const selRange = sel.getRangeAt(0).cloneRange();
          const backward = selectionIsBackward(sel);
          if (!backward) selRange.collapse();
          this.#scrollToAnchor(selRange);
        }
      });
      doc.addEventListener("focusin", (e) =>
        this.scrolled
          ? null
          : // NOTE: `requestAnimationFrame` is needed in WebKit
          requestAnimationFrame(() => this.#scrollToAnchor(e.target)),
      );
    });

    this.#mediaQueryListener = () => {
      if (!this.#view) return;
      this.#background.style.background = getBackground(this.#view.document);
    };
    this.#mediaQuery.addEventListener("change", this.#mediaQueryListener);

    // Initialize page curl effect (inside shadow DOM)
    this.#curlEffect = new PageCurlEffect(this.#top);
  }
  disconnectedCallback() {
    // 清理节流定时器，避免内存泄漏
    if (this.#renderTimeout) {
      clearTimeout(this.#renderTimeout);
      this.#renderTimeout = null;
    }
    if (this.#curlEffect) {
      this.#curlEffect.destroy();
      this.#curlEffect = null;
    }
  }
  /** Page turn style: 'slide' (default scrollLeft animation), 'curl' (page curl effect), 'none' (instant) */
  get pageTurnStyle() { return this.#pageTurnStyle; }
  set pageTurnStyle(style) {
    const valid = ['slide', 'curl', 'none'];
    this.#pageTurnStyle = valid.includes(style) ? style : 'slide';
    // Update animated attribute: slide uses it, curl handles its own animation
    if (this.#pageTurnStyle === 'slide') {
      this.setAttribute('animated', '');
    } else {
      this.removeAttribute('animated');
    }
  }
  attributeChangedCallback(name, _, value) {
    switch (name) {
      case "flow":
        this.#throttledRender();  // 使用节流版本
        break;
      case "gap":
      case "margin":
      case "max-block-size":
      case "max-column-count":
        this.#top.style.setProperty("--_" + name, value);
        break;
      case "max-inline-size":
        // needs explicit `render()` as it doesn't necessarily resize
        this.#top.style.setProperty("--_" + name, value);
        this.#throttledRender();  // 使用节流版本
        break;
    }
  }
  open(book) {
    this.bookDir = book.dir;
    this.sections = book.sections;
    book.transformTarget?.addEventListener("data", ({ detail }) => {
      if (detail.type !== "text/css") return;
      const w = innerWidth;
      const h = innerHeight;
      detail.data = Promise.resolve(detail.data).then((data) =>
        data
          // unprefix as most of the props are (only) supported unprefixed
          .replace(/(?<=[{\s;])-epub-/gi, "")
          // replace vw and vh as they cause problems with layout
          .replace(/(\d*\.?\d+)vw/gi, (_, d) => `${(Number.parseFloat(d) * w) / 100}px`)
          .replace(/(\d*\.?\d+)vh/gi, (_, d) => `${(Number.parseFloat(d) * h) / 100}px`)
          // `page-break-*` unsupported in columns; replace with `column-break-*`
          .replace(/page-break-(after|before|inside)\s*:/gi, (_, x) => `-webkit-column-break-${x}:`)
          .replace(/break-(after|before|inside)\s*:\s*(avoid-)?page/gi, (_, x, y) => `break-${x}: ${y ?? ""}column`),
      );
    });
  }
  #createView() {
    if (this.#view) {
      this.#view.destroy();
      this.#container.removeChild(this.#view.element);
    }
    this.#view = new View({
      container: this,
      onExpand: () => this.#scrollToAnchor(this.#anchor),
    });
    this.#container.append(this.#view.element);
    return this.#view;
  }
  #beforeRender({ vertical, rtl, background }) {
    this.#vertical = vertical;
    this.#rtl = rtl;
    this.#top.classList.toggle("vertical", vertical);

    // set background to `doc` background
    // this is needed because the iframe does not fill the whole element
    this.#background.style.background = background;

    const { width, height } = this.#container.getBoundingClientRect();
    const size = vertical ? height : width;

    const style = getComputedStyle(this.#top);
    const maxInlineSize = Number.parseFloat(style.getPropertyValue("--_max-inline-size"));
    const maxColumnCount = Number.parseInt(style.getPropertyValue("--_max-column-count-spread"));
    // header/footer removed; internal top/bottom margin not used
    const margin = 0;
    this.#margin = 0;

    const g = Number.parseFloat(style.getPropertyValue("--_gap")) / 100;
    // The gap will be a percentage of the #container, not the whole view.
    // This means the outer padding will be bigger than the column gap. Let
    // `a` be the gap percentage. The actual percentage for the column gap
    // will be (1 - a) * a. Let us call this `b`.
    //
    // To make them the same, we start by shrinking the outer padding
    // setting to `b`, but keep the column gap setting the same at `a`. Then
    // the actual size for the column gap will be (1 - b) * a. Repeating the
    // process again and again, we get the sequence
    //     x₁ = (1 - b) * a
    //     x₂ = (1 - x₁) * a
    //     ...
    // which converges to x = (1 - x) * a. Solving for x, x = a / (1 + a).
    // So to make the spacing even, we must shrink the outer padding with
    //     f(x) = x / (1 + x).
    // But we want to keep the outer padding, and make the inner gap bigger.
    // So we apply the inverse, f⁻¹ = -x / (x - 1) to the column gap.
    const gap = (-g / (g - 1)) * size;

    const flow = this.getAttribute("flow");
    if (flow === "scrolled") {
      // FIXME: vertical-rl only, not -lr
      this.setAttribute("dir", vertical ? "rtl" : "ltr");
      this.#top.style.padding = "0";
      const columnWidth = maxInlineSize;

      // no header/footer to populate in scrolled mode

      return { flow, margin, gap, columnWidth };
    }

    const divisor = Math.min(maxColumnCount, Math.ceil(size / maxInlineSize));
    const columnWidth = size / divisor - gap;
    this.setAttribute("dir", rtl ? "rtl" : "ltr");

    // header/footer removed; no marginal grids to set up

    return { height, width, margin, gap, columnWidth };
  }
  render() {
    if (!this.#view) return;
    this.#view.render(
      this.#beforeRender({
        vertical: this.#vertical,
        rtl: this.#rtl,
      }),
    );
    this.#scrollToAnchor(this.#anchor);
  }
  #throttledRender() {
    if (this.#renderTimeout) {
      clearTimeout(this.#renderTimeout);
    }
    this.#renderTimeout = setTimeout(() => {
      this.render();
    }, 100); // 100ms debounce time
  }
  get scrolled() {
    return this.getAttribute("flow") === "scrolled";
  }
  /** Public flag to disable touch/swipe navigation (e.g. during text selection) */
  get navigationLocked() {
    return this.#navigationLocked;
  }
  set navigationLocked(v) {
    this.#navigationLocked = !!v;
  }
  get scrollProp() {
    const { scrolled } = this;
    return this.#vertical ? (scrolled ? "scrollLeft" : "scrollTop") : scrolled ? "scrollTop" : "scrollLeft";
  }
  get sideProp() {
    const { scrolled } = this;
    return this.#vertical ? (scrolled ? "width" : "height") : scrolled ? "height" : "width";
  }
  get size() {
    return this.#container.getBoundingClientRect()[this.sideProp];
  }
  get viewSize() {
    return this.#view?.element?.getBoundingClientRect()[this.sideProp] ?? 0;
  }
  get start() {
    return Math.abs(this.#container[this.scrollProp]);
  }
  get end() {
    return this.start + this.size;
  }
  get page() {
    return Math.floor((this.start + this.end) / 2 / this.size);
  }
  get pages() {
    return Math.round(this.viewSize / this.size);
  }
  scrollBy(dx, dy) {
    const delta = this.#vertical ? dy : dx;
    const element = this.#container;
    const { scrollProp } = this;
    const [offset, a, b] = this.#scrollBounds;
    const rtl = this.#rtl;
    const min = rtl ? offset - b : offset - a;
    const max = rtl ? offset + a : offset + b;
    element[scrollProp] = Math.max(min, Math.min(max, element[scrollProp] + delta));
  }
  snap(vx, vy) {
    const velocity = this.#vertical ? vy : vx;
    const [offset, a, b] = this.#scrollBounds;
    const { start, end, pages, size } = this;
    const min = Math.abs(offset) - a;
    const max = Math.abs(offset) + b;
    const d = velocity * (this.#rtl ? -size : size);
    const page = Math.floor(Math.max(min, Math.min(max, (start + end) / 2 + (Number.isNaN(d) ? 0 : d))) / size);

    this.#scrollToPage(page, "snap").then(() => {
      const dir = page <= 0 ? -1 : page >= pages - 1 ? 1 : null;
      if (dir)
        return this.#goTo({
          index: this.#adjacentIndex(dir),
          anchor: dir < 0 ? () => 1 : () => 0,
        });
    });
  }
  #onTouchStart(e) {
    // If navigation is locked (e.g., during text selection), don't track touch
    if (this.#navigationLocked) return;
    // Also check if there's an active selection in any iframe
    // This handles the case where user drags selection handles
    const contents = this.getContents?.() ?? [];
    for (const { doc } of contents) {
      const sel = doc?.getSelection?.();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        return;
      }
    }
    const touch = e.changedTouches[0];

    // ── Curl mode: start curl effect ──
    if (this.#pageTurnStyle === 'curl' && !this.scrolled && touch) {
      const rect = this.getBoundingClientRect?.() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const touchX = touch.clientX - (rect.left || 0);
      const touchY = touch.clientY - (rect.top || 0);
      const w = rect.width || window.innerWidth;

      // Determine direction based on which half the touch starts in
      const direction = touchX > w / 2 ? 1 : -1;

      this.#curlTouchState = {
        startX: touch.screenX,
        startY: touch.screenY,
        lastX: touch.screenX,
        lastY: touch.screenY,
        startTime: e.timeStamp,
        direction,
        curlStarted: false,
        touchX,
        touchY,
      };
    }

    this.#touchState = {
      x: touch?.screenX,
      y: touch?.screenY,
      t: e.timeStamp,
      vx: 0,
      xy: 0,
      // Track initial position for tap detection — only call preventDefault()
      // once finger has moved beyond threshold, so pure taps still generate
      // synthetic click events (needed for toolbar toggle on iOS).
      startX: touch?.screenX,
      startY: touch?.screenY,
      didPreventDefault: false,
    };
  }
  #onTouchMove(e) {
    const state = this.#touchState;
    if (this.#navigationLocked || state?.pinched) return;
    // Also check if there's an active selection (user might be dragging handles)
    const contents = this.getContents?.() ?? [];
    for (const { doc } of contents) {
      const sel = doc?.getSelection?.();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        return;
      }
    }
    state.pinched = globalThis.visualViewport.scale > 1;
    if (this.scrolled || state.pinched) return;
    if (e.touches.length > 1) {
      if (this.#touchScrolled) e.preventDefault();
      return;
    }

    const touch = e.changedTouches[0];
    const totalDx = Math.abs(touch.screenX - (state.startX ?? touch.screenX));
    const totalDy = Math.abs(touch.screenY - (state.startY ?? touch.screenY));

    // ── Curl mode: update curl effect ──
    if (this.#pageTurnStyle === 'curl' && this.#curlTouchState) {
      const curlState = this.#curlTouchState;

      // Only start curl once we have enough horizontal movement
      if (!curlState.curlStarted && totalDx > 15 && totalDx > totalDy) {
        curlState.curlStarted = true;

        // Resize canvas to match container
        const rect = this.getBoundingClientRect?.() ?? { width: window.innerWidth, height: window.innerHeight };
        if (this.#curlEffect) {
          this.#curlEffect.resize(rect.width, rect.height);
          // Set background color from current theme
          const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg')?.trim();
          if (bg) this.#curlEffect.bgColor = bg;
          this.#curlEffect.start(
            curlState.touchX,
            curlState.touchY,
            curlState.direction,
            null,
          );
        }
      }

      if (curlState.curlStarted) {
        e.preventDefault();
        state.didPreventDefault = true;
        const rect = this.getBoundingClientRect?.() ?? { left: 0, top: 0 };
        const currentX = touch.clientX - (rect.left || 0);
        const currentY = touch.clientY - (rect.top || 0);
        this.#curlEffect?.update(currentX, currentY);

        curlState.lastX = touch.screenX;
        curlState.lastY = touch.screenY;
        return; // Don't do normal scroll in curl mode
      }
    }

    // Only preventDefault once finger moves beyond a small threshold (10px).
    // This preserves synthetic click generation for pure taps on iOS.
    if (totalDx > 10 || totalDy > 10 || state.didPreventDefault) {
      e.preventDefault();
      state.didPreventDefault = true;
    }
    const x = touch.screenX;
    const y = touch.screenY;
    const dx = state.x - x;
    const dy = state.y - y;
    const dt = e.timeStamp - state.t;
    state.x = x;
    state.y = y;
    state.t = e.timeStamp;
    state.vx = dx / dt;
    state.vy = dy / dt;
    this.#touchScrolled = true;
    this.scrollBy(dx, dy);
  }
  #onTouchEnd() {
    this.#touchScrolled = false;
    if (this.scrolled || this.#navigationLocked) return;

    // ── Curl mode: finish the curl animation ──
    if (this.#pageTurnStyle === 'curl' && this.#curlTouchState?.curlStarted) {
      const curlState = this.#curlTouchState;
      const velocity = this.#touchState?.vx ?? 0;
      this.#curlTouchState = null;

      if (this.#curlEffect?.active) {
        this.#curlEffect.finish(velocity).then((completed) => {
          if (completed) {
            // Actually turn the page
            const dir = curlState.direction;
            if (dir === 1) this.next();
            else this.prev();
          }
        });
      }
      return;
    }
    this.#curlTouchState = null;

    // XXX: Firefox seems to report scale as 1... sometimes...?
    // at this point I'm basically throwing `requestAnimationFrame` at
    // anything that doesn't work
    requestAnimationFrame(() => {
      if (globalThis.visualViewport.scale === 1) this.snap(this.#touchState.vx, this.#touchState.vy);
    });
  }
  // allows one to process rects as if they were LTR and horizontal
  #getRectMapper() {
    if (this.scrolled) {
      const size = this.viewSize;
      const margin = this.#margin;
      return this.#vertical
        ? ({ left, right }) => ({ left: size - right - margin, right: size - left - margin })
        : ({ top, bottom }) => ({ left: top + margin, right: bottom + margin });
    }
    const pxSize = this.pages * this.size;
    return this.#rtl
      ? ({ left, right }) =>
        ({ left: pxSize - right, right: pxSize - left })
      : this.#vertical
        ? ({ top, bottom }) => ({ left: top, right: bottom })
        : f => f
  }
  async #scrollToRect(rect, reason) {
    if (this.scrolled) {
      const offset = this.#getRectMapper()(rect).left - this.#margin;
      return this.#scrollTo(offset, reason);
    }
    const offset = this.#getRectMapper()(rect).left;
    return this.#scrollToPage(Math.floor(offset / this.size) + (this.#rtl ? -1 : 1), reason);
  }
  async #scrollTo(offset, reason, smooth) {
    const element = this.#container;
    const { scrollProp, size } = this;
    if (element[scrollProp] === offset) {
      this.#scrollBounds = [offset, this.atStart ? 0 : size, this.atEnd ? 0 : size];
      this.#afterScroll(reason);
      return;
    }
    // FIXME: vertical-rl only, not -lr
    if (this.scrolled && this.#vertical) offset = -offset;

    // Curl mode: always jump instantly (curl Canvas handles the visual transition)
    // None mode: also jump instantly
    const turnStyle = this.#pageTurnStyle;
    if (turnStyle === 'curl' || turnStyle === 'none') {
      element[scrollProp] = offset;
      this.#scrollBounds = [offset, this.atStart ? 0 : size, this.atEnd ? 0 : size];
      this.#afterScroll(reason);
      return;
    }

    // Slide mode: use scrollLeft animation
    if ((reason === "snap" || smooth) && this.hasAttribute("animated"))
      return animate(element[scrollProp], offset, 400, easeOutCubic, (x) => (element[scrollProp] = x)).then(() => {
        this.#scrollBounds = [offset, this.atStart ? 0 : size, this.atEnd ? 0 : size];
        this.#afterScroll(reason);
      });
    else {
      element[scrollProp] = offset;
      this.#scrollBounds = [offset, this.atStart ? 0 : size, this.atEnd ? 0 : size];
      this.#afterScroll(reason);
    }
  }
  async #scrollToPage(page, reason, smooth) {
    const offset = this.size * (this.#rtl ? -page : page);
    return this.#scrollTo(offset, reason, smooth);
  }
  async scrollToAnchor(anchor, select) {
    return this.#scrollToAnchor(anchor, select ? "selection" : "navigation");
  }
  async #scrollToAnchor(anchor, reason = "anchor") {
    this.#anchor = anchor;
    const rects = uncollapse(anchor)?.getClientRects?.();
    // if anchor is an element or a range
    if (rects) {
      // when the start of the range is immediately after a hyphen in the
      // previous column, there is an extra zero width rect in that column
      const rect = Array.from(rects).find((r) => r.width > 0 && r.height > 0) || rects[0];
      if (!rect) return;
      await this.#scrollToRect(rect, reason);
      return;
    }
    // if anchor is a fraction
    if (this.scrolled) {
      await this.#scrollTo(anchor * this.viewSize, reason);
      return;
    }
    const { pages } = this;
    if (!pages) return;
    const textPages = pages - 2;
    const newPage = Math.round(anchor * (textPages - 1));
    await this.#scrollToPage(newPage + 1, reason);
  }
  #getVisibleRange() {
    if (!this.#view) return null;
    // P2-2: Cache visible range — skip expensive DOM traversal when position unchanged
    const cache = this.#visibleRangeCache;
    const curStart = this.start;
    const curEnd = this.end;
    const curIndex = this.#index;
    if (cache.range && cache.start === curStart && cache.end === curEnd && cache.index === curIndex) {
      return cache.range;
    }
    let range;
    if (this.scrolled)
      range = getVisibleRange(
        this.#view.document,
        curStart + this.#margin,
        curEnd - this.#margin,
        this.#getRectMapper(),
      );
    else {
      const size = this.#rtl ? -this.size : this.size;
      range = getVisibleRange(this.#view.document, curStart - size, curEnd - size, this.#getRectMapper());
    }
    cache.start = curStart;
    cache.end = curEnd;
    cache.index = curIndex;
    cache.range = range;
    return range;
  }
  #afterScroll(reason) {
    const range = this.#getVisibleRange();
    if (!range) return;
    this.#lastVisibleRange = range;
    // don't set new anchor if relocation was to scroll to anchor
    if (reason !== "selection" && reason !== "navigation" && reason !== "anchor") this.#anchor = range;
    else this.#justAnchored = true;

    const index = this.#index;
    const detail = { reason, range, index };
    if (this.scrolled) detail.fraction = this.start / this.viewSize;
    else if (this.pages > 0) {
      const { page, pages } = this;
      detail.fraction = (page - 1) / (pages - 2);
      detail.size = 1 / (pages - 2);
    }
    this.dispatchEvent(new CustomEvent("relocate", { detail }));
  }
  async #display(promise) {
    const { index, src, anchor, onLoad, select } = await promise;
    this.#index = index;
    const hasFocus = this.#view?.document?.hasFocus();
    if (src) {
      // Fade-out old content when crossing sections (if animated)
      const container = this.#container;
      const shouldAnimate = this.hasAttribute("animated") && container;
      if (shouldAnimate) {
        container.style.transition = "opacity 120ms ease-out";
        container.style.opacity = "0";
        await wait(120);
      }

      const view = this.#createView();
      const afterLoad = (doc) => {
        if (doc.head) {
          const $styleBefore = doc.createElement("style");
          doc.head.prepend($styleBefore);
          const $style = doc.createElement("style");
          doc.head.append($style);
          this.#styleMap.set(doc, [$styleBefore, $style]);
        }
        onLoad?.({ doc, index });
      };
      const beforeRender = this.#beforeRender.bind(this);
      await view.load(src, afterLoad, beforeRender);
      this.dispatchEvent(
        new CustomEvent("create-overlayer", {
          detail: {
            doc: view.document,
            index,
            attach: (overlayer) => (view.overlayer = overlayer),
          },
        }),
      );
      this.#view = view;

      // Fade-in new content
      if (shouldAnimate) {
        container.style.transition = "opacity 200ms ease-in";
        container.style.opacity = "1";
      }
    }
    if (this.#view) {
      await this.scrollToAnchor((typeof anchor === "function" ? anchor(this.#view.document) : anchor) ?? 0, select);
    }
    if (hasFocus) this.focusView();
  }
  #canGoToIndex(index) {
    return index >= 0 && index <= this.sections.length - 1;
  }
  // ── Adjacent chapter preload cache ──
  #preloadCache = new Map(); // Map<index, Promise<src>>
  #preloadInFlight = new Set();

  #preloadAdjacentSections(currentIndex) {
    const directions = [-1, 1];
    for (const dir of directions) {
      let adjIndex = currentIndex + dir;
      // Skip non-linear sections
      while (adjIndex >= 0 && adjIndex < this.sections.length && this.sections[adjIndex]?.linear === "no") {
        adjIndex += dir;
      }
      if (adjIndex < 0 || adjIndex >= this.sections.length) continue;
      if (this.#preloadCache.has(adjIndex) || this.#preloadInFlight.has(adjIndex)) continue;
      this.#preloadInFlight.add(adjIndex);
      const promise = Promise.resolve(this.sections[adjIndex].load())
        .then((src) => {
          this.#preloadCache.set(adjIndex, src);
          this.#preloadInFlight.delete(adjIndex);
          return src;
        })
        .catch((e) => {
          this.#preloadInFlight.delete(adjIndex);
          console.warn(`[Preload] Failed to preload section ${adjIndex}:`, e);
          return null;
        });
      // Don't await — fire-and-forget
    }
    // Evict cache entries far from current index (keep ±2)
    for (const [idx] of this.#preloadCache) {
      if (Math.abs(idx - currentIndex) > 2) {
        this.#preloadCache.delete(idx);
      }
    }
  }

  async #goTo({ index, anchor, select }) {
    if (index === this.#index) await this.#display({ index, anchor, select });
    else {
      const oldIndex = this.#index;
      const onLoad = (detail) => {
        this.sections[oldIndex]?.unload?.();
        this.setStyles(this.#styles);
        this.dispatchEvent(new CustomEvent("load", { detail }));
      };
      // Use preloaded src if available, otherwise load fresh
      const loadSrc = this.#preloadCache.has(index)
        ? Promise.resolve(this.#preloadCache.get(index))
        : Promise.resolve(this.sections[index].load());
      // Clear used cache entry
      this.#preloadCache.delete(index);
      await this.#display(
        loadSrc
          .then((src) => ({ index, src, anchor, onLoad, select }))
          .catch((e) => {
            console.warn(e);
            console.warn(new Error(`Failed to load section ${index}`));
            return {};
          }),
      );
      // Preload adjacent sections after displaying current
      this.#preloadAdjacentSections(index);
    }
  }
  async goTo(target) {
    if (this.#locked) return;
    const resolved = await target;
    if (this.#canGoToIndex(resolved.index)) {
      const result = await this.#goTo(resolved);
      // Trigger preload on initial navigation too
      this.#preloadAdjacentSections(resolved.index);
      return result;
    }
  }
  #scrollPrev(distance) {
    if (!this.#view) return true;
    if (this.scrolled) {
      if (this.start > 0) return this.#scrollTo(Math.max(0, this.start - (distance ?? this.size)), null, true);
      return true;
    }
    if (this.atStart) return;
    const page = this.page - 1;
    return this.#scrollToPage(page, "page", true).then(() => page <= 0);
  }
  #scrollNext(distance) {
    if (!this.#view) return true;
    if (this.scrolled) {
      if (this.viewSize - this.end > 2)
        return this.#scrollTo(Math.min(this.viewSize, distance ? this.start + distance : this.end), null, true);
      return true;
    }
    if (this.atEnd) return;
    const page = this.page + 1;
    const pages = this.pages;
    return this.#scrollToPage(page, "page", true).then(() => page >= pages - 1);
  }
  get atStart() {
    return this.#adjacentIndex(-1) == null && this.page <= 1;
  }
  get atEnd() {
    return this.#adjacentIndex(1) == null && this.page >= this.pages - 2;
  }
  #adjacentIndex(dir) {
    for (let index = this.#index + dir; this.#canGoToIndex(index); index += dir)
      if (this.sections[index]?.linear !== "no") return index;
  }
  async #turnPage(dir, distance) {
    if (this.#locked) return;
    this.#locked = true;

    // ── Curl mode: play auto curl animation for tap/programmatic page turns ──
    if (this.#pageTurnStyle === 'curl' && !this.scrolled && this.#curlEffect && !this.#curlEffect.active) {
      const rect = this.getBoundingClientRect?.() ?? { width: window.innerWidth, height: window.innerHeight };
      const w = rect.width;
      const h = rect.height;
      this.#curlEffect.resize(w, h);
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg')?.trim();
      if (bg) this.#curlEffect.bgColor = bg;

      // Start from edge, animate to completion
      const startX = dir === 1 ? w : 0;
      this.#curlEffect.start(startX, h / 2, dir, null);

      // Animate the curl automatically
      await this.#curlEffect.finish(dir * 0.5);
    }

    const prev = dir === -1;
    const shouldGo = await (prev ? this.#scrollPrev(distance) : this.#scrollNext(distance));
    if (shouldGo)
      await this.#goTo({
        index: this.#adjacentIndex(dir),
        anchor: prev ? () => 1 : () => 0,
      });
    if (shouldGo || (!this.hasAttribute("animated") && this.#pageTurnStyle !== 'curl')) await wait(100);
    this.#locked = false;
  }
  prev(distance) {
    return this.#turnPage(-1, distance);
  }
  next(distance) {
    return this.#turnPage(1, distance);
  }
  prevSection() {
    return this.goTo({ index: this.#adjacentIndex(-1) });
  }
  nextSection() {
    return this.goTo({ index: this.#adjacentIndex(1) });
  }
  firstSection() {
    const index = this.sections.findIndex((section) => section.linear !== "no");
    return this.goTo({ index });
  }
  lastSection() {
    const index = this.sections.findLastIndex((section) => section.linear !== "no");
    return this.goTo({ index });
  }
  getContents() {
    if (this.#view)
      return [
        {
          index: this.#index,
          overlayer: this.#view.overlayer,
          doc: this.#view.document,
        },
      ];
    return [];
  }
  setStyles(styles) {
    this.#styles = styles;
    const $$styles = this.#styleMap.get(this.#view?.document);
    if (!$$styles) return;
    const [$beforeStyle, $style] = $$styles;
    if (Array.isArray(styles)) {
      const [beforeStyle, style] = styles;
      $beforeStyle.textContent = beforeStyle;
      $style.textContent = style;
    } else $style.textContent = styles;

    // NOTE: needs `requestAnimationFrame` in Chromium
    requestAnimationFrame(() => {
      if (this.#view) this.#background.style.background = getBackground(this.#view.document);
    });

    // needed because the resize observer doesn't work in Firefox
    this.#view?.document?.fonts?.ready?.then(() => this.#view.expand());
  }
  focusView() {
    this.#view?.document?.defaultView?.focus();
  }
  destroy() {
    this.#observer.unobserve(this);
    this.#view?.destroy();
    this.#view = null;
    this.sections[this.#index]?.unload?.();
    this.#mediaQuery.removeEventListener("change", this.#mediaQueryListener);
    // Clean up preload cache
    this.#preloadCache.clear();
    this.#preloadInFlight.clear();
    // Clean up curl effect
    if (this.#curlEffect) {
      this.#curlEffect.destroy();
      this.#curlEffect = null;
    }
  }
}

if (!customElements.get("foliate-paginator")) customElements.define("foliate-paginator", Paginator);

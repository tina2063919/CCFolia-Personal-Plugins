// ==UserScript==
// @name         CCFolia 自訂顏色調色盤
// @namespace    ccf-color-picker
// @version      1.0.1
// @description  在 CCFolia 的角色名稱顏色選單旁加上調色盤，可自由拖曳選出任意顏色
// @match        https://ccfolia.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const PANEL_ID = 'ccf-color-picker';
  // CCFolia 的顏色選單（react-color）裡輸入色碼的欄位
  const HEX_INPUT_SEL = 'input[id^="rc-editable-input-"]';
  const GAP = 8; // 調色盤與原選單的間距

  const CSS = `
/* 想調顏色，改下面這些變數即可 */
#${PANEL_ID} {
  --pk-bg: #ffffff;
  --pk-border: rgba(0, 0, 0, 0.12);
  --pk-text: #666666;

  position: fixed;
  z-index: 1500; /* 要高於 MUI 選單（1300），否則會被選單的透明背景擋住 */
  box-sizing: border-box;
  width: 180px;
  padding: 12px;
  background: var(--pk-bg);
  border-radius: 4px;
  box-shadow: 0 5px 5px -3px rgba(0,0,0,.2), 0 8px 10px 1px rgba(0,0,0,.14), 0 3px 14px 2px rgba(0,0,0,.12);
  user-select: none;
  font: 13px/1 sans-serif;
  color: var(--pk-text);
}
#${PANEL_ID} .pk-sv {
  position: relative;
  height: 140px;
  border-radius: 4px;
  cursor: crosshair;
  touch-action: none;
  background-image:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent);
}
#${PANEL_ID} .pk-hue {
  position: relative;
  height: 12px;
  margin-top: 10px;
  border-radius: 6px;
  cursor: pointer;
  touch-action: none;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
}
#${PANEL_ID} .pk-sv-dot,
#${PANEL_ID} .pk-hue-dot {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.4);
  pointer-events: none;
  transform: translate(-50%, -50%);
}
#${PANEL_ID} .pk-sv-dot { width: 12px; height: 12px; }
#${PANEL_ID} .pk-hue-dot { width: 14px; height: 14px; top: 50%; }
#${PANEL_ID} .pk-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
#${PANEL_ID} .pk-preview {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px var(--pk-border);
}
`;

  // ---------- 色彩換算 ----------

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function hexToRgb(hex) {
    let h = String(hex).replace(/^#/, '').trim();
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, (c) => c + c);
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const rgbToHex = (rgb) =>
    '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  function rgbToHsv([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h, s: max ? d / max : 0, v: max };
  }

  function hsvToRgb({ h, s, v }) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
    };
    return [f(5), f(3), f(1)];
  }

  // ---------- 調色盤 ----------

  let panel = null;
  let hexInput = null; // 目前對應的原選單色碼欄位
  let anchor = null;   // 原選單外框，用來決定調色盤位置
  let hsv = { h: 0, s: 0, v: 0 };
  let lastHex = '';    // 最後一次與原選單同步的顏色
  let dragging = false;
  // 寫回原選單後，CCFolia 要一段時間才會更新，期間選單仍顯示舊顏色；
  // 這段時間內忽略舊顏色，避免調色盤閃回舊顏色再跳到新顏色
  let pendingHex = '';
  let pendingUntil = 0;
  const PENDING_MS = 2000;

  function buildPanel() {
    const el = document.createElement('div');
    el.id = PANEL_ID;
    el.innerHTML = `
      <div class="pk-sv"><div class="pk-sv-dot"></div></div>
      <div class="pk-hue"><div class="pk-hue-dot"></div></div>
      <div class="pk-foot"><div class="pk-preview"></div><span class="pk-hex"></span></div>
    `;
    // 原選單點外面就會關閉，事件不往外傳，才能在調色盤上操作
    for (const type of ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup']) {
      el.addEventListener(type, (e) => e.stopPropagation());
    }
    bindDrag(el.querySelector('.pk-sv'), (x, y) => {
      hsv.s = x;
      hsv.v = 1 - y;
    });
    bindDrag(el.querySelector('.pk-hue'), (x) => {
      hsv.h = Math.min(x * 360, 359.99);
    });
    return el;
  }

  // 拖曳時只更新調色盤畫面，放開滑鼠才寫回原選單，避免一路觸發大量更新
  function bindDrag(area, apply) {
    const move = (e) => {
      const r = area.getBoundingClientRect();
      apply(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
      render();
    };
    area.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      area.setPointerCapture(e.pointerId);
      move(e);
    });
    area.addEventListener('pointermove', (e) => {
      if (dragging && area.hasPointerCapture(e.pointerId)) move(e);
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      if (area.hasPointerCapture(e.pointerId)) area.releasePointerCapture(e.pointerId);
      commit();
    };
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
  }

  function render() {
    const hex = rgbToHex(hsvToRgb(hsv));
    panel.querySelector('.pk-sv').style.backgroundColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
    const dot = panel.querySelector('.pk-sv-dot');
    dot.style.left = `${hsv.s * 100}%`;
    dot.style.top = `${(1 - hsv.v) * 100}%`;
    panel.querySelector('.pk-hue-dot').style.left = `${(hsv.h / 360) * 100}%`;
    panel.querySelector('.pk-preview').style.background = hex;
    panel.querySelector('.pk-hex').textContent = hex.toUpperCase();
  }

  // 透過原選單的色碼欄位寫入顏色，讓 CCFolia 照常處理
  function commit() {
    if (!hexInput || !hexInput.isConnected) return;
    const hex = rgbToHex(hsvToRgb(hsv));
    lastHex = pendingHex = hex;
    pendingUntil = performance.now() + PENDING_MS;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(hexInput, hex.slice(1));
    hexInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 原選單的顏色被改了（點色塊、輸入色碼）就跟著同步
  function syncFromInput() {
    if (dragging) return;
    const rgb = hexToRgb(hexInput.value);
    if (!rgb) return;
    const hex = rgbToHex(rgb);
    if (pendingHex) {
      if (hex === pendingHex) pendingHex = '';
      else if (performance.now() < pendingUntil) return;
      else pendingHex = '';
    }
    if (hex === lastHex) return;
    lastHex = hex;
    const next = rgbToHsv(rgb);
    // 灰階或全黑時色相無意義，保留原本的色相，避免指標亂跳
    if (next.s === 0 || next.v === 0) next.h = hsv.h;
    hsv = next;
    render();
  }

  // 優先放在原選單右側，空間不夠就放左側
  function position() {
    const r = anchor.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    let left = r.right + GAP;
    if (left + w > window.innerWidth - GAP) left = Math.max(GAP, r.left - GAP - w);
    const top = clamp(r.top, GAP, Math.max(GAP, window.innerHeight - h - GAP));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function mount(input) {
    hexInput = input;
    anchor = input.closest('.MuiPaper-root') || input.parentElement.parentElement;
    lastHex = '';
    if (!panel) panel = buildPanel();
    document.body.appendChild(panel);
    syncFromInput();
    if (!lastHex) render();
    tick();
  }

  function unmount() {
    panel?.remove();
    hexInput = anchor = null;
    dragging = false;
    pendingHex = '';
  }

  // 選單開著時每幀跟著位置與顏色走（選單有展開動畫，位置會變）
  function tick() {
    if (!hexInput) return;
    if (!hexInput.isConnected) return unmount();
    syncFromInput();
    position();
    requestAnimationFrame(tick);
  }

  function scan() {
    const input = document.querySelector(HEX_INPUT_SEL);
    if (input && input !== hexInput) {
      unmount();
      mount(input);
    }
  }

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // React 會不斷重繪 DOM，用 MutationObserver 偵測顏色選單出現（以 rAF 節流）
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();

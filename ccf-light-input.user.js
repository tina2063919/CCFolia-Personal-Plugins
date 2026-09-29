// ==UserScript==
// @name         CCFolia 明亮輸入區
// @namespace    ccf-light-input
// @version      1.5.1
// @description  將 CCFolia 房間的聊天輸入區與訊息紀錄改為明亮主題，可一鍵切換回暗色主題，並讓各頁籤保有獨立的輸入草稿
// @match        https://ccfolia.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const MARK = 'ccf-light-input';
  const SELECTOR = 'textarea[name="text"][id^="downshift-"]';
  // 訊息紀錄區白底的不透明度：0 = 全透明、1 = 不透明
  const LOG_ALPHA = 0.9;

  const CSS = `
/*
 * 聊天輸入區（.ccf-light-input 由下方程式標記在輸入表單上）
 * 想調顏色，改下面這些變數即可。
 */
.ccf-light-input {
  --ccf-bg: #f5f5f5;          /* 輸入區整體底色 */
  --ccf-field-bg: #ffffff;    /* 輸入框底色 */
  --ccf-text: #212121;        /* 文字顏色 */
  --ccf-sub-text: rgba(0, 0, 0, 0.6);   /* 標籤、次要文字 */
  --ccf-placeholder: #9e9e9e; /* 提示文字 */
  --ccf-border: rgba(0, 0, 0, 0.23);    /* 框線 */
  --ccf-border-hover: rgba(0, 0, 0, 0.6);
  --ccf-icon: rgba(0, 0, 0, 0.54);      /* 圖示按鈕 */
  --ccf-accent: #1976d2;      /* 聚焦時的框線顏色 */

  background-color: var(--ccf-bg) !important;
  color: var(--ccf-text) !important;
}

/* 表單內的面板、工具列 */
.ccf-light-input .MuiPaper-root,
.ccf-light-input .MuiToolbar-root {
  background-color: var(--ccf-bg) !important;
  background-image: none !important;
  color: var(--ccf-text) !important;
}

/* 輸入框本體 */
.ccf-light-input .MuiInputBase-root,
.ccf-light-input .MuiFilledInput-root,
.ccf-light-input textarea,
.ccf-light-input input:not([type="checkbox"]):not([type="radio"]):not([type="color"]) {
  background-color: var(--ccf-field-bg) !important;
  color: var(--ccf-text) !important;
  caret-color: var(--ccf-text) !important;
  -webkit-text-fill-color: var(--ccf-text) !important;
}

.ccf-light-input textarea::placeholder,
.ccf-light-input input::placeholder {
  color: var(--ccf-placeholder) !important;
  -webkit-text-fill-color: var(--ccf-placeholder) !important;
  opacity: 1 !important;
}

/* 框線（outlined / standard / filled 三種 MUI 樣式） */
.ccf-light-input .MuiOutlinedInput-notchedOutline {
  border-color: var(--ccf-border) !important;
}
.ccf-light-input .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline {
  border-color: var(--ccf-border-hover) !important;
}
.ccf-light-input .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline {
  border-color: var(--ccf-accent) !important;
}
.ccf-light-input .MuiInput-underline::before,
.ccf-light-input .MuiFilledInput-underline::before {
  border-bottom-color: var(--ccf-border) !important;
}

/* 標籤、選單、一般文字 */
.ccf-light-input .MuiFormLabel-root,
.ccf-light-input .MuiInputLabel-root,
.ccf-light-input .MuiFormHelperText-root,
.ccf-light-input .MuiTypography-root {
  color: var(--ccf-sub-text) !important;
}
.ccf-light-input .MuiFormLabel-root.Mui-focused {
  color: var(--ccf-accent) !important;
}
.ccf-light-input .MuiSelect-select {
  color: var(--ccf-text) !important;
}

/* 圖示、按鈕 */
.ccf-light-input .MuiSelect-icon,
.ccf-light-input .MuiIconButton-root,
.ccf-light-input .MuiButton-text,
.ccf-light-input .MuiButton-outlined {
  color: var(--ccf-icon) !important;
}
.ccf-light-input .MuiIconButton-root:hover {
  background-color: rgba(0, 0, 0, 0.04) !important;
}
.ccf-light-input .MuiButton-outlined {
  border-color: var(--ccf-border) !important;
}
.ccf-light-input .Mui-disabled {
  color: rgba(0, 0, 0, 0.26) !important;
  -webkit-text-fill-color: rgba(0, 0, 0, 0.26) !important;
}

/* 骰子圖示（D4〜D100）：原本是黑色填滿 #202020 + 灰色框線 #ACACAC，改成透明填滿 + 黑色框線 */
.ccf-light-input .MuiIconButton-root[aria-label^="D"] svg path[fill="#202020" i] {
  fill: transparent !important;
}

/* 分隔線 */
.ccf-light-input .MuiDivider-root,
.ccf-light-input hr {
  border-color: rgba(0, 0, 0, 0.12) !important;
}

/*
 * 訊息紀錄區（.ccf-light-log 由下方程式自動找到並標記）
 * 文字與各元素底色由 lightenLog() 逐一轉換，這裡只處理底色、捲軸、分隔線。
 */
.ccf-light-log {
  background-color: rgba(255, 255, 255, ${LOG_ALPHA}) !important;
  color: #212121 !important;
  color-scheme: light;
}
.ccf-light-log .MuiDivider-root,
.ccf-light-log hr,
.ccf-light-log .MuiListItem-divider {
  border-color: rgba(0, 0, 0, 0.12) !important;
}

/* 主題切換按鈕（放在輸入表單右上角，頁籤列右側） */
:has(> .ccf-theme-toggle) {
  position: relative;
}
.ccf-theme-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  line-height: 32px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.ccf-theme-toggle:hover {
  background: rgba(255, 255, 255, 0.24);
}
.ccf-light-input > .ccf-theme-toggle {
  background: rgba(0, 0, 0, 0.06) !important;
  color: rgba(0, 0, 0, 0.7) !important;
}
.ccf-light-input > .ccf-theme-toggle:hover {
  background: rgba(0, 0, 0, 0.12) !important;
}
`;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // 每項功能第一次成功套用時，在 Console 提示一次
  const logged = new Set();
  function logOnce(msg) {
    if (logged.has(msg)) return;
    logged.add(msg);
    console.log('[CCFolia 明亮輸入區] ' + msg);
  }

  // ---- 顏色工具 ----
  function parseRgb(str) {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s, l };
  }

  const hsla = ({ h, s, l }, a) =>
    `hsla(${h.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${a})`;

  // ---- 訊息紀錄區 ----
  // 從輸入表單往上找，找出「可捲動、且不包含輸入表單」的區塊，當作訊息紀錄
  // （不要求內容已經超出高度，訊息少的房間也能找到）
  let logEl = null;
  let logForm = null;

  function findLog(form) {
    let a = form.parentElement;
    for (let depth = 0; a && depth < 8; depth++, a = a.parentElement) {
      for (const el of a.querySelectorAll('div, ul')) {
        if (el.contains(form) || form.contains(el)) continue;
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') &&
            el.clientHeight > 50 &&
            el.clientWidth > 100) {
          return el;
        }
      }
    }
    return null;
  }

  // 淺色文字 → 深色、深色底 → 淺色，保留原本色相（擲骰結果的藍色、角色名稱顏色等）
  const SKIP = 'img, svg, svg *, canvas, video';

  // 記住被改過的元素原本的 inline 樣式，切回暗色主題時還原
  const STYLE_PROPS = ['color', '-webkit-text-fill-color', 'background-color'];
  const originals = new Map();

  function setStyle(el, prop, value) {
    if (!originals.has(el)) {
      originals.set(el, STYLE_PROPS.map((p) =>
        [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]));
    }
    el.style.setProperty(prop, value, 'important');
  }

  function restoreStyles() {
    for (const [el, props] of originals) {
      for (const [p, value, priority] of props) {
        if (value) el.style.setProperty(p, value, priority);
        else el.style.removeProperty(p);
      }
    }
    originals.clear();
  }

  function lightenEl(el, bgAlpha) {
    const cs = getComputedStyle(el);

    const fg = parseRgb(cs.color);
    if (fg) {
      const hsl = rgbToHsl(fg);
      if (hsl.l > 0.5) {
        const min = hsl.s < 0.15 ? 0.13 : 0.25; // 灰階最深到 #212121，有色彩的保留一點亮度
        hsl.l = Math.max(min, 1 - hsl.l);
        setStyle(el, 'color', hsla(hsl, fg.a));
        setStyle(el, '-webkit-text-fill-color', 'currentColor');
      }
    }

    const bg = parseRgb(cs.backgroundColor);
    if (bg && bg.a > 0) {
      const hsl = rgbToHsl(bg);
      if (hsl.l < 0.5) {
        hsl.l = 1 - hsl.l * 0.3; // #2b2b2b → 約 #f2f2f2
        setStyle(el, 'background-color', hsla(hsl, bg.a * bgAlpha));
      }
    }
  }

  function lightenLog(log) {
    log.classList.add('ccf-light-log');
    for (const el of log.querySelectorAll('*')) {
      if (el.matches(SKIP)) continue;
      // 紀錄區內的底色也套用同樣透明度，避免蓋住透明效果
      lightenEl(el, LOG_ALPHA);
    }
  }

  // ---- 主題切換 ----
  let lightOn = true;
  try { lightOn = localStorage.getItem('ccf-light-theme') !== 'off'; } catch {}

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'ccf-theme-toggle';
  toggleBtn.addEventListener('click', () => {
    lightOn = !lightOn;
    try { localStorage.setItem('ccf-light-theme', lightOn ? 'on' : 'off'); } catch {}
    if (!lightOn) {
      document.querySelectorAll('.' + MARK).forEach((el) => el.classList.remove(MARK));
      document.querySelectorAll('.ccf-light-log').forEach((el) => el.classList.remove('ccf-light-log'));
      restoreStyles();
    }
    apply();
  });

  function updateToggle(form) {
    // 只在內容不同時才更新，避免觸發 MutationObserver 造成無限重繪
    const icon = lightOn ? '🌙' : '☀️';
    if (toggleBtn.textContent !== icon) {
      toggleBtn.textContent = icon;
      toggleBtn.title = lightOn ? '切換為暗色主題' : '切換為明亮主題';
    }
    if (toggleBtn.parentElement !== form) form.appendChild(toggleBtn);
  }

  function apply() {
    checkRoom();

    let form = null;
    for (const ta of document.querySelectorAll(SELECTOR)) {
      const target =
        ta.closest('form') ||
        ta.closest('.MuiFormControl-root') ||
        ta.closest('.MuiInputBase-root')?.parentElement ||
        ta;
      if (lightOn) target.classList.add(MARK);
      form = form || target;
    }
    if (!form) return;
    updateToggle(form);
    checkTab();
    if (!lightOn) return;
    logOnce('輸入區已套用明亮主題');

    // 輸入表單換了（切換房間、重新渲染）就重新找紀錄區
    if (!logEl || !logEl.isConnected || form !== logForm) {
      logEl = findLog(form);
      logForm = form;
    }
    if (logEl) {
      lightenLog(logEl);
      logOnce('訊息紀錄區已套用明亮主題');
    }
  }

  // ---- 各頁籤獨立的輸入草稿 ----
  // 以頁籤名稱（主頻道、閒聊…）為 key 記住輸入框內容，切換頁籤時換成該頁籤的草稿。
  // 草稿依房間存在 localStorage，重新整理頁面後也會保留。
  let roomPath = null;
  let drafts = {};
  let curTab = null;

  function saveDrafts() {
    try { localStorage.setItem('ccf-drafts:' + roomPath, JSON.stringify(drafts)); } catch {}
  }

  // CCFolia 切換房間不會重新載入頁面，網址變了就重設紀錄區與草稿
  function checkRoom() {
    if (location.pathname === roomPath) return;
    roomPath = location.pathname;
    logEl = null;
    curTab = null;
    try { drafts = JSON.parse(localStorage.getItem('ccf-drafts:' + roomPath)) || {}; } catch { drafts = {}; }
  }

  // 頁籤元素：MUI Tab 或含有未讀數字徽章（MuiBadge）的按鈕
  const TAB_SEL = '[role="tab"], .MuiTab-root, button:has(> .MuiBadge-root)';
  const SELECTED_TAB_SEL = [
    '[role="tab"][aria-selected="true"]',
    '.MuiTab-root.Mui-selected',
    'button.Mui-selected:has(> .MuiBadge-root)',
  ].join(', ');

  // 頁籤名稱：排除未讀數字徽章（<span class="MuiBadge-badge">0</span>），只取頁籤文字
  function tabLabel(tab) {
    const clone = tab.cloneNode(true);
    clone.querySelectorAll('.MuiBadge-badge').forEach((b) => b.remove());
    return clone.textContent.trim();
  }

  // 從輸入框往上找最近的頁籤列，取得目前選中的頁籤名稱
  function getTabName(ta) {
    let a = ta.parentElement;
    for (let depth = 0; a && depth < 10; depth++, a = a.parentElement) {
      const tab = a.querySelector(SELECTED_TAB_SEL);
      if (tab) return tabLabel(tab);
    }
    return null;
  }

  // React 的受控輸入框不能直接改 value，要用原生 setter 再觸發 input 事件
  const nativeSetValue =
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;

  function setTextareaValue(ta, value) {
    if (ta.value === value) return;
    nativeSetValue.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function checkTab() {
    const ta = document.querySelector(SELECTOR);
    if (!ta) return;
    const tab = getTabName(ta);
    if (tab === null) return;
    if (curTab === null) {
      curTab = tab;
      logOnce('頁籤草稿功能已啟用');
      return;
    }
    if (tab !== curTab) {
      curTab = tab;
      setTextareaValue(ta, drafts[tab] || '');
    }
  }

  // 打字時即時記錄目前頁籤的草稿
  document.addEventListener('input', (e) => {
    if (curTab !== null && e.target.matches?.(SELECTOR)) {
      drafts[curTab] = e.target.value;
      saveDrafts();
    }
  }, true);

  // 點頁籤的瞬間（切換前）再存一次，這樣送出訊息後被清空的輸入框也會正確記成空白
  function onTabInteract(e) {
    if (!e.target.closest?.(TAB_SEL)) return;
    const ta = document.querySelector(SELECTOR);
    if (ta && curTab !== null) {
      drafts[curTab] = ta.value;
      saveDrafts();
    }
    setTimeout(checkTab, 0);
    setTimeout(checkTab, 150);
  }
  document.addEventListener('pointerdown', onTabInteract, true);
  document.addEventListener('keydown', onTabInteract, true);

  // React 會不斷重繪 DOM，用 MutationObserver 持續補上標記（以 rAF 節流）
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }).observe(document.body, { childList: true, subtree: true });

  apply();
})();

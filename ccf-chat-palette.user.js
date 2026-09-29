// ==UserScript==
// @name         CCFolia 常用對話快捷面板
// @namespace    ccf-chat-palette
// @version      1.3.0
// @description  在 CCFolia 房間內加入可拖曳的懸浮選單，列出目前發言角色的常用對話（チャットパレット），點一下即可直接發送
// @match        https://ccfolia.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const PANEL_ID = 'ccf-chat-palette';
  const POS_KEY = 'ccf-chat-palette:pos';
  const ENABLED_KEY = 'ccf-chat-palette:enabled';
  const CMD_KEY = 'ccf-chat-palette:cmds:'; // + 房間路徑 + ':' + 角色名稱
  const FACE_KEY = 'ccf-chat-palette:faces:'; // + 房間路徑 + ':' + 角色名稱 → { 差分名稱: 圖片網址 }
  const PREVIEW_ID = 'ccf-chat-palette-preview';
  // 角色編輯視窗裡的差分名稱欄位（faces.0.label、faces.1.label…）
  const FACE_LABEL_SEL = 'input[name^="faces."][name$=".label"]';
  // 聊天輸入框與角色名稱欄位
  const CHAT_SEL = 'textarea[name="text"][id^="downshift-"]';
  const NAME_INPUT_SEL = 'input[name="name"]';
  // 角色編輯視窗裡的「常用對話表」欄位
  const COMMANDS_SEL = 'textarea[name="commands"]';
  const DIALOG_SEL = '[role="dialog"], .MuiDialog-paper, .MuiDrawer-paper, form';
  // 開關放在聊天輸入區下方「Dicebot engine : BCDice@x.x.x」那一行
  const DICEBOT_LINK_SEL = 'a[href*="bcdice.org"]';

  const CSS = `
/* 想調顏色，改下面這些變數即可 */
#${PANEL_ID} {
  --cp-bg: rgba(33, 33, 33, 0.92);
  --cp-head: rgba(255, 255, 255, 0.08);
  --cp-item-hover: rgba(255, 255, 255, 0.12);
  --cp-accent: #1976d2;
  --cp-text: #ffffff;
  --cp-sub: rgba(255, 255, 255, 0.6);

  position: fixed;
  z-index: 1400;
  min-width: 90px;
  max-width: 90vw;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  background: var(--cp-bg);
  color: var(--cp-text);
  font-size: 11px;
  box-shadow: 0 3px 13px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  user-select: none;
}
#${PANEL_ID} .cp-head {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 6px;
  background: var(--cp-head);
  cursor: move;
  touch-action: none;
}
#${PANEL_ID} .cp-title {
  flex: 1;
  min-width: 0;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#${PANEL_ID} .cp-btn {
  border: 0;
  padding: 0 3px;
  background: transparent;
  color: var(--cp-sub);
  font: inherit;
  cursor: pointer;
}
#${PANEL_ID} .cp-btn:hover { color: var(--cp-text); }
#${PANEL_ID} .cp-list { overflow: auto; padding: 3px 0; }
#${PANEL_ID} .cp-cols { display: flex; align-items: flex-start; }
#${PANEL_ID} .cp-col { flex: none; width: 80px; }
#${PANEL_ID} .cp-col + .cp-col { border-left: 1px solid rgba(255, 255, 255, 0.12); }
#${PANEL_ID} .cp-col-title {
  padding: 2px 8px 3px;
  color: var(--cp-sub);
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#${PANEL_ID} .cp-item {
  display: block;
  width: 100%;
  padding: 3px 8px;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  font: inherit;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
#${PANEL_ID} .cp-item:hover { background: var(--cp-item-hover); }
#${PANEL_ID} .cp-item.cp-sent { background: var(--cp-accent); }
#${PANEL_ID} .cp-empty { padding: 6px 8px; color: var(--cp-sub); font-size: 10px; }
#${PANEL_ID}.cp-busy .cp-refresh { opacity: 0.4; pointer-events: none; }

/* 差分預覽 */
#${PREVIEW_ID} {
  position: fixed;
  z-index: 1401;
  display: none;
  padding: 4px;
  border-radius: 6px;
  background: rgba(33, 33, 33, 0.92);
  box-shadow: 0 3px 13px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
#${PREVIEW_ID}.cp-show { display: block; }
#${PREVIEW_ID} img {
  display: block;
  max-width: 120px;
  max-height: 120px;
  border-radius: 4px;
  object-fit: contain;
}

/* 功能開關（Dicebot engine 那一行的右側） */
.ccf-cp-switch-row { display: flex !important; align-items: center; gap: 8px; }
.ccf-cp-switch {
  flex: none;
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  border: 1px solid rgb(100, 100, 100);
  border-radius: 10px;
  background: transparent;
  color: rgb(100, 100, 100);
  cursor: pointer;
  opacity: 0.8;
}
.ccf-cp-switch:hover { opacity: 1; }
.ccf-cp-switch.cp-on { border-color: #1976d2; }
.ccf-cp-switch svg { width: 14px; height: 14px; fill: currentColor; }
`;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const roomPath = () => location.pathname.match(/^\/rooms\/[^/]+/)?.[0] || null;

  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const save = (key, v) => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  };

  // ---- 常用對話的解析與儲存 ----

  // 「cc<=10 心理學」顯示「心理學」；「@笑容」顯示「笑容」；沒有空白就整行顯示
  // 「[技能]」這種整行以 [] 包住的內容開始新的一欄；「//」開頭的行略過
  // 回傳 [{ title, cmds: [{ text, label }] }]
  function parseCommands(text) {
    const cols = [];
    let col = null;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      const head = line.match(/^\[(.*)\]$/);
      if (head) {
        col = { title: head[1].trim(), cmds: [] };
        cols.push(col);
        continue;
      }
      let label;
      if (line.startsWith('@')) label = line.slice(1).split(/\s+/)[0];
      else label = line.match(/\s+(.+)$/)?.[1] || line;
      if (!col) cols.push(col = { title: '', cmds: [] });
      col.cmds.push({ text: line, label: label || line });
    }
    return cols.filter((c) => c.cmds.length || c.title);
  }

  const cmdKey = (name) => CMD_KEY + roomPath() + ':' + name;
  const getCommands = (name) => load(cmdKey(name), null);
  const setCommands = (name, text) => save(cmdKey(name), text);

  // 差分名稱統一去掉開頭的 @ 再比對
  const faceName = (label) => String(label || '').trim().replace(/^@/, '').trim();
  const faceKey = (name) => FACE_KEY + roomPath() + ':' + name;
  const getFaces = (name) => load(faceKey(name), {});
  function setFaces(name, faces) {
    if (JSON.stringify(getFaces(name)) === JSON.stringify(faces)) return false;
    save(faceKey(name), faces);
    return true;
  }

  // ---- 聊天輸入區 ----

  function chatInput() {
    return document.querySelector(CHAT_SEL);
  }

  function currentName() {
    const form = chatInput()?.closest('form');
    const input = form?.querySelector(NAME_INPUT_SEL) || document.querySelector(NAME_INPUT_SEL);
    return input?.value || '';
  }

  // React 的受控輸入框不能直接改 value，要用原生 setter 再觸發 input 事件
  const nativeSetValue =
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;

  function setTextareaValue(ta, value) {
    nativeSetValue.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  let sending = false;
  async function send(text) {
    const ta = chatInput();
    if (!ta || sending) return false;
    sending = true;
    try {
      // 暫存使用者正在打的草稿，送出後放回去
      const draft = ta.value;
      setTextareaValue(ta, text);
      await sleep(0);
      const form = ta.closest('form');
      const submit = form?.querySelector('button[type="submit"]');
      if (submit && !submit.disabled) submit.click();
      else ta.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
      }));
      if (draft) {
        // 等 CCFolia 清空輸入框後再還原草稿
        await waitFor(() => chatInput()?.value !== text, 1000);
        const now = chatInput();
        if (now && !now.value) setTextareaValue(now, draft);
      }
      return true;
    } finally {
      sending = false;
    }
  }

  async function waitFor(fn, timeout = 1500) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(30);
    }
    return null;
  }

  // ---- 從角色編輯視窗讀取常用對話表 ----

  function dialogCharName(ta) {
    return ta.closest(DIALOG_SEL)?.querySelector(NAME_INPUT_SEL)?.value || '';
  }

  // 開啟角色編輯視窗時記下內容
  let seen = new WeakSet();
  function captureDialogs() {
    for (const ta of document.querySelectorAll(COMMANDS_SEL)) {
      if (seen.has(ta)) continue;
      const name = dialogCharName(ta);
      if (!name || !ta.value) continue; // 內容可能還沒載入，下次再試
      seen.add(ta);
      if (getCommands(name) !== ta.value) {
        setCommands(name, ta.value);
        if (name === currentName()) render();
      }
    }
    captureFaces();
  }

  // 讀取編輯視窗中的差分：名稱欄位旁邊的按鈕裡就是差分圖片
  function captureFaces() {
    const byDialog = new Map();
    for (const input of document.querySelectorAll(FACE_LABEL_SEL)) {
      const dialog = input.closest(DIALOG_SEL);
      if (!dialog) continue;
      if (!byDialog.has(dialog)) byDialog.set(dialog, {});
      const label = faceName(input.value);
      const img = input.closest('.MuiFormControl-root')?.parentElement?.querySelector('img');
      if (label && img?.src) byDialog.get(dialog)[label] = img.src;
    }
    for (const [dialog, faces] of byDialog) {
      const name = dialog.querySelector(NAME_INPUT_SEL)?.value;
      if (!name || !Object.keys(faces).length) continue;
      if (setFaces(name, faces) && name === currentName()) render();
    }
  }

  // 在編輯視窗中修改時即時同步
  document.addEventListener('input', (e) => {
    if (!e.target.matches?.(COMMANDS_SEL)) return;
    const name = dialogCharName(e.target);
    if (!name) return;
    setCommands(name, e.target.value);
    if (name === currentName()) render();
  }, true);

  // ---- 從 CCFolia 的資料（Redux store）讀取常用對話表 ----

  // 由 React 根節點往下找 <Provider store>，找到後快取
  let store = null;
  function findStore() {
    if (store) return store;
    const root = document.getElementById('root') || document.body.firstElementChild;
    const key = root && Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
    let fiber = key ? root[key] : root?._reactRootContainer?._internalRoot?.current;
    // 深度優先走訪，Provider 通常在最上層附近
    const stack = fiber ? [fiber] : [];
    for (let n = 0; stack.length && n < 5000; n++) {
      fiber = stack.pop();
      const s = fiber.memoizedProps?.store;
      if (s && typeof s.getState === 'function') return (store = s);
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
    return null;
  }

  // 在 state 中找出所有具有 name 與 commands 字串欄位的角色資料
  function collectCharacters(state) {
    const found = [];
    const visited = new WeakSet();
    const walk = (obj, depth) => {
      if (!obj || typeof obj !== 'object' || visited.has(obj) || depth > 6) return;
      visited.add(obj);
      if (typeof obj.name === 'string' && typeof obj.commands === 'string') {
        found.push(obj);
        return;
      }
      for (const k in obj) walk(obj[k], depth + 1);
    };
    walk(state, 0);
    return found;
  }

  // 讀取所有角色的常用對話表並存起來；回傳是否有讀到任何資料
  function readFromStore() {
    let state;
    try { state = findStore()?.getState(); } catch { return false; }
    if (!state) return false;
    const chars = collectCharacters(state);
    // 同名角色時，優先採用有內容的那個
    const byName = new Map();
    for (const c of chars) {
      if (!byName.has(c.name) || (!byName.get(c.name) && c.commands)) byName.set(c.name, c.commands);
    }
    for (const [name, cmds] of byName) setCommands(name, cmds);
    // 差分：faces 為 [{ label, iconUrl }]，同名角色合併
    const facesByName = new Map();
    for (const c of chars) {
      if (!Array.isArray(c.faces)) continue;
      const faces = facesByName.get(c.name) || {};
      for (const f of c.faces) {
        const label = faceName(f?.label);
        if (label && f.iconUrl && !faces[label]) faces[label] = f.iconUrl;
      }
      facesByName.set(c.name, faces);
    }
    for (const [name, faces] of facesByName) setFaces(name, faces);
    return byName.size > 0;
  }

  async function reload() {
    panel?.classList.add('cp-busy');
    try {
      readFromStore();
      // 若有開著的角色編輯視窗，以視窗內容為準
      seen = new WeakSet();
      captureDialogs();
      render();
      await sleep(200);
    } finally {
      panel?.classList.remove('cp-busy');
    }
  }

  // ---- 懸浮面板 ----

  let panel = null;
  let shownName = null;

  // ---- 差分預覽 ----

  const preview = document.createElement('div');
  preview.id = PREVIEW_ID;
  const previewImg = document.createElement('img');
  previewImg.alt = '';
  preview.appendChild(previewImg);
  document.body.appendChild(preview);

  function showPreview(btn, url) {
    previewImg.onload = () => positionPreview(btn);
    previewImg.src = url;
    preview.classList.add('cp-show');
    positionPreview(btn);
  }

  // 預覽放在面板右側，右邊空間不夠時改放左側
  function positionPreview(btn) {
    if (!panel || !preview.classList.contains('cp-show')) return;
    const p = panel.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const w = preview.offsetWidth, h = preview.offsetHeight;
    const x = p.right + 6 + w <= innerWidth ? p.right + 6 : Math.max(0, p.left - 6 - w);
    const y = Math.min(Math.max(0, b.top), Math.max(0, innerHeight - h));
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
  }

  function hidePreview() {
    preview.classList.remove('cp-show');
    previewImg.onload = null;
  }

  function render() {
    hidePreview();
    if (!panel) return;
    const name = currentName();
    shownName = name;
    panel.querySelector('.cp-title').textContent = name ? `常用對話：${name}` : '常用對話';
    panel.querySelector('.cp-title').title = name;

    const body = panel.querySelector('.cp-body');
    body.textContent = '';
    const stored = name ? getCommands(name) : null;
    const cols = parseCommands(stored ?? '');
    const faces = name ? getFaces(name) : {};

    const list = document.createElement('div');
    list.className = 'cp-list';
    if (!cols.length) {
      const empty = document.createElement('div');
      empty.className = 'cp-empty';
      empty.textContent = stored === null ? '尚未讀取常用對話，按 ⟳ 重新讀取' : '此角色沒有常用對話';
      list.appendChild(empty);
    }
    const row = document.createElement('div');
    row.className = 'cp-cols';
    for (const col of cols) {
      const colEl = document.createElement('div');
      colEl.className = 'cp-col';
      if (col.title) {
        const title = document.createElement('div');
        title.className = 'cp-col-title';
        title.textContent = col.title;
        title.title = col.title;
        colEl.appendChild(title);
      }
      for (const c of col.cmds) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cp-item';
        b.textContent = c.label;
        b.title = c.text;
        b.addEventListener('click', async () => {
          if (await send(c.text)) {
            b.classList.add('cp-sent');
            setTimeout(() => b.classList.remove('cp-sent'), 300);
          }
        });
        // 「@差分名稱」的指令，滑鼠移上時預覽該差分
        const face = c.text.startsWith('@') && faces[faceName(c.text.split(/\s+/)[0])];
        if (face) {
          b.addEventListener('mouseenter', () => showPreview(b, face));
          b.addEventListener('mouseleave', hidePreview);
        }
        colEl.appendChild(b);
      }
      row.appendChild(colEl);
    }
    list.appendChild(row);
    body.appendChild(list);
    // 欄數改變會改變面板寬度，重新夾在視窗內
    place(panel.offsetLeft, panel.offsetTop);
  }

  function clampPos(x, y) {
    const w = panel.offsetWidth, h = panel.offsetHeight;
    return [
      Math.min(Math.max(0, x), Math.max(0, innerWidth - w)),
      Math.min(Math.max(0, y), Math.max(0, innerHeight - h)),
    ];
  }

  function place(x, y) {
    [x, y] = clampPos(x, y);
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    return [x, y];
  }

  function createPanel() {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="cp-head">
        <span class="cp-title">常用對話</span>
        <button type="button" class="cp-btn cp-refresh" title="重新讀取常用對話">⟳</button>
      </div>
      <div class="cp-body"></div>`;
    document.body.appendChild(panel);

    panel.querySelector('.cp-refresh').addEventListener('click', reload);

    // 拖曳標題列移動
    const head = panel.querySelector('.cp-head');
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.cp-btn')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
      head.setPointerCapture(e.pointerId);
      const move = (ev) => place(ev.clientX - dx, ev.clientY - dy);
      const up = () => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
        save(POS_KEY, [panel.offsetLeft, panel.offsetTop]);
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
    });

    render();
    const [x, y] = load(POS_KEY, [innerWidth - 360, 80]);
    place(x, y);
  }

  addEventListener('resize', () => {
    if (panel) place(panel.offsetLeft, panel.offsetTop);
  });

  // ---- 功能開關 ----

  let enabled = load(ENABLED_KEY, true);
  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = 'ccf-cp-switch';
  // 對話框圖示（MUI ChatIcon）
  switchBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"></path></svg>';
  switchBtn.addEventListener('click', () => {
    enabled = !enabled;
    save(ENABLED_KEY, enabled);
    tick();
  });

  function placeSwitch() {
    const row = document.querySelector(DICEBOT_LINK_SEL)?.closest('.MuiBox-root');
    if (!row) return;
    // 只在狀態不同時才更新，避免觸發 MutationObserver 造成無限重繪
    if (!switchBtn.title || switchBtn.classList.contains('cp-on') !== enabled) {
      switchBtn.classList.toggle('cp-on', enabled);
      switchBtn.title = enabled ? '常用對話：開（點擊關閉）' : '常用對話：關（點擊開啟）';
    }
    if (!row.classList.contains('ccf-cp-switch-row')) row.classList.add('ccf-cp-switch-row');
    if (switchBtn.parentElement !== row) row.appendChild(switchBtn);
  }

  // 只在房間頁面顯示；CCFolia 是單頁應用，需持續檢查網址與輸入區是否存在
  let lastRoom = null;
  function tick() {
    placeSwitch();
    captureDialogs();
    const room = roomPath();
    const ready = enabled && room && chatInput();
    if (!ready) {
      if (panel) { panel.remove(); panel = null; }
      lastRoom = null;
      return;
    }
    if (!panel) createPanel();
    // 切換房間或發言角色時重新顯示
    const name = currentName();
    if (room !== lastRoom || name !== shownName) {
      lastRoom = room;
      // 第一次看到的角色自動讀取一次
      if (name && getCommands(name) === null) readFromStore();
      render();
    }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; tick(); });
  }).observe(document.body, { childList: true, subtree: true });
  // 名稱欄位的 value 變動不會觸發 childList，另外定時檢查
  setInterval(tick, 1000);
  tick();
})();

// ==UserScript==
// @name         CCFolia 角色快速切換
// @namespace    ccf-char-switcher
// @version      1.1.0
// @description  在 CCFolia 房間內加入可拖曳的懸浮選單，列出自己所有角色，點一下即可切換聊天發言角色
// @match        https://ccfolia.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const PANEL_ID = 'ccf-char-switcher';
  const POS_KEY = 'ccf-char-switcher:pos';
  const ENABLED_KEY = 'ccf-char-switcher:enabled';
  const LIST_KEY = 'ccf-char-switcher:list:'; // + 房間路徑
  // 聊天輸入區的角色名稱欄位；選擇角色按鈕就在它旁邊
  const NAME_INPUT_SEL = 'input[name="name"]';
  // 點開選擇角色後出現的選單（MUI Popover / Menu）
  const MENU_SEL = '.MuiPopover-paper, .MuiMenu-paper, [role="menu"]';
  const ITEM_SEL = '[role="menuitem"], .MuiMenuItem-root, .MuiListItemButton-root, .MuiListItem-button';
  // 開關放在聊天輸入區下方「Dicebot engine : BCDice@x.x.x」那一行
  const DICEBOT_LINK_SEL = 'a[href*="bcdice.org"]';
  // 讀取選單時先把它藏起來，避免畫面閃一下
  const HIDING = 'ccf-cs-hiding';

  const CSS = `
/* 想調顏色，改下面這些變數即可 */
#${PANEL_ID} {
  --cs-bg: rgba(33, 33, 33, 0.92);
  --cs-head: rgba(255, 255, 255, 0.08);
  --cs-item-hover: rgba(255, 255, 255, 0.12);
  --cs-active: #1976d2;
  --cs-text: #ffffff;
  --cs-sub: rgba(255, 255, 255, 0.6);

  position: fixed;
  z-index: 1400; /* 高於 CCFolia 的面板，低於 MUI 對話框 (1300 以上的 modal 仍可操作) */
  width: 120px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  background: var(--cs-bg);
  color: var(--cs-text);
  font-size: 11px;
  box-shadow: 0 3px 13px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  user-select: none;
}
#${PANEL_ID} .cs-head {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 6px;
  background: var(--cs-head);
  cursor: move;
  touch-action: none;
}
#${PANEL_ID} .cs-title { flex: 1; font-weight: bold; white-space: nowrap; }
#${PANEL_ID} .cs-btn {
  border: 0;
  padding: 0 3px;
  background: transparent;
  color: var(--cs-sub);
  font: inherit;
  cursor: pointer;
}
#${PANEL_ID} .cs-btn:hover { color: var(--cs-text); }
#${PANEL_ID} .cs-list { overflow-y: auto; padding: 3px 0; }
#${PANEL_ID} .cs-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 3px 8px;
  border: 0;
  background: transparent;
  color: var(--cs-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
#${PANEL_ID} .cs-item:hover { background: var(--cs-item-hover); }
#${PANEL_ID} .cs-item.cs-active { background: var(--cs-active); }
#${PANEL_ID} .cs-item img {
  width: 19px;
  height: 19px;
  flex: none;
  border-radius: 3px;
  object-fit: cover;
}
#${PANEL_ID} .cs-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${PANEL_ID} .cs-empty { padding: 6px 8px; color: var(--cs-sub); font-size: 10px; }
#${PANEL_ID}.cs-busy { opacity: 0.6; pointer-events: none; }

/* 功能開關（Dicebot engine 那一行的右側） */
.ccf-cs-switch-row { display: flex !important; align-items: center; gap: 8px; }
.ccf-cs-switch {
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
.ccf-cs-switch:hover { opacity: 1; }
.ccf-cs-switch.cs-on { border-color: #1976d2; }
.ccf-cs-switch svg { width: 14px; height: 14px; fill: currentColor; }

body.${HIDING} .MuiPopover-root,
body.${HIDING} .MuiMenu-root,
.${HIDING}.MuiPopover-root,
.${HIDING}.MuiMenu-root,
.${HIDING}.MuiModal-root { display: none !important; }
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

  // ---- 與 CCFolia 原生的選擇角色選單互動 ----

  function findSelectButton() {
    const input = document.querySelector(NAME_INPUT_SEL);
    // 名稱欄位與頭像按鈕是兄弟節點
    const btn = input?.closest('.MuiInputBase-root')?.parentElement?.querySelector('button');
    return btn || document.querySelector('button[aria-label="選擇角色"]');
  }

  function currentName() {
    return document.querySelector(NAME_INPUT_SEL)?.value || '';
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

  function readItems(menu) {
    const items = [];
    for (const el of menu.querySelectorAll(ITEM_SEL)) {
      // 巢狀符合時只取最外層
      if (el.parentElement.closest(ITEM_SEL) && menu.contains(el.parentElement.closest(ITEM_SEL))) continue;
      const name = (el.querySelector('.MuiListItemText-primary')?.textContent || el.textContent || '').trim();
      if (!name) continue;
      items.push({ el, name, img: el.querySelector('img')?.src || '' });
    }
    return items;
  }

  function closeMenu(menu) {
    const target = menu.querySelector('[role="menu"], ul') || menu;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // 若 Escape 沒效，點背景關閉
    setTimeout(() => {
      if (!menu.isConnected) return;
      menu.closest('.MuiPopover-root, .MuiModal-root')?.querySelector('.MuiBackdrop-root')?.click();
    }, 100);
  }

  // 開啟原生選單（隱藏），執行 fn(items, menu)，結束後恢復顯示
  let running = false;
  async function withMenu(fn) {
    if (running) return null;
    const btn = findSelectButton();
    if (!btn) return null;
    running = true;
    panel?.classList.add('cs-busy');
    document.body.classList.add(HIDING);
    try {
      const before = new Set(document.querySelectorAll(MENU_SEL));
      btn.click();
      const menu = await waitFor(() =>
        [...document.querySelectorAll(MENU_SEL)].find((m) => !before.has(m) && readItems(m).length));
      if (!menu) return null;
      // 這個選單本身直接標記為隱藏，關閉時不用等淡出動畫結束
      (menu.closest('.MuiPopover-root, .MuiMenu-root, .MuiModal-root') || menu).classList.add(HIDING);
      return await fn(readItems(menu), menu);
    } finally {
      document.body.classList.remove(HIDING);
      panel?.classList.remove('cs-busy');
      running = false;
    }
  }

  function storeList(items) {
    chars = items.map(({ name, img }) => ({ name, img }));
    save(LIST_KEY + roomPath(), chars);
    render();
  }

  async function refresh() {
    await withMenu((items, menu) => {
      storeList(items);
      closeMenu(menu);
    });
  }

  async function switchTo(index) {
    const want = chars[index];
    if (!want) return;
    await withMenu((items, menu) => {
      storeList(items);
      // 名稱相同的角色依出現順序對應
      const sameBefore = chars.slice(0, index).filter((c) => c.name === want.name).length;
      const target = items.filter((it) => it.name === want.name)[sameBefore];
      if (target) target.el.click();
      else closeMenu(menu);
    });
    render();
  }

  // ---- 懸浮面板 ----

  let panel = null;
  let chars = [];

  function render() {
    if (!panel) return;
    const list = panel.querySelector('.cs-list');
    list.textContent = '';
    if (!chars.length) {
      const empty = document.createElement('div');
      empty.className = 'cs-empty';
      empty.textContent = '尚未讀取角色，按 ⟳ 重新整理';
      list.appendChild(empty);
      return;
    }
    const cur = currentName();
    chars.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-item' + (c.name === cur ? ' cs-active' : '');
      b.title = c.name;
      if (c.img) {
        const img = document.createElement('img');
        img.src = c.img;
        img.draggable = false;
        b.appendChild(img);
      }
      const span = document.createElement('span');
      span.textContent = c.name;
      b.appendChild(span);
      b.addEventListener('click', () => switchTo(i));
      list.appendChild(b);
    });
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
      <div class="cs-head">
        <span class="cs-title">角色切換</span>
        <button type="button" class="cs-btn cs-refresh" title="重新讀取角色列表">⟳</button>
      </div>
      <div class="cs-list"></div>`;
    document.body.appendChild(panel);

    panel.querySelector('.cs-refresh').addEventListener('click', refresh);

    // 拖曳標題列移動
    const head = panel.querySelector('.cs-head');
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.cs-btn')) return;
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

    const [x, y] = load(POS_KEY, [innerWidth - 200, 80]);
    place(x, y);

    chars = load(LIST_KEY + roomPath(), []);
    render();
  }

  addEventListener('resize', () => {
    if (panel) place(panel.offsetLeft, panel.offsetTop);
  });

  // ---- 功能開關 ----

  let enabled = load(ENABLED_KEY, true);
  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = 'ccf-cs-switch';
  // 人影圖示（MUI PersonIcon）
  switchBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>';
  switchBtn.addEventListener('click', () => {
    enabled = !enabled;
    save(ENABLED_KEY, enabled);
    lastRoom = null; // 重新開啟時重新載入列表
    tick();
  });

  function placeSwitch() {
    const row = document.querySelector(DICEBOT_LINK_SEL)?.closest('.MuiBox-root');
    if (!row) return;
    // 只在狀態不同時才更新，避免觸發 MutationObserver 造成無限重繪
    if (!switchBtn.title || switchBtn.classList.contains('cs-on') !== enabled) {
      switchBtn.classList.toggle('cs-on', enabled);
      switchBtn.title = enabled ? '角色切換：開（點擊關閉）' : '角色切換：關（點擊開啟）';
    }
    if (!row.classList.contains('ccf-cs-switch-row')) row.classList.add('ccf-cs-switch-row');
    if (switchBtn.parentElement !== row) row.appendChild(switchBtn);
  }

  // 只在房間頁面顯示；CCFolia 是單頁應用，需持續檢查網址與輸入區是否存在
  let lastRoom = null;
  let lastName = null;
  function tick() {
    placeSwitch();
    const room = roomPath();
    const ready = enabled && room && findSelectButton();
    if (!ready) {
      if (panel) { panel.remove(); panel = null; }
      lastRoom = null;
      return;
    }
    if (!panel) createPanel();
    if (room !== lastRoom) {
      lastRoom = room;
      chars = load(LIST_KEY + room, []);
      render();
      if (!chars.length) refresh(); // 第一次進房間自動讀取一次
    }
    // 在原生選單切換角色時也同步標示
    const name = currentName();
    if (name !== lastName) { lastName = name; render(); }
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

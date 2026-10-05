// ==UserScript==
// @name         CCFolia 其他房間
// @namespace    ccf-external-rooms
// @version      1.0.0
// @description  在 CCFolia 首頁加入「其他房間」頁籤，可輸入非自己建立的房間網址保存在首頁，與自己的房間分開顯示
// @match        https://ccfolia.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const STORE_KEY = 'ccf-external-rooms';
  // 房間卡片裡連到房間的連結（/rooms/<房間ID>）
  const ROOM_LINK_SEL = 'a[href*="/rooms/"]';
  // 本腳本與房間資料夾腳本自己產生的元素，找房間卡片時要略過
  const OWN_SEL = '.ccf-ext-tabs, .ccf-ext-panel, .ccf-ext-menu, .ccf-folder-bar, .ccf-folder-menu';
  const MINE = 'mine';
  const EXT = 'ext';

  const CSS = `
/* 想調顏色，改下面這些變數即可 */
.ccf-ext-tabs, .ccf-ext-panel {
  --ce-bg: rgba(255, 255, 255, 0.06);
  --ce-card: rgba(255, 255, 255, 0.08);
  --ce-card-hover: rgba(255, 255, 255, 0.14);
  --ce-active: #1976d2;
  --ce-text: #ffffff;
  --ce-sub: rgba(255, 255, 255, 0.6);
  --ce-line: rgba(255, 255, 255, 0.2);

  color: var(--ce-text);
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}

/* 頁籤列 */
.ccf-ext-tabs {
  display: flex;
  gap: 4px;
  margin: 8px 0 8px;
  border-bottom: 1px solid var(--ce-line);
}
.ccf-ext-tabs .ce-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: none;
  color: var(--ce-sub);
  font: inherit;
  cursor: pointer;
  user-select: none;
}
.ccf-ext-tabs .ce-tab:hover { color: var(--ce-text); }
.ccf-ext-tabs .ce-tab.ce-active {
  color: var(--ce-text);
  border-bottom-color: var(--ce-active);
}
.ccf-ext-tabs .ce-count { font-size: 12px; opacity: 0.7; }

/* 其他房間面板 */
.ccf-ext-panel { margin: 8px 0 16px; }
.ccf-ext-panel .ce-add {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--ce-bg);
}
.ccf-ext-panel .ce-input {
  flex: 1 1 260px;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--ce-line);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  color: var(--ce-text);
  font: inherit;
}
.ccf-ext-panel .ce-input:focus { outline: none; border-color: var(--ce-active); }
.ccf-ext-panel .ce-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  background: var(--ce-active);
  color: #fff;
  font: inherit;
  cursor: pointer;
}
.ccf-ext-panel .ce-btn.ce-ghost {
  background: transparent;
  border: 1px dashed var(--ce-sub);
  color: var(--ce-sub);
}
.ccf-ext-panel .ce-empty {
  padding: 32px 12px;
  text-align: center;
  color: var(--ce-sub);
}
.ccf-ext-panel .ce-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.ccf-ext-panel .ce-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background: var(--ce-card);
  overflow: hidden;
  cursor: pointer;
}
.ccf-ext-panel .ce-card:hover { background: var(--ce-card-hover); }
.ccf-ext-panel .ce-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  font-size: 40px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.85);
  user-select: none;
}
.ccf-ext-panel .ce-body { padding: 8px 12px 10px; }
.ccf-ext-panel .ce-name {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ccf-ext-panel .ce-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ce-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ccf-ext-panel .ce-more {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 8px;
  border: none;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  line-height: 1.6;
  cursor: pointer;
  opacity: 0.75;
}
.ccf-ext-panel .ce-more:hover { opacity: 1; background: rgba(0, 0, 0, 0.85); }

/* 彈出選單 */
.ccf-ext-menu {
  position: fixed;
  z-index: 99999;
  min-width: 160px;
  padding: 4px 0;
  border-radius: 6px;
  background: #2b2b2b;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  font-size: 14px;
}
.ccf-ext-menu .ce-item {
  display: block;
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.ccf-ext-menu .ce-item:hover { background: rgba(255, 255, 255, 0.1); }
.ccf-ext-menu .ce-item.ce-danger { color: #ff8a80; }
.ccf-ext-menu hr {
  margin: 4px 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}
`;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ---- 資料 ----
  // rooms: [{ id, name, addedAt, visitedAt }]
  let state = { rooms: [], tab: MINE };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) state = { ...state, ...saved };
  } catch {}

  // 每次資料變動就加 1，面板據此判斷要不要重畫
  let version = 0;

  function save() {
    version++;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
    schedule();
  }

  const roomById = (id) => state.rooms.find((r) => r.id === id);

  function roomIdFromUrl(url) {
    const m = /\/rooms\/([^/?#]+)/.exec(url || '');
    return m ? m[1] : null;
  }

  // 接受完整網址、/rooms/xxx 或單純的房間ID
  function parseRoomInput(text) {
    text = (text || '').trim();
    const fromUrl = roomIdFromUrl(text);
    if (fromUrl) return fromUrl;
    return /^[A-Za-z0-9_-]{4,}$/.test(text) ? text : null;
  }

  function addRoom(text, ownIds) {
    const id = parseRoomInput(text);
    if (!id) {
      alert('看不懂這個網址。\n請貼上像 https://ccfolia.com/rooms/xxxxxx 這樣的房間網址。');
      return false;
    }
    const exist = roomById(id);
    if (exist) {
      alert(`這間房間已經在列表裡了：「${exist.name}」`);
      return false;
    }
    if (ownIds.has(id)) {
      alert('這間房間已經在「我的房間」裡，不需要另外加入。');
      return false;
    }
    const name = prompt('房間名稱（之後可以再改）：', id)?.trim();
    if (name === undefined) return false; // 按了取消
    state.rooms.unshift({
      id,
      name: name || id,
      addedAt: Date.now(),
      visitedAt: 0,
    });
    save();
    return true;
  }

  function renameRoom(id) {
    const r = roomById(id);
    if (!r) return;
    const name = prompt('房間名稱：', r.name)?.trim();
    if (!name) return;
    r.name = name;
    save();
  }

  function removeRoom(id) {
    const r = roomById(id);
    if (!r || !confirm(`從列表移除「${r.name}」？\n只會移除這裡的紀錄，不會影響房間本身。`)) return;
    state.rooms = state.rooms.filter((x) => x !== r);
    save();
  }

  function moveRoom(id, delta) {
    const i = state.rooms.findIndex((r) => r.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= state.rooms.length) return;
    [state.rooms[i], state.rooms[j]] = [state.rooms[j], state.rooms[i]];
    save();
  }

  function copyUrl(id) {
    const url = `${location.origin}/rooms/${id}`;
    navigator.clipboard?.writeText(url).catch(() => prompt('房間網址：', url));
  }

  // ---- 匯出／匯入 ----
  function exportData() {
    const data = { type: STORE_KEY, version: 1, rooms: state.rooms };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ccfolia-其他房間-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // 與現有資料合併，相同房間ID以本機資料為準
  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      let rooms;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.rooms)) throw 0;
        rooms = data.rooms.filter((r) => r && typeof r.id === 'string' && typeof r.name === 'string');
      } catch {
        alert('無法讀取：這不是其他房間的匯出檔。');
        return;
      }
      let added = 0;
      for (const r of rooms) {
        if (roomById(r.id)) continue;
        state.rooms.push({
          id: r.id,
          name: r.name,
          addedAt: r.addedAt || Date.now(),
          visitedAt: r.visitedAt || 0,
        });
        added++;
      }
      save();
      alert(`匯入完成：新增 ${added} 間房間（略過 ${rooms.length - added} 間已存在的）。`);
    });
    input.click();
  }

  // ---- 彈出選單 ----
  let menuEl = null;

  function closeMenu() {
    menuEl?.remove();
    menuEl = null;
  }

  // items: [{ label, onClick, danger }] 或 'sep'
  function openMenu(anchor, items) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'ccf-ext-menu';
    for (const it of items) {
      if (it === 'sep') {
        menuEl.appendChild(document.createElement('hr'));
        continue;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ce-item' + (it.danger ? ' ce-danger' : '');
      b.textContent = it.label;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        it.onClick();
      });
      menuEl.appendChild(b);
    }
    document.body.appendChild(menuEl);

    const r = anchor.getBoundingClientRect();
    const mw = menuEl.offsetWidth;
    const mh = menuEl.offsetHeight;
    menuEl.style.left = Math.max(4, Math.min(r.left, innerWidth - mw - 4)) + 'px';
    menuEl.style.top = (r.bottom + mh + 4 > innerHeight ? Math.max(4, r.top - mh - 4) : r.bottom + 4) + 'px';
  }

  document.addEventListener('pointerdown', (e) => {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  window.addEventListener('scroll', closeMenu, true);

  function roomMenu(anchor, id) {
    openMenu(anchor, [
      { label: '在新分頁開啟', onClick: () => window.open(`/rooms/${id}`, '_blank') },
      { label: '複製房間網址', onClick: () => copyUrl(id) },
      { label: '重新命名', onClick: () => renameRoom(id) },
      'sep',
      { label: '往前移', onClick: () => moveRoom(id, -1) },
      { label: '往後移', onClick: () => moveRoom(id, 1) },
      'sep',
      { label: '從列表移除', danger: true, onClick: () => removeRoom(id) },
    ]);
  }

  // ---- 找出自己的房間列表 ----
  // 與房間資料夾腳本相同的做法：從房間連結往上找，父層只含一間房間就繼續往上，
  // 停下的元素是卡片，它的父層就是房間列表
  function findCards() {
    const cards = new Map(); // 卡片元素 → 房間ID
    for (const a of document.querySelectorAll(ROOM_LINK_SEL)) {
      if (a.closest(OWN_SEL)) continue;
      const id = roomIdFromUrl(a.getAttribute('href'));
      if (!id) continue;
      let card = a;
      while (card.parentElement && card.parentElement !== document.body) {
        const ids = new Set();
        for (const x of card.parentElement.querySelectorAll(ROOM_LINK_SEL)) {
          if (!x.closest(OWN_SEL)) ids.add(roomIdFromUrl(x.getAttribute('href')));
        }
        if (ids.size > 1) break;
        card = card.parentElement;
      }
      if (card.parentElement === document.body) continue;
      cards.set(card, id);
    }
    return cards;
  }

  // ---- 畫面 ----
  let tabsEl = null;
  let panelEl = null;
  let panelVersion = -1;
  let ownIds = new Set();

  // 依房間ID產生固定的底色，沒有縮圖時用來區分房間
  function colorOf(id) {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h}, 45%, 38%)`;
  }

  function fmtDate(t) {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  function enterRoom(id, newTab) {
    if (newTab) window.open(`/rooms/${id}`, '_blank');
    else location.assign(`/rooms/${id}`);
  }

  function renderTabs(ownCount) {
    tabsEl.textContent = '';
    const tab = (label, count, key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ce-tab' + (state.tab === key ? ' ce-active' : '');
      b.append(label);
      const c = document.createElement('span');
      c.className = 'ce-count';
      c.textContent = count;
      b.appendChild(c);
      b.addEventListener('click', () => {
        if (state.tab === key) return;
        state.tab = key;
        save();
      });
      return b;
    };
    tabsEl.appendChild(tab('我的房間', ownCount, MINE));
    tabsEl.appendChild(tab('其他房間', state.rooms.length, EXT));
  }

  function renderPanel() {
    panelEl.textContent = '';

    // 輸入列
    const form = document.createElement('form');
    form.className = 'ce-add';
    const input = document.createElement('input');
    input.className = 'ce-input';
    input.placeholder = '貼上房間網址，例如 https://ccfolia.com/rooms/xxxxxx';
    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'ce-btn';
    addBtn.textContent = '加入';
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'ce-btn ce-ghost';
    more.textContent = '⋯';
    more.title = '匯出／匯入';
    more.addEventListener('click', () => openMenu(more, [
      { label: '匯出列表', onClick: exportData },
      { label: '匯入（與現有資料合併）…', onClick: importData },
    ]));
    form.append(input, addBtn, more);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (addRoom(input.value, ownIds)) input.value = '';
    });
    panelEl.appendChild(form);

    if (!state.rooms.length) {
      const empty = document.createElement('div');
      empty.className = 'ce-empty';
      empty.textContent = '還沒有其他房間。貼上別人建立的房間網址，就能保存在這裡。';
      panelEl.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'ce-grid';
    for (const r of state.rooms) {
      const card = document.createElement('div');
      card.className = 'ce-card';
      card.title = `${r.name}\n/rooms/${r.id}`;
      // 不用 <a href="/rooms/..">，避免被房間資料夾腳本當成自己的房間卡片
      card.addEventListener('click', (e) => enterRoom(r.id, e.ctrlKey || e.metaKey || e.shiftKey));
      card.addEventListener('auxclick', (e) => {
        if (e.button === 1) enterRoom(r.id, true);
      });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        roomMenu(card, r.id);
      });

      const thumb = document.createElement('div');
      thumb.className = 'ce-thumb';
      thumb.style.background = colorOf(r.id);
      thumb.textContent = [...r.name][0] || '?';

      const body = document.createElement('div');
      body.className = 'ce-body';
      const name = document.createElement('div');
      name.className = 'ce-name';
      name.textContent = r.name;
      const meta = document.createElement('div');
      meta.className = 'ce-meta';
      meta.textContent = r.visitedAt ? `上次進入：${fmtDate(r.visitedAt)}` : `加入於：${fmtDate(r.addedAt)}`;
      body.append(name, meta);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ce-more';
      btn.textContent = '⋯';
      btn.title = '更多操作';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        roomMenu(btn, r.id);
      });

      card.append(thumb, body, btn);
      grid.appendChild(card);
    }
    panelEl.appendChild(grid);
  }

  // ---- 房間內：記錄進入時間 ----
  function trackRoom() {
    const id = roomIdFromUrl(location.pathname);
    const r = id && roomById(id);
    if (!r) return;
    // 同一次進房只記一次（一小時內不重複寫入）
    if (Date.now() - r.visitedAt > 3600e3) {
      r.visitedAt = Date.now();
      save();
    }
  }

  let loggedMissing = false;

  function apply() {
    if (location.pathname.startsWith('/rooms/')) {
      trackRoom();
      return;
    }
    if (!location.pathname.startsWith('/home')) return;

    const cards = findCards();
    ownIds = new Set(cards.values());

    // 自己的房間列表；房間資料夾腳本的資料夾列在列表正上方，一起當成「我的房間」的內容
    const list = cards.size ? cards.keys().next().value.parentElement : null;
    if (!list) {
      if (!loggedMissing) {
        loggedMissing = true;
        console.info('[ccf-external-rooms] 尚未找到房間列表（等待載入中，或頁面結構已變更）');
      }
      return;
    }
    const folderBar = list.previousElementSibling?.classList.contains('ccf-folder-bar')
      ? list.previousElementSibling
      : null;
    const top = folderBar || list;

    if (!tabsEl) {
      tabsEl = document.createElement('div');
      tabsEl.className = 'ccf-ext-tabs';
    }
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.className = 'ccf-ext-panel';
    }
    if (tabsEl.nextElementSibling !== top) top.parentElement.insertBefore(tabsEl, top);
    if (list.nextElementSibling !== panelEl) list.after(panelEl);

    const ext = state.tab === EXT;
    const hide = ext ? 'none' : '';
    if (list.style.display !== hide) list.style.display = hide;
    if (folderBar && folderBar.style.display !== hide) folderBar.style.display = hide;
    const show = ext ? '' : 'none';
    if (panelEl.style.display !== show) panelEl.style.display = show;

    const tabsKey = `${version}:${cards.size}`;
    if (tabsEl.dataset.key !== tabsKey) {
      tabsEl.dataset.key = tabsKey;
      renderTabs(cards.size);
    }
    if (panelVersion !== version) {
      panelVersion = version;
      renderPanel();
    }
  }

  // React 會不斷重繪 DOM，用 MutationObserver 持續補上（以 rAF 節流）
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

  apply();
})();

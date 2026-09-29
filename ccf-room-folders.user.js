// ==UserScript==
// @name         CCFolia 房間資料夾
// @namespace    ccf-room-folders
// @version      1.1.0
// @description  在 CCFolia 首頁的房間列表上方加入資料夾列，可把房間分類到資料夾並依資料夾篩選
// @match        https://ccfolia.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const STORE_KEY = 'ccf-room-folders';
  // 房間卡片裡連到房間的連結（/rooms/<房間ID>）
  const ROOM_LINK_SEL = 'a[href*="/rooms/"]';
  const ALL = '__all__';
  const NONE = '__none__';

  const CSS = `
/* 想調顏色，改下面這些變數即可 */
.ccf-folder-bar {
  --cf-bg: rgba(255, 255, 255, 0.06);
  --cf-chip: rgba(255, 255, 255, 0.10);
  --cf-chip-hover: rgba(255, 255, 255, 0.18);
  --cf-active: #1976d2;
  --cf-text: #ffffff;
  --cf-sub: rgba(255, 255, 255, 0.6);
  --cf-drop: #ffb300;

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 8px 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--cf-bg);
  color: var(--cf-text);
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}
.ccf-folder-bar .cf-title {
  color: var(--cf-sub);
  margin-right: 4px;
  user-select: none;
}
.ccf-folder-bar .cf-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: var(--cf-chip);
  color: var(--cf-text);
  font: inherit;
  cursor: pointer;
  user-select: none;
}
.ccf-folder-bar .cf-chip:hover { background: var(--cf-chip-hover); }
.ccf-folder-bar .cf-chip.cf-active { background: var(--cf-active); }
.ccf-folder-bar .cf-chip.cf-drop-over { border-color: var(--cf-drop); }
.ccf-folder-bar .cf-count {
  font-size: 12px;
  opacity: 0.7;
}
.ccf-folder-bar .cf-add {
  background: transparent;
  border: 1px dashed var(--cf-sub);
  color: var(--cf-sub);
}
.ccf-folder-bar .cf-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--cf-sub);
  user-select: none;
}

/* 房間卡片右上角的資料夾按鈕 */
.ccf-folder-card { position: relative !important; }
.ccf-folder-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
  max-width: 70%;
  padding: 2px 8px;
  border: none;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  opacity: 0.75;
}
.ccf-folder-btn:hover { opacity: 1; background: rgba(0, 0, 0, 0.85); }

/* 彈出選單 */
.ccf-folder-menu {
  position: fixed;
  z-index: 99999;
  min-width: 160px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px 0;
  border-radius: 6px;
  background: #2b2b2b;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  font-size: 14px;
}
.ccf-folder-menu .cf-item {
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
.ccf-folder-menu .cf-item:hover { background: rgba(255, 255, 255, 0.1); }
.ccf-folder-menu .cf-item.cf-danger { color: #ff8a80; }
.ccf-folder-menu hr {
  margin: 4px 0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}
`;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ---- 資料 ----
  // folders: [{ id, name }]，rooms: { 房間ID: 資料夾id }，active: 目前篩選的資料夾
  let state = { folders: [], rooms: {}, active: ALL };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) state = { ...state, ...saved };
  } catch {}

  // 每次資料變動就加 1，資料夾列據此判斷要不要重畫
  let version = 0;

  function save() {
    version++;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
    schedule();
  }

  const folderById = (id) => state.folders.find((f) => f.id === id);
  const folderOf = (roomId) => (folderById(state.rooms[roomId]) ? state.rooms[roomId] : NONE);

  function roomIdFromUrl(url) {
    const m = /\/rooms\/([^/?#]+)/.exec(url || '');
    return m ? m[1] : null;
  }

  function addFolder() {
    const name = prompt('新資料夾名稱：')?.trim();
    if (!name) return null;
    const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    state.folders.push({ id, name });
    save();
    return id;
  }

  function renameFolder(id) {
    const f = folderById(id);
    if (!f) return;
    const name = prompt('資料夾名稱：', f.name)?.trim();
    if (!name) return;
    f.name = name;
    save();
  }

  function deleteFolder(id) {
    const f = folderById(id);
    if (!f || !confirm(`刪除資料夾「${f.name}」？\n裡面的房間會回到「未分類」，房間本身不會被刪除。`)) return;
    state.folders = state.folders.filter((x) => x !== f);
    for (const r of Object.keys(state.rooms)) {
      if (state.rooms[r] === id) delete state.rooms[r];
    }
    if (state.active === id) state.active = ALL;
    save();
  }

  function moveFolder(id, delta) {
    const i = state.folders.findIndex((f) => f.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= state.folders.length) return;
    [state.folders[i], state.folders[j]] = [state.folders[j], state.folders[i]];
    save();
  }

  function assignRoom(roomId, folderId) {
    if (folderId === NONE) delete state.rooms[roomId];
    else state.rooms[roomId] = folderId;
    save();
  }

  // ---- 匯出／匯入 ----
  function exportData() {
    const data = { type: STORE_KEY, version: 1, folders: state.folders, rooms: state.rooms };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ccfolia-資料夾-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // replace = true：整個換成匯入的資料；false：合併，同名資料夾視為同一個，房間以匯入的分類為準
  function importData(replace) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      let data;
      try {
        data = JSON.parse(await file.text());
        if (!Array.isArray(data.folders) || typeof data.rooms !== 'object' || !data.rooms) throw 0;
      } catch {
        alert('無法讀取：這不是房間資料夾的匯出檔。');
        return;
      }

      const folders = data.folders.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string');
      const valid = new Set(folders.map((f) => f.id));
      const rooms = {};
      for (const [r, fid] of Object.entries(data.rooms)) if (valid.has(fid)) rooms[r] = fid;

      if (replace) {
        if (!confirm(`匯入 ${folders.length} 個資料夾、${Object.keys(rooms).length} 間房間的分類，並取代現有資料？`)) return;
        state.folders = folders.map(({ id, name }) => ({ id, name }));
        state.rooms = rooms;
        state.active = ALL;
      } else {
        const idMap = {}; // 匯入檔的資料夾id → 本機資料夾id
        for (const f of folders) {
          const same = state.folders.find((x) => x.name === f.name);
          if (same) {
            idMap[f.id] = same.id;
          } else {
            const id = folderById(f.id) ? 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : f.id;
            state.folders.push({ id, name: f.name });
            idMap[f.id] = id;
          }
        }
        for (const [r, fid] of Object.entries(rooms)) state.rooms[r] = idMap[fid];
      }
      save();
      alert(`匯入完成：${folders.length} 個資料夾、${Object.keys(rooms).length} 間房間的分類。`);
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
    menuEl.className = 'ccf-folder-menu';
    for (const it of items) {
      if (it === 'sep') {
        menuEl.appendChild(document.createElement('hr'));
        continue;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cf-item' + (it.danger ? ' cf-danger' : '');
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

    // 放在按鈕下方，超出畫面就往內收
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

  function roomMenu(anchor, roomId) {
    const cur = folderOf(roomId);
    const mark = (id) => (cur === id ? '✓ ' : '　');
    openMenu(anchor, [
      ...state.folders.map((f) => ({ label: mark(f.id) + f.name, onClick: () => assignRoom(roomId, f.id) })),
      { label: mark(NONE) + '未分類', onClick: () => assignRoom(roomId, NONE) },
      'sep',
      {
        label: '＋ 新增資料夾並放入',
        onClick: () => {
          const id = addFolder();
          if (id) assignRoom(roomId, id);
        },
      },
    ]);
  }

  function folderMenu(anchor, id) {
    openMenu(anchor, [
      { label: '重新命名', onClick: () => renameFolder(id) },
      { label: '往左移', onClick: () => moveFolder(id, -1) },
      { label: '往右移', onClick: () => moveFolder(id, 1) },
      'sep',
      { label: '刪除資料夾', danger: true, onClick: () => deleteFolder(id) },
    ]);
  }

  // 卡片上的按鈕在連結裡面，要擋掉點擊造成的跳轉與 MUI 的漣漪效果
  function stopAll(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // ---- 找出房間卡片 ----
  // 從每個房間連結往上找，只要父層還只包含這一間房間，就繼續往上；
  // 最後停下的元素就是一張卡片，它的父層就是房間列表
  function findCards() {
    const cards = new Map(); // 卡片元素 → 房間ID
    for (const a of document.querySelectorAll(ROOM_LINK_SEL)) {
      if (a.closest('.ccf-folder-bar, .ccf-folder-menu')) continue;
      const id = roomIdFromUrl(a.getAttribute('href'));
      if (!id) continue;
      let card = a;
      while (card.parentElement && card.parentElement !== document.body) {
        const ids = new Set();
        for (const x of card.parentElement.querySelectorAll(ROOM_LINK_SEL)) {
          ids.add(roomIdFromUrl(x.getAttribute('href')));
        }
        if (ids.size > 1) break;
        card = card.parentElement;
      }
      if (card.parentElement === document.body) continue; // 頁面上只有一間房的連結，不是房間列表
      cards.set(card, id);
    }
    return cards;
  }

  // ---- 資料夾列 ----
  let barEl = null;
  let barVersion = -1;
  let barCounts = '';

  function chip(label, count, key) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cf-chip' + (state.active === key ? ' cf-active' : '');
    b.dataset.key = key;
    b.append(label);
    if (count !== null) {
      const c = document.createElement('span');
      c.className = 'cf-count';
      c.textContent = count;
      b.appendChild(c);
    }
    b.addEventListener('click', () => {
      state.active = key;
      save();
    });

    if (key === ALL) return b;
    // 把房間卡片拖到資料夾上即可分類
    b.addEventListener('dragover', (e) => {
      e.preventDefault();
      b.classList.add('cf-drop-over');
    });
    b.addEventListener('dragleave', () => b.classList.remove('cf-drop-over'));
    b.addEventListener('drop', (e) => {
      e.preventDefault();
      b.classList.remove('cf-drop-over');
      const id = e.dataTransfer.getData('text/x-ccf-room') ||
        roomIdFromUrl(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'));
      if (id) assignRoom(id, key);
    });
    if (key !== NONE) {
      b.addEventListener('dblclick', () => renameFolder(key));
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        folderMenu(b, key);
      });
    }
    return b;
  }

  function renderBar(counts) {
    barEl.textContent = '';
    const title = document.createElement('span');
    title.className = 'cf-title';
    title.textContent = '📁 資料夾';
    barEl.appendChild(title);

    barEl.appendChild(chip('全部', counts[ALL] || 0, ALL));
    barEl.appendChild(chip('未分類', counts[NONE] || 0, NONE));
    for (const f of state.folders) barEl.appendChild(chip(f.name, counts[f.id] || 0, f.id));

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'cf-chip cf-add';
    add.textContent = '＋ 新增資料夾';
    add.addEventListener('click', addFolder);
    barEl.appendChild(add);

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'cf-chip cf-add';
    more.textContent = '⋯';
    more.title = '匯出／匯入分類資料';
    more.addEventListener('click', () => openMenu(more, [
      { label: '匯出分類資料', onClick: exportData },
      'sep',
      { label: '匯入（與現有資料合併）…', onClick: () => importData(false) },
      { label: '匯入（取代現有資料）…', danger: true, onClick: () => importData(true) },
    ]));
    barEl.appendChild(more);

    const hint = document.createElement('span');
    hint.className = 'cf-hint';
    hint.textContent = '拖曳房間到資料夾即可分類．右鍵資料夾可改名／排序／刪除';
    barEl.appendChild(hint);
  }

  // 拖曳卡片時帶上房間ID
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest?.('.ccf-folder-card');
    if (card?.dataset.ccfRoom) e.dataTransfer.setData('text/x-ccf-room', card.dataset.ccfRoom);
  }, true);

  let loggedMissing = false;

  function apply() {
    // 房間內不處理
    if (location.pathname.startsWith('/rooms/')) return;

    const cards = findCards();
    if (!cards.size) {
      if (!loggedMissing && location.pathname.startsWith('/home')) {
        loggedMissing = true;
        console.info('[ccf-room-folders] 尚未找到房間卡片（等待載入中，或頁面結構已變更）');
      }
      return;
    }

    if (state.active !== ALL && state.active !== NONE && !folderById(state.active)) state.active = ALL;

    const counts = { [ALL]: 0 };
    for (const [card, id] of cards) {
      const folder = folderOf(id);
      counts[ALL]++;
      counts[folder] = (counts[folder] || 0) + 1;

      if (!card.classList.contains('ccf-folder-card')) card.classList.add('ccf-folder-card');
      if (card.dataset.ccfRoom !== id) card.dataset.ccfRoom = id;

      // 右上角按鈕，顯示目前所在資料夾
      let btn = card.querySelector(':scope > .ccf-folder-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ccf-folder-btn';
        btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        btn.addEventListener('mousedown', stopAll);
        btn.addEventListener('click', (e) => {
          stopAll(e);
          roomMenu(btn, card.dataset.ccfRoom);
        });
        card.appendChild(btn);
      }
      const label = folder === NONE ? '📁' : '📁 ' + folderById(folder).name;
      if (btn.textContent !== label) {
        btn.textContent = label;
        btn.title = '選擇資料夾';
      }

      // 依目前資料夾篩選（只在需要時改動，避免觸發 MutationObserver 無限循環）
      const show = state.active === ALL || state.active === folder;
      const display = show ? '' : 'none';
      if (card.style.display !== display) card.style.display = display;
    }

    // 資料夾列放在第一個房間列表的上方
    const list = cards.keys().next().value.parentElement;
    if (!barEl) {
      barEl = document.createElement('div');
      barEl.className = 'ccf-folder-bar';
    }
    if (barEl.nextElementSibling !== list || barEl.parentElement !== list.parentElement) {
      list.parentElement.insertBefore(barEl, list);
    }
    const countsKey = JSON.stringify(counts);
    if (barVersion !== version || barCounts !== countsKey) {
      barVersion = version;
      barCounts = countsKey;
      renderBar(counts);
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

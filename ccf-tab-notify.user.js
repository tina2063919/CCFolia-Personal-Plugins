// ==UserScript==
// @name         CCFolia 頁籤新訊息提示音
// @namespace    ccf-tab-notify
// @version      1.1.0
// @description  CCFolia 房間的頁籤有新訊息時播放提示音，可個別設定哪些頁籤要提示
// @match        https://ccfolia.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  const POP_ID = 'ccf-tab-notify-pop';
  const ENABLED_KEY = 'ccf-tab-notify:enabled';
  const VOLUME_KEY = 'ccf-tab-notify:volume';
  const TABS_KEY = 'ccf-tab-notify:tabs:'; // + 房間路徑 → { 頁籤名稱: true/false }
  // 聊天輸入框
  const CHAT_SEL = 'textarea[name="text"][id^="downshift-"]';
  // 頁籤元素：MUI Tab 或含有未讀數字徽章（MuiBadge）的按鈕
  const TAB_SEL = '[role="tab"], .MuiTab-root, button:has(> .MuiBadge-root)';
  const SELECTED_TAB_SEL = [
    '[role="tab"][aria-selected="true"]',
    '.MuiTab-root.Mui-selected',
    'button.Mui-selected:has(> .MuiBadge-root)',
  ].join(', ');
  // 開關放在聊天輸入區下方「Dicebot engine : BCDice@x.x.x」那一行
  const DICEBOT_LINK_SEL = 'a[href*="bcdice.org"]';
  // 自己送出訊息後這段時間內的新訊息不提示（毫秒）
  const OWN_SEND_MS = 3000;
  // 兩次提示音的最短間隔（毫秒）
  const MIN_GAP_MS = 800;

  const CSS = `
/* 功能開關（Dicebot engine 那一行的右側） */
.ccf-tn-switch-row { display: flex !important; align-items: center; gap: 8px; }
.ccf-tn-switch {
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
.ccf-tn-switch:hover { opacity: 1; }
.ccf-tn-switch.tn-on { border-color: #1976d2; }
.ccf-tn-switch svg { width: 14px; height: 14px; fill: currentColor; }

/* 設定視窗；想調顏色，改下面這些變數即可 */
#${POP_ID} {
  --tn-bg: rgba(33, 33, 33, 0.95);
  --tn-accent: #1976d2;
  --tn-text: #ffffff;
  --tn-sub: rgba(255, 255, 255, 0.6);

  position: fixed;
  z-index: 1500;
  min-width: 160px;
  max-width: 260px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--tn-bg);
  color: var(--tn-text);
  font-size: 12px;
  box-shadow: 0 3px 13px rgba(0, 0, 0, 0.5);
  user-select: none;
}
#${POP_ID} .tn-title { font-weight: bold; margin-bottom: 6px; }
#${POP_ID} .tn-sub { color: var(--tn-sub); margin: 8px 0 4px; }
#${POP_ID} label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#${POP_ID} input[type="checkbox"] { accent-color: var(--tn-accent); margin: 0; }
#${POP_ID} .tn-vol { display: flex; align-items: center; gap: 6px; }
#${POP_ID} .tn-vol input { flex: 1; accent-color: var(--tn-accent); }
#${POP_ID} button.tn-test {
  margin-top: 8px;
  width: 100%;
  padding: 3px 0;
  border: 1px solid var(--tn-accent);
  border-radius: 4px;
  background: transparent;
  color: var(--tn-text);
  cursor: pointer;
}
#${POP_ID} button.tn-test:hover { background: rgba(25, 118, 210, 0.25); }
#${POP_ID} .tn-empty { color: var(--tn-sub); }
#${POP_ID}.tn-disabled .tn-tabs { opacity: 0.4; pointer-events: none; }
`;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const roomPath = () => location.pathname.match(/^\/rooms\/[^/]+/)?.[0] || null;

  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const save = (key, v) => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  };

  let enabled = load(ENABLED_KEY, true);
  let volume = load(VOLUME_KEY, 0.5);

  // 各頁籤是否提示；沒設定過的頁籤預設開啟
  let tabPrefs = {};
  const tabOn = (label) => tabPrefs[label] !== false;

  // ---- 提示音（用 Web Audio 產生，不需要音效檔） ----

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  // 瀏覽器規定要先有使用者操作才能發聲，第一次點擊或按鍵時先解鎖
  const unlock = () => getAudio();
  document.addEventListener('pointerdown', unlock, { capture: true, once: true });
  document.addEventListener('keydown', unlock, { capture: true, once: true });

  // 「叮咚」兩聲
  let lastBeep = 0;
  function beep(force = false) {
    const now = Date.now();
    if (!force && now - lastBeep < MIN_GAP_MS) return;
    lastBeep = now;
    const ctx = getAudio();
    if (!ctx || volume <= 0) return;
    const t0 = ctx.currentTime;
    [[880, 0], [660, 0.15]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume * 0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // ---- 頁籤 ----

  // 頁籤名稱：排除未讀數字徽章，只取頁籤文字
  function tabLabel(tab) {
    const clone = tab.cloneNode(true);
    clone.querySelectorAll('.MuiBadge-badge').forEach((b) => b.remove());
    return clone.textContent.trim();
  }

  // 從輸入框往上找最近的頁籤列，回傳 { tabs: [元素], selected: 名稱 }
  function getTabs() {
    const ta = document.querySelector(CHAT_SEL);
    let a = ta?.parentElement;
    for (let depth = 0; a && depth < 10; depth++, a = a.parentElement) {
      const sel = a.querySelector(SELECTED_TAB_SEL);
      if (!sel) continue;
      const tabs = [...a.querySelectorAll(TAB_SEL)].filter((t) => !t.parentElement.closest(TAB_SEL));
      return { tabs, selected: tabLabel(sel) };
    }
    return { tabs: [], selected: null };
  }

  function badgeCount(tab) {
    const b = tab.querySelector('.MuiBadge-badge');
    if (!b || b.classList.contains('MuiBadge-invisible')) return 0;
    return parseInt(b.textContent, 10) || 0;
  }

  // ---- 自己送出的訊息不提示 ----

  let lastSendAt = 0;
  const markSend = () => { lastSendAt = Date.now(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.matches?.(CHAT_SEL)) markSend();
  }, true);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('button[type="submit"]');
    if (btn && btn.closest('form')?.querySelector(CHAT_SEL)) markSend();
  }, true);
  document.addEventListener('submit', (e) => {
    if (e.target.querySelector?.(CHAT_SEL)) markSend();
  }, true);
  const isOwnRecent = () => Date.now() - lastSendAt < OWN_SEND_MS;

  // ---- 從 CCFolia 的資料（Redux store）偵測新訊息 ----
  // 其他頁籤的新訊息可由未讀徽章數字得知，但目前開著的頁籤沒有徽章，
  // 所以另外監看 store 裡的訊息數量。

  let store = null;
  function findStore() {
    if (store) return store;
    const root = document.getElementById('root') || document.body.firstElementChild;
    const key = root && Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
    let fiber = key ? root[key] : root?._reactRootContainer?._internalRoot?.current;
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

  const isMessage = (m) => m && typeof m === 'object' && typeof m.text === 'string' && 'channel' in m;

  // 找出 state 中存放訊息的 { ids, entities }（Redux Toolkit 的正規化格式）
  let msgPath = null;
  function findMessages(state) {
    if (msgPath) {
      let o = state;
      for (const k of msgPath) o = o?.[k];
      if (o?.entities && Array.isArray(o.ids)) return o;
      msgPath = null;
    }
    const visited = new WeakSet();
    const walk = (obj, path, depth) => {
      if (!obj || typeof obj !== 'object' || visited.has(obj) || depth > 5) return null;
      visited.add(obj);
      if (Array.isArray(obj.ids) && obj.entities && typeof obj.entities === 'object') {
        const first = obj.ids.length ? obj.entities[obj.ids[0]] : null;
        if (isMessage(first) || (!first && /message/i.test(path[path.length - 1] || ''))) {
          msgPath = path;
          return obj;
        }
      }
      if (Array.isArray(obj)) return null;
      for (const k in obj) {
        const r = walk(obj[k], [...path, k], depth + 1);
        if (r) return r;
      }
      return null;
    };
    return walk(state, [], 0);
  }

  // createdAt 可能是數字、Date 或 Firestore Timestamp
  function timeOf(m) {
    const c = m.createdAt ?? m.updatedAt;
    if (typeof c === 'number') return c < 1e12 ? c * 1000 : c;
    if (c instanceof Date) return c.getTime();
    if (c && typeof c.seconds === 'number') return c.seconds * 1000;
    if (c && typeof c.toMillis === 'function') return c.toMillis();
    return null;
  }

  let seenIds = null;
  let baseTime = 0;
  // 回傳這次新出現的訊息
  function newMessages() {
    let state;
    try { state = findStore()?.getState(); } catch { return null; }
    if (!state) return null;
    const slice = findMessages(state);
    if (!slice) return null;
    const ids = slice.ids;
    if (!seenIds) {
      // 第一次讀取只記錄，不提示
      seenIds = new Set(ids);
      baseTime = Date.now();
      return [];
    }
    const fresh = [];
    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const m = slice.entities[id];
      if (!isMessage(m) || m.removed) continue;
      // 往回捲動載入的舊訊息不算
      const t = timeOf(m);
      if (t !== null && t < baseTime - 5000) continue;
      fresh.push(m);
    }
    return fresh;
  }

  // ---- 主要檢查 ----

  let lastRoom = null;
  let badges = new Map(); // 頁籤名稱 → 上次的未讀數
  // 訊息的 channel → 頁籤名稱（依房間記住，從實際收發的訊息學習）
  const CHANNEL_KEY = 'ccf-tab-notify:channels:'; // + 房間路徑
  let channelMap = {};
  // CCFolia 預設的三個頁籤（メイン／情報／雑談）依序對應這三個 channel
  const DEFAULT_CHANNELS = ['main', 'info', 'other'];

  const debug = (...a) => { if (load('ccf-tab-notify:debug', false)) console.log('[提示音]', ...a); };

  function resetRoom(room) {
    lastRoom = room;
    tabPrefs = room ? load(TABS_KEY + room, {}) : {};
    channelMap = room ? load(CHANNEL_KEY + room, {}) : {};
    badges = new Map();
    seenIds = null;
  }

  function learnChannel(channel, label) {
    if (!channel || !label || channelMap[channel] === label) return;
    channelMap[channel] = label;
    if (lastRoom) save(CHANNEL_KEY + lastRoom, channelMap);
    debug('記住頻道', channel, '→', label);
  }

  // 找出訊息所屬的頁籤名稱，找不到回傳 null
  function tabOfMessage(m, labels) {
    const name = typeof m.channelName === 'string' ? m.channelName.trim() : '';
    if (name && labels.includes(name)) return name;
    const ch = String(m.channel ?? '');
    if (channelMap[ch] && labels.includes(channelMap[ch])) return channelMap[ch];
    const i = DEFAULT_CHANNELS.indexOf(ch || 'main');
    if (i >= 0 && labels[i]) return labels[i];
    return null;
  }

  function check() {
    const room = roomPath();
    if (room !== lastRoom) resetRoom(room);
    placeSwitch();
    if (!room) return;

    const { tabs, selected } = getTabs();
    const labels = tabs.map(tabLabel);

    // 未讀徽章數字增加的頁籤
    const badgeHits = [];
    tabs.forEach((tab, i) => {
      const n = badgeCount(tab);
      const prev = badges.get(labels[i]);
      if (prev !== undefined && n > prev) badgeHits.push(labels[i]);
      badges.set(labels[i], n);
    });

    const fresh = newMessages();
    const hits = new Set();
    if (fresh === null) {
      // 讀不到 store 時只能靠徽章
      badgeHits.forEach((l) => hits.add(l));
    } else if (fresh.length) {
      const own = isOwnRecent();
      const channels = [...new Set(fresh.map((m) => String(m.channel ?? '')))];
      // 從實際情況學習 channel 對應哪個頁籤：
      // 自己剛送出的訊息屬於目前頁籤；只有一個徽章增加時，新訊息屬於那個頁籤
      if (channels.length === 1) {
        if (own && selected) learnChannel(channels[0], selected);
        else if (badgeHits.length === 1) learnChannel(channels[0], badgeHits[0]);
      }
      if (!own) {
        for (const m of fresh) {
          const label = tabOfMessage(m, labels);
          debug('新訊息', { channel: m.channel, channelName: m.channelName, text: m.text }, '→', label);
          if (label) hits.add(label);
        }
      }
    }

    if (popup) renderPopup();
    if (!enabled || !hits.size || isOwnRecent()) return;
    if ([...hits].some(tabOn)) beep();
  }

  // ---- 功能開關與設定視窗 ----

  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = 'ccf-tn-switch';
  // 鈴鐺圖示（MUI NotificationsIcon / NotificationsOffIcon）
  const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z"></path></svg>';
  switchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popup) closePopup();
    else openPopup();
  });

  function placeSwitch() {
    const row = document.querySelector(DICEBOT_LINK_SEL)?.closest('.MuiBox-root');
    if (!row) return;
    // 只在狀態不同時才更新，避免觸發 MutationObserver 造成無限重繪
    if (!switchBtn.title || switchBtn.classList.contains('tn-on') !== enabled) {
      switchBtn.classList.toggle('tn-on', enabled);
      switchBtn.innerHTML = enabled ? ICON_ON : ICON_OFF;
      switchBtn.title = enabled ? '新訊息提示音：開（點擊設定）' : '新訊息提示音：關（點擊設定）';
    }
    if (!row.classList.contains('ccf-tn-switch-row')) row.classList.add('ccf-tn-switch-row');
    if (switchBtn.parentElement !== row) row.appendChild(switchBtn);
  }

  let popup = null;
  let popupKey = '';

  function openPopup() {
    getAudio();
    popup = document.createElement('div');
    popup.id = POP_ID;
    popupKey = '';
    document.body.appendChild(popup);
    renderPopup();
    positionPopup();
  }

  function closePopup() {
    popup?.remove();
    popup = null;
  }

  function positionPopup() {
    if (!popup) return;
    const r = switchBtn.getBoundingClientRect();
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    const x = Math.max(4, Math.min(r.right - w, innerWidth - w - 4));
    const y = r.top - h - 6 >= 4 ? r.top - h - 6 : Math.min(r.bottom + 6, innerHeight - h - 4);
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
  }

  function renderPopup() {
    const labels = [...new Set(getTabs().tabs.map(tabLabel))].filter(Boolean);
    // 內容沒變就不重畫（避免拖動音量時被打斷）
    const key = JSON.stringify([enabled, labels, labels.map(tabOn)]);
    if (key === popupKey) return;
    popupKey = key;

    popup.innerHTML = '';
    popup.classList.toggle('tn-disabled', !enabled);

    const title = document.createElement('div');
    title.className = 'tn-title';
    title.textContent = '新訊息提示音';
    popup.appendChild(title);

    popup.appendChild(checkbox('啟用提示音', enabled, (v) => {
      enabled = v;
      save(ENABLED_KEY, enabled);
      placeSwitch();
      renderPopup();
    }));

    const sub = document.createElement('div');
    sub.className = 'tn-sub';
    sub.textContent = '要提示的頁籤';
    popup.appendChild(sub);

    const list = document.createElement('div');
    list.className = 'tn-tabs';
    if (!labels.length) {
      const empty = document.createElement('div');
      empty.className = 'tn-empty';
      empty.textContent = '（找不到頁籤）';
      list.appendChild(empty);
    }
    for (const label of labels) {
      list.appendChild(checkbox(label, tabOn(label), (v) => {
        tabPrefs[label] = v;
        if (lastRoom) save(TABS_KEY + lastRoom, tabPrefs);
        renderPopup();
      }));
    }
    popup.appendChild(list);

    const volSub = document.createElement('div');
    volSub.className = 'tn-sub';
    volSub.textContent = '音量';
    popup.appendChild(volSub);

    const vol = document.createElement('div');
    vol.className = 'tn-vol';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '1';
    range.step = '0.05';
    range.value = String(volume);
    range.addEventListener('input', () => {
      volume = Number(range.value);
      save(VOLUME_KEY, volume);
    });
    range.addEventListener('change', () => beep(true));
    vol.appendChild(range);
    popup.appendChild(vol);

    const test = document.createElement('button');
    test.type = 'button';
    test.className = 'tn-test';
    test.textContent = '試聽';
    test.addEventListener('click', () => beep(true));
    popup.appendChild(test);

    positionPopup();
  }

  function checkbox(text, checked, onChange) {
    const label = document.createElement('label');
    label.title = text;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    label.append(input, document.createTextNode(text));
    return label;
  }

  // 點視窗外面就關閉
  document.addEventListener('pointerdown', (e) => {
    if (popup && !popup.contains(e.target) && !switchBtn.contains(e.target)) closePopup();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (popup && e.key === 'Escape') closePopup();
  });
  addEventListener('resize', positionPopup);

  // React 會不斷重繪 DOM，用 MutationObserver 持續檢查（以 rAF 節流）
  let queued = false;
  new MutationObserver((records) => {
    if (queued) return;
    // 只有設定視窗自己的變動就略過
    if (popup && records.every((r) => popup.contains(r.target))) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; check(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  // store 更新不一定會改動 DOM，另外定時檢查
  setInterval(check, 1000);
  check();
})();

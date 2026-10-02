/* ================= 狀態 ================= */
const state = {
  files: [],
  id: null,
  doc: null,
  dirty: false,
  editing: false,
  channel: '',
  readonly: false,
  sharedAt: null, // 唯讀分享頁：分享內容的更新時間
};
const currentMeta = () => state.files.find((f) => f.id === state.id);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const srcOf = new WeakMap(); // 畫面元素 -> 原檔 article

/* ================= 渲染訊息 ================= */
function avatarEl(m) {
  const av = el('span', 'avatar ' + (m.avatarClass || (m.avatarUrl ? '' : m.avatarLetter ? 'letter' : 'none')));
  if (m.avatarUrl) av.style.backgroundImage = `url("${m.avatarUrl}")`;
  else if (m.avatarLetter) av.textContent = m.avatarLetter;
  return av;
}
function speakerEl(m) {
  const name = el('span', 'speaker', m.name);
  if (m.color) name.style.setProperty('--c', m.color);
  else name.classList.add('plain');
  return name;
}

function renderMsg(art) {
  const m = readMsg(art);
  const box = el('div', 'msg' + (m.kind === 'msg' ? '' : ' sys') + (m.kind === 'divider' ? ' divider' : ''));
  box.dataset.channel = chanOf(art);
  srcOf.set(box, art);

  if (m.kind !== 'msg') {
    box.append(el('div', 'text', m.text));
    if (m.time) box.firstChild.append(el('span', 'time', ' ' + m.time));
  } else {
    box.append(avatarEl(m));

    const body = el('div', 'body');
    const head = el('div', 'head');
    head.append(speakerEl(m));
    if (m.bot) head.append(el('span', 'badge', 'BOT'));
    if (m.time) head.append(el('span', 'time', m.time));
    if (m.chan) head.append(el('span', 'chan', m.chan));
    if (m.edited) head.append(el('span', 'edited', '已編輯'));
    body.append(head);
    if (m.reply) body.append(el('div', 'reply', '↪ ' + m.reply));
    body.append(el('div', 'text', m.text));

    if (m.roll) {
      const r = el('span', 'roll', m.roll.text);
      r.classList.add(...m.roll.cls);
      body.append(r);
    }
    for (const x of m.extras || []) body.append(el('div', 'extra', x));
    if (m.images?.length || m.files?.length) {
      const atts = el('div', 'atts');
      for (const src of m.images) {
        const img = el('img');
        img.src = src;
        img.loading = 'lazy';
        img.alt = '';
        atts.append(img);
      }
      for (const f of m.files) {
        const a = el(f.href ? 'a' : 'span', 'file', '📎 ' + f.name);
        if (f.href) { a.href = f.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        atts.append(a);
      }
      body.append(atts);
    }
    box.append(body);
  }

  const acts = el('div', 'acts');
  const eb = el('button', 'btn act-edit', '修改'); eb.type = 'button';
  const db = el('button', 'btn danger act-del', '刪除'); db.type = 'button';
  acts.append(eb, db);
  box.append(acts);
  if (state.channel && box.dataset.channel !== state.channel) box.hidden = true;
  return box;
}

function renderLog() {
  const doc = state.doc;
  $('#avatarCss').textContent = avatarCss(doc);
  $('#title').value = getTitle(doc);
  document.title = getTitle(doc) + ' - CCFolia Log 檢視器';

  const arts = logItems(doc);
  const channels = [...new Set(arts.map(chanOf))];
  const sel = $('#channel');
  if (!channels.includes(state.channel)) state.channel = '';
  sel.hidden = channels.length < 2;
  sel.replaceChildren(new Option('全部頻道', ''), ...channels.map((c) => new Option(c === 'main' ? '主頻道' : c || '（無）', c)));
  sel.value = state.channel;

  $('#messages').replaceChildren(...arts.map(renderMsg));
  updateInfo();
}

function updateInfo() {
  const meta = currentMeta();
  const n = countMsgs(state.doc);
  let info = `${n} 則訊息`;
  if (meta) info += ` · ${meta.name} · 更新於 ${fmtDate(meta.updatedAt)}`;
  else if (state.readonly) info += ' · 唯讀分享' + (state.sharedAt ? ` · 更新於 ${fmtDate(state.sharedAt)}` : '');
  $('#info').textContent = info;
}

// 已分享時顯示「更新分享內容」，有未更新的修改時加強提示
function updateShareBtn() {
  const m = currentMeta();
  const btn = $('#shareUpdateBtn');
  btn.hidden = !m?.gistId;
  btn.classList.toggle('primary', !!m?.gistId && (state.dirty || m.updatedAt > m.sharedAt));
}

/* ================= 檔案列表 ================= */

async function refreshList() {
  state.files = (await DB.list()).sort((a, b) => b.updatedAt - a.updatedAt);
  renderList();
}

function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const ul = $('#fileList');
  const files = state.files.filter((f) => !q || f.title.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
  if (!files.length) {
    ul.replaceChildren(el('li', 'list-empty', state.files.length ? '沒有符合的檔案' : '還沒有上傳任何檔案'));
    ul.firstChild.style.cursor = 'default';
  } else {
    ul.replaceChildren(...files.map((f) => {
      const li = el('li', f.id === state.id ? 'active' : '');
      li.dataset.id = f.id;
      li.title = f.title;
      const meta = el('div', 'meta', `${f.count} 則 · ${fmtDate(f.updatedAt)}`);
      if (f.gistId) meta.append(' · ', el('span', 'tag', '已分享'));
      li.append(el('div', 'name', f.title), meta);
      return li;
    }));
  }
  const m = currentMeta();
  $('#shareBtn').textContent = m?.gistId ? '已分享' : '分享';
  $('#shareBtn').classList.toggle('on', !!m?.gistId);
  updateShareBtn();
  $('#storageInfo').textContent = `共 ${state.files.length} 個檔案 · 儲存於此瀏覽器`;
}

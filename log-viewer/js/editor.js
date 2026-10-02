/* ================= 訊息編輯 ================= */
// 角色下拉選單：顯示頭貼 + 名稱，選擇後呼叫 onPick(角色)
function charPicker(chars, cur, onPick) {
  const wrap = el('div', 'char-pick');
  const btn = el('button', 'btn char-btn');
  btn.type = 'button';
  btn.title = '更換角色';
  btn.setAttribute('aria-haspopup', 'listbox');
  const label = (m) => [avatarEl(m), speakerEl({ ...m, name: m.name || '（無名）' })];
  const show = (m) => btn.replaceChildren(...label(m), el('span', 'caret', '▾'));
  show(cur);

  const menu = el('div', 'char-menu');
  menu.hidden = true;
  menu.setAttribute('role', 'listbox');
  let curKey = charKey(cur);
  const items = chars.map((c) => {
    const it = el('button', 'char-item');
    it.type = 'button';
    it.setAttribute('role', 'option');
    it.append(...label(c.m), el('span', 'count', c.count));
    it.onclick = () => { curKey = c.key; onPick(c); show(c.m); close(); btn.focus(); };
    return [it, c];
  });
  let filter;
  if (chars.length > 8) {
    filter = el('input', 'field');
    filter.type = 'search';
    filter.placeholder = '搜尋角色…';
    filter.oninput = () => {
      const q = filter.value.trim().toLowerCase();
      items.forEach(([it, c]) => { it.hidden = !!q && !c.m.name.toLowerCase().includes(q); });
    };
    menu.append(filter);
  }
  menu.append(...items.map(([it]) => it));

  const outside = (e) => { if (!wrap.contains(e.target)) close(); };
  function open() {
    items.forEach(([it, c]) => it.classList.toggle('cur', c.key === curKey));
    menu.hidden = false;
    document.addEventListener('pointerdown', outside);
    (filter || items.find(([it]) => it.classList.contains('cur'))?.[0] || items[0]?.[0])?.focus();
  }
  function close() {
    menu.hidden = true;
    document.removeEventListener('pointerdown', outside);
  }
  btn.onclick = () => (menu.hidden ? open() : close());
  wrap.addEventListener('keydown', (e) => {
    if (menu.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const vis = items.map(([it]) => it).filter((it) => !it.hidden);
      const i = vis.indexOf(document.activeElement);
      vis[e.key === 'ArrowDown' ? Math.min(i + 1, vis.length - 1) : Math.max(i - 1, 0)]?.focus();
    }
  });
  wrap.append(btn, menu);
  return wrap;
}

function openEditor(box) {
  const art = srcOf.get(box);
  const m = readMsg(art);
  const sys = m.kind !== 'msg';
  const form = el('form', 'editor');
  const txt = el('textarea');
  txt.value = m.text;
  txt.rows = Math.min(16, txt.value.split('\n').length + 1);

  let nameIn, colorIn, colorAt, picked = null;
  if (!sys) {
    const row = el('div', 'row');
    nameIn = el('input', 'field');
    nameIn.placeholder = '發言者';
    nameIn.value = m.name;
    colorIn = el('input');
    colorIn.type = 'color';
    colorIn.title = '名稱顏色';
    colorIn.value = colorAt = toHex(m.color || '#888888');
    const chars = collectChars(state.doc);
    if (chars.length > 1) {
      row.append(charPicker(chars, m, (c) => {
        picked = c;
        nameIn.value = c.m.name;
        colorIn.value = colorAt = toHex(c.m.color || '#888888');
      }));
    }
    row.append(nameIn, colorIn);
    form.append(row);
  }
  const btns = el('div', 'row end');
  const cancel = el('button', 'btn', '取消'); cancel.type = 'button';
  const ok = el('button', 'btn primary', '確定');
  btns.append(cancel, ok);
  form.append(txt, btns);

  cancel.onclick = () => box.replaceWith(renderMsg(art));
  form.onsubmit = (e) => {
    e.preventDefault();
    if (picked) swapAvatar(art, picked.node);
    writeMsg(art, {
      text: txt.value,
      name: sys ? null : nameIn.value,
      // 手動改過顏色以手動為準，否則沿用所選角色的原始顏色
      color: sys ? null : colorIn.value !== colorAt ? colorIn.value : picked?.m.color ?? null,
    });
    box.replaceWith(renderMsg(art));
    setDirty(true);
  };
  txt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
    if (e.key === 'Escape') cancel.click();
  });

  box.replaceChildren(form);
  txt.focus();
}

$('#messages').addEventListener('click', (e) => {
  const box = e.target.closest('.msg');
  if (!box) return;
  if (e.target.closest('.act-edit')) openEditor(box);
  if (e.target.closest('.act-del')) {
    if (!confirm('確定刪除這則訊息？')) return;
    srcOf.get(box).remove();
    box.remove();
    setDirty(true);
    updateInfo();
  }
});

$('#title').addEventListener('input', () => {
  setTitle(state.doc, $('#title').value);
  setDirty(true);
});

/* ================= 原始碼 ================= */
$('#sourceBtn').onclick = () => {
  $('#sourceText').value = serialize(state.doc);
  $('#sourceDlg').showModal();
};
$('#sourceDlg').addEventListener('close', () => {
  if ($('#sourceDlg').returnValue !== 'apply') return;
  try {
    state.doc = parseLog($('#sourceText').value);
    setDirty(true);
    renderLog();
  } catch (e) {
    toast(e.message, 4000);
  }
});

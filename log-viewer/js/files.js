/* ================= 開啟 / 儲存 ================= */
function confirmDiscard() {
  return !state.dirty || confirm('目前的修改尚未儲存，確定要放棄嗎？');
}

async function openFile(id, force = false) {
  if (!force && id === state.id) return;
  if (!force && !confirmDiscard()) return;
  const html = await DB.html(id);
  if (html == null) { toast('找不到檔案'); return; }
  state.id = id;
  state.doc = parseLog(html);
  setDirty(false);
  setEditing(false);
  $('#empty').hidden = true;
  $('#viewer').hidden = false;
  $('#main').scrollTop = 0;
  renderLog();
  renderList();
  history.replaceState(null, '', '#' + id);
  document.body.classList.remove('menu-open');
}

function closeFile() {
  state.id = null;
  state.doc = null;
  setDirty(false);
  $('#viewer').hidden = true;
  $('#empty').hidden = false;
  $('#avatarCss').textContent = '';
  document.title = 'CCFolia Log 檢視器';
  history.replaceState(null, '', location.pathname + location.search);
  renderList();
}

async function save() {
  if (!state.doc || !state.dirty) return;
  const meta = currentMeta();
  const next = { ...meta, title: getTitle(state.doc), count: countMsgs(state.doc), updatedAt: Date.now() };
  try {
    await DB.put(next, serialize(state.doc));
  } catch (e) {
    toast('儲存失敗：' + e.message);
    return;
  }
  setDirty(false);
  await refreshList();
  updateInfo();
  toast('已儲存');
}

function setDirty(v) {
  state.dirty = v;
  $('#dirty').hidden = !v;
  $('#saveBtn').disabled = !v;
  updateShareBtn();
}

function setEditing(v) {
  state.editing = v;
  $('#log').classList.toggle('editing', v);
  $('#editBtn').classList.toggle('on', v);
  $('#editBtn').textContent = v ? '完成編輯' : '編輯';
  $('#title').readOnly = !v;
  if (!v) document.querySelectorAll('.msg .editor').forEach((f) => f.closest('.msg').replaceWith(renderMsg(srcOf.get(f.closest('.msg')))));
}

/* ================= 上傳 ================= */
async function uploadFiles(list) {
  let lastId = null, ok = 0;
  for (const file of list) {
    try {
      let html = await file.text();
      const doc = parseLog(html);
      // 舊版沒有標題，改用檔名
      if (isOld(doc) && getTitle(doc) === oldDefaultTitle) {
        setTitle(doc, file.name.replace(/\.html?$/i, ''));
        html = serialize(doc);
      }
      const id = newId();
      const now = Date.now();
      await DB.put({ id, name: file.name, title: getTitle(doc), count: countMsgs(doc), createdAt: now, updatedAt: now }, html);
      lastId = id;
      ok++;
    } catch (e) {
      toast(`${file.name}：${e.message}`, 4000);
    }
  }
  await refreshList();
  if (ok) toast(`已上傳 ${ok} 個檔案`);
  if (lastId) openFile(lastId);
}

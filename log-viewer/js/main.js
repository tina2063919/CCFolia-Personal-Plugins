/* ================= 其他按鈕 ================= */
$('#editBtn').onclick = () => setEditing(!state.editing);
$('#saveBtn').onclick = save;
$('#downloadBtn').onclick = () => {
  const blob = new Blob([serialize(state.doc)], { type: 'text/html' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = getTitle(state.doc).replace(/[\\/:*?"<>|]/g, '_') + '.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#deleteBtn').onclick = async () => {
  if (!confirm(`確定刪除「${getTitle(state.doc)}」？此動作無法復原。`)) return;
  const meta = currentMeta();
  if (meta?.gistId && Token.get() && confirm('這份紀錄已分享，要同時停止分享嗎？\n（選「取消」則分享連結會繼續有效）')) {
    try { await deleteGist(meta.gistId); } catch (e) { toast('停止分享失敗：' + e.message, 4000); return; }
  }
  await DB.del(state.id);
  setDirty(false);
  await refreshList();
  closeFile();
  toast('已刪除');
};
$('#channel').onchange = (e) => {
  state.channel = e.target.value;
  document.querySelectorAll('#messages .msg').forEach((m) => { m.hidden = !!state.channel && m.dataset.channel !== state.channel; });
};

$('#fileList').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (li) openFile(li.dataset.id);
});
$('#search').addEventListener('input', renderList);

const pick = () => $('#fileInput').click();
$('#uploadBtn').onclick = pick;
$('#uploadBtn2').onclick = pick;
$('#fileInput').onchange = (e) => { uploadFiles([...e.target.files]); e.target.value = ''; };

$('#menuBtn').onclick = () => document.body.classList.toggle('menu-open');
$('#main').addEventListener('click', () => document.body.classList.remove('menu-open'));

// 主題
function applyThemeIcon() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#themeBtn').textContent = dark ? '☀' : '☾';
}
$('#themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('lv-theme', next); } catch {}
  applyThemeIcon();
};
applyThemeIcon();

// 拖曳上傳
let dragDepth = 0;
const hasFiles = (e) => !state.readonly && [...(e.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; document.body.classList.add('dragging'); } });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  const files = [...e.dataTransfer.files].filter((f) => /\.html?$/i.test(f.name) || f.type === 'text/html');
  if (files.length) uploadFiles(files);
  else toast('請拖曳 HTML 檔案');
});

// 快捷鍵與離開提醒
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
});
addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ================= 啟動 ================= */
(async () => {
  const shared = new URLSearchParams(location.search).get('s');
  if (shared) return openShared(shared);
  try {
    await refreshList();
    const id = location.hash.slice(1);
    if (id && state.files.some((f) => f.id === id)) openFile(id, true);
  } catch (e) {
    toast('無法開啟瀏覽器儲存空間：' + e.message, 5000);
  }
})();

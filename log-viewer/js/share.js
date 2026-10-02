/* ================= 分享（GitHub Secret Gist） ================= */
const GIST_FILE = 'ccfolia-log.html';
const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=CCFolia%20Log%20Viewer';
const Token = {
  get() { try { return localStorage.getItem('lv-gh-token') || ''; } catch { return ''; } },
  set(v) { try { v ? localStorage.setItem('lv-gh-token', v) : localStorage.removeItem('lv-gh-token'); } catch {} },
};

async function gh(path, { method = 'GET', body, anon = false } = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (!anon && Token.get()) headers.Authorization = 'Bearer ' + Token.get();
  if (body) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetch('https://api.github.com' + path, { method, headers, body: body && JSON.stringify(body) });
  } catch {
    throw new Error('無法連線到 GitHub');
  }
  if (!r.ok) {
    let msg = '';
    try { msg = (await r.json()).message || ''; } catch {}
    const err = new Error(
      r.status === 401 ? 'GitHub token 無效或已過期' :
      r.status === 403 && /rate limit/i.test(msg) ? 'GitHub 請求次數已達上限，請稍後再試' :
      r.status === 404 ? '找不到分享內容，可能已停止分享' :
      `GitHub 錯誤 ${r.status}${msg ? '：' + msg : ''}`);
    err.status = r.status;
    throw err;
  }
  return r.status === 204 ? null : r.json();
}

const shareUrl = (gistId) => location.origin + location.pathname + '?s=' + encodeURIComponent(gistId);

async function deleteGist(gistId) {
  try { await gh('/gists/' + gistId, { method: 'DELETE' }); }
  catch (e) { if (e.status !== 404) throw e; }
}

// 建立或更新分享（上傳已儲存的版本）
async function publishShare() {
  if (state.dirty) await save();
  if (state.dirty) throw new Error('儲存失敗，無法分享');
  const meta = currentMeta();
  const payload = {
    description: getTitle(state.doc) + '（CCFolia Log）',
    files: { [GIST_FILE]: { content: serialize(state.doc) } },
  };
  let gist = null;
  if (meta.gistId) {
    try { gist = await gh('/gists/' + meta.gistId, { method: 'PATCH', body: payload }); }
    catch (e) { if (e.status !== 404) throw e; } // 已在 GitHub 上被刪除 → 重新建立
  }
  gist ??= await gh('/gists', { method: 'POST', body: { ...payload, public: false } });
  await DB.putMeta({ ...meta, gistId: gist.id, sharedAt: Date.now() });
  await refreshList();
}

async function stopShare() {
  const meta = currentMeta();
  await deleteGist(meta.gistId);
  const { gistId, sharedAt, ...rest } = meta;
  await DB.putMeta(rest);
  await refreshList();
}

function renderShare() {
  const body = $('#shareBody');
  const meta = currentMeta();
  if (!meta) return;

  if (!Token.get()) {
    body.innerHTML = `
      <p>分享會把紀錄上傳到你的 GitHub 帳號，存成不公開列出的 Secret Gist。拿到連結的人不需登入就能閱覽（唯讀）。</p>
      <p>請先 <a href="${TOKEN_URL}" target="_blank" rel="noopener">建立 GitHub token</a>，只需勾選 <code>gist</code> 權限，再貼到下方。</p>
      <input class="field" id="tokenIn" type="password" placeholder="ghp_… 或 github_pat_…" autocomplete="off">
      <p class="hint">token 只存在此瀏覽器，不會隨紀錄分享出去。</p>
      <div class="row end"><button class="btn primary" id="tokenSave">確認</button></div>`;
    $('#tokenSave').onclick = () => busy(async () => {
      const v = $('#tokenIn').value.trim();
      if (!v) throw new Error('請輸入 token');
      Token.set(v);
      try { await gh('/user'); } catch (e) { Token.set(''); throw e; }
      toast('已連結 GitHub');
    });
    $('#tokenIn').onkeydown = (e) => { if (e.key === 'Enter') $('#tokenSave').click(); };
    $('#tokenIn').focus();
    return;
  }

  if (!meta.gistId) {
    body.innerHTML = `
      <p>建立唯讀連結，拿到連結的人都能閱覽這份紀錄，不需登入。尚未儲存的修改會先自動儲存。</p>
      <div class="row end"><button class="btn primary" id="shCreate">建立分享連結</button></div>`;
    $('#shCreate').onclick = () => busy(async () => { await publishShare(); toast('已建立分享連結'); });
  } else {
    const fresh = !state.dirty && meta.updatedAt <= meta.sharedAt;
    body.innerHTML = `
      <div class="row"><input class="field" id="shLink" readonly><button class="btn" id="shCopy">複製</button></div>
      <p class="hint" id="shStatus"></p>
      <div class="row end">
        <button class="btn danger" id="shStop">停止分享</button>
        <a class="btn" id="shOpen" target="_blank" rel="noopener">開啟</a>
        <button class="btn ${fresh ? '' : 'primary'}" id="shUpdate">更新分享內容</button>
      </div>`;
    $('#shLink').value = shareUrl(meta.gistId);
    $('#shOpen').href = shareUrl(meta.gistId);
    $('#shStatus').textContent = fresh
      ? `分享內容為最新版本（${fmtDate(meta.sharedAt)}）`
      : '有修改尚未更新到分享連結，按「更新分享內容」後對方才看得到。';
    $('#shStatus').classList.toggle('warn', !fresh);
    $('#shCopy').onclick = async () => {
      try { await navigator.clipboard.writeText($('#shLink').value); toast('已複製連結'); }
      catch { $('#shLink').select(); toast('請手動複製連結'); }
    };
    $('#shUpdate').onclick = () => busy(async () => { await publishShare(); toast('已更新分享內容'); });
    $('#shStop').onclick = () => {
      if (!confirm('停止分享後，之前給出的連結將無法開啟。確定嗎？')) return;
      busy(async () => { await stopShare(); toast('已停止分享'); });
    };
  }

  if (location.protocol === 'file:') {
    body.append(el('p', 'hint warn', '目前是從本機檔案開啟，產生的連結只有把網站部署出去後才能給別人使用。'));
  }
  const foot = el('p', 'hint', '已連結 GitHub · ');
  const rm = el('button', 'linkbtn', '移除 token');
  rm.onclick = () => { if (confirm('移除此瀏覽器儲存的 GitHub token？已分享的連結不受影響。')) { Token.set(''); renderShare(); } };
  foot.append(rm);
  body.append(foot);
}

async function busy(fn) {
  const btns = $('#shareBody').querySelectorAll('button, input');
  btns.forEach((b) => { b.disabled = true; });
  try { await fn(); }
  catch (e) { toast(e.message, 4000); }
  finally { renderShare(); }
}

$('#shareBtn').onclick = () => { renderShare(); $('#shareDlg').showModal(); };
$('#shareClose').onclick = () => $('#shareDlg').close();
$('#shareUpdateBtn').onclick = async () => {
  if (!Token.get()) { renderShare(); $('#shareDlg').showModal(); return; } // 需先連結 GitHub
  const btn = $('#shareUpdateBtn');
  btn.disabled = true;
  try { await publishShare(); toast('已更新分享內容'); }
  catch (e) { toast(e.message, 4000); }
  finally { btn.disabled = false; updateShareBtn(); }
};

// 唯讀分享頁
async function openShared(gistId) {
  state.readonly = true;
  document.body.classList.add('readonly');
  $('#emptyTitle').textContent = '載入中…';
  $('#emptyText').textContent = '';
  $('#uploadBtn2').hidden = true;
  try {
    const gist = await gh('/gists/' + encodeURIComponent(gistId), { anon: true });
    const file = Object.values(gist.files).find((f) => /\.html?$/i.test(f.filename));
    if (!file) throw new Error('分享內容不是 HTML 紀錄');
    const html = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
    state.doc = parseLog(html);
    state.sharedAt = Date.parse(gist.updated_at) || null;
    $('#empty').hidden = true;
    $('#viewer').hidden = false;
    renderLog();
  } catch (e) {
    $('#emptyTitle').textContent = '無法開啟分享';
    $('#emptyText').textContent = e.message;
  }
}

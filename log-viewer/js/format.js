/* ================= 檔案格式（CCFolia / 舊版 CCFolia / Discord 機器人匯出） ================= */
const DC_MSG = '.wrap > .msg, .wrap > .sysmsg';
const DC_ITEMS = DC_MSG + ', .wrap > .div';
const isDiscord = (doc) => !doc.querySelector('article.message') && !!doc.querySelector('.wrap > .msg .bd');
// 舊版 CCFolia：<p style="color:…"><span>[頻道]</span><span>名稱</span> : <span>內文</span></p>
const OLD_MSG = 'body > p';
const isOld = (doc) => !doc.querySelector('article.message') && !isDiscord(doc) && !!doc.querySelector('body > p > span + span + span');
const oldDefaultTitle = 'ccfolia - logs';

function parseLog(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.querySelector('article.message') && !isDiscord(doc) && !isOld(doc)) {
    throw new Error('找不到訊息，請確認是 CCFolia 或 Discord 機器人匯出的 HTML');
  }
  return doc;
}
const itemSel = (doc) => (isDiscord(doc) ? DC_ITEMS : isOld(doc) ? OLD_MSG : 'article.message');
// 舊版的頻道寫在第一個 span，例如「 [main]」
const chanOf = (node) => node.dataset.channel
  ?? (node.matches('p') ? (node.children[0]?.textContent.trim().replace(/^\[(.*)\]$/, '$1') ?? '') : '');
const titleEl = (doc) => doc.querySelector('.log-title') || doc.querySelector('.hdr h1');
const getTitle = (doc) => (titleEl(doc)?.textContent || doc.title || '未命名').trim();
function setTitle(doc, t) {
  doc.title = t;
  const h = titleEl(doc);
  if (h) h.textContent = t;
}
const logItems = (doc) => [...doc.querySelectorAll(itemSel(doc))];
const countMsgs = (doc) => doc.querySelectorAll(isDiscord(doc) ? DC_MSG : itemSel(doc)).length;
const safeUrl = (u) => (/^(data:image\/|https?:\/\/)/i.test(u || '') && !/["\\\n<]/.test(u) ? u : null);
const trimText = (s) => s.replace(/^\n+|\s+$/g, '');

// Discord 訊息內文：<br> 轉換行，其餘取純文字
function dcText(node) {
  if (!node) return '';
  const c = node.cloneNode(true);
  c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  c.querySelectorAll('li, pre').forEach((b) => b.append('\n'));
  return c.textContent;
}
// 舊版內文：原始碼縮排的換行不算，<br> 才是換行
function oldText(span) {
  if (!span) return '';
  const c = span.cloneNode(true);
  const walk = c.ownerDocument.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) n.data = n.data.replace(/\n\s*/g, '');
  c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  return c.textContent.trim();
}
const oldColor = (p) => /(?:^|;)\s*color:\s*([^;]+)/.exec(p.getAttribute('style') || '')?.[1].trim() || null;
const dcBlock = (e) => [...e.children].map((c) => dcText(c).trim()).filter(Boolean).join('\n') || e.textContent.trim();

// 將原檔訊息節點讀成統一的資料
function readMsg(node) {
  if (node.matches('article')) {
    const sys = node.classList.contains('system');
    const text = trimText(node.querySelector('.message-text')?.textContent ?? '');
    if (sys) return { kind: 'sys', text };
    const av = node.querySelector('.avatar');
    const n = av && [...av.classList].find((c) => /^avatar-image-\d+$/.test(c));
    const sp = node.querySelector('.speaker');
    const roll = node.querySelector('.roll-result');
    return {
      kind: 'msg', text,
      avatarClass: n ? 'av-' + n.split('-')[2] : null,
      name: sp?.textContent ?? '',
      color: speakerColor(sp),
      time: node.querySelector('.timestamp')?.textContent,
      chan: node.querySelector('.channel-name')?.textContent,
      edited: !!node.querySelector('.edited'),
      roll: roll && { text: roll.textContent, cls: ['success', 'failure', 'critical', 'fumble'].filter((c) => roll.classList.contains(c)) },
    };
  }
  if (node.matches('p')) {
    const [, nm, tx] = node.children;
    const name = nm?.textContent.trim() ?? '';
    const text = oldText(tx);
    if (name === 'system') return { kind: 'sys', text };
    return { kind: 'msg', text, name, color: oldColor(node) };
  }
  // Discord
  if (node.classList.contains('div')) return { kind: 'divider', text: node.textContent.trim() };
  if (node.classList.contains('sysmsg')) {
    const c = node.cloneNode(true);
    c.querySelectorAll('.sysico, .systs').forEach((x) => x.remove());
    return { kind: 'sys', text: c.textContent.trim(), time: node.querySelector('.systs')?.textContent.trim() };
  }
  const nm = node.querySelector('.nm');
  const rp = node.querySelector('.bd > .rp');
  return {
    kind: 'msg',
    text: trimText(dcText(node.querySelector('.tx'))),
    avatarUrl: safeUrl(node.querySelector(':scope > img.av')?.getAttribute('src')),
    avatarLetter: node.querySelector(':scope > .av-fb')?.textContent.trim(),
    name: nm?.textContent ?? '',
    color: /(?:^|;)\s*color:\s*([^;]+)/.exec(nm?.getAttribute('style') || '')?.[1].trim() || null,
    time: node.querySelector('.ts')?.textContent,
    bot: !!node.querySelector('.bt'),
    reply: rp && [rp.querySelector('.rp-nm')?.textContent, rp.querySelector('.rp-tx')?.textContent].filter(Boolean).join('：'),
    extras: [...node.querySelectorAll('.bd > .emb, .bd > .fwd, .bd > .poll, .bd > .comps, .bd > .stickers')].map(dcBlock).filter(Boolean),
    images: [...node.querySelectorAll('.atts img')].map((i) => safeUrl(i.getAttribute('src'))).filter(Boolean),
    files: [...node.querySelectorAll('.atts a.att-a')].map((a) => ({ name: a.textContent.trim(), href: /^https?:\/\//i.test(a.getAttribute('href') || '') ? a.getAttribute('href') : null })),
  };
}

// 將修改寫回原檔節點
function writeMsg(node, { text, name, color }) {
  if (node.matches('article')) {
    const t = node.querySelector('.message-text');
    if (t) t.textContent = text;
    const sp = node.querySelector('.speaker');
    if (sp && name != null) sp.textContent = name;
    if (sp && color) sp.setAttribute('style', '--speaker-color:' + color);
    return;
  }
  const d = node.ownerDocument;
  if (node.matches('p')) {
    const [, nm, tx] = node.children;
    if (tx) tx.replaceChildren(...text.split('\n').flatMap((l, i) => (i ? [d.createElement('br'), l] : [l])));
    if (nm && name != null) nm.textContent = name;
    if (color) node.setAttribute('style', 'color:' + color + ';');
    return;
  }
  if (node.classList.contains('div')) { node.textContent = text; return; }
  if (node.classList.contains('sysmsg')) {
    [...node.childNodes].filter((n) => n.nodeType === 3).forEach((n) => n.remove());
    const ico = node.querySelector('.sysico');
    const tn = d.createTextNode(text);
    ico ? ico.after(tn) : node.prepend(tn);
    return;
  }
  let tx = node.querySelector('.tx');
  if (!tx && text) {
    tx = d.createElement('div');
    tx.className = 'tx';
    const row = node.querySelector('.bd > .row');
    row ? row.after(tx) : node.querySelector('.bd')?.append(tx);
  }
  if (tx) tx.replaceChildren(...text.split('\n').flatMap((l, i) => (i ? [d.createElement('br'), l] : [l])));
  const nm = node.querySelector('.nm');
  if (nm && name != null) nm.textContent = name;
  if (nm && color) nm.setAttribute('style', 'color:' + color);
}

/* ---------- 角色（頭貼 + 名稱） ---------- */
const charKey = (m) => (m.avatarClass || m.avatarUrl || m.avatarLetter || '') + '\n' + m.name;
// 依出現順序列出 log 中所有角色，node 為該角色第一則發言（換角色時從這裡複製頭貼）
function collectChars(doc) {
  const map = new Map();
  for (const node of logItems(doc)) {
    const m = readMsg(node);
    if (m.kind !== 'msg') continue;
    const key = charKey(m);
    const c = map.get(key);
    if (c) c.count++;
    else map.set(key, { key, m, node, count: 1 });
  }
  return [...map.values()];
}
const avatarSel = (node) => (node.matches('article') ? '.avatar' : node.matches('p') ? null : ':scope > img.av, :scope > .av-fb');
// 把 ref 的頭貼節點複製到 node（舊版沒有頭貼）
function swapAvatar(node, ref) {
  const sel = avatarSel(node);
  if (!sel || node === ref) return;
  const olds = [...node.querySelectorAll(sel)];
  const news = [...ref.querySelectorAll(sel)].map((e) => e.cloneNode(true));
  if (olds.length) olds[0].before(...news);
  else if (news.length) {
    // 原本沒有頭貼：依 ref 中的位置插入
    const path = [];
    for (let e = ref.querySelector(sel); e !== ref; e = e.parentElement) path.unshift([...e.parentElement.children].indexOf(e));
    let parent = node;
    for (const i of path.slice(0, -1)) parent = parent.children[i] ?? parent;
    parent.insertBefore(news[0], parent.children[path.at(-1)] ?? null);
    news[0].after(...news.slice(1));
  }
  olds.forEach((e) => e.remove());
}

const serialize = (doc) => '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

// 只取出頭像圖片，不注入原檔的其他 CSS
function avatarCss(doc) {
  const re = /\.avatar-image-(\d+)\s*\{\s*background-image:\s*url\((["']?)(.*?)\2\)\s*;?\s*\}/g;
  let css = '';
  for (const s of doc.querySelectorAll('style')) {
    for (const m of s.textContent.matchAll(re)) {
      const url = m[3];
      if (/^(data:image\/|https?:\/\/)/i.test(url) && !/["\\\n<]/.test(url)) {
        css += `.av-${m[1]}{background-image:url("${url}")}\n`;
      }
    }
  }
  return css;
}

function speakerColor(el) {
  const m = /--speaker-color:\s*([^;]+)/.exec(el?.getAttribute('style') || '');
  return m ? m[1].trim() : '#888888';
}
function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map((x) => x + x).join('');
  return '#888888';
}

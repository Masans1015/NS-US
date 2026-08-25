#!/usr/bin/env node
// docs/*.md → 単一HTMLの計画書を生成する。
//   docs/plan.html            ローカルで開ける単体HTML
//   dist/plan.artifact.html   Artifact公開用（doctype/head を持たない本文のみ）
// Markdown は本プロジェクトの docs/ で実際に使っている記法だけを扱う:
//   h1-h3 / 表 / コードフェンス / 箇条書き / 番号付きリスト / 引用 / 水平線 / **太字** / `コード`
// 汎用パーサではない。記法を増やしたらここも足すこと。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const DOCS = [
  { file: 'docs/apps.md',                  label: '作るもの' },
  { file: 'docs/plan.md',                  label: '実行計画' },
  { file: 'docs/decisions.md',             label: '決定記録' },
  { file: 'docs/baseline-measurement.md',  label: 'Before 実測' },
  { file: 'docs/specs/foundation.md',      label: 'W1-W2 基盤' },
  { file: 'docs/specs/A15-design.md',      label: 'A15 設計' },
  { file: 'docs/specs/A03-A04-logic.md',   label: 'A03・A04 判定' },
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// コード span を番兵に退避 → エスケープ → **太字** → コードを戻す。
// 先にバッククォートで分割すると `**A `x` B**` の太字が両セグメントに割れて消える。
function inline(src) {
  const code = [];
  const held = src.replace(/`([^`]*)`/g, (_, c) => `\u0000${code.push(esc(c)) - 1}\u0000`);
  return esc(held)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${code[+n]}</code>`);
}

// 表の行をセルに割る。バッククォート内のパイプは区切りにしない
function cells(row) {
  const body = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out = [];
  let cur = '', tick = false;
  for (const ch of body) {
    if (ch === '`') tick = !tick;
    if (ch === '|' && !tick) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

const isDivider = l => /^\|[\s:|-]+\|$/.test(l.trim());

// 行群を1段落にする。連結してから inline() を1回だけ通す
// （行ごとに呼ぶと **太字** が改行を跨いだときに割れて消える）
const para = ls => `<p>${inline(ls.join('\n')).replace(/\n/g, '<br>')}</p>`;

function render(md, docIdx) {
  const lines = md.split('\n');
  const toc = [];
  let html = '', i = 0;
  const list = (tag, items) => `<${tag}>` + items.map(t => `<li>${inline(t)}</li>`).join('') + `</${tag}>`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      html += `<pre data-lang="${esc(lang)}"><code>${esc(buf.join('\n'))}</code></pre>`;
      continue;
    }

    if (line.trim().startsWith('|') && isDivider(lines[i + 1] ?? '')) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      const num = c => (/^[\d.\-+%]+[h件回分%]?$/.test(c.replace(/\*\*/g, '')) ? ' class="num"' : '');
      html += '<div class="scroller"><table><thead><tr>'
        + head.map(h => `<th>${inline(h)}</th>`).join('')
        + '</tr></thead><tbody>'
        + rows.map(r => '<tr>' + r.map(c => `<td${num(c)}>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table></div>';
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;              // md の # ## ###
      const tag = lvl + 1;                  // h1 は masthead だけに残すため1段下げる
      const id = `d${docIdx}-h${toc.length}-${lvl}`;
      if (lvl <= 2) toc.push({ id, lvl, text: h[2] });
      html += `<h${tag} class="lv${lvl}" id="${id}">${inline(h[2])}</h${tag}>`;
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) { html += '<hr>'; i++; continue; }

    if (line.startsWith('> ') || line === '>') {
      const buf = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      const groups = buf.join('\n').split(/\n{2,}/).map(g => g.trim()).filter(Boolean);
      html += `<blockquote>${groups.map(g => para(g.split('\n'))).join('')}</blockquote>`;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(lines[i++].replace(/^[-*]\s+/, ''));
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i]) && !lines[i].trim().startsWith('```')) {
          buf[buf.length - 1] += ' ' + lines[i++].trim();
        }
      }
      html += list('ul', buf);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i++].replace(/^\d+\.\s+/, ''));
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i])) {
          buf[buf.length - 1] += ' ' + lines[i++].trim();
        }
      }
      html += list('ol', buf);
      continue;
    }

    if (line.trim()) {
      const buf = [];
      while (i < lines.length && lines[i].trim()
             && !/^(#{1,3}\s|[-*]\s|\d+\.\s|>|```|---+$)/.test(lines[i])
             && !lines[i].trim().startsWith('|')) buf.push(lines[i++]);
      if (buf.length) { html += para(buf); continue; }
    }
    i++;
  }
  return { html, toc };
}

const parts = DOCS.map((d, n) => ({ ...d, ...render(readFileSync(d.file, 'utf8'), n) }));

const nav = parts.map(p => {
  const top = p.toc.find(t => t.lvl === 1);
  const subs = p.toc.filter(t => t.lvl === 2);
  return `<div class="navgroup"><a class="navdoc" href="#${top?.id ?? ''}">${esc(p.label)}</a>`
    + subs.map(s => `<a class="navsec" href="#${s.id}">${inline(s.text)}</a>`).join('')
    + '</div>';
}).join('');

const body = parts.map((p, n) =>
  `<article class="doc" id="doc${n}"><p class="srcpath">${esc(p.file)}</p>${p.html}</article>`
).join('');

const STYLE = readFileSync('scripts/doc-style.css', 'utf8');
const HEAD = `<title>AIアプリ内製プログラム 計画書</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@400;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${STYLE}</style>`;

const BODY = `<div class="layout">
<nav class="toc" aria-label="目次">
  <p class="tocttl">計画書</p>
  <p class="tocsub">v1.1.1 ／ 2026-08-24</p>
  ${nav}
</nav>
<main class="content">
  <header class="masthead">
    <p class="eyebrow">NouScale ／ AIアプリ内製プログラム</p>
    <h1 class="doctitle">計画書</h1>
    <p class="lede">2026-09-01 〜 2026-11-29（13週・稼働174h）／1名＋AI<br>
      社内利用を先行し、可搬性を担保したうえで外販候補を選抜する。</p>
    <div class="metaline">
      <span>確定5本＋条件付き1本</span><span>必要131h ／ バッファ43h</span><span>Masans1015/NS-US</span>
    </div>
  </header>
  ${body}
  <footer>
    本ファイルは <code>scripts/build-docs.mjs</code> が <code>docs/*.md</code> から生成しています。<br>
    直接編集しても次回の生成で失われます。内容を変えるときは Markdown 側を直して再生成してください。
  </footer>
</main>
</div>`;

mkdirSync('dist', { recursive: true });
writeFileSync('docs/plan.html',
  `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${HEAD}\n</head>\n<body>\n${BODY}\n</body>\n</html>\n`);
writeFileSync('dist/plan.artifact.html', `${HEAD}\n${BODY}\n`);

console.log(`docs/plan.html          ${(readFileSync('docs/plan.html').length / 1024).toFixed(1)} KB`);
console.log(`dist/plan.artifact.html ${(readFileSync('dist/plan.artifact.html').length / 1024).toFixed(1)} KB`);
console.log(`${DOCS.length} 文書 / 目次 ${parts.reduce((a, p) => a + p.toc.length, 0)} 項目`);

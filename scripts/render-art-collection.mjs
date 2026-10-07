import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../research/art-collection/', import.meta.url));
const artworks = JSON.parse(await readFile(root + 'artworks.json', 'utf8'));
const candidates = JSON.parse(await readFile(root + 'candidates.json', 'utf8'));
const artists = JSON.parse(await readFile(root + 'artist-registry.json', 'utf8'));
const sourceArtists = new Map();
for (const artist of artists) {
  artist.artwork_ids = [];
  for (const id of artist.source_ids) {
    assert(!sourceArtists.has(id), `Duplicate artist source: ${id}`);
    sourceArtists.set(id, artist);
  }
}
for (const artwork of artworks) {
  const raw = candidates.find(a => a.id === artwork.id)?.raw;
  assert(raw, `Missing artist source: ${artwork.id}`);
  const creators = raw.constituents || raw.creators || [];
  artwork.artist_ids = [...new Set(creators.map(creator => {
    const sourceId = raw.constituents ? `met:${creator.constituentID}` : `cma:${creator.id}`;
    const artist = sourceArtists.get(sourceId);
    assert(artist && !creator.qualifier, `Review artist attribution: ${sourceId}`);
    return artist.id;
  }))];
  artwork.artist_status = artwork.artist_ids.length ? 'identified' : 'unidentified';
  for (const id of artwork.artist_ids) artists.find(a => a.id === id).artwork_ids.push(artwork.id);
}
artists.sort((a, b) => (a.name_ko || a.name).localeCompare(b.name_ko || b.name, 'ko'));
const unidentified = artworks.filter(a => !a.artist_ids.length);
assert.equal(artists.find(a => a.id === 'vincent-van-gogh').artwork_ids.length, 4, 'Cross-museum artist grouping');
assert.equal(artists.find(a => a.id === 'claude-monet').artwork_ids.length, 2, 'Do not classify by artwork title');
assert(!artists.find(a => a.id === 'claude-monet').artwork_ids.includes('met-436965'), 'Manet painted the Monet family');
assert.equal(unidentified.length, 4);
await writeFile(root + 'artists.json', JSON.stringify({ artists, unidentified_artwork_ids: unidentified.map(a => a.id) }, null, 2));
assert.equal(artworks.length, 30);
assert.equal(new Set(artworks.map(a => a.id)).size, 30);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
for (const a of artworks) {
  assert(a.license === 'CC0' && new URL(a.source_url).protocol === 'https:');
  const bytes = await readFile(root + a.local_image);
  const info = await sharp(bytes).metadata();
  assert(info.format === 'jpeg' && info.width >= 400 && info.height >= 400, a.id);
  a.image_width = info.width;
  a.image_height = info.height;
  a.sha256 = createHash('sha256').update(bytes).digest('hex');
  a.title_ko_status = 'working_translation';
  a.themes_status = 'editorial_classification';
}
assert.equal(new Set(artworks.map(a => a.sha256)).size, 30, 'Duplicate image');
await writeFile(root + 'artworks.json', JSON.stringify(artworks, null, 2));
const totalBytes = artworks.reduce((sum, a) => sum + a.image_bytes, 0);
const cards = artworks.map(a => `<article data-artists="${escape(a.artist_ids.length ? a.artist_ids.join('|') : 'unidentified')}" data-search="${escape([a.title_ko, a.title, a.artist, ...a.artist_ids.map(id => artists.find(a => a.id === id).name_ko || ''), ...a.themes].join(' ').toLowerCase())}" data-themes="${escape(a.themes.join('|'))}">
<a href="${escape(a.local_image)}" target="_blank" aria-label="${escape(a.title_ko)} 이미지 크게 보기"><img src="${escape(a.local_image)}" alt="${escape(a.title_ko)} — ${escape(a.artist)}" width="${a.image_width}" height="${a.image_height}"></a>
<h2>${escape(a.title_ko)}</h2><p class="original">${escape(a.title)}</p><p>${a.artist_ids.length ? a.artist_ids.map(id => { const artist = artists.find(a => a.id === id); return `<button class="artist-link" data-artist="${escape(id)}">${escape(artist.name_ko || artist.name)}</button>`; }).join(' · ') : '작가 미상'} · ${escape(a.date)}</p><p>${escape(a.artist)}</p>
<p class="themes">${escape(a.themes.join(' · '))}</p><details><summary>작품 정보와 출처</summary><p>${escape(a.medium)}</p><p>${escape(a.dimensions)}</p><p>${escape(a.museum)} · ${escape(a.accession)}</p><p>${a.image_width} × ${a.image_height}px · CC0</p><a href="${escape(a.source_url)}" target="_blank" rel="noreferrer">미술관 원문 ↗</a> · <a href="${escape(a.policy_url)}" target="_blank" rel="noreferrer">공개 이용 정책 ↗</a></details></article>`).join('\n');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>작품 수집 01 — 30점</title>
<style>.artists{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:8px;margin:14px 0}.artists button{font:inherit;font-size:13px;text-align:left;background:transparent;border:1px solid #c7c8bc;border-radius:4px;padding:9px 12px;cursor:pointer}.artists button[aria-pressed=true]{background:#354d40;color:white}.artists small{display:block;font-size:11px;opacity:.75}.artist-link{font:inherit;color:#354d40;border:0;background:none;padding:0;text-decoration:underline;text-underline-offset:3px;cursor:pointer}button:focus-visible{outline:2px solid #354d40;outline-offset:3px}#reset{font:inherit;border:1px solid #c7c8bc;border-radius:4px;background:white;padding:8px 12px;cursor:pointer}</style>
<style>*{box-sizing:border-box}body{margin:0;background:#f5f3ee;color:#242421;font:15px/1.6 system-ui,sans-serif}header,main,footer{max-width:1500px;margin:auto;padding:30px}header{padding-top:45px}h1{font-size:38px;letter-spacing:-1.5px;margin:4px 0}header p{margin:8px 0;color:#5f625b}.eyebrow{font-size:12px;letter-spacing:2px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0 8px}input,select{padding:12px;font:inherit;border:1px solid #c7c8bc;background:white;border-radius:4px}input{min-width:280px;flex:1}main{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:32px 22px;padding-top:12px}article{min-width:0}article img{width:100%;height:205px;object-fit:contain;background:#e9e6de;display:block}h2{font-size:17px;line-height:1.4;margin:14px 0 5px}article p{font-size:12px;margin:6px 0;color:#55594f}.original{min-height:36px}.themes{color:#496344}details{font-size:12px;border-top:1px solid #d6d7cd;padding-top:9px}summary{cursor:pointer}a{color:inherit;text-underline-offset:3px}footer{font-size:12px;color:#62665d}article[hidden]{display:none}label span{display:block;font-size:12px}label:has(input){flex:1}label input{width:100%}@media(max-width:1100px){main{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){main{grid-template-columns:repeat(2,minmax(0,1fr));gap:25px 15px}header,main,footer{padding:20px}h1{font-size:30px}article img{height:165px}input{min-width:0}}</style>
<header><div class="eyebrow">ARCH-B / COLLECTION STUDY 01</div><h1>좋아하는 작품을 모으는 시작</h1><p>The Met 8점 · Cleveland Museum of Art 22점 / 실제 작품 이미지 30점</p><p>이미지를 누르면 원래 크기로 볼 수 있습니다. 한국어 제목은 작업용 번역이며 원문 제목을 함께 보관했습니다.</p>
<details open><summary>작가별 모아보기 · ${artists.length}명 · 작가 미상 ${unidentified.length}점</summary><div class="artists">${artists.map(a => `<button data-artist="${a.id}" aria-pressed="false">${escape(a.name_ko || a.name)} · ${a.artwork_ids.length}점<small>${escape(a.name)}</small></button>`).join('')}<button data-artist="unidentified" aria-pressed="false">작가 미상 · ${unidentified.length}점<small>작가가 확인되지 않은 작품</small></button></div></details>
<nav><label><span>작품명·작가 검색</span><input id="search" type="search" placeholder="작품명 또는 반 고흐, Monet…"></label><label for="artist"><span>작가</span><select id="artist"><option value="">전체 작가</option>${artists.map(a => `<option value="${a.id}">${escape(a.name_ko || a.name)} · ${a.artwork_ids.length}점</option>`).join('')}<option value="unidentified">작가 미상 · ${unidentified.length}점</option></select></label><label for="theme"><span>컬렉션</span><select id="theme"><option value="">전체 작품</option><option>빛과 풍경</option><option>인물과 일상</option><option>꽃과 사물</option><option>동아시아의 장면</option></select></label></nav><button id="reset">전체 작품 보기</button><p id="count" role="status">30점</p></header>
<main>${cards}</main><footer>2026-09-07 수집 · 개별 미술관 API에서 CC0/Public Domain 표시 확인 · 고해상도 JPEG와 원출처 보관 · 테마는 편집 분류입니다.<br>이 페이지는 수집 자료 검토용이며 기존 사이트에 게시된 화면이 아닙니다.</footer>
<script>
const search=document.querySelector('#search'),theme=document.querySelector('#theme'),artist=document.querySelector('#artist'),cards=[...document.querySelectorAll('article')];
function filter(){let count=0;for(const card of cards){card.hidden=!(card.dataset.search.includes(search.value.trim().toLowerCase())&&(!theme.value||card.dataset.themes.split('|').includes(theme.value))&&(!artist.value||card.dataset.artists.split('|').includes(artist.value)));if(!card.hidden)count++}document.querySelector('#count').textContent=(artist.value?artist.selectedOptions[0].textContent.split(' · ')[0]+' / ':'')+count+'점';for(const button of document.querySelectorAll('.artists button'))button.setAttribute('aria-pressed',String(button.dataset.artist===artist.value));}
search.addEventListener('input',filter);theme.addEventListener('change',filter);artist.addEventListener('change',filter);
for(const button of document.querySelectorAll('[data-artist]'))button.addEventListener('click',()=>{artist.value=button.dataset.artist;search.value='';theme.value='';filter()});
document.querySelector('#reset').addEventListener('click',()=>{artist.value='';search.value='';theme.value='';filter()});
</script></html>`;
await writeFile(root + 'index.html', html);
await writeFile(root + 'artists.md', `# 작가별 작품 목록\n\n확인된 작가 ${artists.length}명, 작가 미상 ${unidentified.length}점. 작가 미상은 한 사람을 뜻하지 않는 별도 분류입니다.\n\n미술관의 작가 식별번호를 기준으로 연결했습니다. 반 고흐와 터너의 두 미술관 레코드는 원자료의 이름과 생몰년을 확인하여 함께 묶었습니다. 원래 작가 표기는 artworks.json의 artist 필드에 보존합니다.\n\n${artists.map(a => `## ${a.name_ko || a.name} — ${a.artwork_ids.length}점\n\n${a.name}\n\n${a.artwork_ids.map(id => {const work=artworks.find(a=>a.id===id);return `- [${work.title_ko}](${work.source_url}) · ${work.date} · ${work.museum}`;}).join('\n')}`).join('\n\n')}\n\n## 작가 미상 — ${unidentified.length}점\n\n${unidentified.map(a=>`- [${a.title_ko}](${a.source_url}) · ${a.date}`).join('\n')}\n`);
const lines = artworks.map((a, i) => `| ${i + 1} | [${a.title_ko}](${a.source_url}) | ${a.artist} | ${a.date} | ${a.museum === 'The Metropolitan Museum of Art' ? 'Met' : 'Cleveland'} | ${a.image_width} × ${a.image_height} |`);
await writeFile(root + 'README.md', `# 실제 작품 수집 01\n\n2026-09-07 수집. 30점 / ${(totalBytes / 1024 / 1024).toFixed(1)} MiB / 고유 JPEG 30개.\n\n- [이미지와 함께 둘러보기](index.html)\n- [작가별 작품 목록](artists.md)\n- [작가별 구조화 데이터](artists.json)\n- [구조화된 작품 데이터](artworks.json)\n- [레퍼런스 사이트 조사](reference-sites.md)\n\nThe Met 8점과 Cleveland Museum of Art 22점입니다. 한국 회화 7점과 일본 회화·판화 5점을 포함합니다. 개별 공개 이용 표시, 원문 링크, 재료·크기·소장품 번호와 이미지 해상도·SHA-256을 기록했습니다.\n\n한국어 제목은 작업용 번역입니다. 공식 한국어 명칭으로 확정하지 않았으며 원문을 기준 정보로 보존했습니다. 해설 원고와 미술사 분류는 추가하지 않았습니다. 테마는 이번 수집을 살펴보기 위한 편집 분류입니다. 초기 표본은 서양 회화와 동아시아에 집중되어 있어 다른 지역·여성 작가·현대 작품은 후속 수집에서 보완할 수 있습니다.\n\n| 번호 | 작품 | 작가 — 원문 | 제작 시기 | 소장처 | 이미지 크기 |\n| --- | --- | --- | --- | --- | --- |\n${lines.join('\n')}\n\n## 수집 및 검증\n\n공식 API에서 후보를 수집하고 selection.json의 30점을 선별했습니다. API 원자료는 candidates.json에 보관했습니다. node scripts/render-art-collection.mjs 명령은 30개 고유 작품, 개별 이용 표시, JPEG 해상도, 이미지 중복을 확인하고 검토 페이지를 다시 만듭니다. 이미지는 Met 원본 및 Cleveland print 크기의 공식 파일입니다. 소장품 판본과 작품 연대를 원자료대로 유지했습니다.\n`);
console.log(JSON.stringify({ count: artworks.length, bytes: totalBytes, minimumWidth: Math.min(...artworks.map(a => a.image_width)), minimumHeight: Math.min(...artworks.map(a => a.image_height)), htmlBytes: (await stat(root + 'index.html')).size }));



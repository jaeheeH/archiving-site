import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogSelection from '../app/(dashboard)/dashboard/contents/CatalogSelection';

const options = Array.from({ length: 1000 }, (_, index) => ({ id: `item-${index}`, title: `항목 ${index}`, subtitle: `Original ${index}` }));
const render = (selected: string[], choices = options, errors: string[] = []) => renderToStaticMarkup(<CatalogSelection name="profile.related_post_ids" label="함께 읽는 글" description="최대 6편 선택" placeholder="글 제목 검색" options={choices} initialSelected={selected} limit={6} errors={errors} onChange={() => {}} />);
const inputs = (html: string, type: string) => [...html.matchAll(/<input\b[^>]*>/g)].map(match => match[0]).filter(tag => tag.includes(`type="${type}"`));
const values = (html: string) => inputs(html, 'hidden').map(tag => tag.match(/value="([^"]*)"/)?.[1]);

const offPage = render(['item-500', 'missing', 'item-500']);
assert.deepEqual(values(offPage), ['item-500', 'missing'], 'Off-page and unavailable selections survive submission without duplicates.');
assert.equal(inputs(offPage, 'checkbox').length, 10, 'A large catalog renders only one page of results.');
assert(inputs(offPage, 'hidden').every(tag => tag.includes('name="profile.related_post_ids"')));
assert(inputs(offPage, 'checkbox').every(tag => !tag.includes('name=')), 'Visible results must not duplicate submitted selections.');
assert(offPage.includes('항목 500') && offPage.includes('연결 항목을 찾을 수 없음'));
assert(inputs(offPage, 'search').every(tag => !tag.includes('name=')), 'Lookup text is not saved as content.');

const full = render(options.slice(0, 6).map(option => option.id));
assert.equal(inputs(full, 'checkbox').filter(tag => tag.includes('disabled=')).length, 4, 'Only unselected choices are disabled at the limit.');
assert.equal(inputs(full, 'checkbox').filter(tag => tag.includes('checked=')).length, 6);
assert(!inputs(full, 'checkbox').some(tag => tag.includes('checked=') && tag.includes('disabled=')), 'Selected choices remain removable at the limit.');
assert.equal(values(full).length, 6);

const unavailable = render(['missing'], [], ['비공개 글을 선택 해제해주세요.']);
assert.deepEqual(values(unavailable), ['missing'], 'An empty result set must not silently clear saved links.');
assert(unavailable.includes('검색 결과가 없습니다.') && unavailable.includes('role="alert"'));
assert.deepEqual(values(render([])), []);
console.log('Catalog selection checks passed: bounded rendering, preserved off-page links, unique form values, selection limits and unavailable items.');

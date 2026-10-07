import assert from 'node:assert/strict';
import { FEEDS, CATEGORIES, fetchFeed, parseFeed } from '../lib/news-feeds.ts';

assert.equal(new Set(FEEDS.map(feed => feed.id)).size, FEEDS.length);
assert.equal(new Set(FEEDS.map(feed => feed.url)).size, FEEDS.length);
assert.ok(FEEDS.every(feed => Object.hasOwn(CATEGORIES, feed.category) && new URL(feed.url).protocol === 'https:'));
for (const id of ['meta', 'google', 'adobe', 'midjourney', 'samsung', 'figma', 'nvidia', 'apple', 'microsoft', 'openai', 'huggingface']) assert.ok(FEEDS.some(feed => feed.id === id));
const feed = FEEDS.find(feed => feed.id === 'google');
const now = Date.parse('2026-10-07T00:00:00Z');
const atom = (title, date = '2026-10-06T00:00:00Z', category = '') => `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>${title}</title><link rel="self" href="https://blog.google/self.xml"/><link rel="alternate" href="https://blog.google/story?utm_source=rss"/><published>${date}</published><category term="${category}"/><summary><![CDATA[<p>Details about the announcement.</p><img src="https://blog.google/image.jpg"/>]]></summary></entry></feed>`;
const article = parseFeed(atom('New Gemini capabilities'), feed, now)[0];
assert.equal(article.category, 'ai'); assert.equal(article.url, 'https://blog.google/story'); assert.equal(article.image, 'https://blog.google/image.jpg');
assert.equal(parseFeed(atom('Painting and email updates'), feed, now)[0].category, 'technology', 'AI must not match inside unrelated words');
assert.equal(parseFeed(atom('New tools', undefined, 'UX'), feed, now)[0].category, 'design');
assert.equal(parseFeed(atom('Archived story', '2025-01-01'), feed, now).length, 0);
assert.equal(parseFeed(atom('Future story', '2027-01-01'), feed, now).length, 0);
assert.deepEqual(parseFeed('<rss><channel><title>Quiet feed</title></channel></rss>', feed, now), []);
assert.throws(() => parseFeed('<html><body>Not a feed</body></html>', feed, now));
const items = Array.from({ length: 30 }, (_, i) => `<item><title>Product ${i}</title><link>https://blog.google/${i}</link><pubDate>${new Date(now - i * 86400000).toUTCString()}</pubDate><description>Details</description></item>`).reverse().join('');
const bounded = parseFeed(`<rss><channel>${items}</channel></rss>`, feed, now);
assert.equal(bounded.length, 20); assert.equal(bounded[0].title, 'Product 0'); assert.equal(bounded.at(-1).title, 'Product 19');
if (process.argv.includes('--live')) {
  const results = await Promise.all(FEEDS.map(async feed => {
    try { const articles = await fetchFeed(feed); console.log(`${feed.name}: ${articles.length} recent items${articles[0] ? `, ${articles[0].published_at.slice(0, 10)} (${articles[0].category})` : ''}`); return { feed, articles }; }
    catch (error) { console.error(`${feed.name}: ${error.message}`); return { feed, error }; }
  }));
  assert.ok(results.every(result => !result.error), 'Every configured publisher must return a valid feed');
  assert.ok(results.every(result => !result.articles?.some(article => !Object.hasOwn(CATEGORIES, article.category) || !article.title || !article.url)));
}
console.log(`News source checks passed: ${FEEDS.length} feeds, RSS/Atom, topic classification, recency, deduplication and bounded collection.`);

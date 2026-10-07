// Manual only: generate review files; never updates published articles.
import fs from 'node:fs/promises';
import { researchNews } from '../lib/news-research.ts';
import { editorialText } from '../lib/news-editorial.ts';
const articles = JSON.parse(await fs.readFile(new URL('../content/news/initial-articles.json', import.meta.url), 'utf8'));
const destination = new URL('../content/news/researched-articles.json', import.meta.url);
let reviewed = [];
try { reviewed = JSON.parse(await fs.readFile(destination, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const selected = process.argv[2] ? articles.filter(article => article.url.includes(process.argv[2])) : articles.filter(article => editorialText(article.paragraphs).length < 1800);
for (const article of selected) {
  if (reviewed.some(item => item.article.url === article.url)) continue;
  try {
    const result = await researchNews({ url: article.url, title: article.original_title, source: article.source, category: article.category });
    reviewed.push(result);
    await fs.writeFile(destination, JSON.stringify(reviewed, null, 2) + '\n');
    console.log(JSON.stringify({ title: result.article.title, characters: result.research.characterCount, references: result.research.sources.length }));
  } catch (error) { console.error(JSON.stringify({ url: article.url, error: error.message })); process.exitCode = 1; }
}

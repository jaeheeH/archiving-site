import { z } from 'zod';

const text = (max = 300) => z.string().trim().max(max);
const url = z.string().url().max(2000).refine(value => { const parsed = new URL(value); return parsed.protocol === 'https:' && !parsed.username && !parsed.password; }, 'https 주소를 입력해주세요.');
export const artIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
export const artistProfileSchema = z.object({
  description: text(1500), lifespan: text(100), context: text(200),
  sources: z.array(z.object({ label: text(200).min(1), url }).strict()).max(5),
  related_post_ids: z.array(z.string().uuid()).max(6).refine(ids => new Set(ids).size === ids.length, '관련 글은 중복 없이 선택해주세요.'),
}).strict().refine(profile => !profile.description || profile.sources.length > 0, { path: ['sources'], message: '소개를 작성하면 확인한 출처를 한 곳 이상 입력해주세요.' });
export type ArtistProfile = z.infer<typeof artistProfileSchema>;
export const artistSchema = z.object({ name: text(200).min(1), name_ko: text(200).nullable(), source_ids: z.array(text(200).min(1)).max(30), profile: artistProfileSchema.optional() }).strict();
export const artworkSchema = z.object({
  title: text().min(1), title_ko: text().min(1), museum: text().min(1), artist: text(),
  artist_ids: z.array(artIdSchema).max(20), date: text(100), medium: text(500), dimensions: text(500),
  medium_ko: text(500).optional(), dimensions_ko: text(1500).optional(), description: text(1500).optional(),
  culture: text(), accession: text(), source_url: url, preview_url: url, policy_url: url,
  license: text(200).min(1), themes: z.array(text(50).min(1)).max(20),
  image_width: z.number().int().min(1).max(50000), image_height: z.number().int().min(1).max(50000),
}).strict();

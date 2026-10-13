import { z } from 'zod';
import { ART_PERIODS, ART_MOVEMENTS, ART_KINDS, ART_SUBJECTS } from './art-taxonomy';

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
export const artTaxonomySchema = z.object({
  periods: z.array(z.enum(ART_PERIODS.map(item => item.id))).max(5),
  movements: z.array(z.enum(ART_MOVEMENTS.map(item => item.id))).max(10),
  kind: z.union([z.literal(''), z.enum(ART_KINDS.map(item => item.id))]),
  subjects: z.array(z.enum(ART_SUBJECTS.map(item => item.id))).max(10),
  sources: z.array(z.object({ label: text(200).min(1), url }).strict()).max(5),
}).strict().superRefine((taxonomy, context) => {
  for (const field of ['periods', 'movements', 'subjects'] as const) {
    if (new Set(taxonomy[field]).size !== taxonomy[field].length) context.addIssue({ code: 'custom', path: [field], message: '같은 분류는 한 번만 선택해주세요.' });
  }
  for (const movement of taxonomy.movements) {
    if (!ART_MOVEMENTS.find(item => item.id === movement)?.periods.some(period => taxonomy.periods.some(value => value === period))) context.addIssue({ code: 'custom', path: ['movements'], message: '선택한 사조에 해당하는 시대를 함께 선택해주세요.' });
  }
  if ((taxonomy.periods.length || taxonomy.movements.length || taxonomy.kind || taxonomy.subjects.length) && !taxonomy.sources.length) context.addIssue({ code: 'custom', path: ['sources'], message: '분류를 확인한 출처를 한 곳 이상 입력해주세요.' });
});
export const artworkSchema = z.object({
  title: text().min(1), title_ko: text().min(1), museum: text().min(1), artist: text(),
  artist_ids: z.array(artIdSchema).max(20), date: text(100), medium: text(500), dimensions: text(500),
  medium_ko: text(500).optional(), dimensions_ko: text(1500).optional(), description: text(1500).optional(),
  culture: text(), accession: text(), source_url: url, preview_url: url, policy_url: url,
  license: text(200).min(1), themes: z.array(text(50).min(1)).max(20),
  taxonomy: artTaxonomySchema.optional(),
  image_width: z.number().int().min(1).max(50000), image_height: z.number().int().min(1).max(50000),
}).strict();

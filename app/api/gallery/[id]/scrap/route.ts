import { handleScrap } from '@/lib/scrap';
async function save(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleScrap(request, (await params).id, 'gallery');
}
export { save as POST, save as PUT };

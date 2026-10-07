import { listArt, saveArt } from '@/lib/art-management';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { return listArt('artworks', request, (await params).id); }
export async function PATCH(request: Request, { params }: Context) { return saveArt('artworks', request, (await params).id); }

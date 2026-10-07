import { listArt, saveArt } from '@/lib/art-management';
export async function GET(request: Request) { return listArt('artworks', request); }
export async function POST(request: Request) { return saveArt('artworks', request); }

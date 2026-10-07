import CatalogPage from '../CatalogPage';
export const dynamic = 'force-dynamic';
export default function Page({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) { return <CatalogPage kind="artists" searchParams={searchParams} />; }

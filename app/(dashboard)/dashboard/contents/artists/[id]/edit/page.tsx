import { CatalogEditPage } from '../../../CatalogPage';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <CatalogEditPage kind="artists" id={(await params).id} />; }

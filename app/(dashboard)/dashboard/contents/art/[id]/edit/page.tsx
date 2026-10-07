import { CatalogEditPage } from '../../../CatalogPage';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <CatalogEditPage kind="art" id={(await params).id} />; }

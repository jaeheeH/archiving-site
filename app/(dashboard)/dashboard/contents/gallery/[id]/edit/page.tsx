import EditGalleryClient from "./EditGalleryClient";

export default async function EditGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = resolved.id;
  return <EditGalleryClient id={id} />;
}

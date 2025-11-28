import EditGalleryClient from "./EditGalleryClient";

export default async function EditGalleryPage({ params }: any) {
  const resolved = await params;
  const id = resolved.id;
  return <EditGalleryClient id={id} />;
}
import NewsEditor from "../../NewsEditor";

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  return <NewsEditor postId={(await params).id} />;
}

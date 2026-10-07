import { permanentRedirect } from "next/navigation";
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  permanentRedirect(`/news/read/${encodeURIComponent((await params).slug)}`);
}

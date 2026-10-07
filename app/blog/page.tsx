import { permanentRedirect } from "next/navigation";
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  permanentRedirect(category && category !== "all" ? `/news/stories?category=editorial&collection=${encodeURIComponent(category)}` : "/news/stories?category=editorial");
}

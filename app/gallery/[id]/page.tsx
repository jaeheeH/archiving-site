import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GalleryDetailClient from './GalleryDetailClient';
import { getGalleryDetailData } from '@/lib/public-data';
import { createPublicClient } from '@/lib/supabase/public';
import { Suspense } from 'react';
import { pageMetadata, jsonLd, breadcrumb, sitePageUrl } from '@/lib/seo';

interface Props {
  params: Promise<{ id: string }>;
}

const STATIC_GALLERY_PARAMS_LIMIT = 100;

export const revalidate = 86400;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('gallery')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(STATIC_GALLERY_PARAMS_LIMIT);

    if (error) {
      console.error('Failed to fetch gallery ids for static generation:', error);
      return [];
    }

    return (data || []).map((item) => ({
      id: String(item.id),
    }));
  } catch (error) {
    console.error('Error in gallery generateStaticParams:', error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const data = await getGalleryDetailData(Number(id));

  if (!data?.gallery) notFound();

  const { gallery } = data;
  return pageMetadata({ path: `/gallery/${id}`, title: gallery.title, description: gallery.description || gallery.gemini_description || 'ARCH.B의 이미지와 프롬프트 아카이브.', image: `/api/og?type=gallery&id=${id}` });
}

export default async function GalleryDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const currentId = Number(id);
  const data = await getGalleryDetailData(currentId);

  if (!data?.gallery) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([
        breadcrumb([{ name: '홈', path: '/' }, { name: '갤러리', path: '/gallery' }, { name: data.gallery.title, path: `/gallery/${id}` }]),
        { '@context': 'https://schema.org', '@type': 'ImageObject', url: sitePageUrl(`/gallery/${id}`), contentUrl: data.gallery.image_url, name: data.gallery.title, description: data.gallery.description || data.gallery.gemini_description || undefined, datePublished: data.gallery.created_at },
      ]) }} />
      <GalleryDetailClient 
        gallery={data.gallery} 
        prevId={data.prevId}
        nextId={data.nextId}
      />
    </Suspense>
  );
}

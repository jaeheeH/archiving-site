'use client';

import dynamic from 'next/dynamic';
import '../css/style.scss';

const BrunchWriteEditor = dynamic(() => import('@/components/Editor/BrunchWriteEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 pt-24">
        <div className="mb-10 h-9 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mb-6 h-12 w-full animate-pulse rounded bg-gray-100" />
        <div className="mb-12 h-24 w-full animate-pulse rounded bg-gray-50" />
        <div className="h-[420px] w-full animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
      </div>
    </div>
  ),
});

export default function CreateBlogPage() {
  return <BrunchWriteEditor type="blog" />;
}

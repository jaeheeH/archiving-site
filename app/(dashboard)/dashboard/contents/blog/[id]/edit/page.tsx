'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BrunchWriteEditor from '@/components/Editor/BrunchWriteEditor';

export default function EditBlogPage() {
  const params = useParams();
  const postId = params.id as string;

  return <BrunchWriteEditor type="blog" postId={postId} />;
}

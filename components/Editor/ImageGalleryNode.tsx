// components/Editor/ImageGalleryNode.tsx

'use client';

import React, { useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import type { NodeViewProps } from '@tiptap/react';

interface ImageGalleryAttrs {
  images: string[];
  layout: 'grid' | 'swiper';
}

type ImageGalleryComponentProps = NodeViewProps;

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
  onExtract: (index: number) => void;
}

const SortableImage = ({ id, url, index, onRemove, onExtract }: SortableImageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative group aspect-square"
    >
      <div {...listeners} className="w-full h-full cursor-move">
        <img
          src={url}
          alt={`이미지 ${index + 1}`}
          className="w-full h-full object-cover rounded"
        />
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExtract(index);
          }}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full p-1 text-xs"
          title="갤러리에서 빼기"
        >
          <i className="ri-arrow-up-line"></i>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
          title="삭제"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
};

// 전역 선택 상태 (DraggableImageNode와 공유)
declare global {
  var selectedImageData: { pos: number; src: string; editor: any; type: 'image' | 'gallery' } | null;
}

if (typeof window !== 'undefined') {
  (window as any).selectedImageData = (window as any).selectedImageData || null;
}

const ImageGalleryComponent = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
  getPos,
  editor,
}: ImageGalleryComponentProps) => {
  const attrs = node.attrs as ImageGalleryAttrs;
  const images = Array.isArray(attrs.images) ? attrs.images : [];
  const layout = attrs.layout || 'grid';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [draggedOutIndex, setDraggedOutIndex] = useState<number | null>(null);
  const [isGallerySelected, setIsGallerySelected] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동 후 드래그 시작
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', fileName);
        formData.append('isTemp', 'true');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '업로드 실패');
        }

        const data = await response.json();
        return data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      updateAttributes({ images: [...images, ...uploadedUrls] });
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      alert('이미지 업로드에 실패했습니다: ' + (error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_: string, i: number) => i !== index);

    // 이미지가 0개면 갤러리 전체 삭제
    if (newImages.length === 0) {
      deleteNode();
      return;
    }

    // 이미지가 하나만 남으면 갤러리를 일반 이미지로 변환
    if (newImages.length === 1) {
      const pos = getPos();
      if (typeof pos === 'number' && editor) {
        const { tr } = editor.state;
        const imageNode = editor.schema.nodes.image.create({ src: newImages[0] });
        tr.replaceWith(pos, pos + node.nodeSize, imageNode);
        editor.view.dispatch(tr);
      }
    } else {
      updateAttributes({ images: newImages });
    }
  };

  const extractImage = (index: number) => {
    const extractedSrc = images[index];
    const newImages = images.filter((_: string, i: number) => i !== index);

    const pos = getPos();
    if (typeof pos !== 'number' || !editor) return;

    // 이미지가 하나만 남거나 0개면 노드 교체/삭제 + 추출
    if (newImages.length <= 1) {
      const { tr } = editor.state;

      if (newImages.length === 1) {
        // 갤러리를 일반 이미지로 변환
        const imageNode = editor.schema.nodes.image.create({ src: newImages[0] });
        tr.replaceWith(pos, pos + node.nodeSize, imageNode);
      } else {
        // 모든 이미지가 빠지면 갤러리 삭제
        tr.delete(pos, pos + node.nodeSize);
      }

      // 추출된 이미지 삽입
      const extractedImageNode = editor.schema.nodes.image.create({ src: extractedSrc });
      const insertPos = newImages.length === 1 ? pos + 1 : pos;
      tr.insert(insertPos, extractedImageNode);

      editor.view.dispatch(tr);
    } else {
      // 2개 이상 남으면 갤러리 업데이트 후 이미지 삽입
      updateAttributes({ images: newImages });

      // 약간의 지연 후 이미지 삽입
      setTimeout(() => {
        const currentPos = getPos();
        if (typeof currentPos === 'number') {
          const { tr } = editor.state;
          const extractedImageNode = editor.schema.nodes.image.create({ src: extractedSrc });
          const insertPos = currentPos + node.nodeSize;
          tr.insert(insertPos, extractedImageNode);
          editor.view.dispatch(tr);
        }
      }, 0);
    }
  };

  const toggleLayout = () => {
    updateAttributes({ layout: layout === 'grid' ? 'swiper' : 'grid' });
  };

  const handleGalleryClick = (e: React.MouseEvent) => {
    // 버튼 클릭은 무시
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    const currentPos = getPos();
    if (typeof currentPos !== 'number' || !editor) return;

    // 전역 선택된 이미지가 있는지 확인
    const selectedData = (window as any).selectedImageData;

    if (selectedData && selectedData.type === 'image' && selectedData.pos !== currentPos) {
      console.log('Adding selected image to gallery');

      // 선택된 이미지를 갤러리에 추가
      const newImages = [...images, selectedData.src];

      const { tr } = editor.state;

      // 갤러리 업데이트
      tr.setNodeMarkup(currentPos, null, { ...node.attrs, images: newImages });

      // 이미지 노드 삭제
      const imageNode = editor.state.doc.nodeAt(selectedData.pos);
      if (imageNode) {
        tr.delete(selectedData.pos, selectedData.pos + imageNode.nodeSize);
      }

      editor.view.dispatch(tr);

      // 선택 초기화
      (window as any).selectedImageData = null;
      setIsGallerySelected(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta, activatorEvent } = event;

    // Check if dragged outside gallery bounds
    if (galleryRef.current && activatorEvent && 'clientY' in activatorEvent) {
      const rect = galleryRef.current.getBoundingClientRect();
      const dragEndY = (activatorEvent as any).clientY + delta.y;
      const dragEndX = (activatorEvent as any).clientX + delta.x;

      const isOutside =
        dragEndY < rect.top ||
        dragEndY > rect.bottom ||
        dragEndX < rect.left ||
        dragEndX > rect.right;

      if (isOutside) {
        // Extract the image
        const draggedIndex = images.findIndex((_: string, i: number) => `image-${i}` === active.id);
        if (draggedIndex !== -1) {
          extractImage(draggedIndex);
          return;
        }
      }
    }

    // Normal reordering logic if not dragged outside
    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((_: string, i: number) => `image-${i}` === active.id);
      const newIndex = images.findIndex((_: string, i: number) => `image-${i}` === over.id);

      const newImages = arrayMove(images, oldIndex, newIndex);
      updateAttributes({ images: newImages });
    }
  };

  return (
    <NodeViewWrapper className={`image-gallery-node ${selected ? 'selected' : ''}`} data-drag-handle>
      <div
        onClick={handleGalleryClick}
        className="relative my-8 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition"
      >
        {/* 컨트롤 버튼 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLayout}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
            >
              {layout === 'grid' ? (
                <>
                  <i className="ri-grid-line mr-1"></i> 그리드
                </>
              ) : (
                <>
                  <i className="ri-slideshow-line mr-1"></i> 슬라이드
                </>
              )}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded transition disabled:opacity-50"
            >
              {uploading ? '업로드 중...' : '이미지 추가'}
            </button>
          </div>
          <button
            onClick={deleteNode}
            className="px-3 py-1 text-sm bg-red-500 text-white hover:bg-red-600 rounded transition"
          >
            <i className="ri-delete-bin-line"></i>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* 이미지 표시 영역 */}
        {images.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <i className="ri-image-add-line text-4xl mb-2"></i>
            <p className="text-sm">이미지를 추가하세요</p>
          </div>
        ) : layout === 'grid' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map((_: string, i: number) => `image-${i}`)}
              strategy={rectSortingStrategy}
            >
              <div ref={galleryRef} className="grid grid-cols-3 gap-4">
                {images.map((url: string, index: number) => (
                  <SortableImage
                    key={`image-${index}`}
                    id={`image-${index}`}
                    url={url}
                    index={index}
                    onRemove={removeImage}
                    onExtract={extractImage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <Swiper
            modules={[Navigation, Pagination]}
            navigation
            pagination={{ clickable: true }}
            className="rounded-lg"
          >
            {images.map((url: string, index: number) => (
              <SwiperSlide key={index}>
                <div className="relative group aspect-video">
                  <img
                    src={url}
                    alt={`이미지 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition z-10"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>

      <style jsx global>{`
        .image-gallery-node.selected > div {
          border-color: #00c4c4;
        }

        .swiper-button-next,
        .swiper-button-prev {
          color: white;
          background: rgba(0, 0, 0, 0.5);
          width: 40px;
          height: 40px;
          border-radius: 50%;
        }

        .swiper-button-next:after,
        .swiper-button-prev:after {
          font-size: 20px;
        }

        .swiper-pagination-bullet-active {
          background: #00c4c4;
        }
      `}</style>
    </NodeViewWrapper>
  );
};

export const ImageGalleryNode = Node.create({
  name: 'imageGallery',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [],
      },
      layout: {
        default: 'grid',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-gallery"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'image-gallery' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryComponent);
  },
});

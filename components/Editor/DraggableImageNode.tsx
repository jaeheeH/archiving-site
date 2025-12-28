// components/Editor/DraggableImageNode.tsx

'use client';

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import Image from '@tiptap/extension-image';

interface DraggableImageComponentProps extends NodeViewProps {}

declare global {
  interface Window {
    selectedImageData: { pos: number; src: string; editor: any; type: 'image' | 'gallery' } | null;
  }
}

// 안전한 접근을 위한 헬퍼 함수
const getSelectedImage = () => {
  if (typeof window !== 'undefined' && window.selectedImageData) {
    return window.selectedImageData;
  }
  return null;
};

const setSelectedImage = (data: any) => {
  if (typeof window !== 'undefined') {
    window.selectedImageData = data;
  }
};

const DraggableImageComponent = ({ node, updateAttributes, deleteNode, getPos, editor }: DraggableImageComponentProps) => {
  const { src } = node.attrs;
  const [isSelected, setIsSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    setSelectedImage(null);
    setIsSelected(false);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const currentPos = getPos();
    if (typeof currentPos !== 'number' || !editor) return;

    const selectedImageData = getSelectedImage();

    // 1. 이미 다른 이미지가 선택되어 있는 경우 (합치기 시도)
    if (selectedImageData && selectedImageData.pos !== currentPos) {
      
      // [방어 코드 1] 에디터 인스턴스가 다르면(새로고침 등) 초기화 후 현재 이미지 선택
      if (selectedImageData.editor !== editor) {
        setSelectedImage({ pos: currentPos, src, editor, type: 'image' });
        setIsSelected(true);
        return;
      }

      const firstPos = Math.min(selectedImageData.pos, currentPos);
      const secondPos = Math.max(selectedImageData.pos, currentPos);

      const { tr } = editor.state;
      const firstNode = editor.state.doc.nodeAt(firstPos);
      const secondNode = editor.state.doc.nodeAt(secondPos);

      // [방어 코드 2] 노드가 없거나, 이미지/갤러리 타입이 아니면(문서가 수정되어 위치가 밀림) 초기화
      const isValidNode = (n: any) => n && (n.type.name === 'image' || n.type.name === 'imageGallery');

      if (!isValidNode(firstNode) || !isValidNode(secondNode)) {
        console.warn('문서 변경으로 인해 이전 선택이 유효하지 않습니다. 새로 선택합니다.');
        // 잘못된 선택은 잊고, 현재 클릭한 이미지를 첫 번째 선택으로 잡음
        setSelectedImage({ pos: currentPos, src, editor, type: 'image' });
        setIsSelected(true);
        return;
      }

      // --- 정상적인 합치기 로직 실행 ---
      
      // 1. 첫 번째 노드가 갤러리인 경우
      if (firstNode!.type.name === 'imageGallery') {
        const currentImages = firstNode!.attrs.images || [];
        const newImages = [...currentImages, secondNode!.type.name === 'image' ? secondNode!.attrs.src : src];
        
        tr.setNodeMarkup(firstPos, null, { ...firstNode!.attrs, images: newImages });
        tr.delete(secondPos, secondPos + secondNode!.nodeSize);
        editor.view.dispatch(tr);
      }
      // 2. 두 번째 노드가 갤러리인 경우
      else if (secondNode!.type.name === 'imageGallery') {
        const currentImages = secondNode!.attrs.images || [];
        const newImages = [firstNode!.type.name === 'image' ? firstNode!.attrs.src : src, ...currentImages];
        
        tr.delete(secondPos, secondPos + secondNode!.nodeSize);
        tr.delete(firstPos, firstPos + firstNode!.nodeSize);
        
        const galleryNode = editor.schema.nodes.imageGallery.create({
          images: newImages,
          layout: secondNode!.attrs.layout || 'grid'
        });
        
        tr.insert(firstPos, galleryNode);
        editor.view.dispatch(tr);
      }
      // 3. 둘 다 일반 이미지인 경우 (새 갤러리 생성)
      else {
        const images = [selectedImageData.src, src];
        
        tr.delete(secondPos, secondPos + secondNode!.nodeSize);
        tr.delete(firstPos, firstPos + firstNode!.nodeSize);
        
        const galleryNode = editor.schema.nodes.imageGallery.create({
          images,
          layout: 'grid'
        });
        
        tr.insert(firstPos, galleryNode);
        editor.view.dispatch(tr);
      }

      // 합치기 완료 후 선택 초기화
      setSelectedImage(null);
      setIsSelected(false);

    } else {
      // 2. 같은 이미지를 클릭했거나(선택 취소), 처음 클릭한 경우
      if (selectedImageData && selectedImageData.pos === currentPos) {
        // 선택 취소
        setSelectedImage(null);
        setIsSelected(false);
      } else {
        // 선택 시작
        setSelectedImage({ pos: currentPos, src, editor, type: 'image' });
        setIsSelected(true);
      }
    }
  };

  return (
    <NodeViewWrapper className="draggable-image-wrapper" data-drag-handle>
      <div
        className={`relative inline-block transition-all ${
          isSelected ? 'ring-4 ring-[#00c4c4] ring-opacity-50 rounded' : ''
        }`}
      >
        <img
          src={src}
          alt=""
          onClick={handleImageClick}
          className="brunch-image cursor-pointer hover:opacity-95 transition"
          draggable="false"

        />
        {isSelected && (
          <div className="absolute top-2 right-2 bg-[#00c4c4] text-white px-3 py-1.5 rounded-full text-xs font-bold z-10 shadow-md">
            선택됨 <span className="font-normal opacity-90">- 다른 이미지를 클릭해 합치기</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const DraggableImage = Image.extend({
  name: 'image',
  draggable: true,
  addNodeView() {
    return ReactNodeViewRenderer(DraggableImageComponent);
  },
});
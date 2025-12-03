// components/Editor/ColumnsNode.tsx
'use client';

import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

// 1. 커맨드 타입 확장 (TypeScript 오류 방지)
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (attrs: { columns: number }) => ReturnType;
    };
  }
}

interface ColumnsAttrs {
  columns: number;
}

const ColumnsComponent = ({
  node,
  updateAttributes,
  deleteNode,
  selected, // 노드가 선택되었는지 여부
}: NodeViewProps) => {
  const { columns } = node.attrs as ColumnsAttrs;

  return (
    <NodeViewWrapper className="columns-component my-4">
      <div
        className={`relative p-4 border-2 rounded-lg transition-all ${
          selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 border-dashed hover:border-gray-300'
        }`}
      >
        {/* 컨트롤 패널 (선택되었을 때만 보이거나 항상 보이게 설정 가능) */}
        <div 
          className="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded-md select-none"
          contentEditable={false} // 중요: 버튼 클릭 시 에디터 포커스 문제 방지
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase px-1">Layout</span>
            <button
              onClick={() => updateAttributes({ columns: 2 })}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                columns === 2
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              2단
            </button>
            <button
              onClick={() => updateAttributes({ columns: 3 })}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                columns === 3
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              3단
            </button>
          </div>
          <button
            onClick={deleteNode}
            className="px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
            title="레이아웃 삭제"
          >
            삭제
          </button>
        </div>

        {/* 중요: NodeViewContent 자체가 Grid가 되도록 스타일링해야 합니다.
          Tailwind 클래스를 직접 붙이기 어렵기 때문에(NodeViewContent는 래퍼를 생성함),
          아래 style 태그를 활용합니다.
        */}
        <NodeViewContent className="content-grid" />
      </div>

      {/* 스타일링 로직: NodeViewContent 내부의 실제 편집 영역 타겟팅 */}
      <style jsx global>{`
        /* NodeViewContent가 생성하는 내부 div를 타겟팅 */
        .columns-component .content-grid > div {
            display: grid;
            grid-template-columns: repeat(${columns}, minmax(0, 1fr)); 
            gap: 1.5rem;
            min-height: 80px;
            align-items: center; /* 수직 중앙 정렬 (선택 사항) */
          }
        
        /* 모바일 대응: 화면이 작으면 1단으로 변경 (선택 사항) */
        @media (max-width: 640px) {
          .columns-component .content-grid > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </NodeViewWrapper>
  );
};

export const ColumnsNode = Node.create({
  name: 'columns',

  group: 'block',

  content: 'block+', // 중요: 문단, 이미지 등 블록 요소들이 자식으로 들어옵니다.

  draggable: true,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (element) => {
            const cols = element.getAttribute('data-columns');
            return cols ? parseInt(cols, 10) : 2;
        },
        renderHTML: (attributes) => {
          return {
            'data-columns': attributes.columns,
            // 렌더링된 HTML에서도 스타일을 유지하기 위해 style 속성 추가
            style: `display: grid; grid-template-columns: repeat(${attributes.columns}, 1fr); gap: 1.5rem;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="columns"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'columns' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnsComponent);
  },

  addCommands() {
    return {
      setColumns:
        (attributes: ColumnsAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
            content: [
              { type: 'paragraph' }, // 기본적으로 빈 문단 하나 포함
              { type: 'paragraph' }, // 2단이므로 시각적 이해를 위해 2개 추가 추천
            ],
          });
        },
    };
  },
});
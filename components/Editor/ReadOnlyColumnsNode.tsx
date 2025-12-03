// components/Editor/ReadOnlyColumnsNode.tsx

'use client';

import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

interface ColumnsAttrs {
  columns: number; // 2 or 3
}

type ReadOnlyColumnsComponentProps = NodeViewProps;

const ReadOnlyColumnsComponent = ({
  node,
}: ReadOnlyColumnsComponentProps) => {
  const { columns = 2 } = node.attrs as ColumnsAttrs;

  return (
    <NodeViewWrapper className="columns-readonly">
      <div className="my-6">
        <div
          className={`grid gap-6 ${
            columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
          }`}
        >
          <NodeViewContent className="column-content" />
        </div>
      </div>

      <style jsx global>{`
        .columns-readonly .column-content > div {
          display: grid;
          grid-template-columns: repeat(var(--columns, 2), 1fr);
          gap: 1.5rem;
        }

        .columns-readonly[data-columns='2'] .column-content > div {
          --columns: 2;
        }

        .columns-readonly[data-columns='3'] .column-content > div {
          --columns: 3;
        }

        @media (max-width: 768px) {
          .columns-readonly .column-content > div {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </NodeViewWrapper>
  );
};

export const ReadOnlyColumnsNode = Node.create({
  name: 'columns',

  group: 'block',

  content: 'block+',

  draggable: false,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (element) => element.getAttribute('data-columns') || 2,
        renderHTML: (attributes) => {
          return {
            'data-columns': attributes.columns,
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
    return ReactNodeViewRenderer(ReadOnlyColumnsComponent);
  },
});

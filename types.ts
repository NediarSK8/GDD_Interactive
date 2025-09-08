import React from 'react';

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface ListBlock {
  type: 'list';
  style: 'unordered' | 'ordered';
  items: string[];
}

export interface ImageBlock {
  type: 'image';
  id: string;
  src: string; // base64 data URI
  caption: string;
}

export interface BlockquoteBlock {
    type: 'blockquote';
    text: string;
}

export interface DefinitionListBlock {
    type: 'definition_list';
    items: {
        term: string;
        description: string;
    }[];
}

export type ContentBlock = HeadingBlock | ParagraphBlock | ListBlock | ImageBlock | BlockquoteBlock | DefinitionListBlock;

export interface Document {
  id: string;
  title: string;
  category: string;
  content: ContentBlock[];
  lastEdited: string;
}

export interface GeminiUpdatePayload {
    newDocuments: Document[];
    updatedDocuments: Document[];
    deletedDocumentIds: string[];
    summary: string;
    thinkingProcess: string[];
}

export type ViewMode = 'gdd' | 'script';

export interface SearchResult {
  docId: string;
  docTitle: string;
  category: string;
  viewMode: ViewMode;
  snippets: React.ReactNode[];
}

export interface Version {
  id: string;
  timestamp: string;
  name?: string; // Only for manual versions
}

export interface CloudVersions {
    manual: Version[];
    automatic: Version[];
}

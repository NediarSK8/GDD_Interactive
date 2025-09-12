import React, { useState } from 'react';
import { Document, ContentBlock, HeadingBlock, SearchResult, ViewMode } from '../types';

interface SidebarProps {
  width: number;
  title: string;
  documents: Document[];
  categories: string[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onUpdateCategoryName: (oldCategory: string, newCategory: string) => void;
  onUpdateDocumentTitle: (docId: string, newTitle: string) => void;
  onReorderDocuments: (draggedId: string, targetId: string) => void;
  onReorderCategories: (draggedCategory: string, targetCategory: string) => void;
  onFindReferences: (docId: string) => void;
  totalWordCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: SearchResult[];
  onSelectSearchResult: (docId: string, viewMode: ViewMode) => void;
}

const slugify = (text: string) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/[\s_-]+/g, '-') // collapse whitespace and underscores
    .replace(/^-+|-+$/g, ''); // remove leading/trailing dashes
};

const formatTimestamp = (isoString: string): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);

        if (diffSeconds < 2) return `agora`;
        if (diffSeconds < 60) return `${diffSeconds}s atrás`;
        
        const diffMinutes = Math.round(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes}m atrás`;

        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h atrás`;
        
        const diffDays = Math.round(diffHours / 24);
        if (diffDays <= 7) return `${diffDays}d atrás`;
        
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
        }).format(date);
    } catch (e) {
        return '';
    }
};

const EditIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
    </svg>
);

const LinkIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
);

const ChevronIcon: React.FC<{ isCollapsed: boolean }> = ({ isCollapsed }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const SearchIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const ClearIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
    width, title, documents, categories, activeDocumentId, 
    onSelectDocument, onUpdateCategoryName, onUpdateDocumentTitle, 
    onReorderDocuments, onReorderCategories, onFindReferences, 
    totalWordCount, searchQuery, onSearchChange, searchResults, onSelectSearchResult
}) => {
  const [editing, setEditing] = useState<{ type: 'category'; id: string } | { type: 'document'; id: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isHeadingsCollapsed, setIsHeadingsCollapsed] = useState<boolean>(false);
  const [draggedItem, setDraggedItem] = useState<{ type: 'doc' | 'category'; id: string } | null>(null);

  const toggleCategory = (categoryName: string) => {
    setCollapsedCategories(prev => ({
        ...prev,
        [categoryName]: !prev[categoryName],
    }));
  };
  
  const handleDocumentClick = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    const hasHeadings = doc?.content.some(block => block.type === 'heading');

    if (activeDocumentId === docId) {
      if (hasHeadings) {
        setIsHeadingsCollapsed(prev => !prev);
      }
    } else {
      onSelectDocument(docId);
      setIsHeadingsCollapsed(false); // Always expand when selecting a new document
    }
  };

  const handleStartEditing = (type: 'category' | 'document', id: string, currentValue: string) => {
    setEditing({ type, id });
    setEditValue(currentValue);
  };

  const handleCancelEditing = () => {
    setEditing(null);
    setEditValue('');
  };

  const handleSaveEditing = () => {
    if (!editing || !editValue.trim()) {
        handleCancelEditing();
        return;
    };

    if (editing.type === 'category') {
        onUpdateCategoryName(editing.id, editValue);
    } else if (editing.type === 'document') {
        onUpdateDocumentTitle(editing.id, editValue);
    }
    handleCancelEditing();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleSaveEditing();
    } else if (e.key === 'Escape') {
        handleCancelEditing();
    }
  };

  // Drag and Drop Handlers
  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // --- Document D&D ---
  const handleDocDragStart = (e: React.DragEvent<HTMLLIElement>, docId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'doc', id: docId }));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggedItem({ type: 'doc', id: docId }), 0);
  };

  const handleDocDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (draggedItem?.type === 'doc') {
      e.currentTarget.classList.add('bg-gray-700/50');
    }
  };
  
  const handleDocDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    e.currentTarget.classList.remove('bg-gray-700/50');
  };

  const handleDocDrop = (e: React.DragEvent<HTMLLIElement>, targetDocId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-gray-700/50');
    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'doc' && data.id && data.id !== targetDocId) {
            onReorderDocuments(data.id, targetDocId);
        }
    } catch (err) { console.error(err); }
    setDraggedItem(null);
  };

  // --- Category D&D ---
  const handleCategoryDragStart = (e: React.DragEvent<HTMLDivElement>, category: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'category', name: category }));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggedItem({ type: 'category', id: category }), 0);
  };

  const handleCategoryDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedItem?.type === 'category') {
        e.currentTarget.classList.add('bg-gray-700/50');
    }
  };

  const handleCategoryDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-gray-700/50');
  };

  const handleCategoryDrop = (e: React.DragEvent<HTMLDivElement>, targetCategory: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent drop from bubbling to parent elements
    e.currentTarget.classList.remove('bg-gray-700/50');
    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'category' && data.name && data.name !== targetCategory) {
            onReorderCategories(data.name, targetCategory);
        }
    } catch (err) { console.error(err); }
    setDraggedItem(null);
  };


  return (
    <aside 
      style={{ width: `${width}px` }}
      className="bg-gray-800 text-white flex flex-col h-full border-r border-gray-700 flex-shrink-0 transition-all duration-300 overflow-hidden"
    >
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold mb-3">{title}</h2>
        <div className="relative text-gray-400 focus-within:text-gray-100">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon />
            </span>
            <input
                type="text"
                placeholder="Pesquisar documentos..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
                <button 
                    onClick={() => onSearchChange('')} 
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                    aria-label="Clear search"
                >
                    <ClearIcon />
                </button>
            )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-4">
        {searchQuery ? (
          <div>
            {searchResults.length > 0 ? (
                <ul className="space-y-2">
                    {searchResults.map(result => (
                        <li key={result.docId}>
                            <button onClick={() => onSelectSearchResult(result.docId, result.viewMode)} className="w-full text-left p-3 bg-gray-900/50 rounded-lg hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <div className="font-semibold text-indigo-400">{result.docTitle}</div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{result.category} ({result.viewMode.toUpperCase()})</div>
                                <div className="space-y-1 text-sm text-gray-400 italic">
                                    {result.snippets.slice(0, 3).map((snippet, i) => (
                                        <div key={i} className="truncate text-ellipsis">
                                            {snippet}
                                        </div>
                                    ))}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center text-gray-500 p-4">Nenhum resultado encontrado.</div>
            )}
          </div>
        ) : (
          categories.map(category => {
            const categoryDocuments = documents.filter(doc => doc.category === category);
            if (categoryDocuments.length === 0) return null;

            const isEditingCategory = editing?.type === 'category' && editing.id === category;
            const isCollapsed = !!collapsedCategories[category];
            const isBeingDragged = draggedItem?.type === 'category' && draggedItem.id === category;

            return (
              <div key={category} className={`transition-opacity ${isBeingDragged ? 'opacity-30' : ''}`}>
                <div 
                  className="group flex items-center justify-between mb-2 rounded-md"
                  draggable={!isEditingCategory}
                  onDragStart={!isEditingCategory ? (e) => handleCategoryDragStart(e, category) : undefined}
                  onDragEnd={!isEditingCategory ? handleDragEnd : undefined}
                  onDragOver={!isEditingCategory ? handleCategoryDragOver : undefined}
                  onDragLeave={!isEditingCategory ? handleCategoryDragLeave : undefined}
                  onDrop={!isEditingCategory ? (e) => handleCategoryDrop(e, category) : undefined}
                  style={{ cursor: !isEditingCategory ? 'grab' : 'default' }}
                >
                  {isEditingCategory ? (
                      <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSaveEditing}
                          onKeyDown={handleInputKeyDown}
                          autoFocus
                          className="w-full bg-gray-900 text-sm font-bold text-indigo-300 uppercase tracking-wider p-1 rounded border border-indigo-500 outline-none"
                      />
                  ) : (
                      <>
                          <button 
                              onClick={() => toggleCategory(category)}
                              className="flex items-center flex-grow text-left text-sm font-bold text-indigo-400 uppercase tracking-wider p-1 -ml-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 group"
                              aria-expanded={!isCollapsed}
                              aria-controls={`category-section-${slugify(category)}`}
                          >
                              <ChevronIcon isCollapsed={isCollapsed} />
                              <span className="ml-1 group-hover:text-indigo-300 transition-colors">{category}</span>
                          </button>
                          <button 
                              onClick={() => handleStartEditing('category', category, category)}
                              className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1 ml-2 flex-shrink-0"
                              aria-label={`Edit category ${category}`}
                          >
                              <EditIcon />
                          </button>
                      </>
                  )}
                </div>
                {!isCollapsed && (
                  <ul id={`category-section-${slugify(category)}`} className="space-y-1 pl-4 border-l border-gray-600 ml-1.5">
                      {categoryDocuments.map(doc => {
                          const isEditingDoc = editing?.type === 'document' && editing.id === doc.id;
                          const isActive = activeDocumentId === doc.id;
                          const hasHeadings = doc.content.some(block => block.type === 'heading');
                          const isBeingDragged = draggedItem?.type === 'doc' && draggedItem.id === doc.id;

                          return (
                              <li 
                                  key={doc.id}
                                  draggable={!isEditingDoc}
                                  onDragStart={!isEditingDoc ? (e) => handleDocDragStart(e, doc.id) : undefined}
                                  onDragEnd={!isEditingDoc ? handleDragEnd : undefined}
                                  onDragOver={!isEditingDoc ? handleDocDragOver : undefined}
                                  onDragLeave={!isEditingDoc ? handleDocDragLeave : undefined}
                                  onDrop={!isEditingDoc ? (e) => handleDocDrop(e, doc.id) : undefined}
                                  className={`rounded-md transition-opacity ${isBeingDragged ? 'opacity-30' : ''}`}
                              >
                                  <div className={`group flex items-center justify-between w-full pr-1 transition-colors duration-200 rounded-md ${
                                      isActive ? 'bg-indigo-600' : 'hover:bg-gray-700'
                                  }`}>
                                      {isEditingDoc ? (
                                          <input
                                              type="text"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              onBlur={handleSaveEditing}
                                              onKeyDown={handleInputKeyDown}
                                              autoFocus
                                              className="w-full bg-gray-900 text-sm px-3 py-2 rounded-md border border-indigo-500 outline-none"
                                          />
                                      ) : (
                                          <>
                                              <button
                                                  onClick={() => handleDocumentClick(doc.id)}
                                                  className={`flex items-start flex-grow text-left px-3 py-2 text-sm w-full rounded-l-md ${
                                                      isActive
                                                      ? 'font-semibold'
                                                      : 'text-gray-300 group-hover:text-white'
                                                  }`}
                                                  style={{ cursor: 'grab' }}
                                                  aria-expanded={isActive && hasHeadings ? !isHeadingsCollapsed : undefined}
                                                  aria-controls={isActive && hasHeadings ? `doc-headings-${doc.id}` : undefined}
                                              >
                                                  <span className="w-4 mr-1 flex-shrink-0 mt-1">
                                                      {isActive && hasHeadings && <ChevronIcon isCollapsed={isHeadingsCollapsed} />}
                                                  </span>
                                                  <div className="flex-grow">
                                                      <span className="block truncate" title={doc.title}>{doc.title}</span>
                                                      {isActive && doc.lastEdited && (
                                                          <div className="text-xs font-normal text-indigo-200/80 -mt-0.5">
                                                              {formatTimestamp(doc.lastEdited)}
                                                          </div>
                                                      )}
                                                  </div>
                                              </button>
                                              <div className="flex items-center flex-shrink-0">
                                                  <button
                                                      onClick={() => onFindReferences(doc.id)}
                                                      className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                      aria-label={`Find references for ${doc.title}`}
                                                      title={`Encontrar referências para ${doc.title}`}
                                                  >
                                                      <LinkIcon />
                                                  </button>
                                                  <button 
                                                      onClick={() => handleStartEditing('document', doc.id, doc.title)}
                                                      className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                      aria-label={`Edit title for ${doc.title}`}
                                                  >
                                                      <EditIcon />
                                                  </button>
                                              </div>
                                          </>
                                      )}
                                  </div>
                                  {isActive && hasHeadings && !isHeadingsCollapsed && (
                                  <ul id={`doc-headings-${doc.id}`} className="pl-4 mt-1 space-y-1 border-l border-gray-600 ml-3">
                                      {doc.content
                                      .filter((block): block is HeadingBlock => block.type === 'heading')
                                      .map((headingBlock, index) => {
                                          const slug = slugify(headingBlock.text);
                                          const getIndentClass = (level: 1 | 2 | 3 | undefined) => {
                                              switch (level) {
                                                  case 1: return 'pl-3';
                                                  case 2: return 'pl-6';
                                                  case 3: return 'pl-9';
                                                  default: return 'pl-3';
                                              }
                                          };
                                          return (
                                              <li key={`${doc.id}-heading-${index}`}>
                                              <a
                                                  href={`#${slug}`}
                                                  onClick={(e) => {
                                                  e.preventDefault();
                                                  const element = document.getElementById(slug);
                                                  if (element) {
                                                      element.scrollIntoView({ behavior: 'smooth' });
                                                  }
                                                  }}
                                                  className={`block w-full text-left py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-white rounded-md transition-colors ${getIndentClass(headingBlock.level)}`}
                                              >
                                                  {headingBlock.text}
                                              </a>
                                              </li>
                                          );
                                      })}
                                  </ul>
                                  )}
                              </li>
                          )
                      })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </nav>
      <footer className="p-4 border-t border-gray-700 text-xs text-gray-400">
          <div className="font-semibold uppercase tracking-wider mb-2">Estatísticas ({title.split(' ')[0]})</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>Documentos:</div>
              <div className="font-bold text-white text-right">{documents.length}</div>
              <div>Categorias:</div>
              <div className="font-bold text-white text-right">{categories.length}</div>
              <div>Palavras:</div>
              <div className="font-bold text-white text-right">{totalWordCount.toLocaleString('pt-BR')}</div>
              <div className="text-gray-500">Tokens (est.):</div>
              <div className="font-bold text-gray-500 text-right">~{(totalWordCount / 0.75).toLocaleString('pt-BR')}</div>
          </div>
      </footer>
    </aside>
  );
};
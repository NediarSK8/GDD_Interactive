import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, ContentBlock, ImageBlock, HeadingBlock, ListBlock, DefinitionListBlock } from '../types';
import { HeadingLevelIcon, ParagraphIcon, ListIcon, ImageIcon, BlockquoteIcon, AiImageIcon, ChevronUpIcon, ChevronDownIcon } from '../assets/icons';

interface PopupState {
    top: number;
    left: number;
    docId: string;
    blockIndex: number;
    itemIndex?: number;
    text: string;
}

interface HeadingLevelPopupState {
    top: number;
    left: number;
    blockIndex: number;
    currentLevel: HeadingBlock['level'];
}

interface AddBlockMenuState {
    index: number;
    top: number;
    left: number;
}

interface ContentViewProps {
  document: Document | null;
  allDocuments: Document[];
  onNavigate: (documentId: string, headingSlug?: string) => void;
  onRefineRequest: (docId: string, blockIndex: number, text: string, itemIndex?: number) => void;
  onFindReferences: (docId: string) => void;
  onUpdateBlock: (docId: string, blockIndex: number, newText: string, itemIndex?: number) => void;
  onUpdateBlockContent: (docId: string, blockIndex: number, partialBlock: Partial<ContentBlock>) => void;
  onSetContent: (docId: string, content: ContentBlock[]) => void;
  scrollToHeading: string | null;
  onDidScrollToHeading: () => void;
  onOpenImageGenerationModal: (docId: string, index: number) => void;
  docSearchQuery: string;
  docSearchCurrentIndex: number;
  onDocSearchResultsChange: (count: number) => void;
}

interface SearchMatch {
    blockIndex: number;
    itemIndex?: number | string;
    start: number;
    end: number;
    ref: React.RefObject<HTMLElement>;
}

const WelcomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-300">Welcome to your GDD</h2>
        <p className="mt-2 max-w-md">Select a document from the sidebar to view its content, or use the "Integrate New Idea" button to add new concepts with the help of AI.</p>
    </div>
);

const slugify = (text: string) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/[\s_-]+/g, '-') // collapse whitespace and underscores
    .replace(/^-+|-+$/g, ''); // remove leading/trailing dashes
};

const EditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        className="p-1.5 bg-gray-700/60 rounded-md text-gray-300 hover:bg-indigo-600 hover:text-white transition-all"
        title="Editar texto"
    >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
        </svg>
    </button>
);

const HeadingLevelButton: React.FC<{ onClick: (e: React.MouseEvent) => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        className="heading-level-button p-1.5 bg-gray-700/60 rounded-md text-gray-300 hover:bg-indigo-600 hover:text-white transition-all"
        title="Alterar nível do título"
    >
        <HeadingLevelIcon />
    </button>
);

const DeleteButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        className="p-1.5 bg-gray-700/60 rounded-md text-gray-300 hover:bg-red-600 hover:text-white transition-all"
        title="Apagar bloco"
    >
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
         <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
    </button>
);

const AddBlockButton: React.FC<{ onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }> = ({ onClick }) => (
    <div className="absolute inset-x-0 -top-4 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
            onClick={onClick}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md"
            title="Adicionar bloco"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
        </button>
    </div>
);

const LinkIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
);


export const ContentView: React.FC<ContentViewProps> = ({ document, allDocuments, onNavigate, onRefineRequest, onFindReferences, onUpdateBlock, onUpdateBlockContent, onSetContent, scrollToHeading, onDidScrollToHeading, onOpenImageGenerationModal, docSearchQuery, docSearchCurrentIndex, onDocSearchResultsChange }) => {
  const [popupState, setPopupState] = useState<PopupState | null>(null);
  const [headingLevelPopupState, setHeadingLevelPopupState] = useState<HeadingLevelPopupState | null>(null);
  const [editingBlock, setEditingBlock] = useState<{ blockIndex: number; itemIndex?: number } | null>(null);
  const [editText, setEditText] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addBlockMenuState, setAddBlockMenuState] = useState<AddBlockMenuState | null>(null);
  const [imageInsertionIndex, setImageInsertionIndex] = useState(0);
  const [imagePreview, setImagePreview] = useState<{ src: string; top: number; left: number } | null>(null);

  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);

  const normalizeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  useEffect(() => {
      if (!docSearchQuery.trim() || !document) {
          setSearchResults([]);
          onDocSearchResultsChange(0);
          return;
      }

      const normalizedQuery = normalizeText(docSearchQuery);
      if (!normalizedQuery) return;

      const results: SearchMatch[] = [];

      const findMatchesInText = (text: string, itemIndex?: number | string) => {
          if (!text) return;
          const normalizedText = normalizeText(text);
          let startIndex = 0;
          while ((startIndex = normalizedText.indexOf(normalizedQuery, startIndex)) !== -1) {
              results.push({
                  blockIndex: results.length, // Placeholder, will be replaced by actual block index
                  itemIndex,
                  start: startIndex,
                  end: startIndex + docSearchQuery.length,
                  ref: React.createRef()
              });
              startIndex += 1;
          }
      };

      document.content.forEach((block, blockIndex) => {
          const currentResultsCount = results.length;
          
          if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'blockquote') {
              findMatchesInText(block.text);
          } else if (block.type === 'list' && Array.isArray(block.items) && typeof block.items[0] === 'string') {
              (block.items as string[]).forEach((item, itemIndex) => findMatchesInText(item, itemIndex));
          } else if (block.type === 'definition_list' && Array.isArray(block.items)) {
              block.items.forEach((item, itemIndex) => {
                  findMatchesInText(item.term, `dl-${itemIndex}-term`);
                  findMatchesInText(item.description, `dl-${itemIndex}-desc`);
              });
          } else if (block.type === 'image') {
              findMatchesInText(block.caption);
          }

          // Assign correct blockIndex to newly found results
          for (let i = currentResultsCount; i < results.length; i++) {
              results[i].blockIndex = blockIndex;
          }
      });

      setSearchResults(results);
      onDocSearchResultsChange(results.length);
  }, [docSearchQuery, document, onDocSearchResultsChange]);

  useEffect(() => {
    if (docSearchCurrentIndex !== -1 && searchResults[docSearchCurrentIndex]) {
        searchResults[docSearchCurrentIndex].ref.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }
  }, [docSearchCurrentIndex, searchResults]);

  useEffect(() => {
    if (scrollToHeading && document) {
        const element = window.document.getElementById(scrollToHeading);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            element.classList.add('highlight-scroll');
            setTimeout(() => {
                element.classList.remove('highlight-scroll');
            }, 2000); // Highlight for 2 seconds
        }
        onDidScrollToHeading(); // Clear the state so it doesn't scroll again
    }
  }, [scrollToHeading, document, onDidScrollToHeading]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        if (popupState && event.target instanceof Element && !event.target.closest('.refine-popup')) {
            setPopupState(null);
        }
        if (headingLevelPopupState && event.target instanceof Element && !event.target.closest('.heading-level-popup, .heading-level-button')) {
            setHeadingLevelPopupState(null);
        }
         if (addBlockMenuState && event.target instanceof Element && !event.target.closest('.add-block-menu')) {
            setAddBlockMenuState(null);
        }
    };
    window.document.addEventListener('mousedown', handleOutsideClick);
    return () => {
        window.document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [popupState, headingLevelPopupState, addBlockMenuState]);
  
  const handleMouseUp = () => {
    if (!document || editingBlock) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let targetElement = range.startContainer.parentElement;

        if (!contentRef.current?.contains(targetElement)) {
            setPopupState(null);
            return;
        }
        
        const blockElement = targetElement?.closest('[data-block-index]');
        if (!blockElement) {
            setPopupState(null);
            return;
        }

        const blockIndexStr = blockElement.getAttribute('data-block-index');
        if (!blockIndexStr) return;
        
        const blockIndex = parseInt(blockIndexStr, 10);
        const block = document.content[blockIndex];

        let itemIndex: number | undefined = undefined;
        let textContent = '';

        if (block.type === 'list' && 'items' in block && Array.isArray(block.items) && typeof block.items[0] === 'string') {
            const listItemElement = targetElement?.closest('[data-item-index]');
            if (listItemElement) {
                const itemIndexStr = listItemElement.getAttribute('data-item-index');
                if (itemIndexStr) {
                    itemIndex = parseInt(itemIndexStr, 10);
                    textContent = (block.items as string[])[itemIndex];
                }
            } else { setPopupState(null); return; }
        } else if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'blockquote'){
            textContent = block.text;
        } else if (block.type === 'image') {
             textContent = block.caption;
        } else { setPopupState(null); return; }

        if(!textContent) { setPopupState(null); return; }
        
        const rect = range.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();
        
        setPopupState({
            top: rect.top - contentRect.top - 40,
            left: rect.left - contentRect.left + (rect.width / 2) - 16,
            docId: document.id,
            blockIndex: blockIndex,
            itemIndex: itemIndex,
            text: textContent,
        });

    } else {
        if(popupState) {
            setTimeout(() => setPopupState(null), 100);
        }
    }
  };

  const handleStartEditing = (blockIndex: number, currentText: string, itemIndex?: number) => {
    setPopupState(null);
    setEditingBlock({ blockIndex, itemIndex });
    setEditText(currentText);
  };

  const handleCancelEditing = () => {
    setEditingBlock(null);
    setEditText('');
  };

  const handleSaveEditing = () => {
    if (!document || editingBlock === null) return;
    onUpdateBlock(document.id, editingBlock.blockIndex, editText, editingBlock.itemIndex);
    handleCancelEditing();
  };

  const handleDeleteBlock = (index: number) => {
    if (!document) return;
    const newContent = document.content.filter((_, i) => i !== index);
    onSetContent(document.id, newContent);
  };

  const handleOpenAddBlockMenu = (event: React.MouseEvent<HTMLButtonElement>, index: number) => {
        event.preventDefault();
        const buttonRect = event.currentTarget.getBoundingClientRect();
        const contentRect = contentRef.current!.getBoundingClientRect();
        setAddBlockMenuState({
            index: index,
            top: buttonRect.top - contentRect.top - 45, // Position menu above the button
            left: buttonRect.left - contentRect.left + buttonRect.width / 2,
        });
    };
    
    const handleAddBlock = (type: ContentBlock['type'] | 'generate-image-ai', index: number) => {
        if (!document) return;

        if (type === 'image') {
            setImageInsertionIndex(index);
            fileInputRef.current?.click();
            setAddBlockMenuState(null);
            return;
        }

        if (type === 'generate-image-ai') {
            onOpenImageGenerationModal(document.id, index);
            setAddBlockMenuState(null);
            return;
        }

        let newBlock: ContentBlock | null = null;
        let textToEdit: string | undefined = undefined;
        let itemIndexToEdit: number | undefined = undefined;

        switch (type) {
            case 'heading':
                newBlock = { type: 'heading', level: 2, text: 'Novo Título' };
                textToEdit = newBlock.text;
                break;
            case 'paragraph':
                newBlock = { type: 'paragraph', text: 'Novo parágrafo.' };
                textToEdit = newBlock.text;
                break;
            case 'list':
                newBlock = { type: 'list', style: 'unordered', items: ['Item 1', 'Item 2'] };
                textToEdit = newBlock.items[0];
                itemIndexToEdit = 0;
                break;
            case 'blockquote':
                newBlock = { type: 'blockquote', text: 'Citação.' };
                textToEdit = newBlock.text;
                break;
        }

        if (newBlock) {
            const newContent = [...document.content];
            newContent.splice(index, 0, newBlock);
            onSetContent(document.id, newContent);
            
            if (textToEdit !== undefined) {
                 setTimeout(() => handleStartEditing(index, textToEdit, itemIndexToEdit), 50);
            }
        }
        setAddBlockMenuState(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !document) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
          const src = e.target?.result as string;
          if (src) {
              const newImageBlock: ImageBlock = {
                  type: 'image',
                  id: `img-${Date.now()}`,
                  src,
                  caption: 'Insira uma legenda para a imagem.'
              };
              const newContent = [...document.content];
              newContent.splice(imageInsertionIndex, 0, newImageBlock);
              onSetContent(document.id, newContent);
              setTimeout(() => handleStartEditing(imageInsertionIndex, newImageBlock.caption), 50);
          }
      };
      reader.readAsDataURL(file);
      
      if (event.target) event.target.value = '';
  };
  
  const handleOpenHeadingLevelPopup = (event: React.MouseEvent, blockIndex: number, currentLevel: HeadingBlock['level']) => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const contentRect = contentRef.current!.getBoundingClientRect();
        setHeadingLevelPopupState({
            top: rect.bottom - contentRect.top + 4,
            left: rect.left - contentRect.left,
            blockIndex,
            currentLevel,
        });
    };

    const { docTitleMap, headingMap } = useMemo(() => {
        const docTitleMap = new Map<string, string>();
        const headingMap = new Map<string, { docId: string, slug: string }>();

        allDocuments.forEach(doc => {
            docTitleMap.set(doc.title.toLowerCase(), doc.id);
            doc.content.forEach(block => {
                if (block.type === 'heading' && block.text) {
                    if (!headingMap.has(block.text.toLowerCase())) {
                        headingMap.set(block.text.toLowerCase(), {
                            docId: doc.id,
                            slug: slugify(block.text),
                        });
                    }
                }
            });
        });

        return { docTitleMap, headingMap };
    }, [allDocuments]);

     const renderContentText = (text: string | undefined, blockIndex: number, itemIndex?: number | string): React.ReactNode[] => {
        if (!text) return [];

        type Marker = { start: number; end: number; type: 'link' | 'highlight' | 'active-highlight'; data: string; ref?: React.RefObject<HTMLElement>; };
        const markers: Marker[] = [];

        // 1. Find links
        const linkRegex = /\[\[(.*?)\]\]/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(text)) !== null) {
            markers.push({ start: linkMatch.index, end: linkMatch.index + linkMatch[0].length, type: 'link', data: linkMatch[0] });
        }
        
        // 2. Find search results for this specific text block
        const relevantResults = searchResults.filter(r => r.blockIndex === blockIndex && r.itemIndex === itemIndex);
        relevantResults.forEach(result => {
            const globalIndex = searchResults.findIndex(sr => sr === result);
            markers.push({ 
                start: result.start, 
                end: result.end, 
                type: globalIndex === docSearchCurrentIndex ? 'active-highlight' : 'highlight',
                data: text.substring(result.start, result.end),
                ref: result.ref
            });
        });
        
        // Filter out search highlights that are inside links.
        const filteredMarkers = markers.filter((marker, i, arr) => {
            if (marker.type.includes('highlight')) {
                return !arr.some(other => other.type === 'link' && marker.start >= other.start && marker.end <= other.end);
            }
            return true;
        });

        if (filteredMarkers.length === 0) return [text];

        filteredMarkers.sort((a, b) => a.start - b.start);

        const nodes: React.ReactNode[] = [];
        let lastIndex = 0;

        filteredMarkers.forEach((marker, i) => {
            if (marker.start > lastIndex) {
                nodes.push(text.substring(lastIndex, marker.start));
            }

            const content = marker.data;
            if (marker.type === 'link') {
                const fullContent = content.slice(2, -2);
                let linkTarget = fullContent;
                let displayText = fullContent;
                let hasCustomDisplay = false;
                if (fullContent.includes('|')) {
                    const splitContent = fullContent.split('|');
                    linkTarget = splitContent[0];
                    displayText = splitContent.slice(1).join('|');
                    hasCustomDisplay = true;
                }
                
                if (linkTarget.startsWith('img:')) {
                    const imgId = linkTarget.substring(4);
                    const imageBlock = document?.content.find(b => b.type === 'image' && b.id === imgId) as ImageBlock | undefined;
                    if (imageBlock) {
                        nodes.push(
                            <span key={`${i}-imglink`} onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setImagePreview({ src: imageBlock.src, top: rect.bottom + 5, left: rect.left }); }} onMouseLeave={() => setImagePreview(null)} className="text-green-400 font-semibold hover:underline bg-green-900/30 px-1 py-0.5 rounded-sm transition-colors cursor-pointer" >
                                {hasCustomDisplay ? displayText : `img:${imgId.slice(-4)}`}
                            </span>
                        );
                    } else {
                        nodes.push(<span key={`${i}-imglink`} className="text-red-400 line-through px-1" title={`Imagem não encontrada: "${imgId}"`}>{hasCustomDisplay ? displayText : imgId}</span>);
                    }
                } else {
                    let docTitle = linkTarget;
                    let headingText: string | undefined = undefined;

                    if (linkTarget.includes('#')) {
                        [docTitle, headingText] = linkTarget.split('#', 2);
                    }

                    const docId = docTitleMap.get(docTitle.toLowerCase());
                    if (docId) {
                        const slug = headingText ? slugify(headingText) : undefined;
                        nodes.push(<button key={`${i}-link`} onClick={() => onNavigate(docId, slug)} className="text-indigo-400 font-semibold hover:underline bg-indigo-900/30 px-1 py-0.5 rounded-sm transition-colors">{displayText}</button>);
                    } else if (!headingText && headingMap.has(docTitle.toLowerCase())) {
                        const headingMatch = headingMap.get(docTitle.toLowerCase())!;
                        nodes.push(<button key={`${i}-link`} onClick={() => onNavigate(headingMatch.docId, headingMatch.slug)} className="text-indigo-400 font-semibold hover:underline bg-indigo-900/30 px-1 py-0.5 rounded-sm transition-colors">{displayText}</button>);
                    } else {
                        nodes.push(<span key={`${i}-link`} className="text-red-400 line-through px-1" title={`Link não encontrado: "${linkTarget}"`}>{displayText}</span>);
                    }
                }
            } else { // highlight or active-highlight
                 nodes.push(
                    <mark key={`${i}-highlight`} ref={marker.ref} className={marker.type === 'active-highlight' ? 'search-highlight-active' : 'highlight'}>
                        {content}
                    </mark>
                );
            }
            lastIndex = marker.end;
        });

        if (lastIndex < text.length) {
            nodes.push(text.substring(lastIndex));
        }
        return nodes;
    };
  
  if (!document) {
    return <WelcomeScreen />;
  }
  
  const EditControls: React.FC = () => (
    <div className="flex justify-end space-x-2 mt-2">
        <button onClick={handleCancelEditing} className="px-3 py-1 text-sm rounded bg-gray-600 hover:bg-gray-500">Cancelar</button>
        <button onClick={handleSaveEditing} className="px-3 py-1 text-sm rounded bg-indigo-600 hover:bg-indigo-500">Salvar</button>
    </div>
  );

  const getHeadingTextareaClass = (level: HeadingBlock['level'] | undefined) => {
    switch (level) {
        case 1: return "text-2xl font-bold text-indigo-400";
        case 2: return "text-xl font-semibold text-gray-200";
        case 3: return "text-lg font-medium text-gray-300";
        default: return "text-2xl font-bold text-indigo-400";
    }
  };

  const AddBlockMenu: React.FC<{
        state: AddBlockMenuState;
        onAddBlock: (type: ContentBlock['type'] | 'generate-image-ai', index: number) => void;
    }> = ({ state, onAddBlock }) => {
        const menuRef = useRef<HTMLDivElement>(null);
        
        const menuItems = [
            { type: 'heading' as const, title: 'Título', icon: <HeadingLevelIcon /> },
            { type: 'paragraph' as const, title: 'Parágrafo', icon: <ParagraphIcon /> },
            { type: 'list' as const, title: 'Lista', icon: <ListIcon /> },
            { type: 'blockquote' as const, title: 'Citação', icon: <BlockquoteIcon /> },
            { type: 'image' as const, title: 'Imagem', icon: <ImageIcon /> },
            { type: 'generate-image-ai' as const, title: 'Gerar Imagem com IA', icon: <AiImageIcon /> },
        ];

        return (
            <div
                ref={menuRef}
                className="add-block-menu absolute z-20 flex items-center space-x-1 bg-gray-900 border border-gray-700 p-1 rounded-lg shadow-lg"
                style={{ top: `${state.top}px`, left: `${state.left}px`, transform: 'translateX(-50%)' }}
            >
                {menuItems.map(item => (
                    <button
                        key={item.type}
                        title={item.title}
                        onClick={() => onAddBlock(item.type, state.index)}
                        className="p-2 text-gray-400 hover:bg-gray-700 hover:text-white rounded-md transition-colors"
                    >
                        {item.icon}
                    </button>
                ))}
            </div>
        );
    };

  return (
    <div className="p-8 lg:p-12 prose prose-invert prose-lg max-w-4xl mx-auto relative" ref={contentRef} onMouseUp={handleMouseUp}>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        {imagePreview && (
          <div className="fixed z-50 p-1 bg-gray-900 border border-gray-600 rounded-md shadow-lg" style={{ top: imagePreview.top, left: imagePreview.left, pointerEvents: 'none' }}>
            <img src={imagePreview.src} alt="Preview" className="max-w-xs max-h-48 rounded-sm" />
          </div>
        )}
        {popupState && (
            <button
                className="refine-popup absolute z-20 bg-yellow-400 text-gray-900 rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-yellow-300 transition-all scale-100 hover:scale-110"
                style={{ top: `${popupState.top}px`, left: `${popupState.left}px` }}
                onClick={() => {
                    onRefineRequest(popupState.docId, popupState.blockIndex, popupState.text, popupState.itemIndex);
                    setPopupState(null);
                }}
                title="Aprimorar texto com IA"
            >
                ✨
            </button>
        )}
        {addBlockMenuState && (
            <AddBlockMenu state={addBlockMenuState} onAddBlock={handleAddBlock} />
        )}
        {headingLevelPopupState && (
            <div className="heading-level-popup absolute z-30 bg-gray-700 rounded-md shadow-lg p-1 flex flex-col" style={{ top: `${headingLevelPopupState.top}px`, left: `${headingLevelPopupState.left}px` }}>
                {( [1, 2, 3] as const).map(level => (
                    <button
                        key={level}
                        onClick={() => {
                            onUpdateBlockContent(document.id, headingLevelPopupState.blockIndex, { level });
                            setHeadingLevelPopupState(null);
                        }}
                        className={`text-left text-sm px-3 py-1 rounded-sm transition-colors ${headingLevelPopupState.currentLevel === level ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600 text-gray-200'}`}
                    >
                        Título {level}
                    </button>
                ))}
            </div>
        )}
      <div className="mb-8 pb-4 border-b border-gray-700">
         <div className="flex justify-between items-center">
            <p className="text-indigo-400 font-semibold">{document.category}</p>
            <button
                onClick={() => onFindReferences(document.id)}
                className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-md px-2 py-1 transition-colors"
                title="Encontrar menções a este documento"
            >
                <LinkIcon />
                <span>Encontrar Referências</span>
            </button>
        </div>
        <h1 className="text-4xl font-extrabold text-white !mb-0">{document.title}</h1>
      </div>
      <div className="text-gray-300 leading-relaxed">
        {Array.isArray(document.content) && document.content.map((block: ContentBlock, index) => {
            if (!block) {
                return null;
            }
            
            const blockContent = () => {
                switch (block.type) {
                    case 'heading': {
                        const isEditing = editingBlock?.blockIndex === index && editingBlock.itemIndex === undefined;
                        const slug = slugify(block.text);
                        return isEditing ? (
                            <div className="mt-4 mb-2">
                                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className={`w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 ${getHeadingTextareaClass(block.level)}`} rows={1} autoFocus />
                                <EditControls />
                            </div>
                        ) : (
                            <div className="group relative">
                                {!editingBlock && <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1"><HeadingLevelButton onClick={(e) => handleOpenHeadingLevelPopup(e, index, block.level)} /><EditButton onClick={() => handleStartEditing(index, block.text)} /><DeleteButton onClick={() => handleDeleteBlock(index)}/></div>}
                                {(() => {
                                    const commonProps = { id: slug, 'data-block-index': index, className: 'scroll-mt-24' };
                                    const children = renderContentText(block.text, index);
                                    switch (block.level) {
                                        case 1: return <h2 {...commonProps} className={`${commonProps.className} text-indigo-400 border-b border-gray-700 pb-2 text-2xl font-bold`}>{children}</h2>;
                                        case 2: return <h3 {...commonProps} className={`${commonProps.className} text-xl font-semibold text-gray-200 mt-8 mb-2`}>{children}</h3>;
                                        case 3: return <h4 {...commonProps} className={`${commonProps.className} text-lg font-medium text-gray-300 mt-6 mb-1`}>{children}</h4>;
                                        default: return <h2 {...commonProps} className={`${commonProps.className} text-indigo-400 border-b border-gray-700 pb-2 text-2xl font-bold`}>{children}</h2>;
                                    }
                                })()}
                            </div>
                        );
                    }
                    case 'paragraph': {
                        const isEditing = editingBlock?.blockIndex === index && editingBlock.itemIndex === undefined;
                        return isEditing ? (
                            <div className="my-4">
                                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500 leading-relaxed" rows={Math.max(3, editText.split('\n').length)} autoFocus />
                                <EditControls />
                            </div>
                        ) : (
                            <div className="group relative">
                                {!editingBlock && <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1"><EditButton onClick={() => handleStartEditing(index, block.text)} /><DeleteButton onClick={() => handleDeleteBlock(index)}/></div>}
                                <p data-block-index={index}>
                                    {renderContentText(block.text, index)}
                                </p>
                            </div>
                        );
                    }
                     case 'blockquote': {
                        const isEditing = editingBlock?.blockIndex === index && editingBlock.itemIndex === undefined;
                        return isEditing ? (
                             <div className="my-4">
                                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500 leading-relaxed" rows={Math.max(3, editText.split('\n').length)} autoFocus />
                                <EditControls />
                            </div>
                        ) : (
                             <div className="group relative">
                                {!editingBlock && <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1"><EditButton onClick={() => handleStartEditing(index, block.text)} /><DeleteButton onClick={() => handleDeleteBlock(index)}/></div>}
                                <blockquote data-block-index={index} className="border-l-4 border-gray-500 pl-4 italic text-gray-400">
                                    {renderContentText(block.text, index)}
                                </blockquote>
                            </div>
                        );
                    }
                    case 'list': {
                        const listBlock = block as ListBlock;
                        const items = Array.isArray(listBlock.items) ? listBlock.items as string[] : [];
                        if (items.length === 0) return null;

                        const ListTag = listBlock.style === 'ordered' ? 'ol' : 'ul';
                        return (
                            <div className="group relative">
                                {!editingBlock && <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteButton onClick={() => handleDeleteBlock(index)}/></div>}
                                {/* A classe `prose` no pai fornece os marcadores de lista (bolinhas/números).
                                    Adicionamos preenchimento e espaçamento aqui para melhorar a legibilidade, conforme solicitado. */}
                                <ListTag data-block-index={index} className="pl-8 space-y-2">
                                    {items.map((item, itemIndex) => {
                                        const isEditing = editingBlock?.blockIndex === index && editingBlock.itemIndex === itemIndex;
                                        return (
                                            <li key={itemIndex} data-item-index={itemIndex}>
                                                {isEditing ? (
                                                    <div className="my-2">
                                                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500" rows={Math.max(1, editText.split('\n').length)} autoFocus />
                                                        <EditControls />
                                                    </div>
                                                ) : (
                                                    <div className="group/item relative">
                                                        {!editingBlock && <div className="absolute top-0 -right-8 z-10 opacity-0 group-hover/item:opacity-100 transition-opacity"><EditButton onClick={() => handleStartEditing(index, item, itemIndex)} /></div>}
                                                        {renderContentText(item, index, itemIndex)}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ListTag>
                            </div>
                        );
                    }
                    case 'definition_list': {
                        const defBlock = block as DefinitionListBlock;
                        const items = Array.isArray(defBlock.items) ? defBlock.items : [];
                        if(items.length === 0) return null;
                        
                        return (
                            <div className="group relative my-4">
                                 {!editingBlock && <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"><DeleteButton onClick={() => handleDeleteBlock(index)}/></div>}
                                <dl data-block-index={index}>
                                    {items.map((item, itemIndex) => (
                                        <div key={itemIndex} className="mb-2">
                                            <dt className="font-semibold text-gray-200">{renderContentText(item.term, index, `dl-${itemIndex}-term`)}</dt>
                                            <dd className="ml-4 text-gray-400">{renderContentText(item.description, index, `dl-${itemIndex}-desc`)}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        );
                    }
                    case 'image': {
                        const isEditing = editingBlock?.blockIndex === index && editingBlock.itemIndex === undefined;
                        return isEditing ? (
                            <figure id={block.id} data-block-index={index} className="my-6 not-prose">
                                <img src={block.src} alt={block.caption} className="w-full rounded-md shadow-lg" />
                                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full mt-2 p-2 bg-gray-900 border border-gray-600 rounded-md text-sm text-center italic" autoFocus />
                                <EditControls />
                            </figure>
                        ) : (
                             <figure id={block.id} data-block-index={index} className="my-6 not-prose">
                                <div className="group relative">
                                    {!editingBlock && <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1"><EditButton onClick={() => handleStartEditing(index, block.caption)} /><DeleteButton onClick={() => handleDeleteBlock(index)}/></div>}
                                    <img src={block.src} alt={block.caption} className="w-full rounded-md shadow-lg" />
                                </div>
                                <figcaption className="text-center text-sm italic text-gray-400 mt-2">{renderContentText(block.caption, index)}</figcaption>
                            </figure>
                        )
                    }
                    default:
                        return null;
                }
            };
            
            return (
                <div key={index} className="group relative">
                    <AddBlockButton onClick={(e) => handleOpenAddBlockMenu(e, index)} />
                    {blockContent()}
                </div>
            )
        })}
        {Array.isArray(document.content) && (
            <div className="group relative h-8">
                <AddBlockButton onClick={(e) => handleOpenAddBlockMenu(e, document.content.length)} />
            </div>
        )}
      </div>
    </div>
  );
};
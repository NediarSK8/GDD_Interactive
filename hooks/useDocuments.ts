import React, { useState, useMemo, useEffect } from 'react';
import { Document, ContentBlock, ViewMode, SearchResult } from '../types';
import { getGddDocuments, saveGddDocuments, getScriptDocuments, saveScriptDocuments } from '../services/db';
import { INITIAL_DOCUMENTS, INITIAL_SCRIPT_DOCUMENTS } from '../constants';
import { ensureTimestamps } from '../utils/helpers';

const GDD_STORAGE_KEY = 'interactive-gdd-documents';
const SCRIPT_STORAGE_KEY = 'interactive-gdd-script-documents';

export const useDocuments = () => {
    const [documents, setDocuments] = useState<Document[] | null>(null);
    const [scriptDocuments, setScriptDocuments] = useState<Document[] | null>(null);
    const [isDBLoading, setIsDBLoading] = useState(true);
    const [dbError, setDbError] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>('gdd');
    const [activeGddDocumentId, setActiveGddDocumentId] = useState<string | null>(null);
    const [activeScriptDocumentId, setActiveScriptDocumentId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [scrollToHeading, setScrollToHeading] = useState<string | null>(null);
    
    useEffect(() => {
        async function loadInitialData() {
            try {
                let gddDocs = await getGddDocuments();
                let scriptDocs = await getScriptDocuments();

                if (!gddDocs) {
                    try {
                        const savedGdd = window.localStorage.getItem(GDD_STORAGE_KEY);
                        if (savedGdd) {
                            gddDocs = JSON.parse(savedGdd);
                            await saveGddDocuments(gddDocs);
                            window.localStorage.removeItem(GDD_STORAGE_KEY);
                        }
                    } catch (e) { console.error("Não foi possível migrar o GDD do localStorage", e); }
                }

                if (!scriptDocs) {
                    try {
                        const savedScript = window.localStorage.getItem(SCRIPT_STORAGE_KEY);
                        if (savedScript) {
                            scriptDocs = JSON.parse(savedScript);
                            await saveScriptDocuments(scriptDocs);
                            window.localStorage.removeItem(SCRIPT_STORAGE_KEY);
                        }
                    } catch (e) { console.error("Não foi possível migrar os Roteiros do localStorage", e); }
                }

                if (!gddDocs) gddDocs = INITIAL_DOCUMENTS;
                if (!scriptDocs) scriptDocs = INITIAL_SCRIPT_DOCUMENTS;
                
                const timedGddDocs = ensureTimestamps(gddDocs);
                const timedScriptDocs = ensureTimestamps(scriptDocs);

                setDocuments(timedGddDocs);
                setScriptDocuments(timedScriptDocs);

                if (timedGddDocs.length > 0) setActiveGddDocumentId(timedGddDocs[0].id);
                if (timedScriptDocs.length > 0) setActiveScriptDocumentId(timedScriptDocs[0].id);

            } catch (err) {
                console.error("Falha ao carregar documentos da persistência", err);
                setDbError("Não foi possível carregar os dados salvos. Começando com um novo conjunto de documentos.");
                setDocuments(ensureTimestamps(INITIAL_DOCUMENTS));
                setScriptDocuments(ensureTimestamps(INITIAL_SCRIPT_DOCUMENTS));
                if (INITIAL_DOCUMENTS.length > 0) setActiveGddDocumentId(INITIAL_DOCUMENTS[0].id);
                if (INITIAL_SCRIPT_DOCUMENTS.length > 0) setActiveScriptDocumentId(INITIAL_SCRIPT_DOCUMENTS[0].id);
            } finally {
                setIsDBLoading(false);
            }
        }
        loadInitialData();
    }, []);

    useEffect(() => {
        if (documents && !isDBLoading) {
            saveGddDocuments(documents).catch(err => {
                console.error("Falha ao salvar documentos do GDD no IndexedDB", err);
                setDbError("Falha ao salvar as alterações do GDD. Seus dados podem não persistir.");
            });
        }
    }, [documents, isDBLoading]);

    useEffect(() => {
        if (scriptDocuments && !isDBLoading) {
            saveScriptDocuments(scriptDocuments).catch(err => {
                console.error("Falha ao salvar documentos de roteiro no IndexedDB", err);
                setDbError("Falha ao salvar as alterações do Roteiro. Seus dados podem não persistir.");
            });
        }
    }, [scriptDocuments, isDBLoading]);

    const activeDocuments = useMemo(() => (viewMode === 'gdd' ? documents : scriptDocuments) || [], [viewMode, documents, scriptDocuments]);
    const activeDocumentId = useMemo(() => (viewMode === 'gdd' ? activeGddDocumentId : activeScriptDocumentId), [viewMode, activeGddDocumentId, activeScriptDocumentId]);
    
    const totalWordCount = useMemo(() => {
        const countWords = (text: string | undefined | null): number => {
            if (!text) return 0;
            return text.trim().split(/\s+/).filter(Boolean).length;
        };
        return activeDocuments.reduce((total, doc) => {
            let docTotal = countWords(doc.title);
            if (Array.isArray(doc.content)) {
                doc.content.forEach(block => {
                    if (block.type === 'heading' || block.type === 'paragraph') docTotal += countWords(block.text);
                    else if (block.type === 'list' && Array.isArray(block.items)) block.items.forEach(item => docTotal += countWords(item));
                    else if (block.type === 'image') docTotal += countWords(block.caption);
                });
            }
            return total + docTotal;
        }, 0);
    }, [activeDocuments]);

    const searchResults = useMemo((): SearchResult[] => {
        if (!searchQuery.trim()) return [];
        const results: SearchResult[] = [];
        const query = searchQuery.trim().toLowerCase();
        const allDocs = [
            ...((documents || []).map(d => ({ ...d, viewMode: 'gdd' as ViewMode }))),
            ...((scriptDocuments || []).map(d => ({ ...d, viewMode: 'script' as ViewMode })))
        ];

        const createSnippet = (text: string, query: string): React.ReactNode => {
            const index = text.toLowerCase().indexOf(query);
            if (index === -1) return null;
            const start = Math.max(0, index - 40);
            const end = Math.min(text.length, index + query.length + 40);
            const snippetText = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
            const regex = new RegExp(`(${searchQuery.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
            // FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
            // Also, replaced unsafe regex.test() in a loop with a check for odd-indexed elements from split(),
            // which is the correct way to identify captured separators.
            const parts = snippetText.split(regex);
            return React.createElement(React.Fragment, null, ...parts.map((part, i) =>
                i % 2 === 1
                    ? React.createElement('mark', { key: i, className: "bg-yellow-400 text-black px-0.5 rounded-sm" }, part)
                    : part
            ));
        };

        allDocs.forEach(doc => {
            const snippets = new Set<React.ReactNode>();
            if (doc.title.toLowerCase().includes(query)) {
                const snippet = createSnippet(doc.title, query);
                if (snippet) snippets.add(snippet);
            }
            doc.content.forEach(block => {
                let texts: string[] = [];
                if ((block.type === 'heading' || block.type === 'paragraph') && block.text) texts.push(block.text);
                else if (block.type === 'list' && block.items) texts.push(...block.items.filter(Boolean));
                else if (block.type === 'image' && block.caption) texts.push(block.caption);
                texts.forEach(text => {
                    if (text.toLowerCase().includes(query)) {
                        const snippet = createSnippet(text, query);
                        if (snippet) snippets.add(snippet);
                    }
                });
            });
            if (snippets.size > 0) {
                results.push({ docId: doc.id, docTitle: doc.title, category: doc.category, viewMode: doc.viewMode, snippets: Array.from(snippets) });
            }
        });
        return results;
    }, [searchQuery, documents, scriptDocuments]);

    const activeDocument = useMemo(() => activeDocuments.find(doc => doc.id === activeDocumentId) || null, [activeDocumentId, activeDocuments]);
    const categories = useMemo(() => [...new Set(activeDocuments.map(doc => doc.category))], [activeDocuments]);

    const handleSelectDocument = (id: string) => {
        const isGdd = (documents || []).some(d => d.id === id);
        if (isGdd) {
            setViewMode('gdd');
            setActiveGddDocumentId(id);
        } else {
            setViewMode('script');
            setActiveScriptDocumentId(id);
        }
        setSearchQuery('');
    };

    const handleSelectSearchResult = (docId: string, resultViewMode: ViewMode) => {
        setViewMode(resultViewMode);
        if (resultViewMode === 'gdd') setActiveGddDocumentId(docId);
        else setActiveScriptDocumentId(docId);
        setSearchQuery('');
    };

    const handleNavigate = (id: string, headingSlug?: string) => {
        const targetIsGdd = (documents || []).some(d => d.id === id);
        if (targetIsGdd) {
            setViewMode('gdd');
            setActiveGddDocumentId(id);
        } else {
            setViewMode('script');
            setActiveScriptDocumentId(id);
        }
        setScrollToHeading(headingSlug || null);
    };

    const handleDidScrollToHeading = () => setScrollToHeading(null);

    const handleUpdateBlock = (docId: string, blockIndex: number, newText: string, itemIndex?: number) => {
        const isGddDoc = (documents || []).some(d => d.id === docId);
        const setDocs = isGddDoc ? setDocuments : setScriptDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => {
            if (doc.id !== docId) return doc;
            const newContent = [...doc.content];
            const targetBlock = { ...newContent[blockIndex] };
            if (targetBlock.type === 'list' && itemIndex !== undefined && Array.isArray(targetBlock.items)) {
                const newItems = [...targetBlock.items];
                newItems[itemIndex] = newText;
                targetBlock.items = newItems;
            } else if (targetBlock.type === 'heading' || targetBlock.type === 'paragraph') {
                targetBlock.text = newText;
            } else if (targetBlock.type === 'image' && itemIndex === undefined) {
                targetBlock.caption = newText;
            }
            newContent[blockIndex] = targetBlock;
            return { ...doc, content: newContent, lastEdited: now };
        }));
    };

    const handleSetContent = (docId: string, newContent: ContentBlock[]) => {
        const isGddDoc = (documents || []).some(d => d.id === docId);
        const setDocs = isGddDoc ? setDocuments : setScriptDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => doc.id === docId ? { ...doc, content: newContent, lastEdited: now } : doc));
    };

    const handleUpdateBlockContent = (docId: string, blockIndex: number, partialBlock: Partial<ContentBlock>) => {
        const isGddDoc = (documents || []).some(d => d.id === docId);
        const setDocs = isGddDoc ? setDocuments : setScriptDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => {
            if (doc.id !== docId) return doc;
            const newContent = [...doc.content];
            const targetBlock = newContent[blockIndex];
            if (!targetBlock) return doc;
            // FIX: Cast the result to ContentBlock. Spreading a discriminated union with a partial of that union
            // can cause TypeScript to infer an invalid type. The cast is safe here due to the application's logic.
            newContent[blockIndex] = { ...targetBlock, ...partialBlock } as ContentBlock;
            return { ...doc, content: newContent, lastEdited: now };
        }));
    };

    const handleUpdateCategoryName = (oldCategory: string, newCategory: string) => {
        if (!newCategory || newCategory.trim() === '' || oldCategory === newCategory) return;
        const setDocs = viewMode === 'gdd' ? setDocuments : setScriptDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => doc.category === oldCategory ? { ...doc, category: newCategory, lastEdited: now } : doc));
    };

    const handleUpdateDocumentTitle = (docId: string, newTitle: string) => {
        if (!newTitle || newTitle.trim() === '') return;
        const setDocs = viewMode === 'gdd' ? setDocuments : setScriptDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => {
            const docs = prevDocs || [];
            const oldTitle = docs.find(d => d.id === docId)?.title;
            if (!oldTitle || oldTitle === newTitle) return docs;
            const linkRegex = new RegExp(`\\[\\[${oldTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\]\\]`, 'gi');
            const newLink = `[[${newTitle}]]`;
            return docs.map(doc => {
                let wasModified = false;
                let updatedDoc = { ...doc };
                if (doc.id === docId) {
                    updatedDoc.title = newTitle;
                    wasModified = true;
                }
                const newContent = updatedDoc.content.map(block => {
                    if ((block.type === 'heading' || block.type === 'paragraph') && block.text?.match(linkRegex)) {
                        wasModified = true;
                        return { ...block, text: block.text.replace(linkRegex, newLink) };
                    }
                    if (block.type === 'list' && Array.isArray(block.items)) {
                        let itemsModified = false;
                        const newItems = block.items.map(item => {
                            if (item?.match(linkRegex)) {
                                itemsModified = true;
                                return item.replace(linkRegex, newLink);
                            }
                            return item;
                        });
                        if (itemsModified) {
                            wasModified = true;
                            return { ...block, items: newItems };
                        }
                    }
                    return block;
                });
                if (wasModified) updatedDoc.lastEdited = now;
                return { ...updatedDoc, content: newContent };
            });
        });
    };

    const handleReorderDocuments = (draggedId: string, targetId: string) => {
        const setDocs = viewMode === 'gdd' ? setDocuments : setScriptDocuments;
        setDocs(prevDocs => {
            const docs = prevDocs || [];
            const draggedIndex = docs.findIndex(doc => doc.id === draggedId);
            const targetIndex = docs.findIndex(doc => doc.id === targetId);
            if (draggedIndex === -1 || targetIndex === -1) return docs;
            const draggedItem = docs[draggedIndex];
            const targetItem = docs[targetIndex];
            if (draggedItem.category !== targetItem.category) return docs;
            const newDocs = [...docs];
            newDocs.splice(draggedIndex, 1);
            const newTargetIndex = newDocs.findIndex(doc => doc.id === targetId);
            newDocs.splice(newTargetIndex, 0, draggedItem);
            return newDocs;
        });
    };

    const handleReorderCategories = (draggedCategory: string, targetCategory: string) => {
        const setDocs = viewMode === 'gdd' ? setDocuments : setScriptDocuments;
        setDocs(prevDocs => {
            const docs = prevDocs || [];
            const uniqueCategories = [...new Set(docs.map(doc => doc.category))];
            const dragIndex = uniqueCategories.indexOf(draggedCategory);
            const targetIndex = uniqueCategories.indexOf(targetCategory);
            if (dragIndex === -1 || targetIndex === -1) return docs;
            const reorderedCategories = [...uniqueCategories];
            const [removed] = reorderedCategories.splice(dragIndex, 1);
            reorderedCategories.splice(targetIndex, 0, removed);
            const docsByCategory = new Map<string, Document[]>();
            docs.forEach(doc => {
                if (!docsByCategory.has(doc.category)) docsByCategory.set(doc.category, []);
                docsByCategory.get(doc.category)!.push(doc);
            });
            const newDocs: Document[] = [];
            reorderedCategories.forEach(category => {
                const categoryDocs = docsByCategory.get(category) || [];
                newDocs.push(...categoryDocs);
            });
            return newDocs;
        });
    };

    return {
        documents, scriptDocuments, setDocuments, setScriptDocuments, isDBLoading, dbError,
        viewMode, setViewMode, activeDocuments, activeDocumentId,
        categories, activeDocument, totalWordCount,
        searchQuery, setSearchQuery, searchResults,
        scrollToHeading, setScrollToHeading,
        handleSelectDocument, handleSelectSearchResult, handleNavigate,
        handleDidScrollToHeading, handleUpdateBlock, handleSetContent,
        handleUpdateBlockContent,
        handleUpdateCategoryName, handleUpdateDocumentTitle,
        handleReorderDocuments, handleReorderCategories,
    };
};
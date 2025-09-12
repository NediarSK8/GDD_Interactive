





import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chat } from '@google/genai';
import { Sidebar } from './components/Sidebar';
import { ContentView } from './components/ContentView';
import { IdeaInputModal } from './components/IdeaInputModal';
import { RefinementModal } from './components/RefinementModal';
import { GlobalUpdateModal } from './components/GlobalUpdateModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ReferenceFinderModal } from './components/ReferenceFinderModal';
import { AdvancedQueryWidget } from './components/AdvancedQueryWidget';
import { AiInsightModal } from './components/AiInsightModal';
import { ImageGenerationModal } from './components/ImageGenerationModal';
import { UploadModal } from './components/UploadModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { SaveVersionModal } from './components/SaveVersionModal';
import { VersionSelectionModal } from './components/VersionSelectionModal';
import { UpdateNotificationModal } from './components/UpdateNotificationModal';
import { UnlockSecretModal } from './components/UnlockSecretModal';
// FIX: Imported SearchResult type to resolve 'Cannot find name' error.
import { Document, ContentBlock, GeminiUpdatePayload, ViewMode, CloudVersions, Version, SearchResult } from './types';
import { analyzeAndIntegrateIdea, analyzeAndIntegrateScriptIdea, refineText, updateDocumentsWithInstruction, startAdvancedChatQuery, generateImagePrompt, generateImageFromPrompt, analyzeAndIntegrateSecretIdea } from './services/geminiService';
import { saveVersionToCloud, getVersions, loadVersion, getLatestVersionMeta, verifyAdminKey, uploadLatestDocx } from './services/cloudSyncService';
import { getGddDocuments, saveGddDocuments, getScriptDocuments, saveScriptDocuments, getSecretDocuments, saveSecretDocuments } from './services/db';
import { useGoogleAuth } from './auth/useGoogleAuth';
import { generateDocxBlob } from './utils/docxGenerator';
import { applyChanges, estimateTokens, ensureTimestamps } from './utils/helpers';
import { BrainIcon, UploadIcon, DownloadIcon, GoogleDriveIcon, DocumentIcon, MagicWandIcon, AiInsightIcon, MenuIcon, ChevronUpIcon, ChevronDownIcon, CloudSyncIcon, SecretIcon } from './assets/icons';
import { encryptData, decryptData } from './utils/crypto';
import { INITIAL_DOCUMENTS, INITIAL_SCRIPT_DOCUMENTS } from './constants';


interface RefinementModalState {
    isOpen: boolean;
    docId: string | null;
    blockIndex: number | null;
    itemIndex?: number;
    initialText: string;
}

interface Reference {
    docId: string;
    docTitle: string;
    category: string;
    snippet: React.ReactNode;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const LOCAL_VERSION_META_KEY = 'currentCloudVersionMeta';

export default function App() {
  const { googleAccessToken, authError, handleGoogleAuthClick } = useGoogleAuth();

  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [scriptDocuments, setScriptDocuments] = useState<Document[] | null>(null);
  const [secretDocuments, setSecretDocuments] = useState<Document[] | null>(null);
  const [isDBLoading, setIsDBLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('gdd');
  const [activeGddDocumentId, setActiveGddDocumentId] = useState<string | null>(null);
  const [activeScriptDocumentId, setActiveScriptDocumentId] = useState<string | null>(null);
  const [activeSecretDocumentId, setActiveSecretDocumentId] = useState<string | null>(null);
  const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);
  
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lastSidebarWidth, setLastSidebarWidth] = useState(320);
  const isResizingRef = useRef(false);
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [isGlobalUpdateModalOpen, setIsGlobalUpdateModalOpen] = useState(false);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [isImageGenModalOpen, setIsImageGenModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUnlockSecretModalOpen, setIsUnlockSecretModalOpen] = useState(false);
  const [imageGenState, setImageGenState] = useState<{ docId: string; insertionIndex: number } | null>(null);
  const [lastAiInsight, setLastAiInsight] = useState<(GeminiUpdatePayload & { rawJson: string }) | null>(null);

  const [refinementModalState, setRefinementModalState] = useState<RefinementModalState>({ isOpen: false, docId: null, blockIndex: null, itemIndex: undefined, initialText: '' });
  const [referenceFinderState, setReferenceFinderState] = useState<{
      isOpen: boolean;
      targetDoc: Document | null;
      references: Reference[];
  }>({ isOpen: false, targetDoc: null, references: [] });
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    message: '',
    currentTokens: 0,
    estimatedTokens: 0,
  });
  const [appError, setAppError] = useState<string | null>(null);

  const [isQueryWidgetOpen, setIsQueryWidgetOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const geminiChat = useRef<Chat | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docSearchResultsCount, setDocSearchResultsCount] = useState(0);
  const [docSearchCurrentIndex, setDocSearchCurrentIndex] = useState(-1);
  
    const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
    const [cloudSyncUrl, setCloudSyncUrl] = useState('');
    const [cloudSyncKey, setCloudSyncKey] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string | null>(null);
    const [isCloudSyncModalClosable, setIsCloudSyncModalClosable] = useState(true);

    const [confirmationModalState, setConfirmationModalState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });
    
    const [isSaveVersionModalOpen, setIsSaveVersionModalOpen] = useState(false);
    const [isVersionSelectionModalOpen, setIsVersionSelectionModalOpen] = useState(false);
    const [cloudVersions, setCloudVersions] = useState<CloudVersions | null>(null);
    const [isFetchingVersions, setIsFetchingVersions] = useState(false);
    const [versionError, setVersionError] = useState<string | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState<Version | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [scrollToHeading, setScrollToHeading] = useState<string | null>(null);
    
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Document Management
    const activeDocuments = useMemo(() => {
        if (viewMode === 'gdd') return documents || [];
        if (viewMode === 'script') return scriptDocuments || [];
        if (viewMode === 'secret') return secretDocuments || [];
        return [];
    }, [viewMode, documents, scriptDocuments, secretDocuments]);

    const activeDocumentId = useMemo(() => {
        if (viewMode === 'gdd') return activeGddDocumentId;
        if (viewMode === 'script') return activeScriptDocumentId;
        if (viewMode === 'secret') return activeSecretDocumentId;
        return null;
    }, [viewMode, activeGddDocumentId, activeScriptDocumentId, activeSecretDocumentId]);

    const activeDocument = useMemo(() => activeDocuments.find(doc => doc.id === activeDocumentId) || null, [activeDocumentId, activeDocuments]);
    const categories = useMemo(() => [...new Set(activeDocuments.map(doc => doc.category))], [activeDocuments]);

    const handleSelectDocument = (id: string, selectedViewMode?: ViewMode) => {
        const targetViewMode = selectedViewMode || viewMode;
        if (targetViewMode === 'gdd') setActiveGddDocumentId(id);
        if (targetViewMode === 'script') setActiveScriptDocumentId(id);
        if (targetViewMode === 'secret') setActiveSecretDocumentId(id);
        setSearchQuery('');
    };
    
    const documentsRef = useRef(documents);
    const scriptDocumentsRef = useRef(scriptDocuments);
    const secretDocumentsRef = useRef(secretDocuments);

    useEffect(() => { documentsRef.current = documents; }, [documents]);
    useEffect(() => { scriptDocumentsRef.current = scriptDocuments; }, [scriptDocuments]);
    useEffect(() => { secretDocumentsRef.current = secretDocuments; }, [secretDocuments]);

    useEffect(() => {
        async function loadInitialData() {
            try {
                let gddDocs = await getGddDocuments();
                let scriptDocs = await getScriptDocuments();
                let secretDocs = await getSecretDocuments();
    
                if (!gddDocs) gddDocs = INITIAL_DOCUMENTS;
                if (!scriptDocs) scriptDocs = INITIAL_SCRIPT_DOCUMENTS;
                if (!secretDocs) secretDocs = [];
    
                setDocuments(ensureTimestamps(gddDocs));
                setScriptDocuments(ensureTimestamps(scriptDocs));
                setSecretDocuments(ensureTimestamps(secretDocs));
    
                if (gddDocs.length > 0) setActiveGddDocumentId(gddDocs[0].id);
                if (scriptDocs.length > 0) setActiveScriptDocumentId(scriptDocs[0].id);
                if (secretDocs.length > 0) setActiveSecretDocumentId(secretDocs[0].id);
    
            } catch (err) {
                console.error("Falha ao carregar documentos da persistência", err);
                setDbError("Não foi possível carregar os dados salvos.");
                setDocuments(ensureTimestamps(INITIAL_DOCUMENTS));
                setScriptDocuments(ensureTimestamps(INITIAL_SCRIPT_DOCUMENTS));
                setSecretDocuments([]);
            } finally {
                setIsDBLoading(false);
            }
        }
        loadInitialData();
    }, []);

     useEffect(() => { if (documents && !isDBLoading) { saveGddDocuments(documents); } }, [documents, isDBLoading]);
     useEffect(() => { if (scriptDocuments && !isDBLoading) { saveScriptDocuments(scriptDocuments); } }, [scriptDocuments, isDBLoading]);
     useEffect(() => { if (secretDocuments && !isDBLoading) { saveSecretDocuments(secretDocuments); } }, [secretDocuments, isDBLoading]);
    
    useEffect(() => {
        // This effect runs once after the initial data load from the DB is complete.
        if (!isDBLoading) {
            const savedUrl = localStorage.getItem('cloudSyncUrl');
            const savedKey = localStorage.getItem('cloudSyncKey');
    
            if (savedUrl && savedKey) {
                // If they are found, update the state.
                setCloudSyncUrl(savedUrl);
                setCloudSyncKey(savedKey);
            } else {
                // If credentials are not found, open the modal and make it non-closable
                setIsCloudSyncModalClosable(false);
                setIsCloudSyncModalOpen(true);
            }
        }
    }, [isDBLoading]);
    
    useEffect(() => {
        const checkForUpdates = async () => {
            if (!cloudSyncUrl || !cloudSyncKey) return;

            const localMetaString = localStorage.getItem(LOCAL_VERSION_META_KEY);
            // Don't check if we've never synced or just uploaded a local file
            if (!localMetaString) return; 

            try {
                const localMeta: Version = JSON.parse(localMetaString);
                const latestMeta = await getLatestVersionMeta(cloudSyncUrl, cloudSyncKey);

                // If server has a version, and its ID is different, and its timestamp is newer
                if (latestMeta && latestMeta.id !== localMeta.id && new Date(latestMeta.timestamp) > new Date(localMeta.timestamp)) {
                    setUpdateAvailable(latestMeta);
                }
            } catch (err) {
                console.error("Failed to check for new versions:", err);
                // Fail silently, don't disrupt the user with an error for a background check
            }
        };

        if (!isDBLoading && !isCloudSyncModalOpen) {
             checkForUpdates();
        }
    }, [cloudSyncUrl, cloudSyncKey, isDBLoading, isCloudSyncModalOpen]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const newWidth = Math.max(240, Math.min(e.clientX, 600)); // Clamp width
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = 'auto';
            document.body.style.userSelect = 'auto';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);
    
    // Effect to clear document search when the active document changes
    useEffect(() => {
        setDocSearchQuery('');
        setDocSearchResultsCount(0);
        setDocSearchCurrentIndex(-1);
    }, [activeDocument?.id]);


    const handleMouseDownOnResizer = (e: React.MouseEvent) => {
        if (isSidebarCollapsed) return;
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const handleToggleSidebar = () => {
      setIsSidebarCollapsed(prev => {
        const willCollapse = !prev;
        if (willCollapse) {
          setLastSidebarWidth(sidebarWidth);
          setSidebarWidth(0);
        } else {
          setSidebarWidth(lastSidebarWidth);
        }
        return willCollapse;
      });
    };


  useEffect(() => {
    if (dbError) setAppError(dbError);
  }, [dbError]);

  useEffect(() => {
    if (authError) setAppError(authError);
  }, [authError]);
  
  const handleDocSearchQueryChange = (query: string) => {
      setDocSearchQuery(query);
      // When user types, reset to the first result
      setDocSearchCurrentIndex(query.trim() ? 0 : -1);
  };

  const handleDocSearchPrev = () => {
      if (docSearchResultsCount > 0) {
          setDocSearchCurrentIndex(prev => (prev - 1 + docSearchResultsCount) % docSearchResultsCount);
      }
  };

  const handleDocSearchNext = () => {
      if (docSearchResultsCount > 0) {
          setDocSearchCurrentIndex(prev => (prev + 1) % docSearchResultsCount);
      }
  };

  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    const results: SearchResult[] = [];
    const query = searchQuery.trim().toLowerCase();
    const allDocs = [
        ...((documents || []).map(d => ({ ...d, viewMode: 'gdd' as ViewMode }))),
        ...((scriptDocuments || []).map(d => ({ ...d, viewMode: 'script' as ViewMode })))
    ];

    const createSnippet = (text: string): React.ReactNode => {
        const index = text.toLowerCase().indexOf(query);
        if (index === -1) return null;
        const start = Math.max(0, index - 40);
        const end = Math.min(text.length, index + query.length + 40);
        const snippetText = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
        const regex = new RegExp(`(${searchQuery.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
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
            const snippet = createSnippet(doc.title);
            if (snippet) snippets.add(snippet);
        }
        doc.content.forEach(block => {
            let texts: string[] = [];
            if ((block.type === 'heading' || block.type === 'paragraph') && block.text) texts.push(block.text);
            else if (block.type === 'list' && block.items) texts.push(...block.items.filter(Boolean));
            else if (block.type === 'image' && block.caption) texts.push(block.caption);
            texts.forEach(text => {
                if (text.toLowerCase().includes(query)) {
                    const snippet = createSnippet(text);
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

  const handleSelectSearchResult = (docId: string, resultViewMode: ViewMode) => {
    setDocSearchQuery(searchQuery);
    setViewMode(resultViewMode);
    if (resultViewMode === 'gdd') setActiveGddDocumentId(docId);
    else setActiveScriptDocumentId(docId);
    setSearchQuery('');
  };
  
  const handleAutomaticCloudSave = async (updatedDocs: Document[], updatedViewMode: ViewMode) => {
    if (!cloudSyncUrl || !cloudSyncKey || updatedViewMode === 'secret') {
        console.log("Cloud sync not configured or in secret mode, skipping automatic save.");
        return;
    }

    const gddToSave = updatedViewMode === 'gdd' ? updatedDocs : documentsRef.current;
    const scriptToSave = updatedViewMode === 'script' ? updatedDocs : scriptDocumentsRef.current;

    if (!gddToSave || !scriptToSave) {
        console.warn("Skipping auto-save because one of the document sets is not available.");
        return;
    }

    setSyncStatus('Salvando backup automático na nuvem...');
    try {
        const combinedData = {
            gdd: gddToSave,
            script: scriptToSave,
        };
        // FIX: Added the missing 'secretDocumentsRef.current' argument to the saveVersionToCloud call.
        const result = await saveVersionToCloud(cloudSyncUrl, cloudSyncKey, combinedData, secretDocumentsRef.current, { type: 'automatic' });
        localStorage.setItem(LOCAL_VERSION_META_KEY, JSON.stringify(result));
        setSyncStatus(`Backup automático salvo com sucesso!`);
        
        // Fire-and-forget DOCX upload for auto-save
        (async () => {
            try {
                const gddBlob = await generateDocxBlob(gddToSave, 'GDD');
                const scriptBlob = await generateDocxBlob(scriptToSave, 'Roteiro');
                await uploadLatestDocx(cloudSyncUrl, cloudSyncKey, gddBlob, scriptBlob);
                console.log("Backup automático de .docx em segundo plano concluído.");
            } catch (docxError) {
                console.error("Falha ao gerar ou enviar o backup automático de .docx:", docxError);
            }
        })();

    } catch (err) {
        const errorMsg = err instanceof Error ? `Falha no backup automático: ${err.message}` : 'Falha no backup automático.';
        setSyncStatus(errorMsg);
        console.error(errorMsg, err);
    } finally {
        setTimeout(() => {
            setSyncStatus(prevStatus => (prevStatus?.includes('backup')) ? null : prevStatus);
        }, 5000);
    }
  };

  const handleSubmitIdea = async (idea: string, config: { maxOutputTokens: number; thinkingBudget: number }) => {
    setIsIdeaModalOpen(false);
    setAppError(null);

    const contextType = viewMode === 'gdd' ? 'GDD' : viewMode === 'script' ? 'Roteiro' : 'Secreta';

    setLoadingState({
        isLoading: true,
        message: 'A IA está analisando sua ideia...',
        currentTokens: 0,
        estimatedTokens: config.maxOutputTokens,
    });

    const onProgress = (tokens: number) => { setLoadingState(prev => ({ ...prev, currentTokens: tokens })); };
    const onStatusUpdate = (message: string) => { setLoadingState(prev => ({ ...prev, message })); };

    try {
        let changes: GeminiUpdatePayload;
        let rawJson: string;

        if (viewMode === 'secret') {
            const result = await analyzeAndIntegrateSecretIdea(idea, secretDocuments || [], documents || [], scriptDocuments || [], onProgress, onStatusUpdate, config);
            changes = result.payload;
            rawJson = result.rawJson;
        } else {
            if (viewMode === 'script') {
                const result = await analyzeAndIntegrateScriptIdea(idea, scriptDocuments || [], documents || [], onProgress, onStatusUpdate, config);
                changes = result.payload;
                rawJson = result.rawJson;
            } else { // GDD mode
                const documentsToUpdate = documents || [];
                const result = await analyzeAndIntegrateIdea(idea, documentsToUpdate, contextType, onProgress, onStatusUpdate, config);
                changes = result.payload;
                rawJson = result.rawJson;
            }
        }
        
        setLastAiInsight({ ...changes, rawJson });
        setLoadingState(prev => ({...prev, message: `Integrando sugestão da IA: ${changes.summary}`}));

        const setDocumentsToUpdate = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
      
        let finalDocs: Document[] = [];
        setDocumentsToUpdate(prevDocs => {
            finalDocs = applyChanges(prevDocs || [], changes);
            return finalDocs;
        });
      
        if (viewMode !== 'secret') {
            handleAutomaticCloudSave(finalDocs, viewMode);
        }
      
        const newDocs = changes.newDocuments;
        if (newDocs.length > 0) {
            handleSelectDocument(newDocs[0].id);
        } else {
            setTimeout(() => {
                const activeDocStillExists = finalDocs.some(d => d.id === activeDocumentId);
                if (!activeDocStillExists && finalDocs.length > 0) {
                    handleSelectDocument(finalDocs[0].id);
                }
            }, 0);
        }
    } catch (err) {
      console.error(err);
      setAppError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setTimeout(() => setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 }), 1500);
    }
  };

  const handleGlobalUpdate = async (instruction: string, config: { maxOutputTokens: number; thinkingBudget: number }) => {
    setIsGlobalUpdateModalOpen(false);
    setAppError(null);
    
    if (viewMode === 'secret') return;

    const documentsToUpdate = (viewMode === 'gdd' ? documents : scriptDocuments) || [];
    const setDocumentsToUpdate = viewMode === 'gdd' ? setDocuments : setScriptDocuments;
    const contextType = viewMode === 'gdd' ? 'GDD' : 'Roteiro';
    
    setLoadingState({
        isLoading: true,
        message: 'A IA está reestruturando os documentos...',
        currentTokens: 0,
        estimatedTokens: config.maxOutputTokens
    });

    const onProgress = (tokens: number) => { setLoadingState(prev => ({ ...prev, currentTokens: tokens })); };
    const onStatusUpdate = (message: string) => { setLoadingState(prev => ({ ...prev, message })); };

    try {
        const { payload: changes, rawJson } = await updateDocumentsWithInstruction(instruction, documentsToUpdate, contextType, onProgress, onStatusUpdate, config);
        setLastAiInsight({ ...changes, rawJson });
        
        let finalDocs: Document[] = [];
        setDocumentsToUpdate(prevDocs => {
            finalDocs = applyChanges(prevDocs || [], changes);
            return finalDocs;
        });

        handleAutomaticCloudSave(finalDocs, viewMode);
        setLoadingState(prev => ({ ...prev, message: changes.summary || 'Documentos atualizados com sucesso!'}));

        setTimeout(() => {
            const activeDocStillExists = finalDocs.some(d => d.id === activeDocumentId);
            if (!activeDocStillExists && finalDocs.length > 0) {
                handleSelectDocument(finalDocs[0].id);
            }
        }, 0);

    } catch (err) {
        console.error(err);
        setAppError(err instanceof Error ? err.message : `Ocorreu um erro desconhecido durante a atualização global do ${contextType}.`);
    } finally {
        setTimeout(() => setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 }), 1000);
    }
  };

  const handleDownload = () => {
    setAppError(null);
    try {
        const combinedData = {
            gdd: documents,
            script: scriptDocuments,
        };
        const encryptedData = encryptData(combinedData);
        const blob = new Blob([encryptedData], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'gdd-e-roteiro-data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Falha ao fazer o download dos dados", err);
        setAppError(err instanceof Error ? err.message : "Falha ao fazer o download dos dados.");
    }
  };
  
  const processUploadedContent = (content: string) => {
    try {
        let parsedData;
        try {
            parsedData = JSON.parse(content);
        } catch (jsonError) {
            try {
               parsedData = decryptData(content);
            } catch (decryptError) {
                console.error("Falha na descriptografia e na análise JSON:", { jsonError, decryptError });
                throw new Error('Formato de arquivo inválido. O arquivo deve ser um JSON válido ou um arquivo criptografado válido deste aplicativo.');
            }
        }
        
        const isDocumentArray = (arr: any): arr is Document[] => 
            Array.isArray(arr) && arr.every(item => 
                item && typeof item === 'object' && 'id' in item && 'title' in item && 'category' in item && 'content' in item
            );
        
        localStorage.removeItem(LOCAL_VERSION_META_KEY);

        if (parsedData && typeof parsedData === 'object' && 'gdd' in parsedData && 'script' in parsedData && !Array.isArray(parsedData)) {
            if (!isDocumentArray(parsedData.gdd) || !isDocumentArray(parsedData.script)) {
                 throw new Error('Formato de arquivo inválido. O arquivo combinado deve conter arrays de documentos válidos para GDD e Roteiro.');
            }
            setDocuments(parsedData.gdd);
            setScriptDocuments(parsedData.script);
            // Don't touch secret documents on regular upload
        } 
        else if (isDocumentArray(parsedData)) {
            setDocuments(parsedData); // Legacy format, only affects GDD
        } 
        else {
            throw new Error('Formato de arquivo desconhecido ou inválido. O arquivo deve conter um GDD e Roteiro combinados ou apenas um GDD antigo.');
        }
    } catch (err) {
        console.error("Falha ao analisar o arquivo carregado", err);
        setAppError(err instanceof Error ? err.message : 'Falha ao processar o arquivo. Certifique-se de que é um arquivo JSON válido ou um arquivo criptografado válido deste aplicativo.');
    } finally {
        setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
    }
  };

  const handleUploadLocal = () => {
    setIsUploadModalOpen(false);
    setAppError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    
    input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        setLoadingState({ isLoading: true, message: 'Processando arquivo...', currentTokens: 0, estimatedTokens: 0});
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result;
            if (typeof content === 'string') {
                processUploadedContent(content);
            }
        };
        reader.onerror = () => {
             setAppError('Falha ao ler o arquivo.');
             setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
        };
        reader.readAsText(file);
    };
    input.click();
  };

  const handleUploadFromUrl = async (url: string) => {
    setIsUploadModalOpen(false);
    setAppError(null);

    const fileIdMatch = url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch || !fileIdMatch[1]) {
        setAppError("URL do Google Drive inválida. Certifique-se de que é um link de compartilhamento de arquivo.");
        return;
    }
    const fileId = fileIdMatch[1];

    setLoadingState({ isLoading: true, message: 'Baixando arquivo do Google Drive...', currentTokens: 0, estimatedTokens: 0 });

    try {
        const publicUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${process.env.API_KEY}`;
        const publicResponse = await fetch(publicUrl);

        if (publicResponse.ok) {
            const content = await publicResponse.text();
            setLoadingState(prev => ({ ...prev, message: 'Processando arquivo público...' }));
            processUploadedContent(content);
            return;
        }

        if (!googleAccessToken) {
            throw new Error('Não foi possível buscar o arquivo público. Se for um arquivo privado, por favor, conecte sua conta do Google primeiro.');
        }

        setLoadingState(prev => ({ ...prev, message: 'Tentando acesso privado...' }));
        const privateResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${googleAccessToken}`
            }
        });

        if (!privateResponse.ok) {
            if (privateResponse.status === 401) {
                throw new Error('Não autorizado. Sua sessão do Google pode ter expirado. Por favor, conecte-se novamente.');
            }
            throw new Error(`Falha ao buscar o arquivo do Google Drive: ${privateResponse.statusText}`);
        }

        const content = await privateResponse.text();
        setLoadingState(prev => ({ ...prev, message: 'Processando arquivo privado...' }));
        processUploadedContent(content);

    } catch (err) {
        console.error("Falha ao carregar do Google Drive", err);
        setAppError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido ao carregar do Google Drive.");
        setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
    }
  };

  const handleGenerateDocs = async () => {
    setAppError(null);
    setLoadingState({
        isLoading: true,
        message: 'Gerando arquivos .docx...',
        currentTokens: 0,
        estimatedTokens: 0
    });
    
    try {
        const downloadBlob = (blob: Blob, filename: string) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        const gddBlob = await generateDocxBlob(documents, 'GDD');
        if (gddBlob) {
            downloadBlob(gddBlob, 'GDD.docx');
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        const scriptBlob = await generateDocxBlob(scriptDocuments, 'Roteiro');
        if (scriptBlob) {
            downloadBlob(scriptBlob, 'Roteiro.docx');
        }
      
      setLoadingState(prev => ({...prev, message: 'Documentos gerados com sucesso!'}));
    } catch (err) {
      console.error("Falha ao gerar documentos", err);
      setAppError(err instanceof Error ? err.message : 'Falha ao gerar os documentos.');
    } finally {
      setTimeout(() => {
        setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
      }, 1500);
    }
  };

  const handleOpenRefinementModal = (docId: string, blockIndex: number, text: string, itemIndex?: number) => {
    setRefinementModalState({ isOpen: true, docId, blockIndex, initialText: text, itemIndex });
  };

  const handleSubmitRefinement = async (instruction: string, includeContext: boolean) => {
    const { docId, blockIndex, itemIndex, initialText } = refinementModalState;
    if (docId === null || blockIndex === null || !initialText) return;

    setRefinementModalState({ ...refinementModalState, isOpen: false });
    setAppError(null);
    
    const estimatedOutputTokens = Math.round(estimateTokens(initialText) * 1.5);

    setLoadingState({
        isLoading: true,
        message: 'A IA está aprimorando o texto...',
        currentTokens: 0,
        estimatedTokens: estimatedOutputTokens
    });
    
    const onProgress = (tokens: number) => {
        setLoadingState(prev => ({ ...prev, currentTokens: tokens }));
    };

    try {
        const documentsForContext = (viewMode === 'gdd' ? documents : viewMode === 'script' ? scriptDocuments : secretDocuments) || [];
        const contextDocs = includeContext ? documentsForContext : undefined;
        const newText = await refineText(initialText, instruction, contextDocs, onProgress);
        handleUpdateBlock(docId, blockIndex, newText, itemIndex);
    } catch (err) {
        console.error("Falha ao aprimorar o texto", err);
        setAppError(err instanceof Error ? err.message : 'Falha ao aprimorar o texto.');
    } finally {
        setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
    }
  };

  const handleFindReferences = (docId: string) => {
      const allDocs = [...(documents || []), ...(scriptDocuments || []), ...(secretDocuments || [])];
      const targetDoc = allDocs.find(d => d.id === docId);
      if (!targetDoc) return;

      const references: Reference[] = [];
      const linkRegex = new RegExp(`(\\[\\[${targetDoc.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\]\\])`);

      const highlight = (text: string) => {
          return text.split(linkRegex).map((part, i) =>
              linkRegex.test(part) ? <strong key={i} className="bg-yellow-400/30 text-yellow-200">{part}</strong> : part
          );
      };
      
      allDocs.forEach(doc => {
          if (doc.id === targetDoc.id) return;

          doc.content.forEach(block => {
              let texts: string[] = [];
              if ((block.type === 'heading' || block.type === 'paragraph' || block.type === 'blockquote') && block.text) {
                  texts.push(block.text);
              } else if (block.type === 'list' && block.items) {
                  texts.push(...block.items.filter(Boolean));
              } else if (block.type === 'image' && block.caption) {
                  texts.push(block.caption);
              }

              texts.forEach(text => {
                  if (linkRegex.test(text)) {
                      references.push({
                          docId: doc.id,
                          docTitle: doc.title,
                          category: doc.category,
                          snippet: <>{highlight(text)}</>,
                      });
                  }
              });
          });
      });

      setReferenceFinderState({
          isOpen: true,
          targetDoc: targetDoc,
          references: references,
      });
  };

  const handleCloseReferenceFinder = () => {
      setReferenceFinderState({ isOpen: false, targetDoc: null, references: [] });
  };

  const handleToggleQueryWidget = () => {
      setIsQueryWidgetOpen(prev => !prev);
  };

  const handleClearChat = () => {
      setChatMessages([]);
      geminiChat.current = null;
  };

  const handleSendChatMessage = async (message: string) => {
      if (!documents || !scriptDocuments) return;

      const newUserMessage: ChatMessage = { role: 'user', text: message };
      setChatMessages(prev => [...prev, newUserMessage]);
      setIsChatLoading(true);

      try {
          if (!geminiChat.current) {
              geminiChat.current = startAdvancedChatQuery(documents, scriptDocuments);
          }
          
          const response = await geminiChat.current.sendMessage({ message });
          const aiResponse: ChatMessage = { role: 'model', text: response.text };
          setChatMessages(prev => [...prev, aiResponse]);

      } catch (err) {
          console.error("Erro na consulta avançada do chat:", err);
          const errorMessage: ChatMessage = {
              role: 'model',
              text: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente."
          };
          setChatMessages(prev => [...prev, errorMessage]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const handleOpenImageGenerationModal = (docId: string, insertionIndex: number) => {
    setImageGenState({ docId, insertionIndex });
    setIsImageGenModalOpen(true);
  };

  const handleSubmitImageGeneration = async (userPrompt: string) => {
    if (!imageGenState) return;
    const { docId, insertionIndex } = imageGenState;
    const docsForContext = activeDocuments;
    const targetDoc = docsForContext.find(d => d.id === docId);
    
    if (!targetDoc) {
      setAppError('Documento alvo para geração de imagem não encontrado.');
      return;
    }
    
    setIsImageGenModalOpen(false);
    setAppError(null);

    try {
      setLoadingState({
        isLoading: true,
        message: 'A IA está criando um prompt de imagem detalhado...',
        currentTokens: 0,
        estimatedTokens: 0
      });
      
      const detailedPrompt = await generateImagePrompt(targetDoc, insertionIndex, [...(documents || []), ...(scriptDocuments || [])], userPrompt);
      
      setLoadingState(prev => ({ ...prev, message: 'A IA está gerando a imagem...' }));
      
      const { base64, mimeType } = await generateImageFromPrompt(detailedPrompt);
      
      const newImageBlock: ContentBlock = {
        type: 'image',
        id: `img-ai-${Date.now()}`,
        src: `data:${mimeType};base64,${base64}`,
        caption: detailedPrompt,
      };
      
      const newContent = [...targetDoc.content];
      newContent.splice(insertionIndex, 0, newImageBlock);
      
      handleSetContent(docId, newContent);
      
      setLoadingState(prev => ({...prev, message: 'Imagem gerada e inserida com sucesso!'}));

    } catch (err) {
      console.error("Falha ao gerar a imagem com IA", err);
      setAppError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido durante a geração da imagem.');
    } finally {
      setImageGenState(null);
      setTimeout(() => setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 }), 1500);
    }
  };

  const handleSaveCloudSyncSettings = async (url: string, key: string) => {
    setCloudSyncUrl(url);
    setCloudSyncKey(key);
    localStorage.setItem('cloudSyncUrl', url);
    localStorage.setItem('cloudSyncKey', key);
    
    const wasInitialSetup = !isCloudSyncModalClosable;

    setSyncStatus('Configurações salvas com sucesso!');

    if (wasInitialSetup) {
        setIsCloudSyncModalOpen(false);
        setIsCloudSyncModalClosable(true);

        const isDefaultGdd = JSON.stringify(documentsRef.current) === JSON.stringify(INITIAL_DOCUMENTS);
        const isDefaultScript = JSON.stringify(scriptDocumentsRef.current) === JSON.stringify(INITIAL_SCRIPT_DOCUMENTS);

        if (isDefaultGdd && isDefaultScript) {
            setLoadingState({ isLoading: true, message: 'Buscando a versão mais recente da nuvem...', currentTokens: 0, estimatedTokens: 0 });
            try {
                const latestMeta = await getLatestVersionMeta(url, key);
                if (latestMeta) {
                    setLoadingState(prev => ({ ...prev, message: 'Baixando a versão mais recente...' }));
                    const data = await loadVersion(url, key, latestMeta.id);
                    setDocuments(data.gdd);
                    setScriptDocuments(data.script);
                    localStorage.setItem(LOCAL_VERSION_META_KEY, JSON.stringify(latestMeta));
                    setLoadingState(prev => ({ ...prev, message: 'Versão mais recente carregada com sucesso!' }));
                } else {
                     setLoadingState(prev => ({ ...prev, message: 'Nenhuma versão encontrada na nuvem. Mantendo documentos padrão.' }));
                }
            } catch (err) {
                console.error("Falha ao buscar automaticamente a versão mais recente:", err);
                const errorMessage = err instanceof Error ? err.message : "Não foi possível carregar a versão mais recente da nuvem.";
                setAppError(errorMessage);
                setSyncStatus(`Erro ao carregar da nuvem: ${errorMessage}`);
            } finally {
                setTimeout(() => setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 }), 2000);
            }
        }
    }
    
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const handleCloudUploadClick = () => {
    if (!cloudSyncUrl || !cloudSyncKey) {
        setSyncStatus('Erro: URL do Worker ou Chave não configurada.');
        setTimeout(() => setSyncStatus(null), 5000);
        return;
    }
    setIsSaveVersionModalOpen(true);
  };

  const handleSaveVersion = async (name: string) => {
    setIsSyncing(true);
    setSyncStatus('Enviando versão para a nuvem...');
    setIsSaveVersionModalOpen(false);
    try {
        const currentGdd = documents || [];
        const currentScript = scriptDocuments || [];
        const currentSecret = secretDocuments;

        const combinedData = {
            gdd: currentGdd,
            script: currentScript,
        };
        const result = await saveVersionToCloud(cloudSyncUrl, cloudSyncKey, combinedData, currentSecret, { type: 'manual', name });
        setSyncStatus(`Versão "${result.name}" salva com sucesso!`);
        localStorage.setItem(LOCAL_VERSION_META_KEY, JSON.stringify(result));
        
        // Fire-and-forget DOCX upload
        (async () => {
            try {
                const gddBlob = await generateDocxBlob(currentGdd, 'GDD');
                const scriptBlob = await generateDocxBlob(currentScript, 'Roteiro');
                await uploadLatestDocx(cloudSyncUrl, cloudSyncKey, gddBlob, scriptBlob);
                 console.log("Backup .docx em segundo plano concluído.");
            } catch (docxError) {
                console.error("Falha ao gerar ou enviar o backup .docx:", docxError);
            }
        })();

    } catch (err) {
        setSyncStatus(err instanceof Error ? `Erro no upload: ${err.message}` : 'Erro desconhecido no upload.');
    } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleCloudDownloadClick = async () => {
    if (!cloudSyncUrl || !cloudSyncKey) {
        setSyncStatus('Erro: URL do Worker ou Chave não configurada.');
        setTimeout(() => setSyncStatus(null), 5000);
        return;
    }
    
    setIsFetchingVersions(true);
    setVersionError(null);
    setCloudVersions(null);
    setIsVersionSelectionModalOpen(true);

    try {
        const versions = await getVersions(cloudSyncUrl, cloudSyncKey);
        versions.manual.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        versions.automatic.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setCloudVersions(versions);
    } catch(err) {
        setVersionError(err instanceof Error ? err.message : 'Erro desconhecido ao buscar versões.');
    } finally {
        setIsFetchingVersions(false);
    }
  };
  
  const handleLoadVersionFromCloud = (versionId: string, versionMeta?: Version) => {
    const performLoad = async () => {
        setIsVersionSelectionModalOpen(false);
        setIsSyncing(true);
        setSyncStatus('Baixando versão da nuvem...');
        try {
            const data = await loadVersion(cloudSyncUrl, cloudSyncKey, versionId);
            setSyncStatus('Dados recebidos. Atualizando documentos...');
            setDocuments(data.gdd);
            setScriptDocuments(data.script);
            
            if (data.secret && Array.isArray(data.secret)) {
                setSecretDocuments(data.secret);
                setIsSecretUnlocked(true);
                console.log("Documentos secretos carregados e categoria desbloqueada.");
            }
            
            let loadedVersionMeta = versionMeta;
            if (!loadedVersionMeta && cloudVersions) {
                const allVersions = [...cloudVersions.manual, ...cloudVersions.automatic];
                loadedVersionMeta = allVersions.find(v => v.id === versionId);
            }

            if (loadedVersionMeta) {
                localStorage.setItem(LOCAL_VERSION_META_KEY, JSON.stringify(loadedVersionMeta));
            }
            
            setSyncStatus('Dados carregados da nuvem com sucesso!');
        } catch (err) {
            setSyncStatus(err instanceof Error ? `Erro no download: ${err.message}` : 'Erro desconhecido no download.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus(null), 5000);
        }
    };

    setConfirmationModalState({
        isOpen: true,
        title: 'Confirmar Carregamento de Versão',
        message: 'Isso substituirá seus documentos locais (GDD e Roteiro). Se você usar a chave de Administrador, os documentos secretos também serão substituídos. Deseja continuar?',
        onConfirm: performLoad,
    });
  };

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

    const handleNavigate = (id: string, headingSlug?: string) => {
        const isGdd = (documents || []).some(d => d.id === id);
        const isScript = (scriptDocuments || []).some(d => d.id === id);
        const isSecret = (secretDocuments || []).some(d => d.id === id);

        if (isGdd) setViewMode('gdd');
        else if (isScript) setViewMode('script');
        else if (isSecret && isSecretUnlocked) setViewMode('secret');
        
        handleSelectDocument(id);
        setScrollToHeading(headingSlug || null);
    };

    const handleDidScrollToHeading = () => setScrollToHeading(null);

    const handleUpdateBlock = (docId: string, blockIndex: number, newText: string, itemIndex?: number) => {
        const setDocs = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => {
            if (doc.id !== docId) return doc;
            const newContent = [...doc.content];
            const targetBlock = { ...newContent[blockIndex] };
            if (targetBlock.type === 'list' && itemIndex !== undefined && Array.isArray(targetBlock.items)) {
                const newItems = [...targetBlock.items];
                newItems[itemIndex] = newText;
                targetBlock.items = newItems;
            } else if (targetBlock.type === 'heading' || targetBlock.type === 'paragraph' || targetBlock.type === 'blockquote') {
                targetBlock.text = newText;
            } else if (targetBlock.type === 'image' && itemIndex === undefined) {
                targetBlock.caption = newText;
            }
            newContent[blockIndex] = targetBlock;
            return { ...doc, content: newContent, lastEdited: now };
        }));
    };

    const handleSetContent = (docId: string, newContent: ContentBlock[]) => {
        const setDocs = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => doc.id === docId ? { ...doc, content: newContent, lastEdited: now } : doc));
    };

    const handleUpdateBlockContent = (docId: string, blockIndex: number, partialBlock: Partial<ContentBlock>) => {
        const setDocs = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => {
            if (doc.id !== docId) return doc;
            const newContent = [...doc.content];
            const targetBlock = newContent[blockIndex];
            if (!targetBlock) return doc;
            newContent[blockIndex] = { ...targetBlock, ...partialBlock } as ContentBlock;
            return { ...doc, content: newContent, lastEdited: now };
        }));
    };

    const handleUpdateCategoryName = (oldCategory: string, newCategory: string) => {
        if (!newCategory || newCategory.trim() === '' || oldCategory === newCategory) return;
        const setDocs = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
        const now = new Date().toISOString();
        setDocs(prevDocs => (prevDocs || []).map(doc => doc.category === oldCategory ? { ...doc, category: newCategory, lastEdited: now } : doc));
    };

    const handleUpdateDocumentTitle = (docId: string, newTitle: string) => {
        if (!newTitle || newTitle.trim() === '') return;
        const setDocs = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
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
        const setDocs = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
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
        const setDocs = viewMode === 'gdd' ? setDocuments : viewMode === 'script' ? setScriptDocuments : setSecretDocuments;
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

  const handleUnlockSecretCategory = async (enteredKey: string): Promise<boolean> => {
    if (!cloudSyncUrl) {
        setAppError("A URL de sincronização na nuvem não está configurada. Não é possível verificar a chave.");
        return false;
    }
    
    setLoadingState({
        isLoading: true,
        message: 'Verificando chave de administrador...',
        currentTokens: 0,
        estimatedTokens: 0
    });

    try {
        const isValid = await verifyAdminKey(cloudSyncUrl, enteredKey);
        if (isValid) {
            // Se a chave for válida, atualiza o estado e o localStorage
            if (enteredKey !== cloudSyncKey) {
                setCloudSyncKey(enteredKey);
                localStorage.setItem('cloudSyncKey', enteredKey);
            }
            setIsSecretUnlocked(true);
            setIsUnlockSecretModalOpen(false);
            setViewMode('secret');
            return true;
        } else {
            return false;
        }
    } catch (err) {
        setAppError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido durante a verificação da chave.');
        return false;
    } finally {
        setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
    }
  };

  const statusIsError = syncStatus && (syncStatus.toLowerCase().includes('erro') || syncStatus.toLowerCase().includes('falha'));

    const sidebarSharedProps = {
        title: viewMode === 'gdd' ? 'GDD Explorer' : viewMode === 'script' ? 'Roteiro Explorer' : 'Documentos Secretos',
        documents: activeDocuments,
        categories: categories,
        activeDocumentId: activeDocumentId,
        onUpdateCategoryName: handleUpdateCategoryName,
        onUpdateDocumentTitle: handleUpdateDocumentTitle,
        onReorderDocuments: handleReorderDocuments,
        onReorderCategories: handleReorderCategories,
        onFindReferences: handleFindReferences,
        totalWordCount: totalWordCount,
        searchQuery: searchQuery,
        onSearchChange: setSearchQuery,
        searchResults: searchResults,
        onSelectDocument: (id: string, selectedViewMode?: ViewMode) => {
            handleSelectDocument(id, selectedViewMode);
            if (isMobile) setIsMobileSidebarOpen(false);
        },
        onSelectSearchResult: (docId: string, viewMode: ViewMode) => {
            handleSelectSearchResult(docId, viewMode);
            if (isMobile) setIsMobileSidebarOpen(false);
        },
    };

  return (
    <div className="flex h-screen font-sans relative">
      {(loadingState.isLoading || isDBLoading) && (
          <LoadingOverlay 
              message={isDBLoading ? "Carregando banco de dados..." : loadingState.message}
              currentTokens={loadingState.currentTokens}
              estimatedTokens={loadingState.estimatedTokens}
          />
      )}
      
      {/* Mobile Sidebar (overlay) */}
      <div className={`md:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          width={Math.min(320, window.innerWidth * 0.85)}
          {...sidebarSharedProps}
        />
      </div>
      {isMobile && isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden animate-fade-in" onClick={() => setIsMobileSidebarOpen(false)}></div>
      )}

      {/* Desktop Sidebar (static) */}
       <div className={`hidden md:flex h-full flex-shrink-0`}>
         <Sidebar 
            width={sidebarWidth}
            {...sidebarSharedProps}
          />
       </div>

      <div className="hidden md:block">
        {!isSidebarCollapsed && (
            <div
                onMouseDown={handleMouseDownOnResizer}
                className="w-1.5 h-full flex-shrink-0 bg-gray-700 hover:bg-indigo-500 transition-colors duration-200"
                style={{ cursor: 'col-resize' }}
            />
        )}
      </div>

      <button
        onClick={handleToggleSidebar}
        className="absolute top-1/2 -translate-y-1/2 bg-gray-800 hover:bg-indigo-600 border border-gray-700 text-white rounded-full p-1 z-30 transition-all duration-200 shadow-lg hidden md:block"
        style={{ left: isSidebarCollapsed ? '8px' : `${sidebarWidth - 16}px` }}
        title={isSidebarCollapsed ? "Expandir" : "Recolher"}
        aria-label={isSidebarCollapsed ? "Expandir painel lateral" : "Recolher painel lateral"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <main className="flex-1 flex flex-col bg-gray-900 overflow-y-auto min-w-0">
         <header className="sticky top-0 z-30 flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700">
             <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                 <button onClick={() => setIsMobileSidebarOpen(true)} className="p-1 rounded-full text-gray-300 hover:bg-gray-700 md:hidden" aria-label="Abrir menu lateral">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="bg-gray-800 p-1 rounded-lg flex items-center">
                    <button onClick={() => setViewMode('gdd')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'gdd' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>GDD</button>
                    <button onClick={() => setViewMode('script')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'script' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Roteiro</button>
                    {isSecretUnlocked && (<button onClick={() => setViewMode('secret')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors flex items-center ${viewMode === 'secret' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><SecretIcon /> <span className="ml-1.5">Secreta</span></button>)}
                </div>
                 <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
                 <div className="hidden md:flex items-center space-x-2">
                    <button onClick={() => { setIsIdeaModalOpen(true); }} className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-md shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        <span className="ml-2 hidden lg:inline">Integrar Ideia</span>
                    </button>
                    <button onClick={() => { setIsGlobalUpdateModalOpen(true); }} className="flex items-center px-4 py-2 text-sm text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors rounded-md shadow-sm disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed" title={`Atualizar todo o ${viewMode.toUpperCase()} com uma instrução`} disabled={viewMode === 'secret'}>
                         <MagicWandIcon />
                         <span className="ml-2 hidden lg:inline">Atualização Global</span>
                     </button>
                </div>
             </div>
             <div className="flex-grow flex justify-center px-2 md:px-4">
                {activeDocument && (
                    <div className="relative w-full max-w-lg">
                        <input type="text" value={docSearchQuery} onChange={(e) => handleDocSearchQueryChange(e.target.value)} placeholder="Pesquisar neste documento..." className="w-full bg-gray-800 border border-gray-600 rounded-full py-2 pl-4 pr-32 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        {docSearchQuery && (
                            <div className="absolute inset-y-0 right-2 flex items-center space-x-1 text-gray-400">
                                <span className="text-xs px-2">{docSearchResultsCount > 0 ? `${docSearchCurrentIndex + 1} de ${docSearchResultsCount}` : '0/0'}</span>
                                <button onClick={handleDocSearchPrev} disabled={docSearchResultsCount === 0} className="p-1 rounded-full hover:bg-gray-700 disabled:text-gray-600"><ChevronUpIcon /></button>
                                <button onClick={handleDocSearchNext} disabled={docSearchResultsCount === 0} className="p-1 rounded-full hover:bg-gray-700 disabled:text-gray-600"><ChevronDownIcon /></button>
                            </div>
                        )}
                    </div>
                )}
             </div>
             <div className="relative flex-shrink-0" ref={menuRef}>
                <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500" aria-haspopup="true" aria-expanded={isMenuOpen} title="Menu de Ações"><MenuIcon /></button>
                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-2 z-50 animate-dropdown">
                         <div className="md:hidden border-b border-gray-600 my-1">
                            <button onClick={() => { setIsIdeaModalOpen(true); setIsMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-md text-left">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                <span className="ml-3">Integrar Ideia</span>
                            </button>
                            <button onClick={() => { setIsGlobalUpdateModalOpen(true); setIsMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-md text-left disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent" disabled={viewMode === 'secret'}>
                                <MagicWandIcon />
                                <span className="ml-3">Atualização Global</span>
                            </button>
                         </div>
                         <button onClick={() => { setIsUploadModalOpen(true); setIsMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-md text-left" title="Carregar GDD e Roteiro"><UploadIcon /><span className="ml-3">Carregar GDD & Roteiro</span></button>
                         <button onClick={() => { handleDownload(); setIsMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-md text-left" title="Salvar GDD e Roteiro no computador"><DownloadIcon /><span className="ml-3">Salvar GDD & Roteiro</span></button>
                         <button onClick={() => { handleGenerateDocs(); setIsMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-md text-left" title="Gerar e baixar o documento completo"><DocumentIcon /><span className="ml-3">Gerar Documentos .docx</span></button>
                         <hr className="border-gray-600 my-1" />
                         <button onClick={() => { setIsCloudSyncModalClosable(true); setIsCloudSyncModalOpen(true); setIsMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-md text-left" title="Configurar e usar a sincronização na nuvem"><CloudSyncIcon /><span className="ml-3">Sincronização na Nuvem</span></button>
                         <button onClick={() => { handleGoogleAuthClick(); setIsMenuOpen(false); }} disabled={!!googleAccessToken} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors rounded-md text-left" title={googleAccessToken ? "Conectado ao Google Drive" : "Conectar ao Google Drive para salvar backups"}><GoogleDriveIcon /><span className="ml-3">{googleAccessToken ? "Conectado ao Google Drive" : "Conectar ao Google Drive"}</span></button>
                         <hr className="border-gray-600 my-1" />
                         <button onClick={() => { setIsUnlockSecretModalOpen(true); setIsMenuOpen(false); }} disabled={!cloudSyncUrl} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors rounded-md text-left" title="Acessar documentos estratégicos e secretos"><SecretIcon /><span className="ml-3">Acessar Categoria Secreta</span></button>
                         <button onClick={() => { setIsInsightModalOpen(true); setIsMenuOpen(false); }} disabled={!lastAiInsight} className="w-full flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors rounded-md text-left" title="Ver o processo de raciocínio da última ação da IA"><AiInsightIcon /><span className="ml-3">Ver Raciocínio da IA</span></button>
                    </div>
                )}
             </div>
         </header>

         {appError && (
            <div className="m-4 p-4 bg-red-800/50 border border-red-600 text-red-200 rounded-md relative animate-fade-in">
                <h3 className="font-bold">Ocorreu um Erro</h3>
                <p>{appError}</p>
                <button onClick={() => setAppError(null)} className="absolute top-2 right-2 text-red-200 hover:text-white p-1">&times;</button>
            </div>
         )}

         <ContentView 
            document={activeDocument} 
            allDocuments={[...(documents || []), ...(scriptDocuments || []), ...(secretDocuments || [])]}
            onNavigate={handleNavigate}
            onRefineRequest={handleOpenRefinementModal}
            onFindReferences={handleFindReferences}
            onUpdateBlock={handleUpdateBlock}
            onUpdateBlockContent={handleUpdateBlockContent}
            onSetContent={handleSetContent}
            scrollToHeading={scrollToHeading}
            onDidScrollToHeading={handleDidScrollToHeading}
            onOpenImageGenerationModal={handleOpenImageGenerationModal}
            docSearchQuery={docSearchQuery}
            docSearchCurrentIndex={docSearchCurrentIndex}
            onDocSearchResultsChange={setDocSearchResultsCount}
         />
      </main>

       {/* Global Sync Status Indicator */}
        {syncStatus && (
            <div className={`fixed bottom-6 right-6 z-50 p-3 rounded-lg shadow-lg text-sm font-semibold transition-all duration-300 animate-fade-in ${ statusIsError ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-200' }`}>{syncStatus}</div>
        )}

      <IdeaInputModal 
        isOpen={isIdeaModalOpen}
        onClose={() => setIsIdeaModalOpen(false)}
        onSubmit={handleSubmitIdea}
        contextType={viewMode === 'gdd' ? 'GDD' : viewMode === 'script' ? 'Roteiro' : 'Secreta'}
      />
      <GlobalUpdateModal 
        isOpen={isGlobalUpdateModalOpen}
        onClose={() => setIsGlobalUpdateModalOpen(false)}
        onSubmit={handleGlobalUpdate}
        contextType={viewMode === 'gdd' ? 'GDD' : 'Roteiro'}
      />
      <ImageGenerationModal
        isOpen={isImageGenModalOpen}
        onClose={() => setIsImageGenModalOpen(false)}
        onSubmit={handleSubmitImageGeneration}
      />
       <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadLocal={handleUploadLocal}
        onUploadFromUrl={handleUploadFromUrl}
        isGoogleAuth={!!googleAccessToken}
        onGoogleAuthClick={() => { handleGoogleAuthClick(); }}
      />
      <RefinementModal
        isOpen={refinementModalState.isOpen}
        onClose={() => setRefinementModalState({ ...refinementModalState, isOpen: false })}
        onSubmit={handleSubmitRefinement}
        initialText={refinementModalState.initialText}
        contextType={viewMode === 'gdd' ? 'GDD' : 'Roteiro'}
      />
      <ReferenceFinderModal
        isOpen={referenceFinderState.isOpen}
        onClose={handleCloseReferenceFinder}
        targetDocTitle={referenceFinderState.targetDoc?.title || ''}
        references={referenceFinderState.references}
        onNavigate={handleNavigate}
      />
       <AiInsightModal
        isOpen={isInsightModalOpen}
        onClose={() => setIsInsightModalOpen(false)}
        insight={lastAiInsight}
      />
      <CloudSyncModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
        isClosable={isCloudSyncModalClosable}
        initialUrl={cloudSyncUrl}
        initialKey={cloudSyncKey}
        onSaveSettings={handleSaveCloudSyncSettings}
        onUploadClick={handleCloudUploadClick}
        onDownloadClick={handleCloudDownloadClick}
        isSyncing={isSyncing}
      />
       <SaveVersionModal
        isOpen={isSaveVersionModalOpen}
        onClose={() => setIsSaveVersionModalOpen(false)}
        onSave={handleSaveVersion}
        isSaving={isSyncing}
      />
      <VersionSelectionModal
        isOpen={isVersionSelectionModalOpen}
        onClose={() => setIsVersionSelectionModalOpen(false)}
        onLoadVersion={handleLoadVersionFromCloud}
        versions={cloudVersions}
        isLoading={isFetchingVersions}
        error={versionError}
      />
      <ConfirmationModal
        isOpen={confirmationModalState.isOpen}
        onClose={() => setConfirmationModalState({ ...confirmationModalState, isOpen: false })}
        onConfirm={() => {
            confirmationModalState.onConfirm();
            setConfirmationModalState({ ...confirmationModalState, isOpen: false });
        }}
        title={confirmationModalState.title}
        message={confirmationModalState.message}
      />
       <UpdateNotificationModal
        isOpen={!!updateAvailable}
        onClose={() => setUpdateAvailable(null)}
        onConfirm={() => {
            if (updateAvailable) {
                handleLoadVersionFromCloud(updateAvailable.id, updateAvailable);
            }
            setUpdateAvailable(null);
        }}
        latestVersion={updateAvailable}
      />
      <UnlockSecretModal
        isOpen={isUnlockSecretModalOpen}
        onClose={() => setIsUnlockSecretModalOpen(false)}
        onUnlock={handleUnlockSecretCategory}
      />
      <AdvancedQueryWidget
        isOpen={isQueryWidgetOpen}
        onToggle={handleToggleQueryWidget}
        messages={chatMessages}
        isLoading={isChatLoading}
        onSendMessage={handleSendChatMessage}
        onClearChat={handleClearChat}
      />
    </div>
  );
}
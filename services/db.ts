import { Document } from '../types';

const DB_NAME = 'GDD_DATABASE';
const DB_VERSION = 2; // Incremented version to trigger onupgradeneeded
const GDD_STORE_NAME = 'gdd_documents';
const SCRIPT_STORE_NAME = 'script_documents';
const SECRET_STORE_NAME = 'secret_documents';
const DOCS_KEY = 'all_docs';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening IndexedDB.');
            dbPromise = null; // Reset promise on error
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(GDD_STORE_NAME)) {
                db.createObjectStore(GDD_STORE_NAME);
            }
            if (!db.objectStoreNames.contains(SCRIPT_STORE_NAME)) {
                db.createObjectStore(SCRIPT_STORE_NAME);
            }
            if (!db.objectStoreNames.contains(SECRET_STORE_NAME)) {
                db.createObjectStore(SECRET_STORE_NAME);
            }
        };
    });

    return dbPromise;
}

async function getDocumentsFromStore(storeName: string): Promise<Document[] | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(DOCS_KEY);

        request.onerror = () => reject(`Error getting docs from ${storeName}`);
        request.onsuccess = () => resolve(request.result || null);
    });
}

async function saveDocumentsToStore(storeName: string, documents: Document[]): Promise<void> {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(documents, DOCS_KEY);

        request.onerror = () => reject(`Error saving docs to ${storeName}`);
        request.onsuccess = () => resolve();
    });
}

export const getGddDocuments = () => getDocumentsFromStore(GDD_STORE_NAME);
export const saveGddDocuments = (documents: Document[]) => saveDocumentsToStore(GDD_STORE_NAME, documents);

export const getScriptDocuments = () => getDocumentsFromStore(SCRIPT_STORE_NAME);
export const saveScriptDocuments = (documents: Document[]) => saveDocumentsToStore(SCRIPT_STORE_NAME, documents);

export const getSecretDocuments = () => getDocumentsFromStore(SECRET_STORE_NAME);
export const saveSecretDocuments = (documents: Document[]) => saveDocumentsToStore(SECRET_STORE_NAME, documents);
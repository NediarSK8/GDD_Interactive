import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Document, ContentBlock, GeminiUpdatePayload, ImageBlock, ListBlock, MindMapNode } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

type ContextType = 'GDD' | 'Roteiro' | 'Secreta';

const sanitizeContentForAI = (content: ContentBlock[]) => {
    return content.map(block => {
        // For image blocks, send the ID and caption, but not the base64 image data.
        if (block.type === 'image') {
            const { src, ...rest } = block as ImageBlock;
            return { ...rest, src: `[IMAGE_DATA_OMITTED]` };
        }
        // For lists with empty items, filter them out.
        if (block.type === 'list') {
            return { ...block, items: (block as ListBlock).items.filter(item => item && item.trim() !== '') };
        }
        return block;
    });
};

// JSON Schemas for Gemini API

const contentBlockSchema = {
    type: Type.OBJECT,
    // Define all possible properties of a content block.
    // The AI is smart enough to use the right ones based on the 'type' property it sets.
    // The `items` property is deliberately omitted from this schema because its type is a union (string[] or object[]),
    // which cannot be easily represented. The detailed system prompt will guide the AI on how to structure `items`.
    properties: {
        type: { type: Type.STRING, description: "The type of the content block (e.g., 'heading', 'paragraph', 'list')." },
        level: { type: Type.INTEGER, description: "For 'heading' blocks, the level (1, 2, or 3)." },
        text: { type: Type.STRING, description: "Text content for 'paragraph', 'heading', or 'blockquote'." },
        style: { type: Type.STRING, description: "For 'list' blocks, the style ('ordered' or 'unordered')." },
        id: { type: Type.STRING, description: "For 'image' blocks, the unique ID." },
        caption: { type: Type.STRING, description: "For 'image' blocks, the caption." }
    },
    required: ['type']
};


const documentSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "Unique ID. For new documents, use format 'doc-TIMESTAMP'. For updated documents, use the existing ID." },
        title: { type: Type.STRING, description: "The title of the document." },
        category: { type: Type.STRING, description: "The category of the document. Can be an existing category or a new one." },
        content: {
            type: Type.ARRAY,
            description: "An array of content blocks. Adhere strictly to the content block formats described in the system prompt.",
            items: contentBlockSchema
        }
    },
    required: ['id', 'title', 'category', 'content']
};

const geminiUpdatePayloadSchema = {
    type: Type.OBJECT,
    properties: {
        newDocuments: { type: Type.ARRAY, description: "Array of completely new documents to be created.", items: documentSchema },
        updatedDocuments: { type: Type.ARRAY, description: "Array of existing documents that have been modified.", items: documentSchema },
        deletedDocumentIds: { type: Type.ARRAY, description: "Array of document IDs to be deleted.", items: { type: Type.STRING } },
        summary: { type: Type.STRING, description: "A brief, one-sentence summary of the changes made, in Portuguese." },
        thinkingProcess: { type: Type.ARRAY, description: "A step-by-step explanation of the reasoning behind the changes, in Portuguese.", items: { type: Type.STRING } }
    },
    required: ['newDocuments', 'updatedDocuments', 'deletedDocumentIds', 'summary', 'thinkingProcess']
};

const DOCUMENT_MANIPULATION_RULES = `
JSON Response Structure:
- newDocuments: An array of new Document objects.
- updatedDocuments: An array of existing Document objects that you have modified.
- deletedDocumentIds: An array of strings, containing the IDs of documents to be deleted.
- summary: A brief, one-sentence summary of the changes you made, in Brazilian Portuguese.
- thinkingProcess: A step-by-step explanation of your reasoning, in Brazilian Portuguese.

Rules for manipulating documents:
1.  **ID Management**:
    -   When updating an existing document, you MUST preserve its original 'id'.
    -   For new documents, you MUST generate a new, unique ID using the format: "doc-" + a descriptive slug + "-" + timestamp (e.g., "doc-combat-amulets-1712345678").
2.  **Content Blocks**: The 'content' array must consist of objects with a 'type' field. The valid types and their structures are:
    -   \`{ "type": "heading", "level": 1|2|3, "text": "..." }\`
    -   \`{ "type": "paragraph", "text": "..." }\`
    -   \`{ "type": "list", "style": "ordered"|"unordered", "items": ["...", "..."] }\`
    -   \`{ "type": "image", "id": "...", "caption": "..." }\` (PRESERVE existing 'id' and DO NOT include 'src').
    -   \`{ "type": "blockquote", "text": "..." }\`
    -   \`{ "type": "definition_list", "items": [{ "term": "...", "description": "..." }] }\`
3.  **Linking**: Create internal links between documents by wrapping a document's title in double square brackets, e.g., "as described in the [[Mecânicas de Combate]] document."
    -   If you rename a document, you MUST update all links pointing to it across all other documents you are updating.
4.  **Consistency**: Ensure all changes are consistent with the overall style and lore of the existing documents.
5.  **Efficiency**:
    -   Only include documents in the 'updatedDocuments' array if their content has actually changed.
    -   If a user's idea is vague, make reasonable, creative decisions to flesh it out.
    -   If an idea requires splitting a document, create a new document and move the relevant content, leaving a summary and a link in the original document.
    -   If the request is to add a small piece of information, find the most logical document and section to add it to.
6.  **Quality**:
    -   Avoid generating repetitive or redundant content.
    -   If a section is incomplete in the user's prompt (like "Ato 3" of a script), create a single placeholder paragraph for it instead of repeating content to fill space. For example: { "type": "paragraph", "text": "[A ser detalhado]" }.
`;

const generateDocumentChanges = async (
    systemInstruction: string,
    userContent: string,
    config: { model: string; maxOutputTokens?: number; thinkingBudget: number },
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
): Promise<{ payload: GeminiUpdatePayload, rawJson: string }> => {
    
    const geminiConfig: any = {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: geminiUpdatePayloadSchema,
    };

    if (config.maxOutputTokens) {
        geminiConfig.maxOutputTokens = config.maxOutputTokens;
    }
    
    // thinkingConfig is only supported by and added for gemini-2.5-flash.
    if (config.model === 'gemini-2.5-flash') {
        const isAuto = config.thinkingBudget === -1;

        if (isAuto) {
            // In "auto" mode, if maxOutputTokens is also set, we must define a budget.
            // If maxOutputTokens is NOT set, we don't pass thinkingConfig to let the API use its default auto logic.
            if (config.maxOutputTokens) {
                const autoBudget = Math.min(10000, Math.round(config.maxOutputTokens * 0.25));
                geminiConfig.thinkingConfig = { thinkingBudget: autoBudget };
            }
        } else {
            // In manual mode, pass the user-defined value (this includes 0 to disable thinking).
            geminiConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
        }
    }
    
    onStatusUpdate('Enviando requisição para a IA...');

    let rawJson = '';
    let totalTokens = 0;

    const responseStream = await ai.models.generateContentStream({
        model: config.model,
        contents: userContent,
        config: {
            systemInstruction,
            ...geminiConfig,
        }
    });

    onStatusUpdate('IA está processando e gerando as mudanças...');
    for await (const chunk of responseStream) {
        rawJson += chunk.text;
        totalTokens = chunk.usageMetadata?.totalTokenCount || totalTokens;
        onProgress(totalTokens);
    }
    
    onStatusUpdate('Analisando e validando a resposta da IA...');

    try {
        const payload: GeminiUpdatePayload = JSON.parse(rawJson);
        if (!payload.newDocuments || !payload.updatedDocuments || !payload.deletedDocumentIds || !payload.summary || !payload.thinkingProcess) {
            throw new Error("A resposta da IA está incompleta ou malformada.");
        }
        return { payload, rawJson };
    } catch (e) {
        console.error("Erro ao analisar JSON da IA:", e);
        console.error("JSON Bruto Recebido:", rawJson);
        throw new Error(`A resposta da IA não era um JSON válido. Erro: ${(e as Error).message}`);
    }
};

const getBaseSystemInstruction = (contextType: ContextType) => {
    return `You are an expert game designer and technical writer integrated into a GDD management tool.
Your goal is to intelligently update a set of documents based on a user's request.
You MUST respond with a single, valid JSON object that conforms to the provided schema.
${DOCUMENT_MANIPULATION_RULES}
Your current task is to modify the ${contextType}. Analyze the user's request and the provided documents, and then generate the JSON object with the necessary changes.
`;
};

// FIX: Added export keyword to make the function available for import.
export async function analyzeAndIntegrateIdea(
    idea: string,
    documents: Document[],
    contextType: ContextType,
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { model: string; maxOutputTokens?: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload, rawJson: string }> {

    const systemInstruction = getBaseSystemInstruction(contextType);
    const sanitizedDocs = documents.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));

    const userContent = `
    Here are the current documents for the ${contextType}:
    ---
    ${JSON.stringify(sanitizedDocs, null, 2)}
    ---

    Here is the new idea/content to integrate:
    ---
    ${idea}
    ---

    Please analyze the idea and the existing documents, and generate the JSON object to integrate this new idea.
    `;
    
    // FIX: Added missing return statement.
    return generateDocumentChanges(systemInstruction, userContent, config, onProgress, onStatusUpdate);
}

// FIX: Added export keyword to make the function available for import.
export async function analyzeAndIntegrateScriptIdea(
    idea: string,
    scriptDocuments: Document[],
    gddDocuments: Document[],
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { model: string; maxOutputTokens?: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload, rawJson: string }> {

    const systemInstruction = `${getBaseSystemInstruction('Roteiro')}

CRITICAL RULES FOR SCRIPT INTEGRATION:
1.  **READ-ONLY CONTEXT**: The GDD (Game Design Document) is provided for context ONLY. You MUST NOT modify, copy, or recreate any part of the GDD documents. Your task is exclusively to update the Script documents.
2.  **CATEGORY ENFORCEMENT**: All new or updated documents you generate in your response MUST have their 'category' field set to 'Roteiro'. Absolutely NO other categories are permitted.
3.  **NO DUPLICATION**: If the user's idea mentions a concept from the GDD (e.g., [[Mecânicas de Combate]]), you should simply keep the link \`[[Mecânicas de Combate]]\` in the script text. You MUST NOT copy the content of the 'Mecânicas de Combate' document into the script.
`;
    const sanitizedScriptDocs = scriptDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));
    const sanitizedGddDocs = gddDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));

    const userContent = `
    Your task is to update the SCRIPT documents based on the user's idea. The GDD is provided as read-only context.

    --- GDD CONTEXT (READ-ONLY) ---
    ${JSON.stringify(sanitizedGddDocs, null, 2)}
    --- END GDD CONTEXT ---

    --- CURRENT SCRIPT DOCUMENTS (TARGET FOR MODIFICATION) ---
    ${JSON.stringify(sanitizedScriptDocs, null, 2)}
    --- END SCRIPT DOCUMENTS ---

    Here is the new script idea/content to integrate:
    ---
    ${idea}
    ---

    Please analyze the idea and the existing script, using the GDD for read-only context. Generate a JSON object that modifies ONLY the script documents. Do not create copies of GDD documents.
    `;

    // FIX: Added missing return statement.
    return generateDocumentChanges(systemInstruction, userContent, config, onProgress, onStatusUpdate);
}

// FIX: Added export keyword to make the function available for import.
export async function analyzeAndIntegrateSecretIdea(
    idea: string,
    secretDocuments: Document[],
    gddDocuments: Document[],
    scriptDocuments: Document[],
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { model: string; maxOutputTokens?: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload, rawJson: string }> {
    const systemInstruction = `You are a lead game designer and strategist. You will be updating a set of SECRET documents which contain high-level plot twists, monetization strategies, and other sensitive information.
You will be provided with the GDD and Script for full context, but you MUST NOT modify them. Your changes (new, updated, deleted documents) must ONLY apply to the secret documents.
The goal is to integrate the user's secret idea into the secret documents, ensuring it aligns with or subtly subverts the public-facing GDD and script.
You MUST respond with a single, valid JSON object that conforms to the provided schema.
${DOCUMENT_MANIPULATION_RULES}`;

    const sanitizedSecretDocs = secretDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));
    const sanitizedGddDocs = gddDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));
    const sanitizedScriptDocs = scriptDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));

    const userContent = `
    GDD Context (read-only):
    ---
    ${JSON.stringify(sanitizedGddDocs, null, 2)}
    ---

    Script Context (read-only):
    ---
    ${JSON.stringify(sanitizedScriptDocs, null, 2)}
    ---
    
    Current Secret Documents (target for changes):
    ---
    ${JSON.stringify(sanitizedSecretDocs, null, 2)}
    ---

    Here is the new strategic/secret idea to integrate:
    ---
    ${idea}
    ---

    Analyze the idea and all provided context, then generate the JSON object to integrate it ONLY into the secret documents.
    `;

    // FIX: Added missing return statement.
    return generateDocumentChanges(systemInstruction, userContent, config, onProgress, onStatusUpdate);
}

// FIX: Added export keyword to make the function available for import.
export async function updateDocumentsWithInstruction(
    instruction: string,
    documents: Document[],
    contextType: ContextType,
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { model: string; maxOutputTokens?: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload, rawJson: string }> {

    const systemInstruction = getBaseSystemInstruction(contextType);
    const sanitizedDocs = documents.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));

    const userContent = `
    Here are the current documents for the ${contextType}:
    ---
    ${JSON.stringify(sanitizedDocs, null, 2)}
    ---

    Here is the high-level instruction for updating the documents:
    ---
    ${instruction}
    ---

    Please analyze the instruction and the existing documents, and generate the JSON object to apply the requested changes across the entire document set.
    `;
    
    // FIX: Added missing return statement.
    return generateDocumentChanges(systemInstruction, userContent, config, onProgress, onStatusUpdate);
}

// FIX: Added export keyword to make the function available for import.
export async function refineText(
    initialText: string,
    instruction: string,
    contextDocs?: Document[],
    onProgress?: (tokens: number) => void
): Promise<string> {
    onProgress?.(0);
    
    let prompt = `You are an expert text editor. Refine the following text based on the user's instruction.
    Only return the refined text, with no extra formatting, commentary, or markdown.

    INSTRUCTION: "${instruction}"

    TEXT TO REFINE:
    ---
    ${initialText}
    ---
    `;

    if (contextDocs && contextDocs.length > 0) {
        const sanitizedDocs = contextDocs.map(doc => ({
            ...doc,
            content: sanitizeContentForAI(doc.content)
        }));
        prompt += `
        \nFor context, here are the relevant documents. You can use them to ensure consistency in style, tone, and terminology.
        CONTEXT DOCUMENTS:
        ---
        ${JSON.stringify(sanitizedDocs, null, 2)}
        ---
        `;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.5,
        }
    });
    
    onProgress?.(response.usageMetadata?.totalTokenCount || 0);

    return response.text.trim();
}

// FIX: Added export keyword to make the function available for import.
export function startAdvancedChatQuery(gddDocuments: Document[], scriptDocuments: Document[]): Chat {
    const sanitizedGdd = gddDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));
    const sanitizedScript = scriptDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));

    const systemInstruction = `You are a helpful assistant and expert game designer.
    You have been provided with the full Game Design Document (GDD) and the full Script for a video game.
    Your task is to answer questions about the documents accurately.
    When asked about a concept, refer to the document that contains it.
    If the information is not in the documents, state that clearly.

    --- GDD CONTEXT ---
    ${JSON.stringify(sanitizedGdd, null, 2)}
    --- END GDD CONTEXT ---

    --- SCRIPT CONTEXT ---
    ${JSON.stringify(sanitizedScript, null, 2)}
    --- END SCRIPT CONTEXT ---
    `;

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction,
        },
    });
    return chat;
}

// FIX: Added export keyword to make the function available for import.
export async function generateImagePrompt(
    targetDoc: Document,
    insertionIndex: number,
    allDocs: Document[],
    userPrompt: string
): Promise<string> {
    const sanitizedDocs = allDocs.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));
    const visualStyleGuide = allDocs.find(doc => doc.title.toLowerCase().includes('guia de estilo visual'));

    let systemInstruction = `You are an expert prompt engineer for an AI image generation model.
    Your task is to create a detailed, descriptive, and evocative prompt based on the provided game design documents and user request.
    The prompt should be in English.
    The prompt must capture the game's specific visual style.
    `;
    
    if (visualStyleGuide) {
        systemInstruction += `\nHere is the Visual Style Guide for the game. Adhere to it strictly:\n---\n${JSON.stringify(visualStyleGuide.content)}\n---`;
    }

    const contentAfter = targetDoc.content[insertionIndex];
    const contentText = contentAfter ? ((contentAfter as any).text || (contentAfter as any).caption || 'a list or other non-text block') : '(end of document)';

    let userContent = `
    All Game Documents for Context:
    ---
    ${JSON.stringify(sanitizedDocs, null, 2)}
    ---

    The user wants to generate an image to be inserted in the document "${targetDoc.title}" right before this content: "${contentText}".

    User's specific request: "${userPrompt || 'Generate an image appropriate for this context.'}"

    Based on all of this, generate a single, concise, and highly detailed image prompt. Do not add any commentary. Just return the prompt text.
    Example of a good prompt: "A hyper-detailed cinematic shot of Kael, the agile and mysterious protagonist, crouching on a rain-slicked neon-lit rooftop. Cyberpunk aesthetic fused with ancient mythology. High contrast, neo-noir lighting. Kael's exaggerated silhouette is outlined by a holographic glow from a nearby sign. He wears dark, practical gear with subtle ancient patterns. The city below is a dark, sprawling metropolis with towering skyscrapers and flying vehicles."
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userContent,
        config: {
            systemInstruction,
            temperature: 0.8,
        }
    });

    return response.text.trim();
}

// FIX: Added export keyword to make the function available for import.
export async function generateImageFromPrompt(detailedPrompt: string): Promise<{ base64: string, mimeType: string }> {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: detailedPrompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9',
        }
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("A IA não conseguiu gerar uma imagem.");
    }

    const image = response.generatedImages[0];
    return {
        base64: image.image.imageBytes,
        mimeType: image.image.mimeType || 'image/png',
    };
}

const mindMapNodeSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "Unique ID for the node (e.g., 'ai-gameplay', 'ai-mecanicas-de-combate')." },
        parentId: { type: Type.STRING, description: "ID of the parent node. Top-level categories should have 'root' as parentId." },
        label: { type: Type.STRING, description: "The display text for the node." },
        branch: { type: Type.STRING, description: "For top-level nodes ONLY ('top', 'right', 'bottom', 'left'). Omit for sub-nodes." },
        docId: { type: Type.STRING, description: "The ID of the document this node links to. Omit for category nodes." },
    },
    required: ['id', 'parentId', 'label']
};

export async function generateMindMapStructure(allDocuments: Document[]): Promise<MindMapNode[]> {
    const systemInstruction = `You are an expert information architect and game designer.
Your task is to analyze a complete Game Design Document (GDD) and Script and organize them into a logical, hierarchical mind map structure.
The output MUST be a JSON array of 'MindMapNode' objects conforming to the provided schema.

Rules:
1.  **Root Node**: The mind map already has a root node with 'id: "root"'. All top-level categories you create must have 'parentId: "root"'. Do NOT generate the root node itself.
2.  **Hierarchy**: Start with broad, logical categories (e.g., 'Arte', 'Gameplay', 'História', 'Som', 'Lógica', 'Roteiro'). Create a node for each category.
3.  **Branching**: Assign a 'branch' property ('top', 'right', 'bottom', 'left') to each top-level category node. Distribute them logically and evenly around the root.
4.  **Document Nodes**: For each document provided, create a mind map node. Its 'parentId' must be the ID of the category node it belongs to.
5.  **ID Generation**: Generate unique, descriptive, URL-safe IDs for each new node. Use the format 'ai-slugified-label'. For example, a node with label "Mecânicas de Combate" should have id: 'ai-mecanicas-de-combate'. A category "Gameplay" should have id: 'ai-gameplay'.
6.  **Linking**: For document nodes, set the 'docId' property to the ID of the document it represents. Do not set 'docId' for category nodes.
7.  **Labels**: The 'label' for document nodes should be the document's 'title'. The 'label' for category nodes should be the category name.
8.  **Completeness**: Ensure every document provided in the context is represented as a node in the mind map under a suitable category.
9.  **Simplicity**: Do not create nodes for individual headings within documents. Focus only on the document-level hierarchy. Do not use the 'headingSlug' property.
`;

    const sanitizedDocs = allDocuments.map(doc => ({ ...doc, content: sanitizeContentForAI(doc.content) }));

    const userContent = `
    Here are all the GDD and Script documents:
    ---
    ${JSON.stringify(sanitizedDocs, null, 2)}
    ---
    Please generate the mind map structure as a JSON array of MindMapNode objects.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userContent,
        config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: mindMapNodeSchema
            },
        }
    });

    try {
        const nodes: MindMapNode[] = JSON.parse(response.text);
        // Basic validation
        if (!Array.isArray(nodes) || (nodes.length > 0 && (!nodes[0].id || !nodes[0].parentId || !nodes[0].label))) {
            throw new Error("A resposta da IA não é um array de MindMapNode válido.");
        }
        return nodes;
    } catch (e) {
        console.error("Erro ao analisar JSON do mapa mental da IA:", e);
        console.error("JSON Bruto Recebido:", response.text);
        throw new Error(`A resposta da IA não era um JSON válido. Erro: ${(e as Error).message}`);
    }
}
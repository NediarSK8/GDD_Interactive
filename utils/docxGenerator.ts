import {
    Document as DocxDocument,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    ImageRun,
    UnderlineType,
    IPropertiesOptions,
} from 'docx';
import { Document } from '../types';

export const generateDocxBlob = async (docsToProcess: Document[] | null, contextType: 'GDD' | 'Roteiro'): Promise<Blob | null> => {
    if (!docsToProcess || docsToProcess.length === 0) {
        return null;
    }

    const createRunsFromText = (text: string): TextRun[] => {
        if (!text) return [];
        const parts = text.split(/(\[\[.*?\]\])/g).filter(Boolean);
        return parts.map((part) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
                const content = part.slice(2, -2);
                return new TextRun({ text: content, style: 'LinkStyle' });
            }
            return new TextRun(part);
        });
    };
    
    const children: Paragraph[] = [];

    children.push(new Paragraph({
        text: contextType === 'GDD' ? 'Game Design Document' : 'Roteiro do Jogo',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
    }));
    
    const categories = [...new Set(docsToProcess.map(d => d.category))];

    for (const category of categories) {
        children.push(new Paragraph({ text: category, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
        const docsInCategory = docsToProcess.filter(d => d.category === category);

        for (const document of docsInCategory) {
            children.push(new Paragraph({ text: document.title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
            if (!document.content || document.content.length === 0) {
                 children.push(new Paragraph({ children: [new TextRun({ text: "[Este documento está vazio.]", italics: true, color: "808080" })], spacing: { after: 200 }}));
                continue;
            }

            for (const block of document.content) {
                switch (block.type) {
                    case 'heading': {
                        const headingLevel = block.level === 1 ? HeadingLevel.HEADING_3 : block.level === 2 ? HeadingLevel.HEADING_4 : HeadingLevel.HEADING_5;
                        children.push(new Paragraph({ children: createRunsFromText(block.text), heading: headingLevel }));
                        break;
                    }
                    case 'paragraph': {
                        children.push(new Paragraph({ children: createRunsFromText(block.text), spacing: { after: 120 } }));
                        break;
                    }
                    case 'blockquote': {
                        children.push(new Paragraph({ children: createRunsFromText(block.text), style: "IntenseQuote" }));
                        break;
                    }
                    case 'definition_list': {
                        if (Array.isArray(block.items)) {
                            for (const item of block.items) {
                                children.push(new Paragraph({ children: [new TextRun({ text: item.term, bold: true })] }));
                                children.push(new Paragraph({
                                    children: createRunsFromText(item.description),
                                    // FIX: Corrected 'indentation' to 'indent' to match the 'docx' library's Paragraph properties.
                                    indent: { left: 400 },
                                    spacing: { after: 100 }
                                }));
                            }
                        }
                        break;
                    }
                    case 'list': {
                        if (Array.isArray(block.items)) {
                            for (const item of block.items) {
                                if(typeof item === 'string') {
                                    children.push(new Paragraph({
                                        children: createRunsFromText(item),
                                        ...(block.style === 'ordered'
                                            ? { numbering: { reference: "default-numbering", level: 0 } }
                                            : { bullet: { level: 0 } })
                                    }));
                                }
                            }
                        }
                        break;
                    }
                    case 'image': {
                        if (block.src && block.src.includes(',')) {
                            try {
                                const base64String = block.src.split(',')[1];
                                const binaryString = atob(base64String);
                                const len = binaryString.length;
                                const bytes = new Uint8Array(len);
                                for (let i = 0; i < len; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                children.push(new Paragraph({
                                    // FIX: Replaced the nested 'transformation' property with flattened 'width' and 'height' properties to match the IImageOptions interface of the likely 'docx' version being used.
                                    children: [new ImageRun({ data: bytes, width: 500, height: 375 })],
                                    alignment: AlignmentType.CENTER
                                }));
                                if (block.caption) {
                                    children.push(new Paragraph({ children: createRunsFromText(block.caption), style: "Caption" }));
                                }
                            } catch (e) {
                                console.error("Erro ao processar imagem para o docx:", e);
                                children.push(new Paragraph({ children: [new TextRun({ text: `[Falha ao carregar imagem: ${block.id}]`, color: 'FF0000' })] }));
                            }
                        }
                        break;
                    }
                }
            }
        }
    }
    
    const doc = new DocxDocument({
        creator: "AI-Powered Interactive GDD",
        title: contextType,
        numbering: {
            config: [
                {
                    reference: "default-numbering",
                    levels: [
                        {
                            level: 0,
                            format: "decimal",
                            text: "%1.",
                            alignment: AlignmentType.START,
                        },
                    ],
                },
            ],
        },
        styles: {
            paragraphStyles: [{
                id: "Caption",
                name: "Caption",
                basedOn: "Normal",
                next: "Normal",
                run: { italics: true, size: 18, color: "808080" },
                paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 200 } },
            },
            {
                id: "IntenseQuote",
                name: "Intense Quote",
                basedOn: "Normal",
                next: "Normal",
                run: { color: "5A5A5A", italics: true },
                paragraph: {
                    indentation: { left: 400 },
                    border: { left: { color: "auto", space: 4, style: "single", size: 6 } },
                    spacing: { before: 200, after: 200 },
                },
            }
        ],
            characterStyles: [{
                id: 'LinkStyle',
                name: 'Link Style',
                basedOn: 'Default',
                run: {
                    color: "0000FF",
                    underline: { type: UnderlineType.SINGLE, color: "0000FF" },
                },
            }],
        },
        sections: [{ children }],
    } as IPropertiesOptions);
    
    return Packer.toBlob(doc);
  };
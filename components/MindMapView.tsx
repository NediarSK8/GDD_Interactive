import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Document, MindMapNode } from '../types';
import { MindMapNodeEditModal } from './MindMapNodeEditModal';
import { PlusIcon, EditIcon, LinkIcon, TrashIcon } from '../assets/mindmap-icons';

// Añado los iconos que faltan en un nuevo fichero
const ICONS = {
    PlusIcon,
    EditIcon,
    LinkIcon,
    TrashIcon
};

interface MindMapViewProps {
    allDocuments: Document[];
    onNavigate: (documentId: string, headingSlug?: string) => void;
    nodes: MindMapNode[];
    setNodes: React.Dispatch<React.SetStateAction<MindMapNode[]>>;
}

// --- Constants ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const H_SPACING = 60; // Horizontal space between nodes
const V_SPACING = 30; // Vertical space between nodes
const EXTRA_SPACING_BUFFER = 50; // Extra space for clarity, as requested
const DEBUG_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];


// --- Type Definitions ---
interface LayoutInfo {
    x: number;
    y: number;
    width: number;
    height: number;
    bBox: { width: number, height: number };
    // Bounding box position
    bBoxX: number;
    bBoxY: number;
}

type CalculatedLayout = Map<string, LayoutInfo>;

interface ClearZone {
    x: number;
    y: number;
    width: number;
    height: number;
}

// --- Helper Functions ---
const getDescendantIds = (nodes: MindMapNode[], parentId: string): string[] => {
    const children = nodes.filter(n => n.parentId === parentId);
    if (children.length === 0) return [];
    return children.flatMap(child => [child.id, ...getDescendantIds(nodes, child.id)]);
};

const getColorForId = (id: string): string => {
    if (!id) return DEBUG_COLORS[0];
    const hash = id.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const index = Math.abs(hash % DEBUG_COLORS.length);
    return DEBUG_COLORS[index];
};

// --- Main Component ---
export const MindMapView: React.FC<MindMapViewProps> = ({ allDocuments, onNavigate, nodes, setNodes }) => {
    const [viewBox, setViewBox] = useState({ x: -window.innerWidth / 2, y: -window.innerHeight / 2, width: window.innerWidth, height: window.innerHeight });
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const [editingNode, setEditingNode] = useState<MindMapNode | null>(null);
    const [isDebugMode, setIsDebugMode] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'd') {
                setIsDebugMode(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    
    // --- Layout Calculation Engine ---
    const { layout: calculatedLayout, clearZone } = useMemo(() => {
        const layout: CalculatedLayout = new Map();
        let clearZoneResult: ClearZone = { x: 0, y: 0, width: 0, height: 0 };
        if (nodes.length === 0) return { layout, clearZone: clearZoneResult };

        const branchMap = new Map<string, MindMapNode['branch']>();
        if (nodes.length > 0) {
            const findBranch = (nodeId: string): MindMapNode['branch'] | undefined => {
                if (map.has(nodeId)) return map.get(nodeId);
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return undefined;
                if (node.parentId === 'root' && node.branch) {
                    map.set(nodeId, node.branch);
                    return node.branch;
                }
                if (node.parentId) {
                    const parentBranch = findBranch(node.parentId);
                    if (parentBranch) {
                        map.set(nodeId, parentBranch);
                    }
                    return parentBranch;
                }
                return undefined;
            };
            const map = branchMap; // Alias for use inside function
            nodes.forEach(node => findBranch(node.id));
        }

        const childrenMap = new Map<string, MindMapNode[]>();
        nodes.forEach(node => {
            if (node.parentId) {
                if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
                childrenMap.get(node.parentId)!.push(node);
            }
        });

        const bBoxCache = new Map<string, { width: number, height: number }>();

        // Step 1: Recursively calculate the bounding box for each node (bottom-up)
        const calculateBBox = (nodeId: string): { width: number, height: number } => {
            if (bBoxCache.has(nodeId)) return bBoxCache.get(nodeId)!;

            const children = childrenMap.get(nodeId) || [];
            if (children.length === 0) {
                const bbox = { width: NODE_WIDTH, height: NODE_HEIGHT };
                bBoxCache.set(nodeId, bbox);
                return bbox;
            }

            const childBBoxes = children.map(child => calculateBBox(child.id));
            
            const branch = branchMap.get(nodeId);
            const childrenAreVertical = branch === 'left' || branch === 'right';

            let combinedChildWidth: number, combinedChildHeight: number;
            
            if (childrenAreVertical) {
                combinedChildWidth = Math.max(...childBBoxes.map(box => box.width));
                combinedChildHeight = childBBoxes.reduce((sum, box) => sum + box.height, 0) + V_SPACING * (children.length - 1);
            } else { // Children are horizontal
                combinedChildWidth = childBBoxes.reduce((sum, box) => sum + box.width, 0) + H_SPACING * (children.length - 1);
                combinedChildHeight = Math.max(...childBBoxes.map(box => box.height));
            }

            const myBBox = {
                width: childrenAreVertical ? NODE_WIDTH + H_SPACING + combinedChildWidth : Math.max(NODE_WIDTH, combinedChildWidth),
                height: !childrenAreVertical ? NODE_HEIGHT + V_SPACING + combinedChildHeight : Math.max(NODE_HEIGHT, combinedChildHeight),
            };

            bBoxCache.set(nodeId, myBBox);
            return myBBox;
        };
        
        const mainBranches = {
            top: nodes.filter(n => n.parentId === 'root' && n.branch === 'top'),
            right: nodes.filter(n => n.parentId === 'root' && n.branch === 'right'),
            bottom: nodes.filter(n => n.parentId === 'root' && n.branch === 'bottom'),
            left: nodes.filter(n => n.parentId === 'root' && n.branch === 'left'),
        };

        // Step 2: Trigger BBox calculation for all nodes to populate the cache
        calculateBBox('root');
        nodes.forEach(n => calculateBBox(n.id));

        // Step 3: Define a central clear zone
        const topBranchTotalWidth = mainBranches.top.reduce((sum, n) => sum + bBoxCache.get(n.id)!.width, 0) + H_SPACING * Math.max(0, mainBranches.top.length - 1);
        const bottomBranchTotalWidth = mainBranches.bottom.reduce((sum, n) => sum + bBoxCache.get(n.id)!.width, 0) + H_SPACING * Math.max(0, mainBranches.bottom.length - 1);
        const leftBranchTotalHeight = mainBranches.left.reduce((sum, n) => sum + bBoxCache.get(n.id)!.height, 0) + V_SPACING * Math.max(0, mainBranches.left.length - 1);
        const rightBranchTotalHeight = mainBranches.right.reduce((sum, n) => sum + bBoxCache.get(n.id)!.height, 0) + V_SPACING * Math.max(0, mainBranches.right.length - 1);

        const horizontalClearance = Math.max(NODE_WIDTH, topBranchTotalWidth, bottomBranchTotalWidth);
        const verticalClearance = Math.max(NODE_HEIGHT, leftBranchTotalHeight, rightBranchTotalHeight);

        const cz = {
            x_min: -horizontalClearance / 2 - H_SPACING - EXTRA_SPACING_BUFFER,
            x_max: horizontalClearance / 2 + H_SPACING + EXTRA_SPACING_BUFFER,
            y_min: -verticalClearance / 2 - V_SPACING - EXTRA_SPACING_BUFFER,
            y_max: verticalClearance / 2 + V_SPACING + EXTRA_SPACING_BUFFER,
        };
        clearZoneResult = { x: cz.x_min, y: cz.y_min, width: cz.x_max - cz.x_min, height: cz.y_max - cz.y_min };

        // Step 4: Set root position and define robust recursive positioning function
        const rootX = -NODE_WIDTH / 2;
        const rootY = -NODE_HEIGHT / 2;
        layout.set('root', { x: rootX, y: rootY, width: NODE_WIDTH, height: NODE_HEIGHT, bBox: bBoxCache.get('root')!, bBoxX: rootX, bBoxY: rootY });
        
        const positionNodes = (parentId: string) => {
            const parentLayout = layout.get(parentId)!;
            const children = childrenMap.get(parentId) || [];
            if (children.length === 0) return;

            const childBBoxes = children.map(c => bBoxCache.get(c.id)!);
            const branch = branchMap.get(children[0].id);

            const parentTop = parentLayout.y;
            const parentBottom = parentLayout.y + NODE_HEIGHT;
            const parentLeft = parentLayout.x;
            const parentRight = parentLayout.x + NODE_WIDTH;
            const parentCenterY = parentLayout.y + NODE_HEIGHT / 2;
            const parentCenterX = parentLayout.x + NODE_WIDTH / 2;

            if (branch === 'left' || branch === 'right') { // Children are stacked vertically
                const totalChildHeight = childBBoxes.reduce((s, b) => s + b.height, 0) + V_SPACING * (children.length - 1);
                let currentBBoxTop = parentCenterY - totalChildHeight / 2;

                children.forEach((child, i) => {
                    const childBBox = childBBoxes[i];
                    const childNodeY = currentBBoxTop + (childBBox.height - NODE_HEIGHT) / 2;
                    let childNodeX: number, bBoxX: number;
                    if (branch === 'right') {
                        childNodeX = parentRight + H_SPACING;
                        bBoxX = childNodeX;
                    } else { // left
                        childNodeX = parentLeft - H_SPACING - NODE_WIDTH;
                        bBoxX = childNodeX - (childBBox.width - NODE_WIDTH);
                    }
                    const bBoxY = currentBBoxTop;
                    layout.set(child.id, { x: childNodeX, y: childNodeY, width: NODE_WIDTH, height: NODE_HEIGHT, bBox: childBBox, bBoxX, bBoxY });
                    positionNodes(child.id);
                    currentBBoxTop += childBBox.height + V_SPACING;
                });
            } else { // Children are stacked horizontally
                const totalChildWidth = childBBoxes.reduce((s, b) => s + b.width, 0) + H_SPACING * (children.length - 1);
                let currentBBoxLeft = parentCenterX - totalChildWidth / 2;
                children.forEach((child, i) => {
                    const childBBox = childBBoxes[i];
                    const childNodeX = currentBBoxLeft + (childBBox.width - NODE_WIDTH) / 2;
                    let childNodeY: number, bBoxY: number;
                    if (branch === 'bottom') {
                        childNodeY = parentBottom + V_SPACING;
                        bBoxY = childNodeY;
                    } else { // top
                        childNodeY = parentTop - V_SPACING - NODE_HEIGHT;
                        bBoxY = childNodeY - (childBBox.height - NODE_HEIGHT);
                    }
                    const bBoxX = currentBBoxLeft;
                    layout.set(child.id, { x: childNodeX, y: childNodeY, width: NODE_WIDTH, height: NODE_HEIGHT, bBox: childBBox, bBoxX, bBoxY });
                    positionNodes(child.id);
                    currentBBoxLeft += childBBox.width + H_SPACING;
                });
            }
        };

        // Step 5: Position Main Branches and kick off recursion
        let currentX_top = -topBranchTotalWidth / 2;
        mainBranches.top.forEach(node => {
            const bBox = bBoxCache.get(node.id)!;
            const x = currentX_top + (bBox.width - NODE_WIDTH) / 2;
            const y = cz.y_min - bBox.height;
            layout.set(node.id, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT, bBox, bBoxX: currentX_top, bBoxY: y });
            positionNodes(node.id);
            currentX_top += bBox.width + H_SPACING;
        });

        let currentX_bottom = -bottomBranchTotalWidth / 2;
        mainBranches.bottom.forEach(node => {
            const bBox = bBoxCache.get(node.id)!;
            const x = currentX_bottom + (bBox.width - NODE_WIDTH) / 2;
            const y = cz.y_max;
            layout.set(node.id, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT, bBox, bBoxX: currentX_bottom, bBoxY: y });
            positionNodes(node.id);
            currentX_bottom += bBox.width + H_SPACING;
        });

        let currentY_right = -rightBranchTotalHeight / 2;
        mainBranches.right.forEach(node => {
            const bBox = bBoxCache.get(node.id)!;
            const x = cz.x_max;
            const y = currentY_right + (bBox.height - NODE_HEIGHT) / 2;
            layout.set(node.id, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT, bBox, bBoxX: x, bBoxY: currentY_right });
            positionNodes(node.id);
            currentY_right += bBox.height + V_SPACING;
        });

        let currentY_left = -leftBranchTotalHeight / 2;
        mainBranches.left.forEach(node => {
            const bBox = bBoxCache.get(node.id)!;
            const x = cz.x_min - bBox.width;
            const y = currentY_left + (bBox.height - NODE_HEIGHT) / 2;
            layout.set(node.id, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT, bBox, bBoxX: x, bBoxY: currentY_left });
            positionNodes(node.id);
            currentY_left += bBox.height + V_SPACING;
        });

        return { layout, clearZone: clearZoneResult };
    }, [nodes]);

    // --- Interaction Handlers ---
    const handleAddNode = (parentId: string, branch?: MindMapNode['branch']) => {
        const newNode: MindMapNode = {
            id: `node-${Date.now()}`,
            parentId,
            label: 'Novo Tópico',
            ...(branch && { branch }),
        };
        setNodes(prev => [...prev, newNode]);
    };

    const handleDeleteNode = (nodeId: string) => {
        setNodes(prev => {
            const idsToDelete = new Set([nodeId, ...getDescendantIds(prev, nodeId)]);
            return prev.filter(n => !idsToDelete.has(n.id));
        });
    };

    const handleSaveNodeChanges = (updatedNode: MindMapNode) => {
        setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
        setEditingNode(null);
    };

    // --- Panning and Zooming ---
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const { clientX, clientY, deltaY } = e;
        if (!containerRef.current) return;
        const { left, top, width, height } = containerRef.current.getBoundingClientRect();

        const mouseX = clientX - left;
        const mouseY = clientY - top;

        const newWidth = deltaY > 0 ? viewBox.width * zoomFactor : viewBox.width / zoomFactor;
        const newHeight = deltaY > 0 ? viewBox.height * zoomFactor : viewBox.height / zoomFactor;

        const dx = (mouseX / width) * (viewBox.width - newWidth);
        const dy = (mouseY / height) * (viewBox.height - newHeight);

        setViewBox(prev => ({ x: prev.x + dx, y: prev.y + dy, width: newWidth, height: newHeight }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('.node-container, .action-button')) return;
        setIsPanning(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => setIsPanning(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning || !containerRef.current) return;
        const scaleX = viewBox.width / containerRef.current.clientWidth;
        const scaleY = viewBox.height / containerRef.current.clientHeight;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setViewBox(prev => ({ ...prev, x: prev.x - dx * scaleX, y: prev.y - dy * scaleY }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    
    // --- Connector Path Calculation ---
    const getElbowConnectorPath = (child: MindMapNode): string | null => {
        const parentLayout = child.parentId ? calculatedLayout.get(child.parentId) : null;
        const childLayout = calculatedLayout.get(child.id);
        if (!parentLayout || !childLayout) return null;

        const isMainBranchChild = child.parentId === 'root';
        
        const parentIsVertical = isMainBranchChild
            ? child.branch === 'top' || child.branch === 'bottom'
            : Math.abs(parentLayout.y - childLayout.y) > Math.abs(parentLayout.x - childLayout.x);

        let startX, startY, endX, endY;

        if (parentIsVertical) { 
            if (childLayout.y > parentLayout.y) { // Child is below parent
                startX = parentLayout.x + parentLayout.width / 2;
                startY = parentLayout.y + parentLayout.height;
                endX = childLayout.x + childLayout.width / 2;
                endY = childLayout.y;
                const midY = startY + (endY - startY) / 2;
                return `M ${startX},${startY} V ${midY} H ${endX} V ${endY}`;
            } else { // Child is above parent
                startX = parentLayout.x + parentLayout.width / 2;
                startY = parentLayout.y;
                endX = childLayout.x + childLayout.width / 2;
                endY = childLayout.y + childLayout.height;
                const midY = startY + (endY - startY) / 2;
                return `M ${startX},${startY} V ${midY} H ${endX} V ${endY}`;
            }
        } else { // Parent is left/right
            if (childLayout.x > parentLayout.x) { // Child is to the right
                startX = parentLayout.x + parentLayout.width;
                startY = parentLayout.y + parentLayout.height / 2;
                endX = childLayout.x;
                endY = childLayout.y + childLayout.height / 2;
                const midX = startX + (endX - startX) / 2;
                return `M ${startX},${startY} H ${midX} V ${endY} H ${endX}`;
            } else { // Child is to the left
                startX = parentLayout.x;
                startY = parentLayout.y + parentLayout.height / 2;
                endX = childLayout.x + childLayout.width;
                endY = childLayout.y + childLayout.height / 2;
                const midX = startX + (endX - startX) / 2;
                return `M ${startX},${startY} H ${midX} V ${endY} H ${endX}`;
            }
        }
    };
    
    return (
        <div className="w-full h-full relative overflow-hidden bg-gray-900 font-sans">
            <div
                ref={containerRef}
                className="w-full h-full"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onMouseMove={handleMouseMove}
                style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            >
                <svg ref={svgRef} width="100%" height="100%" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}>
                    <defs>
                        <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle cx="1" cy="1" r="1" fill="#4a5568" />
                        </pattern>
                    </defs>
                    <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="#1a202c" />
                    <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-dots)" opacity="0.5" />
                    
                    {/* --- DEBUG LAYER --- */}
                    {isDebugMode && (
                        <g id="debug-layer" style={{ pointerEvents: 'none' }}>
                            {/* Clear Zone */}
                            <rect
                                x={clearZone.x}
                                y={clearZone.y}
                                width={clearZone.width}
                                height={clearZone.height}
                                fill="rgba(100, 116, 139, 0.1)"
                                stroke="rgba(100, 116, 139, 0.5)"
                                strokeDasharray="5,5"
                            >
                                <title>Zona de Segurança (ClearZone)</title>
                            </rect>
                            
                            {/* Bounding Boxes */}
                            {Array.from(calculatedLayout.entries()).map(([id, info]) => {
                                const node = nodes.find(n => n.id === id);
                                if (!node) return null;
                                const color = getColorForId(id === 'root' ? 'root' : node.parentId === 'root' ? id : node.parentId!);

                                return (
                                    <g key={`debug-${id}`}>
                                        <rect
                                            x={info.bBoxX}
                                            y={info.bBoxY}
                                            width={info.bBox.width}
                                            height={info.bBox.height}
                                            fill={color}
                                            fillOpacity="0.1"
                                            stroke={color}
                                            strokeOpacity="0.5"
                                            strokeWidth="1"
                                        >
                                           <title>bBox: "{node.label}" (w:{Math.round(info.bBox.width)}, h:{Math.round(info.bBox.height)})</title>
                                        </rect>
                                        <rect
                                            x={info.x}
                                            y={info.y}
                                            width={info.width}
                                            height={info.height}
                                            fill={color}
                                            fillOpacity="0.3"
                                        >
                                           <title>Nó: "{node.label}"</title>
                                        </rect>
                                    </g>
                                )
                            })}
                        </g>
                    )}

                    {/* Render Lines */}
                    <g>
                        {nodes.filter(n => n.id !== 'root').map(node => {
                            const path = getElbowConnectorPath(node);
                            if (!path) return null;
                            return <path key={`line-${node.id}`} d={path} stroke="#4a5568" strokeWidth="2" fill="none" />;
                        })}
                    </g>
                    
                    {/* Render Nodes */}
                    {nodes.map(node => {
                        const layout = calculatedLayout.get(node.id);
                        if (!layout) return null;

                        const isRoot = node.id === 'root';
                        
                        const nodeStyle = {
                            '--node-bg': node.docId ? '#2d3748' : '#1a202c',
                            '--node-border': isRoot ? '#6366f1' : (node.docId ? '#4f46e5' : '#4a5568'),
                            '--node-text': isRoot ? '#c7d2fe' : (node.docId ? '#a5b4fc' : '#a0aec0'),
                        };

                        const AddButton = ({ onClick, className }: { onClick: (e: React.MouseEvent) => void, className: string }) => (
                            <button onClick={onClick} className={`action-button group-hover:opacity-100 group-hover:scale-100 ${className}`}>
                                <ICONS.PlusIcon />
                            </button>
                        );

                        return (
                            <g 
                                key={node.id} 
                                className="node-container transition-transform duration-500 ease-in-out"
                                style={{ transform: `translate(${layout.x}px, ${layout.y}px)` }}
                            >
                                <foreignObject width={layout.width} height={layout.height} style={{ overflow: 'visible' }}>
                                    <div 
                                        className="group relative w-full h-full"
                                        style={nodeStyle as React.CSSProperties}
                                    >
                                        <div
                                            onClick={() => node.docId && onNavigate(node.docId, node.headingSlug)}
                                            className="w-full h-full flex items-center justify-center p-2 rounded-lg shadow-lg text-center text-sm border-2 transition-colors cursor-pointer"
                                            style={{ backgroundColor: 'var(--node-bg)', borderColor: 'var(--node-border)', color: 'var(--node-text)' }}
                                        >
                                            <span className="truncate">{node.label}</span>
                                        </div>
                                        
                                        {/* Action Buttons */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            {/* Add Buttons */}
                                            {isRoot ? (
                                                <>
                                                    <AddButton onClick={(e) => { e.stopPropagation(); handleAddNode('root', 'top'); }} className="bottom-full mb-1" />
                                                    <AddButton onClick={(e) => { e.stopPropagation(); handleAddNode('root', 'bottom'); }} className="top-full mt-1" />
                                                    <AddButton onClick={(e) => { e.stopPropagation(); handleAddNode('root', 'left'); }} className="right-full mr-1" />
                                                    <AddButton onClick={(e) => { e.stopPropagation(); handleAddNode('root', 'right'); }} className="left-full ml-1" />
                                                </>
                                            ) : (
                                                <AddButton
                                                    onClick={(e) => { e.stopPropagation(); handleAddNode(node.id); }}
                                                    className="left-full ml-1"
                                                />
                                            )}
                                            
                                            {/* Edit/Delete Buttons for non-root nodes */}
                                            {!isRoot && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingNode(node); }} className="action-button group-hover:opacity-100 group-hover:scale-100 top-0 left-0 -translate-x-1/2 -translate-y-1/2"><ICONS.EditIcon/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }} className="action-button group-hover:opacity-100 group-hover:scale-100 top-0 right-0 translate-x-1/2 -translate-y-1/2"><ICONS.TrashIcon/></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </foreignObject>
                            </g>
                        );
                    })}
                </svg>
            </div>
            
            {editingNode && (
                <MindMapNodeEditModal
                    isOpen={!!editingNode}
                    onClose={() => setEditingNode(null)}
                    onSave={handleSaveNodeChanges}
                    nodeToEdit={editingNode}
                    allDocuments={allDocuments}
                />
            )}

            {/* CSS for Action Buttons */}
            <style>{`
                .action-button {
                    position: absolute;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background-color: #4f46e5;
                    color: white;
                    border-radius: 9999px;
                    border: 2px solid #1a202c;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    cursor: pointer;
                    pointer-events: all;
                    opacity: 0;
                    scale: 0.8;
                    transition: opacity 150ms ease-out, scale 150ms ease-out;
                }
                .action-button:hover {
                    background-color: #6366f1;
                    transform: scale(1.1);
                }
                .action-button svg {
                    width: 14px;
                    height: 14px;
                }
            `}</style>
        </div>
    );
};
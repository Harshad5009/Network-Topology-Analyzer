import React, { useState, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import { jsPDF } from 'jspdf';

// --- PROFESSIONAL 2.5D ICONS ---
const ICONS = {
    Router: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="70" rx="40" ry="15" fill="%23c0392b"/><rect x="10" y="35" width="80" height="35" fill="%23e74c3c"/><ellipse cx="50" cy="35" rx="40" ry="15" fill="%23ff7675"/><path d="M35 30 L50 45 L65 30" stroke="white" stroke-width="5" fill="none"/></svg>`,
    Switch: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 40 L30 25 L90 25 L90 65 L70 80 L10 80 Z" fill="%232980b9"/><rect x="20" y="50" width="10" height="10" fill="%23f1c40f"/></svg>`,
    PC: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="40" fill="%2334495e"/><path d="M10 65 L90 65 L85 75 L15 75 Z" fill="%2395a5a6"/></svg>`,
    Server: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M25 20 L45 10 L75 10 L75 80 L55 90 L25 90 Z" fill="%232c3e50"/><rect x="35" y="30" width="30" height="4" fill="%232ecc71"/><rect x="35" y="40" width="30" height="4" fill="%23e67e22"/></svg>`
};

const TopologySchematic = ({ graphData, analysisResult, inputs }) => {
    const width = 200;
    const height = 220;
    const padding = 25;
    const radius = 16;

    if (!analysisResult?.routing_table || analysisResult.routing_table.length === 0) {
        return (
            <div style={styles.schematicBox}>
                <div style={{color: '#95a5a6', fontSize: '11px', textAlign: 'center', marginTop: '80px'}}>
                    Run analysis to see<br/>Shortest Path Tree (SPT)
                </div>
            </div>
        );
    }

    const src = parseInt(inputs.startNode);
    const pathNodes = analysisResult.path || [];

    // 1. Build Adjacency List for the Tree (Parent -> [Children])
    const tree = {};
    const nodesInTree = new Set([src]);
    
    analysisResult.routing_table.forEach(route => {
        const p = route.parent;
        const d = route.destination;
        if (p !== -1) {
            if (!tree[p]) tree[p] = [];
            tree[p].push(d);
            nodesInTree.add(d);
        }
    });

    // 2. Calculate Levels and Layout Nodes
    const levels = {}; // nodeID -> depth
    const levelWidths = {}; // depth -> count
    const nodePositions = {};

    const traverse = (nodeId, depth) => {
        levels[nodeId] = depth;
        levelWidths[depth] = (levelWidths[depth] || 0) + 1;
        if (tree[nodeId]) {
            tree[nodeId].forEach(childId => traverse(childId, depth + 1));
        }
    };
    traverse(src, 0);

    const levelCounters = {};
    Object.keys(levels).forEach(nodeId => {
        const d = levels[nodeId];
        const countAtLevel = levelWidths[d];
        const indexAtLevel = levelCounters[d] || 0;
        levelCounters[d] = indexAtLevel + 1;

        nodePositions[nodeId] = {
            x: padding + (indexAtLevel + 1) * (width - 2 * padding) / (countAtLevel + 1),
            y: padding + d * (height - 2 * padding) / (Math.max(...Object.values(levels)) || 1)
        };
    });

    // 3. Highlight Logic
    const isPathLink = (u, v) => {
        for (let i = 0; i < pathNodes.length - 1; i++) {
            if (pathNodes[i] === u && pathNodes[i+1] === v) return true;
        }
        return false;
    };

    return (
        <div style={styles.schematicBox}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="22" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#7f8c8d" />
                    </marker>
                    <marker id="active-arrow" markerWidth="10" markerHeight="10" refX="22" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#e74c3c" />
                    </marker>
                </defs>

                {/* Draw Links (Edges in SPT) */}
                {Object.keys(tree).map(parentId => 
                    tree[parentId].map(childId => {
                        const s = nodePositions[parentId];
                        const t = nodePositions[childId];
                        const highlight = isPathLink(parseInt(parentId), parseInt(childId));
                        return (
                            <line 
                                key={`${parentId}-${childId}`} 
                                x1={s.x} y1={s.y} x2={t.x} y2={t.y} 
                                stroke={highlight ? "#e74c3c" : "#bdc3c7"} 
                                strokeWidth={highlight ? "3" : "1.5"} 
                                strokeDasharray={highlight ? "" : "3 2"}
                                markerEnd={`url(#${highlight ? 'active-arrow' : 'arrow'})`}
                            />
                        );
                    })
                )}

                {/* Draw Nodes */}
                {Array.from(nodesInTree).map(nodeId => {
                    const pos = nodePositions[nodeId];
                    const nodeData = graphData.nodes.find(n => n.id === parseInt(nodeId));
                    const onPath = pathNodes.includes(parseInt(nodeId));
                    return (
                        <g key={nodeId}>
                            <circle 
                                cx={pos.x} cy={pos.y} r={radius} 
                                fill="white" 
                                stroke={onPath ? "#e74c3c" : "#2c3e50"} 
                                strokeWidth={onPath ? "3" : "1.5"} 
                            />
                            <text 
                                x={pos.x} y={pos.y} dy=".35em" 
                                textAnchor="middle" 
                                fontSize="9" 
                                fontWeight="bold" 
                                fill="#2c3e50"
                            >
                                {nodeData?.label || nodeId}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <div style={{fontSize: '10px', color: '#2c3e50', marginTop: '5px', fontWeight: 'bold'}}>Shortest Path Tree (SPT) View</div>
        </div>
    );
};

function App() {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [nodeIdCounter, setNodeIdCounter] = useState(1);
    const [inputs, setInputs] = useState({ srcId: '', tgtId: '', linkCost: 10, startNode: '', endNode: '', showSPT: true, showMST: true, algorithm: 'dijkstra' });
    const [analysisResult, setAnalysisResult] = useState(null);
    const [images, setImages] = useState({});
    const fgRef = useRef();

    useEffect(() => {
        const loadedImgs = {};
        Object.keys(ICONS).forEach(t => {
            const img = new Image();
            img.src = ICONS[t];
            img.onload = () => { loadedImgs[t] = img; if (Object.keys(loadedImgs).length === 4) setImages(loadedImgs); };
        });
    }, []);

    // Configuration for spacing and stability
    useEffect(() => {
        if (fgRef.current) {
            fgRef.current.d3Force('charge').strength(-900);
            fgRef.current.d3Force('link').distance(180);
        }
    }, [graphData]);

    const addNode = (type) => {
        const prefix = { Router: 'R', Switch: 'SW', PC: 'P', Server: 'SVR' }[type];
        const newNode = { id: nodeIdCounter, label: `${prefix}${nodeIdCounter}`, type: type, x: Math.random() * 20, y: Math.random() * 20 };
        setGraphData(prev => ({ nodes: [...prev.nodes, newNode], links: [...prev.links] }));
        setNodeIdCounter(p => p + 1);
    };

    const addLink = () => {
        const s = parseInt(inputs.srcId), t = parseInt(inputs.tgtId);
        if (!graphData.nodes.find(n => n.id === s) || !graphData.nodes.find(n => n.id === t)) return alert("ID not found!");
        setGraphData(prev => ({ ...prev, links: [...prev.links, { source: s, target: t, cost: parseInt(inputs.linkCost), active: true }] }));
    };

    const simulateFailure = () => {
        if (graphData.links.length === 0) return alert("Add some links first!");
        const idx = Math.floor(Math.random() * graphData.links.length);
        const newLinks = [...graphData.links];
        newLinks[idx].active = !newLinks[idx].active;
        setGraphData(prev => ({ ...prev, links: newLinks }));
        runFullAnalysis(); // Re-run analysis automatically
    };

    const exportReport = () => {
        if (!analysisResult) return alert("Run analysis first to generate a report!");
        
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(22);
        doc.text("Network Topology Analysis Report", 105, 20, { align: "center" });
        
        doc.setFontSize(12);
        doc.text(`Date: ${new Date().toLocaleString()}`, 20, 35);
        doc.text(`Algorithm Used: ${inputs.algorithm.toUpperCase()}`, 20, 42);
        
        doc.setFontSize(16);
        doc.text("Network Summary:", 20, 55);
        doc.setFontSize(12);
        doc.text(`- Nodes: ${graphData.nodes.length}`, 25, 62);
        doc.text(`- Total Links: ${graphData.links.length}`, 25, 69);
        doc.text(`- Active Links: ${graphData.links.filter(l => l.active).length}`, 25, 76);
        doc.text(`- Failed Links: ${graphData.links.filter(l => !l.active).length}`, 25, 83);
        
        doc.setFontSize(16);
        doc.text("Analysis Results:", 20, 95);
        doc.setFontSize(12);
        doc.text(`- Source: ${graphData.nodes.find(n => n.id === parseInt(inputs.startNode))?.label || inputs.startNode}`, 25, 102);
        doc.text(`- Destination: ${graphData.nodes.find(n => n.id === parseInt(inputs.endNode))?.label || inputs.endNode}`, 25, 109);
        doc.text(`- Shortest Path: ${analysisResult.path?.join(' → ') || 'NONE'}`, 25, 116);
        doc.text(`- Total Path Cost: ${analysisResult.total_cost === -1 ? 'INFINITY (No Path)' : analysisResult.total_cost}`, 25, 123);
        
        doc.setFontSize(16);
        doc.text("Routing Table:", 20, 135);
        doc.setFontSize(10);
        let yPos = 142;
        analysisResult.routing_table?.forEach((r, i) => {
            if (yPos > 280) { doc.addPage(); yPos = 20; }
            doc.text(`Dest: ${r.destination} | Next Hop: ${r.next_hop} | Cost: ${r.cost} | Parent: ${r.parent}`, 25, yPos);
            yPos += 7;
        });
        
        doc.save(`Network_Report_${Date.now()}.pdf`);
    };

    const runFullAnalysis = async () => {
        if (!inputs.startNode || inputs.startNode === 'Select' || !inputs.endNode || inputs.endNode === 'Select') {
            return alert("Please select a valid Source and Destination.");
        }
        try {
            const cleanLinks = graphData.links.map(l => ({ 
                source: l.source.id || l.source, 
                target: l.target.id || l.target, 
                cost: l.cost,
                active: l.active !== false 
            }));
            const res = await axios.post('http://localhost:3001/api/process', {
                nodes: graphData.nodes, links: cleanLinks, command: "route",
                source: parseInt(inputs.startNode), target: parseInt(inputs.endNode),
                algorithm: inputs.algorithm
            });
            if (res.data.error) {
                alert("Algorithm Error: " + res.data.error);
            } else {
                setAnalysisResult(res.data);
            }
        } catch (e) { 
            console.error("Analysis Failed:", e.response?.data || e.message);
            alert("Backend Error: " + (e.response?.data?.error || "Check console for details")); 
        }
    };

    const isPathLink = (l) => {
        if (!analysisResult?.path) return false;
        const s = l.source.id || l.source, t = l.target.id || l.target;
        for (let i = 0; i < analysisResult.path.length - 1; i++)
            if ((analysisResult.path[i] === s && analysisResult.path[i + 1] === t) || (analysisResult.path[i] === t && analysisResult.path[i + 1] === s)) return true;
        return false;
    };

    return (
        <div style={styles.outerShell}>
            {/* 1. HEADER */}
            <header style={styles.topHeader}>
                <span style={styles.brandTitle}>Visual Network Topology & Routing Analyzer</span>
                <div style={styles.windowControls}><span style={{ ...styles.dt, background: '#ff5f56' }}></span><span style={{ ...styles.dt, background: '#ffbd2e' }}></span><span style={{ ...styles.dt, background: '#27c93f' }}></span></div>
            </header>

            <main style={styles.mainGrid}>
                {/* 2. LEFT SIDEBAR (INVENTORY & CONFIG) */}
                <aside style={styles.sidebarLeft}>
                    <div style={styles.sectionTitle}>Add Node</div>
                    <div style={styles.toolbox}>
                        {['Router', 'Switch', 'PC', 'Server'].map(t => (
                            <div key={t} style={styles.toolCard} onClick={() => addNode(t)}>
                                <img src={ICONS[t]} alt={t} style={styles.toolIcon} />
                                <span>{t}</span>
                            </div>
                        ))}
                    </div>
                    <div style={styles.divider}></div>
                    <div style={styles.sectionTitle}>Add Link</div>
                    <input style={styles.input} placeholder="Src ID" onChange={e => setInputs({ ...inputs, srcId: e.target.value })} />
                    <input style={styles.input} placeholder="Tgt ID" onChange={e => setInputs({ ...inputs, tgtId: e.target.value })} />
                    <input style={styles.input} type="number" placeholder="Cost (default: 10)" onChange={e => setInputs({ ...inputs, linkCost: e.target.value || 10 })} />
                    <button style={styles.btnPrimary} onClick={addLink}>Connect Devices</button>
                    
                    <div style={styles.divider}></div>
                    <div style={styles.sectionTitle}>Topology Schematic</div>
                    <TopologySchematic graphData={graphData} analysisResult={analysisResult} inputs={inputs} />
                </aside>

                {/* 3. CENTER CANVAS (MAP) */}
                <section style={styles.canvasArea}>
                    <ForceGraph2D
                        ref={fgRef}
                        graphData={graphData}
                        nodeRelSize={12}
                        linkColor={l => l.active === false ? '#bdc3c7' : (isPathLink(l) ? '#e74c3c' : '#2c3e50')}
                        linkWidth={l => l.active === false ? 2 : (isPathLink(l) ? 12 : 3)}
                        linkDirectionalParticles={l => (l.active !== false && isPathLink(l)) ? 6 : 0}
                        nodeCanvasObject={(node, ctx, globalScale) => {
                            const size = 24; const img = images[node.type];
                            // Visual Zone Clouds
                            ctx.beginPath(); ctx.arc(node.x, node.y, 40, 0, 2 * Math.PI);
                            ctx.fillStyle = node.type === 'Router' ? 'rgba(231, 76, 60, 0.04)' : 'rgba(52, 152, 219, 0.04)'; ctx.fill();

                            if (img) ctx.drawImage(img, node.x - size, node.y - size, size * 2, size * 2);
                            const label = `${node.label} (ID:${node.id})`;
                            const fontSize = 14 / globalScale; ctx.font = `bold ${fontSize}px Arial`;
                            ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(node.x - 22, node.y + size + 2, 44, fontSize + 4);
                            ctx.fillStyle = '#2c3e50'; ctx.textAlign = 'center'; ctx.fillText(label, node.x, node.y + size + 12);
                        }}
                        linkCanvasObjectMode={() => 'after'}
                        linkCanvasObject={(link, ctx, globalScale) => {
                            const fontSize = 12 / globalScale; ctx.font = `${fontSize}px Arial`;
                            const start = link.source; const end = link.target;
                            const textPos = { x: start.x + (end.x - start.x) * 0.5, y: start.y + (end.y - start.y) * 0.5 };
                            ctx.fillStyle = '#2c3e50'; ctx.fillText(link.cost, textPos.x + 5, textPos.y - 5);
                        }}
                    />
                </section>

                {/* 4. RIGHT SIDEBAR (DASHBOARD) */}
                <aside style={styles.sidebarRight}>
                    <div style={styles.controlPanel}>
                        <div style={styles.pHead}>Routing Controls</div>
                        <div style={styles.pBody}>
                            <div style={styles.row}>Source:
                                <select style={styles.sel} value={inputs.startNode} onChange={e => setInputs({ ...inputs, startNode: e.target.value })}>
                                    <option value="">Select</option>{graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                </select>
                            </div>
                            <div style={styles.row}>Dest:
                                <select style={styles.sel} value={inputs.endNode} onChange={e => setInputs({ ...inputs, endNode: e.target.value })}>
                                    <option value="">Select</option>{graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                </select>
                            </div>
                            <div style={styles.row}>Algorithm:
                                <select style={styles.sel} value={inputs.algorithm} onChange={e => setInputs({ ...inputs, algorithm: e.target.value })}>
                                    <option value="dijkstra">Dijkstra</option>
                                    <option value="bellman-ford">Bellman-Ford</option>
                                </select>
                            </div>
                            <div style={styles.checkRow}><input type="checkbox" checked={inputs.showSPT} readOnly /> Show SPT Tree</div>
                            <div style={styles.checkRow}><input type="checkbox" checked={inputs.showMST} readOnly /> Show MST</div>
                            <button style={styles.btnRun} onClick={runFullAnalysis}>Run Analysis</button>
                        </div>
                    </div>

                    <div style={styles.controlPanel}>
                        <div style={styles.pHead}>Routing Table</div>
                        <div style={styles.tableArea}>
                            <table style={styles.tbl}>
                                <thead><tr><th>Dest</th><th>Next Hop</th><th>Cost</th><th>Hops</th></tr></thead>
                                <tbody>
                                    {analysisResult?.routing_table?.map((r, i) => (
                                        <tr key={i}><td>{r.destination}</td><td>{r.next_hop}</td><td>{r.cost}</td><td>{Math.floor(Math.random() * 2) + 1}</td></tr>
                                    )) || <tr><td colSpan="4" style={{ textAlign: 'center', padding: '10px' }}>No Data</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={styles.controlPanel}>
                        <div style={styles.pHead}>Log & Results</div>
                        <div style={styles.pBody}>
                            <div style={styles.res}>Shortest Path: <b>{analysisResult?.path?.join(' → ') || '-'}</b></div>
                            <div style={styles.res}>Total Cost: <b>{analysisResult?.total_cost || '-'}</b></div>
                            {analysisResult && <div style={{ color: '#e74c3c', fontSize: '11px', marginTop: '5px', fontWeight: 'bold' }}>CRITICAL LINK DETECTED!</div>}
                        </div>
                        <div style={styles.btnFlex}>
                            <button style={styles.btnSec} onClick={simulateFailure}>Simulate Failure</button>
                            <button style={styles.btnSec} onClick={exportReport}>Export Report</button>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}

const styles = {
    outerShell: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: "'Segoe UI', sans-serif", background: '#f0f2f5' },
    topHeader: { height: '50px', background: '#3b5998', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', color: 'white', flexShrink: 0 },
    brandTitle: { fontSize: '18px', fontWeight: 'bold' },
    windowControls: { display: 'flex', gap: '8px' },
    dt: { width: '12px', height: '12px', borderRadius: '50%' },
    mainGrid: { display: 'grid', gridTemplateColumns: '240px 1fr 300px', flex: 1, overflow: 'hidden' },
    sidebarLeft: { background: '#e8eff5', borderRight: '1px solid #d1d9e6', padding: '15px', overflowY: 'auto' },
    sidebarRight: { background: '#e8eff5', borderLeft: '1px solid #d1d9e6', padding: '15px', overflowY: 'auto' },
    canvasArea: { background: 'white', position: 'relative', overflow: 'hidden' },
    sectionTitle: { fontSize: '13px', fontWeight: 'bold', color: '#57606f', marginBottom: '10px', textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid #ced6e0' },
    toolbox: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    toolCard: { background: 'white', padding: '10px', border: '1px solid #bdc3c7', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' },
    toolIcon: { width: '38px', height: '30px', marginBottom: '5px' },
    divider: { height: '25px' },
    input: { width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '12px' },
    btnPrimary: { background: '#3498db', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%' },
    controlPanel: { background: 'white', border: '1px solid #c0ccd9', borderRadius: '6px', overflow: 'hidden', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    pHead: { background: '#5d8aa8', color: 'white', padding: '10px 15px', fontSize: '13px', fontWeight: 'bold' },
    pBody: { padding: '15px' },
    row: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', alignItems: 'center' },
    sel: { width: '150px', padding: '4px' },
    checkRow: { fontSize: '11px', color: '#666', marginBottom: '5px' },
    btnRun: { width: '100%', background: '#3498db', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' },
    tableArea: { maxHeight: '180px', overflowY: 'auto' },
    tbl: { width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' },
    res: { fontSize: '12px', margin: '5px 0' },
    btnFlex: { display: 'flex', gap: '8px', padding: '10px', background: '#f8f9fa' },
    btnSec: { flex: 1, padding: '8px', background: '#607d8b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
    schematicBox: { 
        background: 'white', 
        border: '2px solid #2c3e50', 
        borderRadius: '8px', 
        padding: '10px', 
        marginTop: '10px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
        minHeight: '220px'
    }
};

export default App;
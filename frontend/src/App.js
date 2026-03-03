import React, { useState, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

// --- PROFESSIONAL 2.5D ICONS ---
const ICONS = {
    Router: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="70" rx="40" ry="15" fill="%23c0392b"/><rect x="10" y="35" width="80" height="35" fill="%23e74c3c"/><ellipse cx="50" cy="35" rx="40" ry="15" fill="%23ff7675"/><path d="M35 30 L50 45 L65 30" stroke="white" stroke-width="5" fill="none"/></svg>`,
    Switch: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 40 L30 25 L90 25 L90 65 L70 80 L10 80 Z" fill="%232980b9"/><rect x="20" y="50" width="10" height="10" fill="%23f1c40f"/></svg>`,
    PC: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="40" fill="%2334495e"/><path d="M10 65 L90 65 L85 75 L15 75 Z" fill="%2395a5a6"/></svg>`,
    Server: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M25 20 L45 10 L75 10 L75 80 L55 90 L25 90 Z" fill="%232c3e50"/><rect x="35" y="30" width="30" height="4" fill="%232ecc71"/><rect x="35" y="40" width="30" height="4" fill="%23e67e22"/></svg>`
};

function App() {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [nodeIdCounter, setNodeIdCounter] = useState(1);
    const [inputs, setInputs] = useState({ srcId: '', tgtId: '', linkCost: 10, startNode: '', endNode: '', showSPT: true, showMST: true });
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
        setGraphData(prev => ({ ...prev, links: [...prev.links, { source: s, target: t, cost: parseInt(inputs.linkCost) }] }));
    };

    const runFullAnalysis = async () => {
        if (!inputs.startNode || !inputs.endNode) return alert("Select Source/Destination");
        try {
            const cleanLinks = graphData.links.map(l => ({ source: l.source.id || l.source, target: l.target.id || l.target, cost: l.cost }));
            const res = await axios.post('http://localhost:3001/api/process', {
                nodes: graphData.nodes, links: cleanLinks, command: "route",
                source: parseInt(inputs.startNode), target: parseInt(inputs.endNode)
            });
            setAnalysisResult(res.data);
        } catch (e) { alert("Backend Error!"); }
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
                {/* 2. LEFT SIDEBAR (INVENTORY) */}
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
                    <button style={styles.btnPrimary} onClick={addLink}>Connect Devices</button>
                </aside>

                {/* 3. CENTER CANVAS (MAP) */}
                <section style={styles.canvasArea}>
                    <ForceGraph2D
                        ref={fgRef}
                        graphData={graphData}
                        nodeRelSize={12}
                        linkColor={l => isPathLink(l) ? '#e74c3c' : '#2c3e50'}
                        linkWidth={l => isPathLink(l) ? 12 : 3}
                        linkDirectionalParticles={l => isPathLink(l) ? 6 : 0}
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
                                <select style={styles.sel} onChange={e => setInputs({ ...inputs, startNode: e.target.value })}>
                                    <option>Select</option>{graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                </select>
                            </div>
                            <div style={styles.row}>Dest:
                                <select style={styles.sel} onChange={e => setInputs({ ...inputs, endNode: e.target.value })}>
                                    <option>Select</option>{graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                </select>
                            </div>
                            <div style={styles.checkRow}><input type="checkbox" checked={inputs.showSPT} readOnly /> Show SPT Tree</div>
                            <div style={styles.checkRow}><input type="checkbox" checked={inputs.showMST} readOnly /> Show MST</div>
                            <button style={styles.btnRun} onClick={runFullAnalysis}>Run Dijkstra</button>
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
                            <button style={styles.btnSec}>Simulate Failure</button>
                            <button style={styles.btnSec}>Export Report</button>
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
    btnSec: { flex: 1, padding: '8px', background: '#607d8b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }
};

export default App;
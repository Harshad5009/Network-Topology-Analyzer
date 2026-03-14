const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// FIXED: Added .exe extension explicitly for Windows compatibility
const CPP_EXEC = path.join(__dirname, 'network_analyzer.exe'); 

app.post('/api/process', (req, res) => {
    const inputData = JSON.stringify(req.body);
    let outputData = '';
    let errorData = '';

    console.log(`[${new Date().toLocaleTimeString()}] Processing ${req.body.command} request...`);

    // Start the C++ program
    const childProcess = spawn(CPP_EXEC);

    // Write data to C++ stdin
    childProcess.stdin.write(inputData);
    childProcess.stdin.end();

    // Capture C++ standard output (Results)
    childProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    // Capture C++ standard error (Crashes/Bugs)
    childProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    // Handle process completion
    childProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`C++ Execution Error (Code ${code}): ${errorData}`);
            return res.status(500).json({ 
                error: "Algorithm Engine failed", 
                details: errorData || "Unknown C++ crash",
                code: code
            });
        }
        
        try {
            if (!outputData.trim()) {
                throw new Error("No output from algorithm engine");
            }
            // Parse the result back to JSON
            const jsonResponse = JSON.parse(outputData);
            res.json(jsonResponse);
        } catch (e) {
            console.error("Backend Error Detail:", e.message);
            console.error("Raw Output from C++:", outputData);
            res.status(500).json({ 
                error: "Invalid data format from backend engine", 
                details: e.message,
                raw: outputData 
            });
        }
    });

    // Handle system-level spawn errors (e.g., .exe file not found)
    childProcess.on('error', (err) => {
        console.error("Failed to start C++ process:", err.message);
        res.status(500).json({ 
            error: "Backend Engine not found. Did you compile network_analyzer.cpp?",
            details: err.message
        });
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`----------------------------------------`);
    console.log(`Backend Server running on http://localhost:${PORT}`);
    console.log(`Ready to process Network Topologies.`);
    console.log(`----------------------------------------`);
});
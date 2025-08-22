// File: server.js

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Serve the static files from the project root
app.use(express.static(path.join(__dirname)));

// Endpoint to serve API keys from the settings.json file
app.get('/api/config', (req, res) => {
    const settingsPath = path.join(__dirname, './config/settings.json'); // Assumes settings.json is in the root
    fs.readFile(settingsPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading settings file:', err);
            return res.status(500).send('Internal Server Error');
        }
        try {
            const settings = JSON.parse(data);
            res.json({
                geminiApiKey: settings.GEMINI_API_KEY,
                alphaVantageApiKey: settings.ALPHA_VANTAGE_API_KEY,
                fmpApiKey: settings.FMP_API_KEY
            });
        } catch (parseErr) {
            console.error('Error parsing JSON:', parseErr);
            res.status(500).send('Invalid JSON format');
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
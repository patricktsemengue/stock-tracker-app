// Filename: server.js
// A simple Node.js Express server to serve static files and provide API keys from a config file.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

let apiConfig = {};

try {
    // Read API keys from the config.json file
    const configFile = fs.readFileSync(path.join(__dirname, './config/settings.json'));
    apiConfig = JSON.parse(configFile);
    console.log('Successfully loaded API keys from config.json.');
} catch (error) {
    console.error('Error loading config.json:', error.message);
    console.warn('API keys will not be available from the server. The application will fall back to using locally saved keys.');
}

// Serve the API keys as a JSON endpoint
app.get('/api/config', (req, res) => {
    res.json({
        geminiApiKey: apiConfig.GEMINI_API_KEY || null,
        alphaVantageApiKey: apiConfig.ALPHA_VANTAGE_API_KEY || null,
    });
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
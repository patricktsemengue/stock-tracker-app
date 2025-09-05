// File: server.js

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Use CORS middleware to allow cross-origin requests from the front-end
app.use(cors());

// Serve the static files from the project root
app.use(express.static(path.join(__dirname)));

// Proxy endpoint for market data search
app.get('/api/search', async (req, res) => {
    const { query, by } = req.query;

    if (!query || !by) {
        return res.status(400).json({ error: 'Missing "query" or "by" parameter' });
    }

    try {
        const apiUrl = `https://strady-market-data.onrender.com/search?query=${query}&by=${by}`;
        const response = await axios.get(apiUrl);
        res.json(response.data);
    } catch (error) {
        console.error('Error proxying search request:', error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response ? error.response.data : 'Error fetching data';
        res.status(status).json({ error: message });
    }
});

// Proxy endpoint for forex rates
app.get('/api/rates', async (req, res) => {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        const apiUrl = `https://strady-market-data.onrender.com/rates?symbol=${symbol}`;
        const response = await axios.get(apiUrl);
        res.json(response.data);
    } catch (error) {
        console.error('Error proxying rates request:', error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response ? error.response.data : 'Internal Server Error';
        res.status(status).json({ error: message });
    }
});

//  "wake up" the render.com service
app.get('/api/ping', async (req, res) => {
    try {
        await axios.get('https://strady-market-data.onrender.com/');
        res.status(200).json({ message: 'API is awake' });
    } catch (error) {
        console.error('Error pinging API:', error.message);
        res.status(500).json({ error: 'API ping failed' });
    }
});

// Endpoint to serve API keys and app settings from the settings.json file
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
                fmpApiKey: settings.FMP_API_KEY,
                finnhubApiKey: settings.FINNHUB_API_KEY,
                cacheSize: settings.CACHE_RECENTLY_SEARCHED_SIZE,
                cacheExpire: settings.CACHE_RECENTLY_SEARCHED_EXPIRE
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
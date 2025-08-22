exports.handler = async (event, context) => {
    // Access API keys from Netlify's environment variables
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const fmpApiKey = process.env.FMP_API_KEY;

    // Return the keys as a JSON object
    return {
        statusCode: 200,
        body: JSON.stringify({
            geminiApiKey,
            alphaVantageApiKey,
            fmpApiKey
        }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Allows your frontend to access this endpoint
        },
    };

};


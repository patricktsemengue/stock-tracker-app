exports.handler = async (event, context) => {
    // Access API keys from Netlify's environment variables
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const fmpApiKey = process.env.FMP_API_KEY;
    const cacheSize = process.env.CACHE_RECENTLY_SEARCHED_SIZE;
    const cacheExpire = process.env.CACHE_RECENTLY_SEARCHED_EXPIRE;
    const finnhubApiKey =  process.env.FINNHUB_API_KEY;


    // Return the keys as a JSON object
    return {
        statusCode: 200,
        body: JSON.stringify({
            geminiApiKey,
            alphaVantageApiKey,
            fmpApiKey,
            cacheSize,
            finnhubApiKey,
            cacheExpire
        }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Allows your frontend to access this endpoint
        },
    };

};
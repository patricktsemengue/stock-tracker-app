exports.handler = async (event, context) => {
    // Access the remaining necessary variables from Netlify's environment
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const cacheSize = process.env.CACHE_RECENTLY_SEARCHED_SIZE;
    const cacheExpire = process.env.CACHE_RECENTLY_SEARCHED_EXPIRE;

    // Return only the required keys and settings
    return {
        statusCode: 200,
        body: JSON.stringify({
            geminiApiKey,
            cacheSize,
            cacheExpire
        }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Allows your frontend to access this endpoint
        },
    };
};
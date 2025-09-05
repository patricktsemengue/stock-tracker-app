const axios = require('axios');

exports.handler = async (event, context) => {
    // Get query parameters from the request
    const { query, by } = event.queryStringParameters;

    if (!query || !by) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing "query" or "by" parameter' }),
        };
    }

    try {
        const apiUrl = `https://strady-market-data.onrender.com/search?query=${query}&by=${by}`;
        const response = await axios.get(apiUrl);
        return {
            statusCode: 200,
            body: JSON.stringify(response.data),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Allow frontend access
            },
        };
    } catch (error) {
        console.error('Error in search function:', error.message);
        return {
            statusCode: error.response?.status || 500,
            body: JSON.stringify({ error: 'Failed to fetch search data.' }),
        };
    }
};
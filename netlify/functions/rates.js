const axios = require('axios');

exports.handler = async (event, context) => {
    const { symbol } = event.queryStringParameters;

    if (!symbol) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing symbol parameter' }),
        };
    }

    try {
        const apiUrl = `https://strady-market-data.onrender.com/rates?symbol=${symbol}`;
        const response = await axios.get(apiUrl);
        return {
            statusCode: 200,
            body: JSON.stringify(response.data),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        };
    } catch (error) {
        console.error('Error in rates function:', error.message);
        return {
            statusCode: error.response?.status || 500,
            body: JSON.stringify({ error: 'Failed to fetch rate data.' }),
        };
    }
};
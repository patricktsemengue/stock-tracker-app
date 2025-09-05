const axios = require('axios');

exports.handler = async (event, context) => {
    try {
        await axios.get('https://strady-market-data.onrender.com/');
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'API is awake' }),
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        };
    } catch (error) {
        console.error('Error in ping function:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API ping failed' }),
        };
    }
};
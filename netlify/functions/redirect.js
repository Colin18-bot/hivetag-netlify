const { google } = require('googleapis');
const fetch = require('node-fetch');

const SHEET_ID = '11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs';
const SHEET_RANGE = 'Form Responses 1';
const API_KEY = process.env.GOOGLE_API_KEY;

exports.handler = async function (event) {
  try {
    const urlParams = new URLSearchParams(event.queryStringParameters);
    const hiveId = urlParams.get('hive');
    const apiary = urlParams.get('apiary');

    if (!hiveId || !apiary) {
      return {
        statusCode: 400,
        body: 'Missing hive or apiary parameters',
      };
    }

    const formUrl = new URL('https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform');
    formUrl.searchParams.append('entry.432611212', hiveId);   // Hive ID
    formUrl.searchParams.append('entry.275862362', apiary);   // Apiary

    return {
      statusCode: 302,
      headers: {
        Location: formUrl.toString(),
      },
      body: '',
    };
  } catch (err) {
    console.error('Redirect error:', err);
    return {
      statusCode: 500,
      body: 'Server error',
    };
  }
};

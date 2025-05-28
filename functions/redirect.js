const { google } = require('googleapis');
const fetch = require('node-fetch');

const SHEET_ID = '11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs';
const SHEET_RANGE = 'Form Responses 1';
const API_KEY = process.env.GOOGLE_API_KEY;

const DEFAULT_RADIUS_METERS = 100;

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestHive(currentLat, currentLon, hiveList, radius = DEFAULT_RADIUS_METERS) {
  return hiveList.find(hive => {
    const { latitude, longitude } = hive;
    if (!latitude || !longitude) return false;
    const distance = getDistanceMeters(currentLat, currentLon, parseFloat(latitude), parseFloat(longitude));
    return distance <= radius;
  });
}

exports.handler = async function (event) {
  try {
    const urlParams = new URLSearchParams(event.queryStringParameters);
    const lat = parseFloat(urlParams.get('lat'));
    const lon = parseFloat(urlParams.get('lon'));

    if (!lat || !lon) {
      return {
        statusCode: 400,
        body: 'Missing GPS coordinates',
      };
    }

    const sheets = google.sheets({ version: 'v4', auth: API_KEY });
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });

    const rows = sheetData.data.values;
    if (!rows || rows.length < 2) {
      return {
        statusCode: 404,
        body: 'No hive data found',
      };
    }

    const headers = rows[0];
    const hiveList = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((key, i) => {
        obj[key.trim()] = row[i] || '';
      });
      return {
        hiveId: obj['Hive ID'],
        latitude: obj['Latitude'],
        longitude: obj['Longitude'],
        apiary: obj['Apiary Name'],
      };
    });

    const match = findNearestHive(lat, lon, hiveList);

    if (!match) {
      return {
        statusCode: 404,
        body: 'No hive matched within 100m',
      };
    }

    const formUrl = new URL('https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform');
    formUrl.searchParams.append('entry.432611212', match.hiveId);   // Hive ID
    formUrl.searchParams.append('entry.275862362', match.apiary);   // Apiary

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
const { google } = require('googleapis');
const fetch = require('node-fetch');

// MAIN HANDLER FUNCTION
exports.handler = async (event) => {
  const hiveId = event.queryStringParameters.hive_id;
  const lat = parseFloat(event.queryStringParameters.lat);
  const lon = parseFloat(event.queryStringParameters.lon);

  if (!hiveId || isNaN(lat) || isNaN(lon)) {
    return {
      statusCode: 400,
      body: 'Missing hive_id, lat, or lon',
    };
  }

  // ✅ Google Sheets API auth
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ✅ Your Sheet and range
  const spreadsheetId = '11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs'; // ✅ Customer Registration Sheet ID
  const range = 'Customer Registration (Responses)!A1:Z1000';

  // ✅ Load sheet rows
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    return {
      statusCode: 404,
      body: 'No data found in the sheet.',
    };
  }

  const headers = rows[0];
  const hiveIdIndex = headers.indexOf('Hive ID');
  const latIndex = headers.indexOf('Latitude');
  const lonIndex = headers.indexOf('Longitude');

  // 🔍 Find matching hive
  const match = rows.slice(1).find((row) => {
    const rowHiveId = row[hiveIdIndex];
    const rowLat = parseFloat(row[latIndex]);
    const rowLon = parseFloat(row[lonIndex]);

    if (!rowHiveId || isNaN(rowLat) || isNaN(rowLon)) return false;

    const distance = haversineDistance(lat, lon, rowLat, rowLon);
    return rowHiveId === hiveId || distance < 0.1; // match by ID or within 100m
  });

  if (match) {
    // ✅ Redirect to INSPECTION FORM
    const inspectionFormURL = 'https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform?usp=pp_url';

    const redirectURL = `${inspectionFormURL}` +
      `&entry.432611212=${encodeURIComponent(hiveId)}` + // Hive ID
      `&entry.275862362=${encodeURIComponent(match[headers.indexOf('Apiary Name')] || '')}` + // Apiary
      `&entry.2060880531=${encodeURIComponent(match[headers.indexOf('Weather')] || 'Unknown')}`; // Weather

    return {
      statusCode: 302,
      headers: {
        Location: redirectURL,
      },
    };
  } else {
    // ❌ Not found → redirect to REGISTRATION FORM
    const registrationFormURL = 'https://docs.google.com/forms/d/e/1FAIpQLSejvAZD9WekBezk3Z6Z8Tt7Uedy5Irfjl4JLUZgIdw68nQBeA/viewform?usp=pp_url';

    const redirectURL = `${registrationFormURL}` +
      `&entry.432611212=${encodeURIComponent(hiveId)}` +
      `&lat=${lat}&lon=${lon}`;

    return {
      statusCode: 302,
      headers: {
        Location: redirectURL,
      },
    };
  }
};

// 📍 Calculate haversine distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => value * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

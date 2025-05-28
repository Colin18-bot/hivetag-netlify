// /netlify/functions/hivetag-redirect.js

const fetch = require("node-fetch");
const { google } = require("googleapis");

// Embedded WeatherAPI key
const WEATHER_API_KEY = "01e79aaf041646c8bbf182847252805";
const SHEET_ID = "11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs"; // HiveTag Registration sheet
const SHEET_NAME = "Form Responses 1";
const FORM_BASE_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform";

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.handler = async (event) => {
  const { lat, lon } = event.queryStringParameters;
  if (!lat || !lon) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing lat/lon parameters" }),
    };
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  let hiveId = "";
  let apiary = "";
  let matched = false;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:Z`,
    });

    const rows = response.data.values;

    for (const row of rows) {
      const [timestamp, hive, apiaryName, , , , , latStr, lonStr] = row;
      if (!latStr || !lonStr) continue;

      const hiveLat = parseFloat(latStr);
      const hiveLon = parseFloat(lonStr);
      const dist = haversineDistance(parseFloat(lat), parseFloat(lon), hiveLat, hiveLon);

      if (dist <= 200) {
        hiveId = hive;
        apiary = apiaryName;
        matched = true;
        break;
      }
    }

    if (!matched) {
      return {
        statusCode: 200,
        body: JSON.stringify({ error: "No hive found within 200m radius" }),
      };
    }

    // Fetch weather
    const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();
    const weather = weatherData?.current?.condition?.text || "Unknown";

    // Build prefill form URL
    const formUrl = new URL(FORM_BASE_URL);
    formUrl.searchParams.set("usp", "pp_url");
    formUrl.searchParams.set("entry.432611212", hiveId);
    formUrl.searchParams.set("entry.275862362", apiary);
    formUrl.searchParams.set("entry.2060880531", weather);

    return {
      statusCode: 200,
      body: JSON.stringify({ redirectUrl: formUrl.toString() }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

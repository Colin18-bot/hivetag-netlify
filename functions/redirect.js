const { google } = require("googleapis");

exports.handler = async function (event, context) {
  try {
    const { lat, lon } = event.queryStringParameters;

    if (!lat || !lon) {
      return {
        statusCode: 400,
        body: "Missing lat or lon",
      };
    }

    // 🌦️ Step 1: Get weather
    const weatherRes = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lat},${lon}`);
    const weatherData = await weatherRes.json();

    if (!weatherData || !weatherData.current?.condition?.text) {
      return { statusCode: 500, body: "Weather lookup failed" };
    }

    const weather = weatherData.current.condition.text;

    // 📊 Step 2: Get spreadsheet data
    const sheets = google.sheets({ version: "v4", auth: process.env.GOOGLE_API_KEY });
    const spreadsheetId = "11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs";
    const range = "Form Responses 1";
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;

    const registrationFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSejvAZD9WekBezk3Z6Z8Tt7Uedy5Irfjl4JLUZgIdw68nQBeA/viewform?usp=pp_url";

    if (!rows || rows.length < 2 || rows.slice(1).every(row => row.every(cell => !cell))) {
      // ✅ Spreadsheet is empty of actual content
      return {
        statusCode: 302,
        headers: {
          Location: registrationFormUrl,
        },
      };
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const latIndex = headers.indexOf("Latitude");
    const lonIndex = headers.indexOf("Longitude");
    const hiveIdIndex = headers.indexOf("Hive ID");
    const apiaryIndex = headers.indexOf("Apiary Name");

    if ([latIndex, lonIndex, hiveIdIndex, apiaryIndex].includes(-1)) {
      return { statusCode: 500, body: "Missing expected columns" };
    }

    const toRadians = (deg) => (deg * Math.PI) / 180;
    const distanceMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371000;
      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    let closest = null;
    let closestDistance = 100;

    let validGPSFound = false;

    for (const row of dataRows) {
      const rowLat = parseFloat(row[latIndex]);
      const rowLon = parseFloat(row[lonIndex]);
      if (isNaN(rowLat) || isNaN(rowLon)) continue;

      validGPSFound = true;

      const d = distanceMeters(parseFloat(lat), parseFloat(lon), rowLat, rowLon);
      if (d < closestDistance) {
        closestDistance = d;
        closest = row;
      }
    }

    if (!validGPSFound || !closest) {
      // 📭 No GPS saved or no hive within range — fallback
      return {
        statusCode: 302,
        headers: {
          Location: registrationFormUrl,
        },
      };
    }

    const hiveId = closest[hiveIdIndex];
    const apiary = closest[apiaryIndex];

    const inspectionUrl = `https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform?usp=pp_url&entry.432611212=${encodeURIComponent(hiveId)}&entry.275862362=${encodeURIComponent(apiary)}&entry.2060880531=${encodeURIComponent(weather)}`;

    return {
      statusCode: 302,
      headers: {
        Location: inspectionUrl,
      },
    };

  } catch (err) {
    console.error("Redirect error:", err);
    return { statusCode: 500, body: "Server error" };
  }
};

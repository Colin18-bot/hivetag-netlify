const { google } = require("googleapis");

exports.handler = async function (event, context) {
  try {
    const { lat, lon } = event.queryStringParameters;

    if (!lat || !lon) {
      return { statusCode: 400, body: "Missing lat or lon" };
    }

    // 🌦️ Step 1: Fetch weather
    const weatherRes = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lat},${lon}`);
    const weatherData = await weatherRes.json();

    if (!weatherData?.current?.condition?.text) {
      return { statusCode: 500, body: "Weather lookup failed" };
    }

    const weather = weatherData.current.condition.text;

    // 📊 Step 2: Load spreadsheet
    const sheets = google.sheets({ version: "v4", auth: process.env.GOOGLE_API_KEY });
    const spreadsheetId = "11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs";
    const range = "Form Responses 1";
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;

    const headers = rows?.[0] || [];
    const dataRows = rows?.slice(1) || [];

    const latIndex = headers.indexOf("Latitude");
    const lonIndex = headers.indexOf("Longitude");
    const hiveIdIndex = headers.indexOf("Hive ID");
    const apiaryIndex = headers.indexOf("Apiary Name");

    if ([latIndex, lonIndex, hiveIdIndex, apiaryIndex].includes(-1)) {
      return { statusCode: 500, body: "Missing expected columns" };
    }

    // 🧪 Check for at least one row with valid GPS
    const gpsRows = dataRows.filter((r) => {
      const rowLat = parseFloat(r[latIndex]);
      const rowLon = parseFloat(r[lonIndex]);
      return !isNaN(rowLat) && !isNaN(rowLon);
    });

    if (gpsRows.length === 0) {
      // 🆕 First-time use — go to registration
      return {
        statusCode: 302,
        headers: {
          Location: "https://docs.google.com/forms/d/e/1FAIpQLSejvAZD9WekBezk3Z6Z8Tt7Uedy5Irfjl4JLUZgIdw68nQBeA/viewform?usp=pp_url",
        },
      };
    }

    // 📍 Find closest match
    const toRad = (deg) => (deg * Math.PI) / 180;
    const getDist = (aLat, aLon, bLat, bLon) => {
      const R = 6371000;
      const dLat = toRad(bLat - aLat);
      const dLon = toRad(bLon - aLon);
      const aa = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    };

    let closest = null;
    let closestDistance = 100;

    for (const row of gpsRows) {
      const rowLat = parseFloat(row[latIndex]);
      const rowLon = parseFloat(row[lonIndex]);

      const d = getDist(parseFloat(lat), parseFloat(lon), rowLat, rowLon);
      if (d < closestDistance) {
        closest = row;
        closestDistance = d;
      }
    }

    if (!closest) {
      // 🧭 No match within 100m
      return {
        statusCode: 302,
        headers: {
          Location: "https://docs.google.com/forms/d/e/1FAIpQLSejvAZD9WekBezk3Z6Z8Tt7Uedy5Irfjl4JLUZgIdw68nQBeA/viewform?usp=pp_url",
        },
      };
    }

    // 🐝 Build Inspection Form URL
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

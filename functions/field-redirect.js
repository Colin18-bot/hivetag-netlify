// Field-Ready Dynamic Hive Redirect Function
const { google } = require("googleapis");
const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  try {
    const { lat, lon, hiveId } = event.queryStringParameters;

    if ((!lat || !lon) && !hiveId) {
      return {
        statusCode: 400,
        body: "Missing lat/lon or hiveId",
      };
    }

    let weather = "Unknown";

    // 🌦️ Step 1: Weather lookup (only if lat/lon provided and valid)
    if (lat && lon && lat !== "0" && lon !== "0") {
      try {
        const weatherRes = await fetch(
          `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lat},${lon}`
        );
        const weatherData = await weatherRes.json();
        if (weatherData && weatherData.current?.condition?.text) {
          weather = weatherData.current.condition.text;
        }
      } catch (err) {
        console.warn("Weather lookup failed:", err);
      }
    }

    // 📊 Step 2: Sheet lookup
    const sheets = google.sheets({ version: "v4", auth: process.env.GOOGLE_API_KEY });
    const spreadsheetId = "11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs";
    const range = "Form Responses 1";
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;

    if (!rows || rows.length < 2) {
      return { statusCode: 500, body: "No data found" };
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const latIndex = headers.indexOf("Latitude");
    const lonIndex = headers.indexOf("Longitude");
    const hiveIdIndex = headers.indexOf("Hive ID");
    const apiaryIndex = headers.indexOf("Apiary Name");

    let closest = null;
    let closestDistance = 100;
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const distanceMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371000;
      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    if (lat && lon && lat !== "0" && lon !== "0") {
      for (const row of dataRows) {
        const rowLat = parseFloat(row[latIndex]);
        const rowLon = parseFloat(row[lonIndex]);
        if (isNaN(rowLat) || isNaN(rowLon)) continue;

        const d = distanceMeters(parseFloat(lat), parseFloat(lon), rowLat, rowLon);
        if (d < closestDistance) {
          closestDistance = d;
          closest = row;
        }
      }
    }

    // 🧭 Fallback to Hive ID match if no GPS match
    if (!closest && hiveId) {
      closest = dataRows.find((r) => r[hiveIdIndex] === hiveId);
    }

    if (!closest) {
      return { statusCode: 404, body: "No hive matched within 100m or by Hive ID" };
    }

    const matchedHiveId = closest[hiveIdIndex];
    const apiary = closest[apiaryIndex];

    const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform?usp=pp_url&entry.432611212=${encodeURIComponent(matchedHiveId)}&entry.275862362=${encodeURIComponent(apiary)}&entry.2060880531=${encodeURIComponent(weather)}`;

    return {
      statusCode: 302,
      headers: { Location: formUrl },
    };
  } catch (err) {
    console.error("Redirect error:", err);
    return { statusCode: 500, body: "Server error" };
  }
};

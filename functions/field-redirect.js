// Field-Ready Dynamic Hive Redirect Function with Enhanced Fallback Priority and Weather Logging
const { google } = require("googleapis");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event, context) {
  try {
    const { lat, lon, hiveId, apiaryName: apiaryNameParam } = event.queryStringParameters;

    if ((!lat || !lon) && !hiveId) {
      return {
        statusCode: 400,
        body: "Missing lat/lon or hiveId",
      };
    }

    let weather = "Unknown";
    let latForWeather = lat;
    let lonForWeather = lon;
    let fallbackNote = "";

    const sheets = google.sheets({ version: "v4", auth: process.env.GOOGLE_API_KEY });
    const spreadsheetId = "11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs";
    const range = "Customer Registration Responses"; // ✅ Updated sheet name

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
    let closestRowIndex = -1;
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
      dataRows.forEach((row, i) => {
        const rowLat = parseFloat(row[latIndex]);
        const rowLon = parseFloat(row[lonIndex]);
        if (isNaN(rowLat) || isNaN(rowLon)) return;

        const d = distanceMeters(parseFloat(lat), parseFloat(lon), rowLat, rowLon);
        if (d < closestDistance) {
          closestDistance = d;
          closest = row;
          closestRowIndex = i + 1;
        }
      });
    }

    if (!closest && hiveId && apiaryNameParam) {
      const hiveMatches = dataRows.filter(
        r => r[hiveIdIndex] === hiveId && r[apiaryIndex] === apiaryNameParam
      );
      if (hiveMatches.length === 1) {
        closest = hiveMatches[0];
        closestRowIndex = dataRows.indexOf(closest) + 1;
      } else if (hiveMatches.length > 1) {
        const gpsMissing = hiveMatches.find(r => !r[latIndex] || !r[lonIndex]);
        closest = gpsMissing || hiveMatches.find(r => r[latIndex] && r[lonIndex]);
        closestRowIndex = dataRows.indexOf(closest) + 1;
      }
    }

    if (!closest) {
      return { statusCode: 404, body: "No hive matched within 100m or valid fallback by Hive ID and Apiary Name" };
    }

    const matchedHiveId = closest[hiveIdIndex];
    const apiary = closest[apiaryIndex];

    if (lat && lon && lat !== "0" && lon !== "0") {
      const recordedLat = closest[latIndex]?.trim();
      const recordedLon = closest[lonIndex]?.trim();
      const isMissingGPS = !recordedLat || !recordedLon || isNaN(recordedLat) || isNaN(recordedLon);

      if (isMissingGPS && closestRowIndex !== -1) {
        const updateRange = `Customer Registration Responses!${String.fromCharCode(65 + latIndex)}${closestRowIndex + 1}:${String.fromCharCode(65 + lonIndex)}${closestRowIndex + 1}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: updateRange,
          valueInputOption: "RAW",
          requestBody: { values: [[lat, lon]] },
        });
      }
    }

    if (closest[latIndex] && closest[lonIndex]) {
      latForWeather = closest[latIndex].trim();
      lonForWeather = closest[lonIndex].trim();
      fallbackNote = "Using lat/lon from matched hive row.";
    } else if (lat && lon) {
      latForWeather = lat;
      lonForWeather = lon;
      fallbackNote = "Using provided lat/lon due to missing fallback GPS.";
    } else {
      fallbackNote = "No valid lat/lon available for weather lookup.";
    }

    if (latForWeather && lonForWeather && latForWeather !== "0" && lonForWeather !== "0") {
      try {
        const weatherRes = await fetch(
          `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${latForWeather},${lonForWeather}`
        );
        const weatherData = await weatherRes.json();
        if (weatherData && weatherData.current?.condition?.text) {
          weather = weatherData.current.condition.text;
        } else if (weatherData.error) {
          fallbackNote += ` Weather API error: ${weatherData.error.message}`;
        }
      } catch (err) {
        fallbackNote += ` Weather fetch failed: ${err.message}`;
      }
    } else {
      fallbackNote += " No valid GPS for weather lookup.";
    }

    const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform?usp=pp_url&entry.432611212=${encodeURIComponent(matchedHiveId)}&entry.275862362=${encodeURIComponent(apiary)}&entry.2060880531=${encodeURIComponent(weather)}&entry.1234567890=${encodeURIComponent(fallbackNote)}`;

    return {
      statusCode: 302,
      headers: { Location: formUrl },
    };
  } catch (err) {
    console.error("Redirect error:", err);
    return { statusCode: 500, body: "Server error" };
  }
};

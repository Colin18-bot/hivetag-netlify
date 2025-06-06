// HiveTag – Final Working field-redirect.js (Matching Latest Headers + Fallback + Weather + GPS Update)

const { google } = require("googleapis");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event, context) {
  try {
    const { lat, lon, hiveId, apiaryName: apiaryNameParam } = event.queryStringParameters;
    console.log("Query received:", event.queryStringParameters);

    if ((!lat || !lon) && !hiveId) {
      console.error("Missing lat/lon or hiveId");
      return {
        statusCode: 400,
        body: "Missing lat/lon or hiveId",
      };
    }

    const sheets = google.sheets({ version: "v4", auth: process.env.GOOGLE_API_KEY });
    const spreadsheetId = "11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs";
    const range = "Customer Registration Responses";

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;

    if (!rows || rows.length < 2) {
      console.error("No rows found in sheet");
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

    const toRadians = deg => (deg * Math.PI) / 180;
    const distanceMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371000;
      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    // 🧭 Find closest hive by GPS
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

    // 🧩 Fallback by Hive ID and Apiary Name
    if (!closest && hiveId && apiaryNameParam) {
      const matches = dataRows.filter(
        r => r[hiveIdIndex] === hiveId && r[apiaryIndex] === apiaryNameParam
      );
      if (matches.length === 1) {
        closest = matches[0];
        closestRowIndex = dataRows.indexOf(closest) + 1;
      } else if (matches.length > 1) {
        closest = matches.find(r => !r[latIndex] || !r[lonIndex]) || matches[0];
        closestRowIndex = dataRows.indexOf(closest) + 1;
      }
    }

    if (!closest) {
      console.error("No match by GPS or Hive ID + Apiary");
      return {
        statusCode: 404,
        body: "No hive matched within 100m or fallback available",
      };
    }

    const matchedHiveId = closest[hiveIdIndex];
    const matchedApiary = closest[apiaryIndex];

    // 📌 Update missing GPS if needed
    if (lat && lon && lat !== "0" && lon !== "0") {
      const storedLat = closest[latIndex]?.trim();
      const storedLon = closest[lonIndex]?.trim();
      const isMissingGPS = !storedLat || !storedLon || isNaN(storedLat) || isNaN(storedLon);

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

    // ☁️ Get weather from coordinates
    let weather = "Unknown";
    const lookupLat = closest[latIndex] || lat;
    const lookupLon = closest[lonIndex] || lon;

    try {
      const weatherRes = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lookupLat},${lookupLon}`);
      const weatherData = await weatherRes.json();
      weather = weatherData?.current?.condition?.text || "Unknown";
    } catch (err) {
      console.error("Weather fetch failed:", err.message);
    }

    const prefillUrl = `https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform?usp=pp_url&entry.432611212=${encodeURIComponent(matchedHiveId)}&entry.275862362=${encodeURIComponent(matchedApiary)}&entry.2060880531=${encodeURIComponent(weather)}`;

    return {
      statusCode: 302,
      headers: { Location: prefillUrl },
    };

  } catch (err) {
    console.error("Redirect error:", err.message);
    return { statusCode: 500, body: "Server error" };
  }
};

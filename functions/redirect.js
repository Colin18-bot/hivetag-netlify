const fetch = require("node-fetch");

const GOOGLE_SHEET_ID = "11nPXg_sx88U8tScpT2-iqmeRGN_jvqnBxs_twqaenJs";
const SHEET_NAME = "HiveTag - Customer Registration (Responses)";
const API_KEY = process.env.GOOGLE_API_KEY;

exports.handler = async (event) => {
  const { hive_id, lat, lon } = event.queryStringParameters;

  if (!hive_id) {
    return {
      statusCode: 400,
      body: "Missing hive_id",
    };
  }

  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(
    SHEET_NAME
  )}?key=${API_KEY}`;

  try {
    const response = await fetch(sheetUrl);
    const data = await response.json();
    const rows = data.values;

    const headers = rows[0];
    const hiveIdIndex = headers.indexOf("Hive ID");
    const apiaryIndex = headers.indexOf("Apiary Name");
    const latIndex = headers.indexOf("Latitude");
    const lonIndex = headers.indexOf("Longitude");
    const weatherIndex = headers.indexOf("Weather");

    const hiveRow = rows.find((row, i) => i > 0 && row[hiveIdIndex] === hive_id);

    if (!hiveRow) {
      const regUrl = new URL("https://docs.google.com/forms/d/e/1FAIpQLSejvAZD9WekBezk3Z6Z8Tt7Uedy5Irfjl4JLUZgIdw68nQBeA/viewform");
      regUrl.searchParams.set("entry.432611212", hive_id);
      if (lat) regUrl.searchParams.set("lat", lat);
      if (lon) regUrl.searchParams.set("lon", lon);

      return {
        statusCode: 302,
        headers: {
          Location: regUrl.toString(),
        },
      };
    }

    const apiary = hiveRow[apiaryIndex] || "";
    const savedLat = hiveRow[latIndex] || lat || "";
    const savedLon = hiveRow[lonIndex] || lon || "";
    const weather = hiveRow[weatherIndex] || "Unknown";

    const inspectUrl = new URL("https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform");
    inspectUrl.searchParams.set("entry.432611212", hive_id);
    inspectUrl.searchParams.set("entry.275862362", apiary);
    inspectUrl.searchParams.set("entry.2060880531", weather);
    if (savedLat) inspectUrl.searchParams.set("lat", savedLat);
    if (savedLon) inspectUrl.searchParams.set("lon", savedLon);

    return {
      statusCode: 302,
      headers: {
        Location: inspectUrl.toString(),
      },
    };
  } catch (error) {
    console.error("Error in redirect.js:", error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

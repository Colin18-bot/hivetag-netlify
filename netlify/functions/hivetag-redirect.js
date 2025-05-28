// /netlify/functions/hivetag-redirect.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Weather API key (already embedded)
const WEATHER_API_KEY = "01e79aef041646c8bbf182847252805";

// Google Form prefill base
const FORM_BASE_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform";
const ENTRY_HIVE_ID = "entry.432611212";
const ENTRY_APIARY = "entry.275862362";
const ENTRY_WEATHER = "entry.2060880531";

function buildPrefillUrl(hive, apiary, weather) {
  const params = new URLSearchParams();
  if (hive) params.append(ENTRY_HIVE_ID, hive);
  if (apiary) params.append(ENTRY_APIARY, apiary);
  if (weather) params.append(ENTRY_WEATHER, weather);

  return `${FORM_BASE_URL}?usp=pp_url&${params.toString()}`;
}

exports.handler = async (event) => {
  try {
    const { hive = "", apiary = "", lat = "", lon = "" } = event.queryStringParameters;

    let weather = "";

    if (lat && lon) {
      const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}`;
      const response = await fetch(weatherUrl);
      const data = await response.json();
      weather = data.current?.condition?.text || "";
    }

    const url = buildPrefillUrl(hive, apiary, weather);

    return {
      statusCode: 200,
      body: JSON.stringify({ url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

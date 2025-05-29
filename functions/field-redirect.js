if (lat && lon && lat !== "0" && lon !== "0") {
  try {
    const weatherRes = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${lat},${lon}`
    );
    const weatherData = await weatherRes.json();
    console.log("🌦️ Weather response:", weatherData); // 🔍 Add this line

    if (weatherData && weatherData.current?.condition?.text) {
      weather = weatherData.current.condition.text;
    } else if (weatherData.error) {
      console.warn("⚠️ Weather API Error:", weatherData.error.message);
    }
  } catch (err) {
    console.warn("Weather lookup failed:", err.message);
  }
}

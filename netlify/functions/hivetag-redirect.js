exports.handler = async (event) => {
  const params = event.queryStringParameters;
  const hive = params.hive || '';
  const mode = params.mode || '';
  const lat = params.lat || '';
  const lon = params.lon || '';

  // Replace with your actual API logic and keys
  const url = `https://docs.google.com/forms/d/e/1FAIpQLSdVdBrqwRRiPI0phriZLS1eWyaEIIk96wGBemvmvjF7NfMqYg/viewform?usp=pp_url&entry.432611212=${hive}&entry.275862362=${mode}&entry.2060880531=Overcast`;

  return {
    statusCode: 200,
    body: JSON.stringify({ url })
  };
};
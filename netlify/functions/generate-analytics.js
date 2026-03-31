exports.handler = async function () {
  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'stub', message: 'TODO: fetch athlete data, call OpenAI, store in analytics_cache, return report' }),
  }
}

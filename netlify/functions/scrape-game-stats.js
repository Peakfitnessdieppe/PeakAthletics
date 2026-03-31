exports.handler = async function () {
  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'stub', message: 'TODO: scheduled cron, fetch game stats per sport, store in game_stats table' }),
  }
}

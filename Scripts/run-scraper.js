require('dotenv').config()

const { handler } = require('../netlify/functions/scrape-game-stats')

handler({}, {})
  .then((result) => {
    try {
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body
      console.log('Result:', body)
    } catch (err) {
      console.error('Failed to parse result body', err)
    }
  })
  .catch((err) => {
    console.error('Scraper execution failed', err)
  })

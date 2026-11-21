const axios = require('axios')

const fallback = require('./items-fallback')

class Items {
  constructor() {
    this.items = {}
  }

  async init() {
    let data = ''

    try {
      const response = await axios.get(
        'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.txt',
        { timeout: 10000 }
      )

      data = response.data
    } catch (error) {
      data = fallback
    }

    for (const line of data.trim().split('\n')) {
      const raw = line.split(':')

      const itemNumId = parseInt(raw[0].trim(), 10)
      const itemId = raw[1].trim()
      const itemName = raw[2] != null ? raw[2].trim() : itemId

      this.items[itemNumId] = {
        itemNumId,
        itemId,
        itemName
      }
    }
  }

  has(itemNumId) {
    return this.items[itemNumId] != null
  }

  // Never returns undefined, so a new item that is not in the database yet is
  // logged as unknown_<id> instead of dropping the whole loot event.
  get(itemNumId) {
    return (
      this.items[itemNumId] ?? {
        itemNumId,
        itemId: 'unknown_' + itemNumId,
        itemName: 'unknown_' + itemNumId
      }
    )
  }
}

module.exports = new Items()

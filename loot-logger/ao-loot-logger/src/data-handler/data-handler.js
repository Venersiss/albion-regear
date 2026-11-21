const RequestData = require('./request-data')
const ResponseData = require('./response-data')
const EventData = require('./event-data')
const Logger = require('../utils/logger')
const ParserError = require('./parser-error')
const Config = require('../config')
const Items = require('../items')
const fs = require('fs')

const DEBUG = process.env.LOOT_LOGGER_DEBUG === '1'

class DataHandler {
  static handleEventData(event) {
    try {
      const eventId = event?.parameters?.[252]
      // console.log(event)

      // Protocol 18: eventCode in header is no longer always 1
      // Filter by parameters[252] (event ID) instead
      if (!event || !eventId) {
        return
      }

      switch (eventId) {
        case Config.events.EvInventoryPutItem: // 26 - EvInventoryPutItem
          return EventData.EvInventoryPutItem.handle(event, 'case26')

        case Config.events.EvNewCharacter: // 29 - EvNewCharacter
          return EventData.EvNewCharacter.handle(event)

        case Config.events.EvNewEquipmentItem: // 30 - EvNewEquipmentItem
          return EventData.EvNewEquipmentItem.handle(event)

        case Config.events.EvNewSiegeBannerItem: // 31 - EvNewSiegeBannerItem
          return EventData.EvNewSiegeBannerItem.handle(event)

        case Config.events.EvNewSimpleItem: // 32 - EvNewSimpleItem
          return EventData.EvNewSimpleItem.handle(event)

        case Config.events.EvNewLoot: // 98 - EvNewLoot
          return EventData.EvNewLoot.handle(event)

        case Config.events.EvAttachItemContainer: // 99 - EvAttachItemContainer
          return EventData.EvAttachItemContainer.handle(event)

        case Config.events.EvDetachItemContainer: // 100 - EvDetachItemContainer
          return EventData.EvDetachItemContainer.handle(event)

        case Config.events.EvCharacterStats: // 143 - EvCharacterStats
          return EventData.EvCharacterStats.handle(event)

        case Config.events.EvOtherGrabbedLoot: // 275 - EvOtherGrabbedLoot
          return EventData.EvOtherGrabbedLoot.handle(event, 'case' + Config.events.EvOtherGrabbedLoot)

        case Config.events.EvDeathEvent: // 165 - EvDeathEvent - KILLFEED
          return EventData.EvDeathEvent.handle(event)

        case Config.events.EvNewLootChest: // 300 - EvNewLootChest
           return EventData.EvNewLootChest.handle(event)        
        
        case Config.events.EvUpdateLootChest: // 301 - EvUpdateLootChest
          return EventData.EvUpdateLootChest.handle(event)

        default:
          return DataHandler.handleUnknownEvent(event, eventId)
      }
    } catch (error) {
      if (error instanceof ParserError) {
        Logger.warn(error, event)
      } else {
        Logger.error(error, event)
      }
    }
  }

  // Albion renumbers events after some game updates. If an event we have no
  // handler for looks exactly like a "grabbed loot" event, treat it as loot so a
  // renumbering cannot silently stop logging. The ID is reported once on screen.
  static handleUnknownEvent(event, eventId) {
    const p = event.parameters

    if (DEBUG && !DataHandler.seenUnknown.has(eventId)) {
      DataHandler.seenUnknown.add(eventId)
      const shape = Object.keys(p).map((k) => k + ':' + (Array.isArray(p[k]) ? 'array' : typeof p[k])).join(' ')
      try {
        fs.appendFileSync('unknown-events.txt', 'event ' + eventId + ' -> ' + shape + '\n')
      } catch (error) {
        // debug output is best effort
      }
    }

    if (typeof eventId !== 'number' || eventId < 250 || eventId > 320) return

    const looksLikeLoot =
      typeof p[1] === 'string' && p[1].length > 0 &&
      typeof p[2] === 'string' && p[2].length > 0 &&
      !p[3] &&
      Number.isInteger(p[4]) && Items.has(p[4]) &&
      Number.isInteger(p[5]) && p[5] > 0 && p[5] < 100000

    if (!looksLikeLoot) return

    if (!DataHandler.warnedLootIds.has(eventId)) {
      DataHandler.warnedLootIds.add(eventId)
      console.info('\n\tLoot event detected on ID ' + eventId + ' (expected ' + Config.events.EvOtherGrabbedLoot + '). Logging it anyway.\n')
    }

    return EventData.EvOtherGrabbedLoot.handle(event, 'case' + eventId)
  }

  static handleRequestData(event) {
    const eventId = event?.parameters?.[253]
    // console.log(event)

    try {
      switch (eventId) {
        case Config.events.OpInventoryMoveItem: // 30 - OpInventoryMoveItem
          return RequestData.OpInventoryMoveItem.handle(event, 'case30')

        default:
          break
      }
    } catch (error) {
      if (error instanceof ParserError) {
        Logger.warn(error, event)
      } else {
        Logger.error(error, event)
      }
    }
  }

  static handleResponseData(event) {
    const eventId = event?.parameters?.[253]

    try {
      switch (eventId) {
        case Config.events.OpJoin: // 2 - OpJoin
          return ResponseData.OpJoin.handle(event)

        case Config.events.EvMarketData: // 81 - EvMarketData - Market Pages
          return EventData.EvMarketData.handle(event, false)

        case Config.events.EvBlackMarketData: // 82 - EvBlackMarketData - Black Market
          return EventData.EvMarketData.handle(event, true)

        case Config.events.EvMightRanking: // 443 - EvMightRanking - Might Rankings
          return EventData.EvMightRanking.handle(event)

        default:
          break
      }
    } catch (error) {
      if (error instanceof ParserError) {
        Logger.warn(error, event)
      } else {
        Logger.error(error, event)
      }
    }
  }
}

DataHandler.seenUnknown = new Set()
DataHandler.warnedLootIds = new Set()

module.exports = DataHandler

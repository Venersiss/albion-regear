const { version } = require('../package.json')

// Event IDs shift when Albion ships a game update. If loot stops appearing after
// a patch, run with LOOT_LOGGER_DEBUG=1 and compare the IDs in debug-logs.txt.

// Photon/Albion event and operation codes (fixed for the game protocol version in use)
const EVENTS = {
  EvInventoryPutItem: 26,
  EvNewCharacter: 29,
  EvNewEquipmentItem: 30,
  EvNewSiegeBannerItem: 31,
  EvNewSimpleItem: 32,
  EvNewLoot: 98,
  EvAttachItemContainer: 99,
  EvDetachItemContainer: 100,
  EvCharacterStats: 142,
  EvOtherGrabbedLoot: 278,
  EvDied: 164,
  EvNewLootChest: 392,
  EvUpdateLootChest: 393,
  OpJoin: 2,
  OpInventoryMoveItem: 29
}

class Config {
  constructor() {
    this.events = EVENTS

    this.ROTATE_LOGGER_FILE_KEY = 'd'
    this.RESTART_NETWORK_FILE_KEY = 'r'
    this.TITLE = `AO Loot Logger - v${version}`
  }
}

module.exports = new Config()

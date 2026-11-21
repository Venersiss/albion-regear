# AO Loot Logger (Coup De Grace)

Logs loot and killfeed events in Albion Online by reading the game's network traffic, so the guild can review who looted what. It is a patched build of the community LootLogger fork (v1.3.x, Protocol18), with event IDs updated for the current game (see [PATCH-NOTES.txt](PATCH-NOTES.txt)).

It does not modify or inject into the game. It only listens to network packets on your PC.

## Install (Windows)

1. **Install Npcap** from <https://npcap.com/#download>.
   During setup, tick **"Install Npcap in WinPcap API-compatible Mode"**.
2. **Download the Loot Logger**: go to the [latest release](../../releases/latest), download `ao-loot-logger-win.zip` and extract the whole folder anywhere.
3. **Run `Start Loot Logger.cmd`**. It asks for administrator permission by itself and checks that Npcap is installed. Then start Albion Online.
   The window should show **ALBION DETECTED**.
4. **Play.** Log files are written next to the logger:
   - `loot-events-<timestamp>.txt`
   - `killfeed-events-<timestamp>.txt`
5. **View them** on the guild dashboard Loot Logger page (no login needed): drop the `.txt` files in the upload box. Files are parsed in your browser and are not uploaded anywhere.

## Troubleshooting

- A log file is only created when the first event happens.
- Loot logs show loot grabbed by *other* players near you.
- Nothing logged? Run `Start Loot Logger (debug).cmd`, play for a minute, and send `debug-logs.txt` and `unknown-events.txt` to an admin.
- Albion sometimes renumbers its events after an update. If a loot event arrives on an unexpected ID, the logger prints `Loot event detected on ID ...` and logs it anyway.

## Repository layout

- `ao-loot-logger/` - the logger (Node.js). `src/config.js` holds the event IDs.
- `viewer/` - optional local-only viewer at `http://127.0.0.1:8765` (the dashboard page replaces this for most people).

## For maintainers

The release zip is `ao-loot-logger/` plus a `node_modules/` folder that includes the Windows `node.exe` and the compiled `cap` module. `node_modules`, `.zip` and `.exe` files are git-ignored, so build the zip from a folder that has them and attach it to a GitHub Release (the dashboard's download button points at `/releases/latest`).

Network calls the logger makes: the item list from `raw.githubusercontent.com/ao-data/ao-bin-dumps`, and a time-sync lookup to `time.recckless.com`. The update check is off by default (`LOOT_LOGGER_CHECK_UPDATES=1` turns it on).

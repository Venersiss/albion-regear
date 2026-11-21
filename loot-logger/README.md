# AO Loot Logger (Coup De Grace)

Logs loot and killfeed events in Albion Online by reading the game's network traffic, so the guild can review who looted what. Based on [matheussampaio/ao-loot-logger](https://github.com/matheussampaio/ao-loot-logger), patched for current Albion event IDs (see [PATCH-NOTES.txt](PATCH-NOTES.txt)).

It does not modify or inject into the game. It only listens to network packets on your PC.

## Install (Windows)

1. **Install Npcap** from <https://npcap.com/#download>.
   During setup, tick **"Install Npcap in WinPcap API-compatible Mode"**.
2. **Download the Loot Logger**: go to the [latest release](../../releases/latest), download `ao-loot-logger-win.zip` and extract it anywhere.
3. **Run it as Administrator**: right-click the logger, choose *Run as administrator*, then start Albion Online.
   The window should show **ALBION DETECTED**. If not, press the restart key shown in the window.
4. **Play.** Log files are written next to the logger:
   - `loot-events-<timestamp>.txt`
   - `killfeed-events-<timestamp>.txt`
5. **View them** on the guild dashboard Loot Logger page (no login needed): drop the `.txt` files in the upload box. Files are parsed in your browser and are not uploaded anywhere.

## Notes

- Loot logs show loot grabbed by *other* players near you; your own loot uses a separate path.
- A loot file is only created when the first loot event happens.
- If packet capture fails, run as Administrator and confirm Npcap is installed in WinPcap-compatible mode.
- After an Albion update, event IDs can shift and loot may stop appearing. The event map in `ao-loot-logger/_/src/data-handler/` then needs updating.

## Repository layout

- `ao-loot-logger/` - the packet logger (Node.js).
- `viewer/` - optional local-only viewer at `http://127.0.0.1:8765` (the dashboard page replaces this for most people).

## For maintainers

The `.zip`/`.exe` files are git-ignored. Publish `ao-loot-logger-win.zip` as an asset on a GitHub Release so the dashboard's download button (`/releases/latest`) works. The `.cmd` launchers in this folder contain machine-specific paths (`C:\Users\maria\...`) and are only for the original author's PC.

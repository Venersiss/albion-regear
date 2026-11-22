// Small first download: the public Loot Ledger (/loot) loads only its own page,
// everything else loads the dashboard app.
if (/^\/loot\/?$/.test(window.location.pathname)) {
  import('./lootStandalone.jsx')
} else {
  import('./main.jsx')
}

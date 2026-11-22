// Public /loot page on its own, without the admin dashboard code.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { LootLoggerPage } from './lootLogger'
import './lootStandalone.css'

createRoot(document.getElementById('root')).render(<LootLoggerPage standalone />)

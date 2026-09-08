import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  plan: <><path d="M6 3h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h6"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M3 8v8l9 5 9-5V8M12 13v8"/></>,
  settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.3a2 2 0 1 1-4 0v-.2A2 2 0 0 0 5.8 18l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 12a2 2 0 1 1 0-4h.2a2 2 0 0 0 1.4-3.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 9.4.4h.2a2 2 0 1 1 4 0v.2A2 2 0 0 0 17 2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 21.2 8h.2a2 2 0 1 1 0 4h-.2a2 2 0 0 0-1.8 3Z"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  swords: <><path d="m14.5 5.5 4-4 1 1-4 4M13 7l4 4M5 19l6-6M4 20l1-1M3 15l6 6M12 12 4 4"/><path d="m14 4 6 6M4 20h4"/></>,
  close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
}

function Icon({ name, size = 18, className = '' }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

const initialMembers = [
  { name: 'Kestrel', role: 'Frontline', guild: 'Vanguard', avatar: 'K', tone: 'violet', status: 'Ready', chest: 'C-04', last: 'Today, 08:42' },
  { name: 'Mirael', role: 'Support', guild: 'Vanguard', avatar: 'M', tone: 'blue', status: 'Needs regear', chest: 'C-07', last: 'Yesterday, 22:10' },
  { name: 'Oaken', role: 'Tank', guild: 'Vanguard', avatar: 'O', tone: 'green', status: 'Ready', chest: 'C-02', last: 'Today, 09:15' },
  { name: 'Sablefox', role: 'DPS', guild: 'Vanguard', avatar: 'S', tone: 'orange', status: 'Needs regear', chest: 'C-09', last: '2 days ago' },
  { name: 'Tallow', role: 'Healer', guild: 'Vanguard', avatar: 'T', tone: 'rose', status: 'Ready', chest: 'C-03', last: 'Today, 07:58' },
  { name: 'Rook', role: 'Frontline', guild: 'Vanguard', avatar: 'R', tone: 'teal', status: 'Needs regear', chest: 'C-11', last: '3 days ago' },
]

const plans = [
  { title: 'Avalonian Roads — 13 Sep', subtitle: '20:00 UTC · 8 members', status: 'Upcoming', progress: '0 / 8 regeared', date: '13 SEP', accent: 'ember' },
  { title: 'Crystal League — 11 Sep', subtitle: '21:30 UTC · 6 members', status: 'In progress', progress: '4 / 6 regeared', date: '11 SEP', accent: 'blue' },
  { title: 'Open World roam — 08 Sep', subtitle: '19:00 UTC · 12 members', status: 'Complete', progress: '12 / 12 regeared', date: '08 SEP', accent: 'green' },
]

function App() {
  const [active, setActive] = useState('Dashboard')
  const [members, setMembers] = useState(initialMembers)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')

  const filteredMembers = useMemo(() => members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.role.toLowerCase().includes(query.toLowerCase())), [members, query])
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const markRegeared = (name) => { setMembers((current) => current.map((member) => member.name === name ? { ...member, status: 'Ready', last: 'Just now' } : member)); notify(`${name} marked as regeared`) }

  return <div className="app-shell">
    <Sidebar active={active} onNavigate={setActive} />
    <main className="main-content">
      <Topbar query={query} setQuery={setQuery} onNotify={notify} />
      {active === 'Dashboard' && <Dashboard members={members} onOpenMember={() => setShowMemberModal(true)} onOpenPlan={() => setShowPlanModal(true)} onNavigate={setActive} onMark={markRegeared} />}
      {active === 'Regear plans' && <Plans onOpenPlan={() => setShowPlanModal(true)} onMark={markRegeared} />}
      {active === 'Members' && <Members members={filteredMembers} onOpenMember={() => setShowMemberModal(true)} onMark={markRegeared} />}
      {active === 'Armory' && <Armory onNotify={notify} />}
      {active === 'Settings' && <Settings onNotify={notify} />}
      {active === 'Member view' && <MemberView />}
    </main>
    {showMemberModal && <MemberModal onClose={() => setShowMemberModal(false)} onSave={(member) => { setMembers((current) => [...current, member]); setShowMemberModal(false); notify(`${member.name} added to roster`) }} />}
    {showPlanModal && <PlanModal onClose={() => setShowPlanModal(false)} onSave={(name) => { setShowPlanModal(false); notify(`${name} created`) }} />}
    {toast && <div className="toast"><span className="toast-dot" />{toast}</div>}
  </div>
}

function Sidebar({ active, onNavigate }) {
  const nav = [['Dashboard', 'grid'], ['Regear plans', 'plan'], ['Members', 'users'], ['Armory', 'box']]
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark">A<span>R</span></div><div><div className="brand-name">Albion <em>Regear</em></div><div className="brand-caption">VANGUARD GUILD</div></div></div>
    <div className="sidebar-rule" />
    <div className="nav-label">Workspace</div>
    <nav>{nav.map(([label, icon]) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => onNavigate(label)}><Icon name={icon} size={17} /><span>{label}</span>{label === 'Regear plans' && <span className="nav-count">3</span>}</button>)}</nav>
    <div className="sidebar-public"><button className={`nav-item ${active === 'Member view' ? 'active' : ''}`} onClick={() => onNavigate('Member view')}><Icon name="eye" size={17} /><span>Member view</span></button></div>
    <div className="sidebar-bottom">
      <button className={`nav-item ${active === 'Settings' ? 'active' : ''}`} onClick={() => onNavigate('Settings')}><Icon name="settings" size={17} /><span>Settings</span></button>
      <div className="user-card"><div className="avatar avatar-admin">JD</div><div className="user-meta"><strong>Jasper D.</strong><span>Administrator</span></div><button className="icon-button"><Icon name="more" size={17} /></button></div>
      <div className="version">v0.1 prototype <span>·</span> Supabase ready</div>
    </div>
  </aside>
}

function Topbar({ query, setQuery, onNotify }) {
  return <header className="topbar"><div className="mobile-brand"><div className="brand-mark">A<span>R</span></div><strong>Albion <em>Regear</em></strong></div><div className="breadcrumbs"><span>Vanguard Guild</span><Icon name="chevron" size={14} /><strong>Operations room</strong></div><div className="top-actions"><label className="search"><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members..." aria-label="Search members" /><kbd>⌘ K</kbd></label><button className="notification" onClick={() => onNotify('No new alerts')} aria-label="View notifications"><Icon name="bell" size={18} /><i /></button><div className="online"><span /> Live</div></div></header>
}

function PageIntro({ eyebrow, title, description, action, onAction }) { return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <button className="button button-primary" onClick={onAction}><Icon name="plus" size={16} />{action}</button>}</div> }

function Dashboard({ members, onOpenMember, onOpenPlan, onNavigate, onMark }) {
  const needs = members.filter((m) => m.status === 'Needs regear')
  return <div className="page dashboard-page"><PageIntro eyebrow="Tuesday, 08 September 2026" title="Good evening, Jasper." description="The guild is in good shape. Here’s what needs your attention before the next CTA." action="New regear plan" onAction={onOpenPlan} />
    <div className="stat-grid"><StatCard label="Needs regear" value={needs.length.toString().padStart(2, '0')} detail="members waiting" tone="ember" icon="swords" /><StatCard label="Ready to fight" value="18" detail="of 24 members" tone="green" icon="check" /><StatCard label="Next CTA" value="13 Sep" detail="Avalonian Roads · 20:00" tone="blue" icon="plan" /><StatCard label="Items in armory" value="248" detail="92% stocked" tone="purple" icon="box" /></div>
    <div className="dashboard-grid"><section className="panel attention-panel"><PanelHeading title="Needs your attention" action="View all" onAction={() => onNavigate('Members')} /><div className="member-list">{needs.map((member) => <AttentionRow key={member.name} member={member} onMark={() => onMark(member.name)} />)}</div>{needs.length === 0 && <EmptyState text="Everyone is ready for the next fight." />}</section><section className="panel plans-panel"><PanelHeading title="Upcoming plans" action="All plans" onAction={() => onNavigate('Regear plans')} /><div className="plan-list">{plans.slice(0, 3).map((plan) => <PlanRow key={plan.title} plan={plan} />)}</div><button className="panel-footer-link" onClick={onOpenPlan}><Icon name="plus" size={15} /> Schedule another regear</button></section></div>
    <div className="lower-grid"><section className="panel activity-panel"><PanelHeading title="Regear activity" action="Last 7 days" /><div className="chart-wrap"><div className="chart-y"><span>24</span><span>16</span><span>8</span><span>0</span></div><div className="chart"><div className="chart-gridline line-1" /><div className="chart-gridline line-2" /><div className="chart-gridline line-3" /><svg viewBox="0 0 620 190" preserveAspectRatio="none" aria-label="Regear activity chart"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d47736" stopOpacity=".28"/><stop offset="1" stopColor="#d47736" stopOpacity="0"/></linearGradient></defs><path d="M0 141 C32 136 49 119 81 125 S128 157 160 127 S204 77 239 102 S283 135 319 88 S369 49 398 76 S436 116 467 71 S513 81 543 50 S584 39 620 15 L620 190 L0 190Z" fill="url(#area)"/><path d="M0 141 C32 136 49 119 81 125 S128 157 160 127 S204 77 239 102 S283 135 319 88 S369 49 398 76 S436 116 467 71 S513 81 543 50 S584 39 620 15" fill="none" stroke="#d47736" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x"><span>03 Sep</span><span>04 Sep</span><span>05 Sep</span><span>06 Sep</span><span>07 Sep</span><span>08 Sep</span></div></div></div><div className="chart-legend"><span><i className="legend-ember" /> Items issued <strong>86</strong></span><span><i className="legend-muted" /> Members regeared <strong>31</strong></span></div></section><section className="panel chest-panel"><PanelHeading title="Armory at a glance" action="Open armory" onAction={() => onNavigate('Armory')} /><div className="chest-map"><div className="island-grid"><span className="chest chest-a">C-01</span><span className="chest chest-b active-chest">C-04</span><span className="chest chest-c">C-07</span><span className="chest chest-d">C-09</span><span className="chest chest-e">C-11</span><span className="chest chest-f">C-14</span><div className="island-tree tree-1">✦</div><div className="island-tree tree-2">✦</div></div><div className="map-caption"><span className="map-pin" /> Most used chest <strong>C-04</strong><small>· 42 items issued</small></div></div><div className="stock-row"><div><span className="stock-label">Stock health</span><strong>92%</strong></div><div className="stock-bar"><span style={{ width: '92%' }} /></div><span className="stock-good">Good</span></div></section></div>
  </div>
}

function StatCard({ label, value, detail, tone, icon }) { return <div className={`stat-card tone-${tone}`}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon name={icon} size={17} /></div></div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span><div className="stat-spark"><span /><span /><span /><span /><span /><span /></div></div> }
function PanelHeading({ title, action, onAction }) { return <div className="panel-heading"><h2>{title}</h2>{action && <button onClick={onAction}>{action}<Icon name="arrow" size={14} /></button>}</div> }
function AttentionRow({ member, onMark }) { return <div className="attention-row"><div className={`avatar avatar-${member.tone}`}>{member.avatar}</div><div className="row-primary"><strong>{member.name}</strong><span>{member.role} <b>·</b> Chest {member.chest}</span></div><span className="item-summary">{member.role === 'Support' ? 'Holy Staff set' : member.role === 'DPS' ? 'Claymore set' : 'Plate set'}</span><button className="row-action" onClick={onMark}><Icon name="check" size={14} /> Mark ready</button><button className="more-button" aria-label={`More options for ${member.name}`}><Icon name="more" size={16} /></button></div> }
function PlanRow({ plan }) { return <div className="plan-row"><div className={`plan-date date-${plan.accent}`}><strong>{plan.date.split(' ')[0]}</strong><span>{plan.date.split(' ')[1]}</span></div><div className="row-primary"><strong>{plan.title}</strong><span>{plan.subtitle}</span></div><div className={`status status-${plan.accent}`}>{plan.status}</div><span className="plan-progress">{plan.progress}</span><button className="more-button" aria-label={`More options for ${plan.title}`}><Icon name="more" size={16} /></button></div> }
function EmptyState({ text }) { return <div className="empty-state"><Icon name="check" size={20} /><span>{text}</span></div> }

function Plans({ onOpenPlan, onMark }) { return <div className="page"><PageIntro eyebrow="Operations calendar" title="Regear plans" description="Schedule, track, and close out the kits your members need for every fight." action="New regear plan" onAction={onOpenPlan} /><div className="filter-bar"><div className="segmented"><button className="selected">All plans <span>3</span></button><button>Upcoming <span>1</span></button><button>In progress <span>1</span></button><button>Complete <span>1</span></button></div><button className="button button-ghost"><Icon name="plan" size={15} /> Calendar view</button></div><section className="panel plans-table"><div className="table-header"><span>Plan</span><span>State</span><span>Progress</span><span /></div>{plans.map((plan) => <PlanRow key={plan.title} plan={plan} />)}</section><section className="panel plan-note"><div className="note-mark"><Icon name="swords" size={19} /></div><div><strong>Keep your quartermaster loop tight</strong><p>Members can see what’s assigned to them, while only admins can change stock or mark a kit as issued.</p></div></section></div> }

function Members({ members, onOpenMember, onMark }) { return <div className="page"><PageIntro eyebrow="Roster management" title="Members" description="Your roster is the source of truth for every kit and regear hand-off." action="Add member" onAction={onOpenMember} /><div className="filter-bar"><div className="member-count"><strong>{members.length}</strong> active members <span>·</span> <b>3 need attention</b></div><div className="filter-actions"><button className="button button-ghost">All roles <Icon name="chevron" size={14} /></button><button className="button button-ghost">Export roster</button></div></div><section className="panel roster-table"><div className="table-header"><span>Member</span><span>Role</span><span>Chest</span><span>Last regear</span><span>Status</span><span /></div>{members.map((member) => <div className="roster-row" key={member.name}><div className="member-cell"><div className={`avatar avatar-${member.tone}`}>{member.avatar}</div><div><strong>{member.name}</strong><span>{member.guild}</span></div></div><span className="role-cell">{member.role}</span><span className="chest-cell">{member.chest}</span><span className="last-cell">{member.last}</span><span className={`status status-${member.status === 'Ready' ? 'green' : 'ember'}`}>{member.status}</span><button className="more-button" aria-label={`More options for ${member.name}`} onClick={() => member.status !== 'Ready' && onMark(member.name)}><Icon name="more" size={16} /></button></div>)}</section></div> }

function Armory({ onNotify }) { const items = [['Knight Helmet', 'Head', 'C-04', '18 / 24', 75, 'good'], ['Royal Jacket', 'Armor', 'C-04', '21 / 24', 88, 'good'], ['Heavy Mace', 'Weapon', 'C-07', '5 / 8', 62, 'warn'], ['Leering Cane', 'Off hand', 'C-07', '3 / 8', 38, 'low'], ['Soldier Boots', 'Boots', 'C-04', '23 / 24', 96, 'good']]; return <div className="page"><PageIntro eyebrow="Guild island inventory" title="Armory" description="Know what’s in each chest before the call goes out. Low stock is flagged automatically." action="Add item" onAction={() => onNotify('Item form coming with Supabase setup')} /><div className="armory-overview"><div className="panel inventory-total"><span className="eyebrow">Total tracked items</span><strong>248</strong><p>Across 6 chests <span>·</span> 92% healthy</p></div><div className="panel inventory-total"><span className="eyebrow">Needs restock</span><strong className="ember-text">07</strong><p>Items below your minimum threshold</p></div><div className="panel inventory-total"><span className="eyebrow">Last updated</span><strong className="time-value">18:42</strong><p>by Jasper D. <span>·</span> Today</p></div></div><section className="panel inventory-table"><div className="table-header"><span>Item</span><span>Category</span><span>Chest</span><span>Stock</span><span>Health</span><span /></div>{items.map(([name, category, chest, stock, percentage, tone]) => <div className="inventory-row" key={name}><div className="item-cell"><div className={`item-icon item-${tone}`}><Icon name={category === 'Weapon' ? 'swords' : 'box'} size={16} /></div><strong>{name}</strong></div><span>{category}</span><span className="chest-cell">{chest}</span><span>{stock}</span><div className="health-cell"><div className="mini-bar"><i className={`bar-${tone}`} style={{ width: `${percentage}%` }} /></div><span>{percentage}%</span></div><button className="more-button" onClick={() => onNotify(`${name} details opened`)} aria-label={`Open ${name}`}><Icon name="more" size={16} /></button></div>)}</section></div> }

function Settings({ onNotify }) { return <div className="page"><PageIntro eyebrow="Guild configuration" title="Settings" description="Control how your guild uses Albion Regear." /><section className="settings-grid"><div className="panel settings-nav"><button className="settings-link active">Guild profile</button><button className="settings-link">Regear defaults</button><button className="settings-link">Admin access</button><button className="settings-link">Notifications</button></div><div className="panel settings-form"><div className="form-section"><span className="eyebrow">Guild profile</span><h2>Make it yours</h2><p>This is how the operations room identifies your guild.</p><label>Guild name<input defaultValue="Vanguard Guild" /></label><label>Server region<select defaultValue="Americas"><option>Americas</option><option>Europe</option><option>Asia</option></select></label><button className="button button-primary" onClick={() => onNotify('Guild profile saved')}>Save changes</button></div></div></section></div> }

function MemberView() { return <div className="page member-view-page"><PageIntro eyebrow="Public member board · no account needed" title="Your kit, at a glance." description="Members can check their assigned regear and storage chest here. Only administrators can edit this information." /><div className="member-board"><section className="panel board-welcome"><div className="board-sigil"><Icon name="swords" size={24} /></div><div><span className="eyebrow">Viewing as</span><h2>Kestrel</h2><p>Frontline <span>·</span> Vanguard Guild</p></div><button className="button button-ghost">Change character <Icon name="chevron" size={14} /></button></section><div className="board-grid"><section className="panel board-cta"><div className="board-label"><span className="status status-ember">Upcoming</span><span className="eyebrow">Next regear plan</span></div><h2>Avalonian Roads</h2><p>Saturday, 13 September · 20:00 UTC</p><div className="cta-rule" /><div className="cta-meta"><div><span>Meet at</span><strong>Guild island</strong></div><div><span>Your chest</span><strong className="ember-text">C-04</strong></div></div></section><section className="panel kit-panel"><div className="panel-heading"><h2>Your assigned kit</h2><span className="status status-green">Ready to issue</span></div><div className="kit-list"><KitItem label="Weapon" value="Claymore" /><KitItem label="Off hand" value="Mistcaller" /><KitItem label="Helmet" value="Knight Helmet" /><KitItem label="Armor" value="Royal Jacket" /><KitItem label="Boots" value="Soldier Boots" /></div></section></div></div></div> }
function KitItem({ label, value }) { return <div className="kit-item"><span>{label}</span><strong>{value}</strong><Icon name="check" size={14} /></div> }

function Modal({ title, eyebrow, children, onClose }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="close-button" onClick={onClose} aria-label="Close"><Icon name="close" size={19} /></button></div>{children}</div></div> }
function MemberModal({ onClose, onSave }) { const [name, setName] = useState(''); const [role, setRole] = useState('Frontline'); const [chest, setChest] = useState('C-04'); return <Modal title="Add guild member" eyebrow="Roster management" onClose={onClose}><div className="form-grid"><label>Character name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightjar" /></label><label>Role<select value={role} onChange={(e) => setRole(e.target.value)}><option>Frontline</option><option>Support</option><option>Tank</option><option>DPS</option><option>Healer</option></select></label><label>Regear chest<select value={chest} onChange={(e) => setChest(e.target.value)}><option>C-02</option><option>C-03</option><option>C-04</option><option>C-07</option><option>C-09</option><option>C-11</option></select></label><label>Notes<input placeholder="Optional note" /></label></div><div className="modal-footer"><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), role, guild: 'Vanguard', avatar: name.trim()[0]?.toUpperCase() || '?', tone: 'teal', status: 'Needs regear', chest, last: 'Not yet' })}>Add member</button></div></Modal> }
function PlanModal({ onClose, onSave }) { const [name, setName] = useState(''); return <Modal title="New regear plan" eyebrow="Operations calendar" onClose={onClose}><div className="form-grid"><label>Plan name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Avalonian Roads" /></label><label>Date<input type="date" defaultValue="2026-09-13" /></label><label>Start time<input type="time" defaultValue="20:00" /></label><label>Members<select defaultValue="Select members"><option>Select members</option><option>All frontline</option><option>Members needing regear</option></select></label></div><div className="kit-callout"><Icon name="swords" size={18} /><div><strong>Quick start with a kit template</strong><span>Choose members and items after creating the plan.</span></div></div><div className="modal-footer"><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Create plan</button></div></Modal> }

createRoot(document.getElementById('root')).render(<App />)

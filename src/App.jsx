import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Chart as ChartJS, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import { SHEET_ID, API_KEY, SHEET_TAB } from './config.js'
import './App.css'

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

// ── JX Standards — Pho3nix 2024-25, 10yr girl, Long Course ───────────────────
const JX_LC = {
  'Freestyle|50':          { gold: 34.31, silver: 35.91, bronze: 38.14 },
  'Butterfly|50':          { gold: 35.73, silver: 37.62, bronze: 40.02 },
  'Backstroke|50':         { gold: 38.51, silver: 40.30, bronze: 42.18 },
  'Breaststroke|50':       { gold: 42.65, silver: 44.70, bronze: 47.51 },
  'Individual Medley|200': { gold: 178.63, silver: 190.19, bronze: 200.99 },
  'IM|200':                { gold: 178.63, silver: 190.19, bronze: 200.99 },
  'Medley|200':            { gold: 178.63, silver: 190.19, bronze: 200.99 },
}

function getJX(stroke, distance, course) {
  if (course !== 'Long') return null
  return JX_LC[`${stroke}|${distance}`] || null
}

function jxLevel(time, jx) {
  if (!jx || time == null) return null
  if (time <= jx.gold)   return 'gold'
  if (time <= jx.silver) return 'silver'
  if (time <= jx.bronze) return 'bronze'
  return null
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null
  str = String(str).trim()
  const au = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (au) return new Date(+au[3], +au[2] - 1, +au[1])
  const dash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dash) return new Date(+dash[3], +dash[2] - 1, +dash[1])
  const d = new Date(str)
  return isNaN(d) ? null : d
}

function toISO(str) {
  const d = parseDate(str)
  if (!d) return str
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function parseTime(str) {
  if (!str) return null
  str = String(str).trim()
  if (str.includes(':')) {
    const [m, s] = str.split(':')
    const v = parseInt(m, 10) * 60 + parseFloat(s)
    return isNaN(v) ? null : v
  }
  const v = parseFloat(str)
  return isNaN(v) ? null : v
}

function formatTime(secs) {
  if (secs == null || isNaN(secs)) return '—'
  if (secs >= 60) {
    const m = Math.floor(secs / 60)
    const s = (secs % 60).toFixed(2).padStart(5, '0')
    return `${m}:${s}`
  }
  return secs.toFixed(2)
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function distLabel(d) {
  const n = parseInt(d, 10)
  return isNaN(n) ? d : `${n}m`
}

function courseTag(c) {
  if (c === 'Long')  return 'LC'
  if (c === 'Short') return 'SC'
  return c
}

function eventKey(r) { return `${r.stroke}|${r.distance}|${r.course}` }

const LINE_COLORS = {
  dark:  ['#00c9a7','#a78bfa','#4ade80','#fb923c','#f472b6','#facc15','#60a5fa','#38bdf8'],
  light: ['#2a7d78','#6d4fb0','#3a8a58','#b55e18','#9e3f74','#9a7010','#2c5fa0','#2a7d78'],
}

// ── Data fetching ─────────────────────────────────────────────────────────────
function shapeRow(cells, headers) {
  const r = {}
  headers.forEach((h, i) => { r[h.trim()] = (cells[i] || '').trim() })
  return {
    isoDate: toISO(r.Date), rawDate: r.Date,
    meet: r.Meet, stroke: r.Stroke, distance: r.Distance,
    course: r.Course, country: r.Country, age: r.Age,
    verified: r.Verified, timeStr: r.Time, time: parseTime(r.Time),
  }
}

async function fetchSheetData() {
  const range = encodeURIComponent(`${SHEET_TAB}!A:I`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  const json = await res.json()
  const [headers, ...dataRows] = json.values || []
  if (!headers) return []
  return dataRows
    .map(cells => shapeRow(cells, headers))
    .filter(r => r.isoDate && r.time != null)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

// ── Race Review storage (localStorage) ───────────────────────────────────────
const REVIEW_KEY = 'indy-swim-reviews'

function loadReviews() {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}') } catch { return {} }
}

function saveReview(key, review) {
  try {
    const all = loadReviews()
    all[key] = review
    localStorage.setItem(REVIEW_KEY, JSON.stringify(all))
  } catch {}
}

function reviewKey(r) { return `${r.isoDate}|${r.stroke}|${r.distance}|${r.course}|${r.timeStr}` }

// ── Main App ──────────────────────────────────────────────────────────────────
const STROKE_ORDER = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley', 'IM', 'Medley']

export default function App() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [view,    setView]    = useState('progression')
  const [reviews, setReviews] = useState(() => loadReviews())
  const [theme,   setTheme]   = useState(() => {
    try { return localStorage.getItem('indy-theme') || 'dark' } catch { return 'dark' }
  })

  const [fStroke,  setFStroke]  = useState('All')
  const [fDist,    setFDist]    = useState('All')
  const [fCourse,  setFCourse]  = useState('All')
  const [fCountry, setFCountry] = useState('All')

  useEffect(() => {
    fetchSheetData().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    try { localStorage.setItem('indy-theme', theme) } catch {}
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const opts = useMemo(() => {
    const uniq = key => [...new Set(rows.map(r => r[key]).filter(Boolean))]
    return {
      strokes:   uniq('stroke').sort(),
      distances: uniq('distance').sort((a,b) => parseInt(a) - parseInt(b)),
      courses:   uniq('course').sort(),
      countries: uniq('country').sort(),
    }
  }, [rows])

  const filtered = useMemo(() =>
    rows.filter(r =>
      (fStroke  === 'All' || r.stroke   === fStroke)  &&
      (fDist    === 'All' || r.distance === fDist)    &&
      (fCourse  === 'All' || r.course   === fCourse)  &&
      (fCountry === 'All' || r.country  === fCountry)
    ), [rows, fStroke, fDist, fCourse, fCountry])

  const chartReady = fStroke !== 'All' && fDist !== 'All'

  const groups = useMemo(() => {
    if (!chartReady) return new Map()
    const map = new Map()
    filtered.forEach(r => {
      const k = eventKey(r)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(r)
    })
    return map
  }, [filtered, chartReady])

  const runningPB = useMemo(() => {
    const map = new Map()
    groups.forEach((eventRows, key) => {
      let best = Infinity
      map.set(key, eventRows.map(r => { const isNew = r.time < best; if (isNew) best = r.time; return isNew }))
    })
    return map
  }, [groups])

  const currentPBMap = useMemo(() => {
    const map = new Map()
    groups.forEach((eventRows, key) => { map.set(key, Math.min(...eventRows.map(r => r.time))) })
    return map
  }, [groups])

  const allPBs = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      const k = eventKey(r)
      if (!map.has(k) || r.time < map.get(k).time) map.set(k, r)
    })
    return map
  }, [rows])

  // JX dashed reference lines for the chart
  const jxDatasets = useMemo(() => {
    if (!chartReady || fCourse === 'All') return []
    const jx = getJX(fStroke, fDist, fCourse)
    if (!jx) return []
    const dates = filtered.map(r => r.isoDate).sort()
    if (!dates.length) return []
    const start = dates[0]; const end = dates[dates.length - 1]
    return [
      { y: jx.gold,   label: `JX Gold ${formatTime(jx.gold)}`,   color: '#d97706' },
      { y: jx.silver, label: `JX Silver ${formatTime(jx.silver)}`, color: '#94a3b8' },
      { y: jx.bronze, label: `JX Bronze ${formatTime(jx.bronze)}`, color: '#b45309' },
    ].map(({ y, label, color }) => ({
      label, borderColor: color, backgroundColor: 'transparent',
      data: [{ x: start, y }, { x: end, y }],
      borderWidth: 1.5, borderDash: [6, 4],
      pointRadius: 0, pointHoverRadius: 0, tension: 0,
    }))
  }, [chartReady, fStroke, fDist, fCourse, filtered])

  const chartData = useMemo(() => {
    const entries = [...groups.entries()]
    const colors = LINE_COLORS[theme] || LINE_COLORS.dark
    const swimDatasets = entries.map(([, eventRows], idx) => {
      const pbFlags = runningPB.get(eventKey(eventRows[0]))
      const color = colors[idx % colors.length]
      return {
        label: `${eventRows[0].stroke} ${distLabel(eventRows[0].distance)} ${courseTag(eventRows[0].course)}`,
        data: eventRows.map((r, i) => ({ x: r.isoDate, y: r.time, meet: r.meet, timeStr: r.timeStr, isPB: pbFlags[i] })),
        borderColor: color, backgroundColor: 'transparent',
        borderWidth: 2.5,
        pointBackgroundColor: eventRows.map((_, i) => pbFlags[i] ? '#22c55e' : color),
        pointBorderColor:     eventRows.map((_, i) => pbFlags[i] ? '#166534' : color),
        pointRadius:          eventRows.map((_, i) => pbFlags[i] ? 7 : 4.5),
        pointHoverRadius: 9, tension: 0.4, fill: false,
      }
    })
    return { datasets: [...swimDatasets, ...jxDatasets] }
  }, [groups, runningPB, jxDatasets, theme])

  const chartOptions = useMemo(() => {
    const dark = theme === 'dark'
    return {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', displayFormats: { month: 'MMM yy' } },
          grid: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' },
          ticks: { color: dark ? '#4a5568' : '#7a9090', maxTicksLimit: 8 },
          border: { color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
        },
        y: {
          reverse: false,
          grid: { color: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' },
          ticks: { color: dark ? '#4a5568' : '#7a9090', callback: v => formatTime(v) },
          border: { color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
        },
      },
      plugins: {
        legend: { position: 'top', labels: { color: dark ? '#64748b' : '#7a9090', boxWidth: 10, padding: 14, font: { size: 11 } } },
        tooltip: {
          filter: item => !!item.raw?.timeStr,
          callbacks: {
            title: items => formatDate(items[0].raw.x),
            label: item => {
              const { timeStr, isPB, meet } = item.raw
              return ` ${item.dataset.label}: ${timeStr}${isPB ? ' ★ PB' : ''}${meet ? `  ·  ${meet}` : ''}`
            },
          },
          backgroundColor: dark ? '#1a1a1a' : '#ffffff',
          titleColor: dark ? '#f0f0f0' : '#1a2626',
          bodyColor: dark ? '#a0aec0' : '#4a6060',
          borderColor: dark ? '#2e2e2e' : '#dde6e5',
          borderWidth: 1, padding: 10,
        },
      },
    }
  }, [theme])

  const metrics = useMemo(() => {
    if (!filtered.length || !chartReady) return null
    const times = filtered.map(r => r.time)
    const pb = Math.min(...times); const worst = Math.max(...times)
    return {
      count: filtered.length,
      pb: formatTime(pb),
      improvement: worst > pb ? `${((worst - pb) / worst * 100).toFixed(1)}%` : '—',
      meets: new Set(filtered.map(r => r.meet).filter(Boolean)).size,
    }
  }, [filtered, chartReady])

  const handleSaveReview = useCallback((key, review) => {
    saveReview(key, review)
    setReviews(loadReviews())
  }, [])

  const clearFilters = () => { setFStroke('All'); setFDist('All'); setFCourse('All'); setFCountry('All') }
  const hasFilters = fStroke !== 'All' || fDist !== 'All' || fCourse !== 'All' || fCountry !== 'All'

  if (loading) return <div className="splash"><div className="spinner"/><p>Loading swim data…</p></div>
  if (error) return (
    <div className="splash error">
      <h2>Could not load data</h2>
      <p className="err-msg">{error}</p>
    </div>
  )

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <div className="header-left">
            <span className="header-icon">🏊</span>
            <div>
              <h1>Indy's Swim Tracker</h1>
              <p className="subtitle">Indigo Riordan — Time Progression</p>
            </div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        <button className={view === 'progression' ? 'active' : ''} onClick={() => setView('progression')}>Progression</button>
        <button className={view === 'pbs' ? 'active' : ''} onClick={() => setView('pbs')}>Personal Bests</button>
        <button className={view === 'meet' ? 'active' : ''} onClick={() => setView('meet')}>Meet Recap</button>
      </nav>

      {view === 'progression' && (
        <>
          <section className="filters card">
            <FilterSelect label="Stroke"   value={fStroke}  onChange={setFStroke}  options={opts.strokes} />
            <FilterSelect label="Distance" value={fDist}    onChange={setFDist}    options={opts.distances} distMode />
            <FilterSelect label="Course"   value={fCourse}  onChange={setFCourse}  options={opts.courses} />
            <FilterSelect label="Country"  value={fCountry} onChange={setFCountry} options={opts.countries} />
            {hasFilters && <button className="reset-btn" onClick={clearFilters}>Clear</button>}
          </section>

          {metrics && (
            <section className="metrics">
              <MetricCard label="Results"          value={metrics.count} />
              <MetricCard label="Personal Best"    value={metrics.pb} highlight />
              <MetricCard label="Best Improvement" value={metrics.improvement} />
              <MetricCard label="Meets"            value={metrics.meets} />
            </section>
          )}

          <section className="chart-card card">
            {!chartReady ? (
              <div className="chart-prompt">
                <div className="chart-prompt-icon">📈</div>
                <p>Select a <strong>Stroke</strong> and <strong>Distance</strong> to view progression</p>
              </div>
            ) : chartData.datasets.some(d => d.data.some(p => p.timeStr)) ? (
              <>
                <div className="chart-wrap">
                  <Line data={chartData} options={chartOptions} />
                </div>
                <p className="chart-note">Green dots = new PB at time of swim · Lower = faster</p>
              </>
            ) : (
              <div className="empty">No results match the current filters.</div>
            )}
          </section>

          <section className="table-card card">
            <ResultsTable
              rows={chartReady ? filtered : [...rows].sort((a,b) => b.isoDate.localeCompare(a.isoDate)).slice(0, 20)}
              currentPBMap={currentPBMap}
              reviews={reviews}
              onSaveReview={handleSaveReview}
              showRecentLabel={!chartReady}
            />
          </section>
        </>
      )}

      {view === 'pbs' && <PBsView allPBs={allPBs} />}
      {view === 'meet' && <MeetRecapView rows={rows} />}
    </div>
  )
}

// ── Filter Select ─────────────────────────────────────────────────────────────
function FilterSelect({ label, value, onChange, options, distMode }) {
  return (
    <div className="filter">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="All">All</option>
        {options.map(o => <option key={o} value={o}>{distMode ? distLabel(o) : o}</option>)}
      </select>
    </div>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, highlight }) {
  return (
    <div className={`metric-card${highlight ? ' pb' : ''}`}>
      <div className="metric-val">{value}</div>
      <div className="metric-lbl">{label}</div>
    </div>
  )
}

// ── Results Table + Race Review ───────────────────────────────────────────────
const REVIEW_PHASES = ['Dive', 'Underwater', 'Stroke', 'Finish']

function ResultsTable({ rows, currentPBMap, reviews, onSaveReview, showRecentLabel }) {
  const [expandedKey, setExpandedKey] = useState(null)
  const [draft, setDraft] = useState({})

  const sorted = useMemo(() => [...rows].sort((a,b) => b.isoDate.localeCompare(a.isoDate)), [rows])

  function openReview(r) {
    const k = reviewKey(r)
    if (expandedKey === k) { setExpandedKey(null); return }
    setDraft(reviews[k] || { dive: 0, underwater: 0, stroke: 0, finish: 0, notes: '' })
    setExpandedKey(k)
  }

  function handleSave(r) {
    onSaveReview(reviewKey(r), draft)
    setExpandedKey(null)
  }

  return (
    <div className="table-wrap">
      {showRecentLabel && <p className="table-label">20 most recent results</p>}
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Meet</th><th>Stroke</th><th>Dist</th>
            <th>Course</th><th>Country</th><th>Age</th><th>Time</th><th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const isPB = currentPBMap.get(eventKey(r)) === r.time
            const rk = reviewKey(r)
            const hasReview = !!reviews[rk]
            const isOpen = expandedKey === rk
            return (
              <>
                <tr key={i} className={isPB ? 'pb-row' : ''}>
                  <td>{formatDate(r.isoDate)}</td>
                  <td>{r.meet}</td>
                  <td>{r.stroke}</td>
                  <td>{distLabel(r.distance)}</td>
                  <td>{courseTag(r.course)}</td>
                  <td>{r.country}</td>
                  <td>{r.age}</td>
                  <td className={isPB ? 'pb-time' : ''}>{r.timeStr}{isPB ? ' ★' : ''}</td>
                  <td>
                    <button
                      className={`review-btn${hasReview ? ' has-review' : ''}${isOpen ? ' open' : ''}`}
                      onClick={() => openReview(r)}
                      title={hasReview ? 'View/edit review' : 'Add race review'}
                    >
                      {hasReview ? '★' : '+'}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr key={rk + '-review'} className="review-row">
                    <td colSpan={9}>
                      <div className="review-panel">
                        <div className="review-ratings">
                          {REVIEW_PHASES.map(phase => {
                            const field = phase.toLowerCase()
                            return (
                              <div key={phase} className="review-phase">
                                <span className="review-phase-label">{phase}</span>
                                <div className="review-stars">
                                  {[1,2,3,4,5].map(n => (
                                    <button
                                      key={n}
                                      className={`star-btn${draft[field] >= n ? ' active' : ''}`}
                                      onClick={() => setDraft(d => ({ ...d, [field]: d[field] === n ? 0 : n }))}
                                    >{n}</button>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <textarea
                          className="review-notes"
                          placeholder="Anything worth remembering? (optional)"
                          value={draft.notes || ''}
                          onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                          rows={2}
                        />
                        <div className="review-actions">
                          <button className="review-save" onClick={() => handleSave(r)}>Save review</button>
                          <button className="review-cancel" onClick={() => setExpandedKey(null)}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Personal Bests View ───────────────────────────────────────────────────────
function PBsView({ allPBs }) {
  const byStroke = useMemo(() => {
    const map = {}
    allPBs.forEach(r => {
      if (!map[r.stroke]) map[r.stroke] = []
      map[r.stroke].push(r)
    })
    Object.values(map).forEach(arr => arr.sort((a,b) => parseInt(a.distance) - parseInt(b.distance)))
    return map
  }, [allPBs])

  const ordered = [
    ...STROKE_ORDER.filter(s => byStroke[s]),
    ...Object.keys(byStroke).filter(s => !STROKE_ORDER.includes(s)).sort(),
  ]

  return (
    <div className="pbs-view">
      <div className="pbs-grid">
        {ordered.map(stroke => (
          <div key={stroke} className="pbs-card card">
            <h3 className="pbs-stroke-name">{stroke}</h3>
            <div className="pbs-entries">
              {byStroke[stroke].map((r, i) => {
                const jx = getJX(r.stroke, r.distance, r.course)
                const level = jxLevel(r.time, jx)
                return (
                  <div key={i} className="pbs-entry">
                    <div className="pbs-time">{r.timeStr}</div>
                    <div className="pbs-entry-tags">
                      <span className="pbs-tag">{distLabel(r.distance)}</span>
                      <span className={`pbs-tag course-tag-${r.course.toLowerCase()}`}>{courseTag(r.course)}</span>
                      {level && <span className={`jx-badge jx-${level}`}>JX {level[0].toUpperCase() + level.slice(1)}</span>}
                    </div>
                    <div className="pbs-entry-meta">{formatDate(r.isoDate)} · {r.meet}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="pbs-note">JX = Pho3nix Junior Excellence · Long Course only · 2024-25 season · 10yr girl</p>
    </div>
  )
}

// ── Meet Recap View ───────────────────────────────────────────────────────────
function MeetRecapView({ rows }) {
  // Build sorted meet list: most recent first
  const meets = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      if (!r.meet) return
      const existing = map.get(r.meet)
      if (!existing || r.isoDate > existing.date) {
        map.set(r.meet, { name: r.meet, date: r.isoDate, country: r.country })
      }
    })
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [rows])

  const [selectedMeet, setSelectedMeet] = useState(() => meets[0]?.name || '')

  // Keep selectedMeet in sync if data loads after render
  useEffect(() => {
    if (!selectedMeet && meets.length) setSelectedMeet(meets[0].name)
  }, [meets, selectedMeet])

  const meetRows = useMemo(() =>
    rows.filter(r => r.meet === selectedMeet).sort((a, b) => {
      // Sort by stroke order, then distance
      const si = STROKE_ORDER.indexOf(a.stroke)
      const sj = STROKE_ORDER.indexOf(b.stroke)
      if (si !== sj) return (si === -1 ? 99 : si) - (sj === -1 ? 99 : sj)
      return parseInt(a.distance) - parseInt(b.distance)
    }), [rows, selectedMeet])

  // For each swim in this meet, find the PB that existed BEFORE this meet date
  // (i.e., best time for that event from all results with an earlier date)
  const priorPBs = useMemo(() => {
    const meetDate = meets.find(m => m.name === selectedMeet)?.date || ''
    const map = new Map()
    rows.forEach(r => {
      if (r.isoDate >= meetDate) return  // only use swims strictly before this meet
      const k = eventKey(r)
      if (!map.has(k) || r.time < map.get(k)) map.set(k, r.time)
    })
    return map
  }, [rows, selectedMeet, meets])

  if (!meets.length) return (
    <div className="meet-recap-empty card">
      <div className="chart-prompt-icon">🏆</div>
      <p>No meet data available yet.</p>
    </div>
  )

  // Summary stats
  const pbsSet = meetRows.filter(r => {
    const prior = priorPBs.get(eventKey(r))
    return prior == null || r.time < prior
  }).length

  const improvements = meetRows
    .map(r => { const prior = priorPBs.get(eventKey(r)); return prior ? prior - r.time : null })
    .filter(d => d != null && d > 0)

  const biggestImprovement = improvements.length ? Math.max(...improvements) : null

  const meetInfo = meets.find(m => m.name === selectedMeet)

  return (
    <div className="meet-recap">
      {/* Meet selector */}
      <div className="meet-selector card">
        <label className="meet-selector-label">Select meet</label>
        <select
          className="meet-selector-select"
          value={selectedMeet}
          onChange={e => setSelectedMeet(e.target.value)}
        >
          {meets.map(m => (
            <option key={m.name} value={m.name}>
              {m.name} · {formatDate(m.date)}
            </option>
          ))}
        </select>
      </div>

      {/* Meet header */}
      <div className="meet-header card">
        <div className="meet-header-info">
          <h2 className="meet-name">{selectedMeet}</h2>
          <p className="meet-meta">{meetInfo ? formatDate(meetInfo.date) : ''}{meetInfo?.country ? ` · ${meetInfo.country}` : ''}</p>
        </div>
        <div className="meet-summary-stats">
          <div className="meet-stat">
            <div className="meet-stat-val">{meetRows.length}</div>
            <div className="meet-stat-lbl">Swims</div>
          </div>
          <div className={`meet-stat${pbsSet > 0 ? ' pb' : ''}`}>
            <div className="meet-stat-val">{pbsSet}</div>
            <div className="meet-stat-lbl">New PBs</div>
          </div>
          {biggestImprovement != null && (
            <div className="meet-stat">
              <div className="meet-stat-val">−{biggestImprovement.toFixed(2)}s</div>
              <div className="meet-stat-lbl">Best drop</div>
            </div>
          )}
        </div>
      </div>

      {/* Swim cards */}
      <div className="meet-swims">
        {meetRows.map((r, i) => {
          const prior = priorPBs.get(eventKey(r))
          const delta = prior != null ? prior - r.time : null  // positive = faster
          const isNewPB = prior == null || r.time < prior
          const isFirstEver = prior == null
          const jx = getJX(r.stroke, r.distance, r.course)
          const level = jxLevel(r.time, jx)
          const pct = prior ? Math.abs(delta / prior * 100) : null

          return (
            <div key={i} className={`meet-swim-card card${isNewPB ? ' meet-swim-pb' : ''}`}>
              <div className="meet-swim-event">
                <span className="meet-swim-stroke">{r.stroke}</span>
                <span className="pbs-tag">{distLabel(r.distance)}</span>
                <span className={`pbs-tag course-tag-${r.course.toLowerCase()}`}>{courseTag(r.course)}</span>
                {level && <span className={`jx-badge jx-${level}`}>JX {level[0].toUpperCase() + level.slice(1)}</span>}
              </div>

              <div className="meet-swim-times">
                <div className="meet-swim-time">{r.timeStr}</div>
                <div className="meet-swim-delta">
                  {isFirstEver ? (
                    <span className="delta-pb">First ever ★</span>
                  ) : isNewPB ? (
                    <span className="delta-pb">↓ {Math.abs(delta).toFixed(2)}s PB {pct ? `(${pct.toFixed(1)}%)` : ''} ★</span>
                  ) : delta != null ? (
                    <span className={delta >= 0 ? 'delta-faster' : 'delta-slower'}>
                      {delta >= 0 ? `↓ ${delta.toFixed(2)}s faster` : `↑ ${Math.abs(delta).toFixed(2)}s slower`}
                      {pct ? ` (${pct.toFixed(1)}%)` : ''}
                    </span>
                  ) : null}
                </div>
                {prior != null && (
                  <div className="meet-swim-pb-label">PB going in: {formatTime(prior)}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

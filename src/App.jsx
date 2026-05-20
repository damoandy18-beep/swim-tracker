import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import { SHEET_ID, API_KEY, SHEET_TAB } from './config.js'
import './App.css'

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

// ── Utilities ─────────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null
  str = String(str).trim()
  // DD/MM/YYYY or D/M/YYYY (Australian format)
  const au = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (au) return new Date(+au[3], +au[2] - 1, +au[1])
  // DD-MM-YYYY
  const dash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dash) return new Date(+dash[3], +dash[2] - 1, +dash[1])
  const d = new Date(str)
  return isNaN(d) ? null : d
}

function toISO(str) {
  const d = parseDate(str)
  if (!d) return str
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseTime(str) {
  if (!str) return null
  str = String(str).trim()
  if (str.includes(':')) {
    const [m, s] = str.split(':')
    const val = parseInt(m, 10) * 60 + parseFloat(s)
    return isNaN(val) ? null : val
  }
  const val = parseFloat(str)
  return isNaN(val) ? null : val
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

function eventKey(r) {
  return `${r.stroke}|${r.distance}|${r.course}`
}

function eventLabel(r) {
  return `${r.stroke} ${distLabel(r.distance)} ${r.course}`
}

const LINE_COLORS = [
  '#4fc3f7', '#ce93d8', '#80cbc4', '#ffd54f', '#ff8a65',
  '#a5d6a7', '#ef9a9a', '#90caf9', '#f48fb1', '#ffe082',
]

// ── Data fetching ─────────────────────────────────────────────────────────────

function shapeRow(cells, headers) {
  const r = {}
  headers.forEach((h, i) => { r[h.trim()] = (cells[i] || '').trim() })
  const isoDate = toISO(r.Date)
  const time = parseTime(r.Time)
  return { isoDate, rawDate: r.Date, meet: r.Meet, stroke: r.Stroke, distance: r.Distance, course: r.Course, country: r.Country, age: r.Age, verified: r.Verified, timeStr: r.Time, time }
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

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [fStroke, setFStroke] = useState('All')
  const [fDist, setFDist] = useState('All')
  const [fCourse, setFCourse] = useState('All')
  const [fCountry, setFCountry] = useState('All')

  useEffect(() => {
    fetchSheetData()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const opts = useMemo(() => {
    const uniq = (key) => [...new Set(rows.map(r => r[key]).filter(Boolean))]
    return {
      strokes: uniq('stroke').sort(),
      distances: uniq('distance').sort((a, b) => parseInt(a) - parseInt(b)),
      courses: uniq('course').sort(),
      countries: uniq('country').sort(),
    }
  }, [rows])

  const filtered = useMemo(() =>
    rows.filter(r =>
      (fStroke === 'All' || r.stroke === fStroke) &&
      (fDist === 'All' || r.distance === fDist) &&
      (fCourse === 'All' || r.course === fCourse) &&
      (fCountry === 'All' || r.country === fCountry)
    ), [rows, fStroke, fDist, fCourse, fCountry])

  // Group by event for chart
  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach(r => {
      const k = eventKey(r)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(r)
    })
    return map
  }, [filtered])

  // Running PB flags per event (in date order)
  const runningPB = useMemo(() => {
    const map = new Map()
    groups.forEach((eventRows, key) => {
      let best = Infinity
      map.set(key, eventRows.map(r => {
        const isNew = r.time < best
        if (isNew) best = r.time
        return isNew
      }))
    })
    return map
  }, [groups])

  // Current all-time PB per event (for table highlighting)
  const currentPB = useMemo(() => {
    const map = new Map()
    groups.forEach((eventRows, key) => {
      map.set(key, Math.min(...eventRows.map(r => r.time)))
    })
    return map
  }, [groups])

  // Chart datasets
  const chartData = useMemo(() => {
    const entries = [...groups.entries()]
    return {
      datasets: entries.map(([key, eventRows], idx) => {
        const pbFlags = runningPB.get(key)
        const color = LINE_COLORS[idx % LINE_COLORS.length]
        return {
          label: eventLabel(eventRows[0]),
          data: eventRows.map((r, i) => ({
            x: r.isoDate,
            y: r.time,
            meet: r.meet,
            timeStr: r.timeStr,
            isPB: pbFlags[i],
          })),
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: eventRows.map((_, i) => pbFlags[i] ? '#22c55e' : color),
          pointBorderColor: eventRows.map((_, i) => pbFlags[i] ? '#166534' : color),
          pointRadius: eventRows.map((_, i) => pbFlags[i] ? 7 : 4),
          pointHoverRadius: 9,
          tension: 0.25,
          fill: false,
        }
      })
    }
  }, [groups, runningPB])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'month', displayFormats: { month: 'MMM yy', year: 'yyyy' } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#64748b', maxTicksLimit: 10 },
      },
      y: {
        reverse: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: '#64748b',
          callback: v => formatTime(v),
        },
        title: { display: true, text: '← Faster', color: '#475569', font: { size: 11 } },
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#cbd5e1', boxWidth: 10, padding: 16, font: { size: 12 } },
      },
      tooltip: {
        callbacks: {
          title: items => formatDate(items[0].raw.x),
          label: item => {
            const { timeStr, isPB, meet } = item.raw
            const pb = isPB ? ' ★ PB' : ''
            return ` ${item.dataset.label}: ${timeStr}${pb}${meet ? `  ·  ${meet}` : ''}`
          },
        },
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
      },
    },
  }), [])

  // Summary metrics
  const metrics = useMemo(() => {
    if (!filtered.length) return null
    const times = filtered.map(r => r.time)
    const pb = Math.min(...times)
    const worst = Math.max(...times)
    const improvement = worst > pb ? ((worst - pb) / worst * 100).toFixed(1) : '0.0'
    const meets = new Set(filtered.map(r => r.meet).filter(Boolean)).size
    return { count: filtered.length, pb: formatTime(pb), improvement: `${improvement}%`, meets }
  }, [filtered])

  const resetFilters = useCallback(() => {
    setFStroke('All'); setFDist('All'); setFCourse('All'); setFCountry('All')
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="splash">
      <div className="spinner" />
      <p>Loading swim data…</p>
    </div>
  )

  if (error) return (
    <div className="splash error">
      <h2>Could not load data</h2>
      <p className="err-msg">{error}</p>
      {API_KEY === 'YOUR_API_KEY_HERE' && (
        <p className="err-hint">Open <code>src/config.js</code> and add your Google Sheets API key. See README for instructions.</p>
      )}
    </div>
  )

  const hasData = chartData.datasets.length > 0

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <span className="header-icon">🏊</span>
          <div>
            <h1>Indy's Swim Tracker</h1>
            <p className="subtitle">Indigo Riordan — Time Progression</p>
          </div>
        </div>
      </header>

      <section className="filters card">
        <FilterSelect label="Stroke"   value={fStroke}  onChange={setFStroke}  options={opts.strokes} />
        <FilterSelect label="Distance" value={fDist}    onChange={setFDist}    options={opts.distances} distMode />
        <FilterSelect label="Course"   value={fCourse}  onChange={setFCourse}  options={opts.courses} />
        <FilterSelect label="Country"  value={fCountry} onChange={setFCountry} options={opts.countries} />
        {(fStroke !== 'All' || fDist !== 'All' || fCourse !== 'All' || fCountry !== 'All') && (
          <button className="reset-btn" onClick={resetFilters}>Clear</button>
        )}
      </section>

      {metrics && (
        <section className="metrics">
          <MetricCard label="Results"         value={metrics.count} />
          <MetricCard label="Personal Best"   value={metrics.pb}    highlight />
          <MetricCard label="Best Improvement" value={metrics.improvement} />
          <MetricCard label="Meets"           value={metrics.meets} />
        </section>
      )}

      <section className="chart-card card">
        {hasData ? (
          <div className="chart-wrap">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="empty">No results match the current filters.</div>
        )}
        {hasData && (
          <p className="chart-note">Green dots = new personal best at the time · Y-axis reversed: higher = faster</p>
        )}
      </section>

      {filtered.length > 0 && (
        <section className="table-card card">
          <ResultsTable rows={filtered} currentPB={currentPB} />
        </section>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterSelect({ label, value, onChange, options, distMode }) {
  return (
    <div className="filter">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="All">All</option>
        {options.map(o => (
          <option key={o} value={o}>{distMode ? distLabel(o) : o}</option>
        ))}
      </select>
    </div>
  )
}

function MetricCard({ label, value, highlight }) {
  return (
    <div className={`metric-card${highlight ? ' pb' : ''}`}>
      <div className="metric-val">{value}</div>
      <div className="metric-lbl">{label}</div>
    </div>
  )
}

function ResultsTable({ rows, currentPB }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.isoDate.localeCompare(a.isoDate)), [rows])

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Meet</th>
            <th>Stroke</th>
            <th>Dist</th>
            <th>Course</th>
            <th>Country</th>
            <th>Age</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const key = eventKey(r)
            const isPB = currentPB.get(key) === r.time
            return (
              <tr key={i} className={isPB ? 'pb-row' : ''}>
                <td>{formatDate(r.isoDate)}</td>
                <td>{r.meet}</td>
                <td>{r.stroke}</td>
                <td>{distLabel(r.distance)}</td>
                <td>{r.course}</td>
                <td>{r.country}</td>
                <td>{r.age}</td>
                <td className={isPB ? 'pb-time' : ''}>{r.timeStr}{isPB ? ' ★' : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

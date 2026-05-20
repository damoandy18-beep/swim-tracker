# Indy's Swim Tracker — Roadmap

## ✅ Phase 1 — Complete
- Live data from Google Sheet via Sheets API
- Filters: Stroke, Distance, Course, Country
- Line chart with reversed Y axis (higher = faster)
- PB highlighting (green dots + star in table)
- Summary metrics: results count, PB, best improvement %, meets
- Results table with full meet details
- Hosted on GitHub Pages

## 🔧 Phase 2 — Quick Wins
- [ ] Line smoothing — bezier curve tension (~0.4) for smoother progressions
- [ ] Flip Y axis — lower = faster (conventional swim chart style)
- [ ] Current PBs page — table of best ever time per stroke/distance/course

## 🚀 Phase 3 — Enhancements
- [ ] JX benchmark lines — horizontal Bronze/Silver/Gold reference lines on chart
      updating dynamically based on active stroke/distance filter
      Standards reference: Pho3nix JX 2024-25 (10yr girl):
      50m Free: Gold 34.31 / Silver 35.91 / Bronze 38.14
      50m Fly:  Gold 35.73 / Silver 37.62 / Bronze 40.02
      50m Back: Gold 38.51 / Silver 40.30 / Bronze 42.18
      50m Breast: Gold 42.65 / Silver 44.70 / Bronze 47.51
      200m IM: Gold 2:58.63 / Silver 3:10.19 / Bronze 3:20.99
- [ ] Age group colour coding — visually separate age 8, 9, 10+ results
- [ ] SCY conversion toggle — show US short course yards equivalent times
      (relevant for US college scholarship tracking from ~age 15)

## 🤖 Phase 4 — Data Automation
- [ ] CSV drag-and-drop import — merge new meet results directly into Google Sheet
      Priority over API scraping as it covers all jurisdictions (AU, UK, interstate)
- [ ] Swim Central API (stretch) — auto-pull verified AU results
      Note: unofficial API, jurisdiction-locked, won't cover SSV or UK meets
- [ ] Meet Mobile integration (stretch) — broader meet coverage AU + UK

## 💡 Future Ideas
- Relay splits tracking
- Comparison overlays (e.g. Indy age 9 vs age 10)
- Print/export PB card for swim bag
- US college recruiting timeline tracker (activate ~age 14-15)

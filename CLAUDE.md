# Claude Code Instructions — Indy's Swim Tracker

## About this project
A swim time progression tracker for Indigo "Indy" Riordan, born 28 December 2015.
Currently age 10, Year 5, Mentone Primary School, Melbourne Australia.
Swimming with MSC Junior Squad at Mentone Girls' Grammar under coach Kerri Morley.
Swimming is her primary sport and long-term development priority.

## Data source
Google Sheet ID: 1Sne6SYpCK4VlZW2KZdy01kW3NbXwOrIO2JZ2CVB-dnc
Sheet name: Swim Results
Columns: Date (A), Meet (B), Stroke (C), Distance (D), Course (E), Country (F), Age (G), Verified (H), Time (I)
Data spans: UK swims (Winchester City Penguins, age 8-9) + Australian swims (MSC, age 10)
New results added manually after each meet — do not overwrite existing data.

## Design principles
- Dark theme
- Clean minimal UI
- Chart.js for all charting
- Y axis: lower = faster (conventional swim chart style)
- Faster times trend downward visually
- PBs highlighted in green
- Times displayed as m:ss.xx format where applicable
- Responsive — works on mobile (parents check from poolside)

## Hosting
GitHub Pages — any changes must build and deploy cleanly.
Repo: damoandy18-beep/swim-tracker

## Key context
- Indy is a December birthday (youngest in her age group) — relevant for age group comparisons
- UK times are long course unless noted SC
- SSV (School Sport Victoria) times are not in Swim Central — must be added manually
- JX = Pho3nix Junior Excellence program (SwimAUS) — benchmark standards in ROADMAP.md
- Long-term context: US college swimming scholarship pathway being monitored
  Times will eventually need SCY (short course yards) conversion for US coaches

## Always
- Read ROADMAP.md before starting any session
- Check existing component structure before creating new files
- Keep Google Sheet as single source of truth — never hardcode swim data
- Test build before pushing to GitHub Pages

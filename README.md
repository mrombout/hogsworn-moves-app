# ⚡ Hogsworn Moves Single-Page App

A fast, user-friendly single-page reference web application for **Hogsworn** (Harry Potter themed Ironsworn) TTRPG moves and spells. Built for players and guides to quickly look up rules, roll dice, and refer to moves and spells at the game table.

---

## 🌟 Key Features

- **⚡ Instant Real-Time Search**: Search through all 47 moves by title, stat (`+heart`, `+cunning`), trigger condition, or rule keywords. Press `/` anywhere to focus search.
- **✨ Spell Reference**: Browse and search spells by incantation, summary, and spell type, with the year learned shown on each spell.
- **🪄 Category Tabs**: Filter moves across all 8 rule categories or browse the spell catalogue:
  - 🧭 **Adventure** (13 moves): Cast, Face Danger, Study, Gather Information, etc.
  - ⚔️ **Combat** (7 moves): Battle, Clash, Strike, Spell Combat, End the Fight, etc.
  - 🏰 **Hogwarts Life** (3 moves): Attend Class, Brew a Potion, Go to Hospital Wing.
  - 📜 **Quests & Mysteries** (4 moves): Advance, Find a Clue, Investigate, Solve Mystery.
  - 🤝 **Relationships** (6 moves): Compel, Forge a Bond, Common Room, House Cup.
  - ⏳ **Scene Challenges** (5 moves): Begin Scene, Quidditch, Face Danger, Finish Scene.
  - 💔 **Suffer & Harm** (7 moves): Endure Harm, Endure Stress, Get Caught, Face Death.
  - 🔮 **Fate & Oracle** (2 moves): Ask the Oracle, Pay the Price.
- **👥 Secondary Filters**:
  - Filter by Audience: **All**, **Player**, or **Guide**.
  - Filter by Type: **All**, **Action**, or **Reaction**.
- **⭐ Pinned Moves (Favorites)**: Star any move to pin it to a dedicated quick-reference tray at the top of the screen (saved across sessions in `localStorage`).
- **🎲 Integrated Hogsworn Dice Roller**:
  - **Action Roll**: Roll 1d6 (Action die) + Stat + Adds vs 2d10 (Challenge dice). Automatically calculates **Strong Hit**, **Weak Hit**, **Miss**, and detects **Matches** (dramatic twists)!
  - **Click-to-Roll Stat Chips**: Click any stat badge (e.g., `+edge`, `+power`, `+wits`) on any move card to immediately launch the roll with that stat selected!
  - **Ask the Oracle**: Roll 1d100 with probability odds (Almost Certain, Likely, 50/50, Unlikely, Small Chance) and match detection for doubles.
  - Recent roll log history.
- **📜 Interactive Table Roller**: Click "🎲 Roll Table" on moves like *Pay the Price*, *Endure Harm*, *Endure Stress*, or *Get Caught* to roll 1d100 and automatically highlight the exact resulting row!
- **🔗 Cross-Reference Deep Linking**: Move references (e.g. *Pay the Price*, *Face Death*) are clickable links that smoothly scroll to and illuminate that move. Each card also has a copyable direct link.
- **🌓 Theme & Layout Toggles**:
  - Hogwarts Dark Theme & Antique Parchment Light Theme.
  - Compact grid mode & Expand/Collapse all cards.
- **📱 Fully Responsive**: Optimized for phones, tablets, and desktops.

---

## 🚀 Running Locally with Node.js

### Prerequisites
- Node.js (v18+) and npm

### 1. Build the Static Site
```bash
npm run build
```
This reads all markdown files from `../Rules/Moves/` (with local fallback to `./data/moves/`) and spell data from `./data/spells/`, then generates self-contained static files in `dist/`.

### 2. Preview the App
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🐳 Deployment with Docker & Docker Compose

A production-ready `Dockerfile` and `docker-compose.yml` are included for effortless containerized deployment with Nginx.

### Run with Docker Compose
```bash
docker compose up -d --build
```
The app will be available at **[http://localhost:8080](http://localhost:8080)**.

To stop the container:
```bash
docker compose down
```

### Build & Run with Docker directly
```bash
docker build -t hogsworn-moves .
docker run -d -p 8080:80 --name hogsworn-moves hogsworn-moves
```

---

## 📁 Directory Structure

```
App/
├── build.js              # Static site generator script
├── serve.js              # Lightweight local HTTP preview server
├── package.json          # Node dependencies & npm scripts
├── Dockerfile            # Multi-stage container build (Node + Nginx Alpine)
├── docker-compose.yml    # Docker Compose specification (Port 8080)
├── nginx.conf            # Nginx config with gzip and caching
├── src/
│   ├── style.css         # Complete Hogwarts-themed stylesheet
│   └── app.js            # Interactivity (search, filters, dice roller, tables)
├── data/
│   ├── moves/            # Local copy of markdown moves for standalone Docker builds
│   └── spells/           # Spell reference markdown files
└── dist/                 # Generated static website ready to serve
    ├── index.html
    ├── style.css
    ├── app.js
    └── moves.json
```

---

## 🔄 Updating Moves & Spells

When moves in `Rules/Moves/` or spell files in `data/spells/` are updated or added:
1. Run `npm run build` locally, or re-run `docker compose up --build`.
2. The generator will automatically re-parse the move and spell data and regenerate the site in `dist/`.

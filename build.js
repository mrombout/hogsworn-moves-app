const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { marked } = require('marked');

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false
});

// Category metadata
const CATEGORIES = {
  adventure: {
    id: 'adventure',
    name: 'Adventure',
    icon: '🧭',
    description: 'Exploration, spellcasting, study, and dangerous encounters around Hogwarts and beyond.'
  },
  combat: {
    id: 'combat',
    name: 'Combat',
    icon: '⚔️',
    description: 'Duels, skirmishes, clashes, and tactical spell combat against adversaries.'
  },
  life: {
    id: 'life',
    name: 'Hogwarts Life',
    icon: '🏰',
    description: 'Attending classes, brewing potions, hospital wing recovery, and student routines.'
  },
  quest: {
    id: 'quest',
    name: 'Quests & Mysteries',
    icon: '📜',
    description: 'Investigating mysteries, gathering clues, advancing tracks, and solving enigmas.'
  },
  relationship: {
    id: 'relationship',
    name: 'Relationships',
    icon: '🤝',
    description: 'Aiding allies, compelling others, forging bonds, common room downtime, and the House Cup.'
  },
  scene_challenge: {
    id: 'scene_challenge',
    name: 'Scene Challenge',
    icon: '⏳',
    description: 'High-stakes scenes, Quidditch matches, countdown segments, and rapid resolution.'
  },
  suffer: {
    id: 'suffer',
    name: 'Suffer & Harm',
    icon: '💔',
    description: 'Enduring physical harm, mental stress, getting caught by teachers, setbacks, and death.'
  },
  fate: {
    id: 'fate',
    name: 'Fate & Oracle',
    icon: '🔮',
    description: 'Asking the oracle yes/no questions and paying the price when fortune turns sour.'
  },
  spells: {
    id: 'spells',
    name: 'Spells',
    icon: '✨',
    description: 'Incantations, spell types, summaries, and the year each spell is learned.'
  }
};

// Locate moves source directory
let movesDir = path.resolve(__dirname, '../Rules/Moves');
const localMovesDir = path.resolve(__dirname, 'data/moves');

if (fs.existsSync(movesDir)) {
  console.log(`Using vault moves directory: ${movesDir}`);
  // Sync to local data/moves for standalone builds / Docker
  fs.mkdirSync(localMovesDir, { recursive: true });
  copyDirRecursive(movesDir, localMovesDir);
} else if (fs.existsSync(localMovesDir)) {
  console.log(`Using local data/moves directory: ${localMovesDir}`);
  movesDir = localMovesDir;
} else {
  console.error('Error: Could not find Rules/Moves or data/moves directory!');
  process.exit(1);
}

function copyDirRecursive(src, dst) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dstPath, { recursive: true });
      copyDirRecursive(srcPath, dstPath);
    } else if (entry.name.endsWith('.md') && entry.name !== 'Move Index.md') {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// 1. First Pass: Collect all files and build title-to-id map
function findMarkdownFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md') && entry.name !== 'Move Index.md') {
      results.push(fullPath);
    }
  }
  return results;
}

const filePaths = findMarkdownFiles(movesDir);
console.log(`Discovered ${filePaths.length} move markdown files.`);

const rawMoves = [];
for (const filePath of filePaths) {
  const relPath = path.relative(movesDir, filePath);
  const folder = path.dirname(relPath).replace(/\\/g, '/');
  const filename = path.basename(filePath);
  const title = filename.replace(/\.md$/, '');
  const content = fs.readFileSync(filePath, 'utf8');

  let fm = {};
  let body = content;
  if (content.startsWith('---')) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      try {
        fm = yaml.load(parts[1]) || {};
      } catch (e) {
        console.warn(`YAML parse warning in ${relPath}: ${e.message}`);
      }
      body = parts.slice(2).join('---').trim();
    }
  }

  // Normalize category
  let catKey = (fm.move_category || folder).toLowerCase().replace(/[\s-]+/g, '_');
  if (!CATEGORIES[catKey]) {
    if (catKey === 'scene challenge' || catKey === 'scene-challenge') catKey = 'scene_challenge';
    else if (catKey === 'moves') catKey = 'adventure';
  }
  if (!CATEGORIES[catKey]) catKey = 'adventure';

  // Normalize audience and type
  const audience = (fm.move_audience || 'player').toLowerCase().trim();
  const type = (fm.move_type || 'action').toLowerCase().trim();

  // Create unique slug
  const slug = (catKey.replace(/_/g, '-') + '-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');

  rawMoves.push({
    id: slug,
    title,
    categoryKey: catKey,
    categoryFolder: folder,
    audience,
    type,
    rawBody: body,
    relPath
  });
}

// Build map for cross-referencing
const titleMap = new Map();
for (const m of rawMoves) {
  const lowerTitle = m.title.toLowerCase();
  if (!titleMap.has(lowerTitle)) {
    titleMap.set(lowerTitle, []);
  }
  titleMap.get(lowerTitle).push(m);
}

// 2. Second Pass: Enhance markdown and render HTML
const parsedMoves = [];

for (const m of rawMoves) {
  let md = m.rawBody;

  // Clean Obsidian-specific meta-bind button blocks
  md = md.replace(/```meta-bind-button[\s\S]*?```/g, '').trim();

  // Clean Obsidian wikilinks: [[Rules/Moves/Adventure/Cast|Cast]] or [[Cast]] -> Cast
  md = md.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

  // Fix outcome spacing so bold outcomes always become distinct paragraphs/blocks
  md = md.replace(/([^\n])\n(On a \*\*(?:strong hit|weak hit|mis[s]?)\*\*)/gi, '$1\n\n$2');
  md = md.replace(/([^\n])\n(One a \*\*weak hit\*\*)/gi, '$1\n\n$2');

  // Replace stat references with clickable roll chips
  const stats = ['edge', 'heart', 'power', 'cunning', 'wits', 'health', 'spirit', 'reputation'];
  for (const s of stats) {
    const reg = new RegExp(`(\\broll\\s*|\\s*)\\+(${s})\\b`, 'gi');
    md = md.replace(reg, (match, prefix, stat) => {
      const cleanPrefix = prefix ? prefix : '';
      return `${cleanPrefix}<button type="button" class="stat-roll-badge" data-stat="${stat.toLowerCase()}" title="Roll +${stat.toLowerCase()}">+${stat.toLowerCase()}</button>`;
    });
  }

  // Cross-reference links for italicized move names like _Pay the Price_
  md = md.replace(/_([A-Z][A-Za-z0-9\s]{2,30})_/g, (match, moveTitle) => {
    const key = moveTitle.toLowerCase().trim();
    if (titleMap.has(key)) {
      const candidates = titleMap.get(key);
      let targetMove = candidates[0];
      // If ambiguous, match same category if possible
      if (candidates.length > 1) {
        const sameCat = candidates.find(c => c.categoryKey === m.categoryKey);
        if (sameCat) targetMove = sameCat;
      }
      return `<a href="#${targetMove.id}" class="move-ref-link" title="Jump to ${targetMove.title}">${moveTitle} ↗</a>`;
    }
    return match;
  });

  // Render markdown to HTML
  let html = marked.parse(md);

  // Style trigger paragraph ("When you...")
  html = html.replace(/<p>(When\b[\s\S]*?)<\/p>/gi, '<p class="move-trigger">$1</p>');

  // Post-process HTML for Outcome Callouts
  html = html.replace(/<p>(On a <strong>strong hit<\/strong>[\s\S]*?)<\/p>/gi, '<div class="outcome-block outcome-strong"><p>$1</p></div>');
  html = html.replace(/<p>((?:On|One) a <strong>weak hit<\/strong>[\s\S]*?)<\/p>/gi, '<div class="outcome-block outcome-weak"><p>$1</p></div>');
  html = html.replace(/<p>(On a <strong>mis[s]?<\/strong>[\s\S]*?)<\/p>/gi, '<div class="outcome-block outcome-miss"><p>$1</p></div>');

  // Absorb bullet list immediately following an outcome block inside that block
  html = html.replace(/(<div class="outcome-block [^"]*">[\s\S]*?<\/div>)\s*(<ul>[\s\S]*?<\/ul>)/gi, (match, div, ul) => {
    return div.replace(/<\/div>$/, '\n' + ul + '</div>');
  });

  // Wrap table in responsive table wrapper with roll button if it contains dice roll numbers
  html = html.replace(/<table>([\s\S]*?)<\/table>/gi, (match) => {
    const hasRanges = /\b\d+-\d+\b|\b\d+\b/.test(match);
    const rollBtn = hasRanges ? '<button type="button" class="table-roll-btn" title="Roll 1d100 on this table">🎲 Roll Table</button>' : '';
    return `<div class="table-wrapper">
      <div class="table-toolbar">
        <span>📜 Table Reference</span>
        ${rollBtn}
      </div>
      ${match}
    </div>`;
  });

  // Plain search text for instant client-side filtering
  const plainText = (m.title + ' ' + m.categoryKey + ' ' + m.audience + ' ' + m.type + ' ' + md.replace(/<[^>]+>/g, ' '))
    .toLowerCase()
    .replace(/\s+/g, ' ');

  parsedMoves.push({
    ...m,
    html,
    plainText
  });
}

// Parse spell reference data from local Markdown files
const spellsDir = path.resolve(__dirname, 'data/spells');
if (!fs.existsSync(spellsDir)) {
  console.error('Error: Could not find spell data directory at data/spells!');
  process.exit(1);
}

const spellFilePaths = findMarkdownFiles(spellsDir);
const parsedSpells = spellFilePaths.map(filePath => {
  const relPath = path.relative(spellsDir, filePath);
  const title = path.basename(filePath, '.md');
  const content = fs.readFileSync(filePath, 'utf8');
  let frontmatter = {};

  if (content.startsWith('---')) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      try {
        frontmatter = yaml.load(parts[1]) || {};
      } catch (e) {
        console.warn(`YAML parse warning in ${relPath}: ${e.message}`);
      }
    }
  }

  const spellType = frontmatter['Spell Type'] == null ? '' : String(frontmatter['Spell Type']).trim();
  const summary = frontmatter.Summary == null ? '' : String(frontmatter.Summary).trim();
  const yearLearned = frontmatter['Year Learned'] == null ? '' : String(frontmatter['Year Learned']).trim();
  const id = ('spell-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');
  const plainText = `${title} ${spellType} ${summary} ${yearLearned}`.toLowerCase().replace(/\s+/g, ' ');

  return { id, title, categoryKey: 'spells', spellType, summary, yearLearned, plainText };
}).sort((a, b) => a.title.localeCompare(b.title));

// Sort moves: by category order, then title
const catOrder = Object.keys(CATEGORIES);
parsedMoves.sort((a, b) => {
  const catDiff = catOrder.indexOf(a.categoryKey) - catOrder.indexOf(b.categoryKey);
  if (catDiff !== 0) return catDiff;
  return a.title.localeCompare(b.title);
});

// Group moves by category
const groupedMoves = {};
for (const catKey of catOrder) {
  groupedMoves[catKey] = catKey === 'spells'
    ? parsedSpells
    : parsedMoves.filter(m => m.categoryKey === catKey);
}

// 3. Generate HTML markup
function renderMoveCard(m) {
  const cat = CATEGORIES[m.categoryKey];
  if (m.categoryKey === 'spells') {
    return `
    <article class="move-card spell-card" id="${escapeHtml(m.id)}" data-category="spells" data-is-spell="true" data-search-text="${escapeHtml(m.plainText)}">
      <div class="card-header">
        <div class="card-title-group">
          <h3 class="card-title">${escapeHtml(m.title)}</h3>
          <div class="card-badges">
            <span class="badge badge-cat" data-category="spells">${cat.icon} ${cat.name}</span>
            <span class="badge badge-spell-type">${escapeHtml(m.spellType || 'Spell type unspecified')}</span>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="card-btn pin-btn" title="Pin spell to top" aria-label="Pin spell">☆</button>
          <button type="button" class="card-btn copy-link-btn" title="Copy direct link" aria-label="Copy spell link">🔗</button>
          <button type="button" class="card-btn collapse-btn" title="Toggle card content" aria-label="Toggle content">▾</button>
        </div>
      </div>
      <div class="card-body">
        <p>${escapeHtml(m.summary || 'No summary available.')}</p>
${m.yearLearned ? `        <p class="spell-year">Learned in Year ${escapeHtml(m.yearLearned)}</p>` : ''}
      </div>
    </article>
  `.trim();
  }

  return `
    <article class="move-card" id="${m.id}" data-category="${m.categoryKey}" data-audience="${m.audience}" data-type="${m.type}" data-search-text="${escapeHtml(m.plainText)}">
      <div class="card-header">
        <div class="card-title-group">
          <h3 class="card-title">${escapeHtml(m.title)}</h3>
          <div class="card-badges">
            <span class="badge badge-cat" data-category="${m.categoryKey}">${cat.icon} ${cat.name}</span>
            <span class="badge badge-${m.type}">${m.type}</span>
            <span class="badge badge-audience">${m.audience}</span>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="card-btn pin-btn" title="Pin move to top" aria-label="Pin move">☆</button>
          <button type="button" class="card-btn copy-link-btn" title="Copy direct link" aria-label="Copy link">🔗</button>
          <button type="button" class="card-btn collapse-btn" title="Toggle card content" aria-label="Toggle content">▾</button>
        </div>
      </div>
      <div class="card-body">
        ${m.html}
      </div>
    </article>
  `;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build category sections
let categorySectionsHtml = '';
for (const catKey of catOrder) {
  const cat = CATEGORIES[catKey];
  const entries = groupedMoves[catKey] || [];
  if (entries.length === 0) continue;

  const cardsHtml = entries.map(renderMoveCard).join('\n');

  categorySectionsHtml += `
    <section class="category-group" id="cat-group-${catKey}" data-category="${catKey}" data-item-label="${catKey === 'spells' ? 'spells' : 'moves'}">
      <div class="category-header">
        <h2>${cat.icon} ${cat.name}</h2>
        <span class="category-desc">${cat.description}</span>
        <span class="category-count">${entries.length} ${catKey === 'spells' ? 'spells' : 'moves'}</span>
      </div>
      <div class="moves-grid">
        ${cardsHtml}
      </div>
    </section>
  `.trim();
}

// Build category filter tabs
const categoryTabsHtml = [
  `<button type="button" class="cat-tab active" data-category="all">✨ All Moves & Spells <span class="tab-badge">${parsedMoves.length + parsedSpells.length}</span></button>`,
  ...catOrder.map(catKey => {
    const cat = CATEGORIES[catKey];
    const count = (groupedMoves[catKey] || []).length;
    return `<button type="button" class="cat-tab" data-category="${catKey}">${cat.icon} ${cat.name} <span class="tab-badge">${count}</span></button>`;
  })
].join('\n');

// 4. Read template and assemble final HTML
const fullHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hogsworn Moves & Spells | Hogwarts TTRPG Rulebook & Reference</title>
  <meta name="description" content="Quick-reference single-page app for Hogsworn and Ironsworn moves and spells. Search, roll dice, and refer to rules at the table.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Fira+Code:wght@500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Sticky Header -->
  <header class="header-wrapper">
    <div class="header-container">
      <a href="#" class="brand">
        <div class="brand-icon">⚡</div>
        <div class="brand-text">
          <h1>Hogsworn</h1>
          <p>Hogwarts TTRPG Moves & Spells Compendium</p>
        </div>
      </a>

      <div class="header-actions">
        <button type="button" class="action-btn dice-toggle-btn" id="dice-toggle-btn" title="Open Dice Roller (D)">
          🎲 <span class="btn-text">Dice Roller</span>
        </button>
        <button type="button" class="action-btn" id="expand-all-btn" title="Expand or Collapse All Cards">
          ⊟ <span class="btn-text">Collapse All</span>
        </button>
        <button type="button" class="action-btn" id="layout-toggle-btn" title="Toggle Compact / Full Cards">
          ⊞ <span class="btn-text">Compact</span>
        </button>
        <button type="button" class="action-btn" id="theme-toggle-btn" title="Toggle Dark / Parchment Theme">
          ☀️ <span class="btn-text">Light</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Filter & Search Toolbar -->
  <section class="toolbar-section">
    <!-- Search Bar -->
    <div class="search-wrapper">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="search-input" placeholder="Search moves by title, roll, trigger, or rules; spells by name, summary, or type..." autocomplete="off" spellcheck="false">
      <button type="button" class="search-clear-btn" id="search-clear" title="Clear search">×</button>
      <span class="search-shortcut">/</span>
    </div>

    <!-- Category Filter Tabs -->
    <nav class="category-tabs" aria-label="Category Filters">
      ${categoryTabsHtml}
    </nav>

    <!-- Secondary Filters Bar -->
    <div class="secondary-filters">
      <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
        <!-- Audience Filter -->
        <div class="filter-group">
          <span class="filter-label">Audience:</span>
          <button type="button" class="filter-pill pill-audience active" data-audience="all">All</button>
          <button type="button" class="filter-pill pill-audience" data-audience="player">Player</button>
          <button type="button" class="filter-pill pill-audience" data-audience="guide">Guide</button>
        </div>

        <!-- Type Filter -->
        <div class="filter-group">
          <span class="filter-label">Type:</span>
          <button type="button" class="filter-pill pill-type active" data-type="all">All</button>
          <button type="button" class="filter-pill pill-type" data-type="action">Action</button>
          <button type="button" class="filter-pill pill-type" data-type="reaction">Reaction</button>
        </div>
      </div>

      <div class="view-controls">
        <button type="button" class="action-btn" id="filter-pinned-btn" title="Show only pinned moves">
          ⭐ Pinned (<span id="pinned-count">0</span>)
        </button>
      </div>
    </div>
  </section>

  <!-- Status Bar -->
  <div class="status-bar">
    <span id="results-count">Showing ${parsedMoves.length + parsedSpells.length} of ${parsedMoves.length + parsedSpells.length} entries</span>
    <button type="button" class="reset-filters-btn" id="reset-filters-btn">↺ Reset Filters</button>
  </div>

  <!-- Pinned Moves Section -->
  <section class="pinned-section" id="pinned-section">
    <div class="pinned-header">
      <span>⭐ Pinned Quick-Reference Moves</span>
    </div>
    <div class="pinned-grid" id="pinned-grid"></div>
  </section>

  <!-- Main Moves Container -->
  <main class="main-container" id="main-container">
    ${categorySectionsHtml}
  </main>

  <!-- Dice Roller Overlay & Drawer -->
  <div class="dice-drawer-overlay" id="dice-drawer-overlay"></div>
  <aside class="dice-drawer" id="dice-drawer" aria-label="Interactive Dice Roller">
    <div class="dice-header">
      <h3>🎲 Hogsworn Dice Roller</h3>
      <button type="button" class="close-drawer-btn" id="close-drawer-btn" title="Close Dice Roller (Esc)">×</button>
    </div>

    <div class="dice-mode-tabs">
      <button type="button" class="mode-tab active" data-mode="action">Action Roll (d6 + 2d10)</button>
      <button type="button" class="mode-tab" data-mode="oracle">Ask Oracle (d100)</button>
    </div>

    <div class="dice-content">
      <!-- Action Roll Controls -->
      <div id="action-dice-controls" class="roller-controls">
        <div class="control-row">
          <span class="control-label">Select Character Stat:</span>
          <div class="stat-pills">
            <button type="button" class="stat-pill-btn" data-stat="edge" data-val="2">Edge (+2)</button>
            <button type="button" class="stat-pill-btn" data-stat="heart" data-val="1">Heart (+1)</button>
            <button type="button" class="stat-pill-btn" data-stat="power" data-val="1">Power (+1)</button>
            <button type="button" class="stat-pill-btn" data-stat="cunning" data-val="2">Cunning (+2)</button>
            <button type="button" class="stat-pill-btn" data-stat="wits" data-val="3">Wits (+3)</button>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; align-items: center; justify-content: space-between;">
          <div class="control-row">
            <span class="control-label">Stat Modifier:</span>
            <div class="stepper-control">
              <button type="button" class="stepper-btn" id="stat-minus">-</button>
              <span class="stepper-value" id="stat-val-display">+0</span>
              <button type="button" class="stepper-btn" id="stat-plus">+</button>
            </div>
          </div>

          <div class="control-row">
            <span class="control-label">Adds / Momentum:</span>
            <div class="stepper-control">
              <button type="button" class="stepper-btn" id="adds-minus">-</button>
              <span class="stepper-value" id="adds-val-display">+0</span>
              <button type="button" class="stepper-btn" id="adds-plus">+</button>
            </div>
          </div>
        </div>

        <button type="button" class="roll-cta-btn" id="roll-action-btn">
          ⚡ Roll Action Move
        </button>
      </div>

      <!-- Oracle Controls -->
      <div id="oracle-dice-controls" class="roller-controls" style="display: none;">
        <span class="control-label">Select Likelihood:</span>
        <div class="oracle-odds-grid">
          <button type="button" class="odds-btn" data-odds="almost-certain">
            <span class="odds-title">Almost Certain</span>
            <span class="odds-sub">Yes on 11+</span>
          </button>
          <button type="button" class="odds-btn" data-odds="likely">
            <span class="odds-title">Likely</span>
            <span class="odds-sub">Yes on 26+</span>
          </button>
          <button type="button" class="odds-btn active" data-odds="50-50">
            <span class="odds-title">50 / 50</span>
            <span class="odds-sub">Yes on 51+</span>
          </button>
          <button type="button" class="odds-btn" data-odds="unlikely">
            <span class="odds-title">Unlikely</span>
            <span class="odds-sub">Yes on 76+</span>
          </button>
          <button type="button" class="odds-btn" data-odds="small-chance" style="grid-column: span 2;">
            <span class="odds-title">Small Chance</span>
            <span class="odds-sub">Yes on 91+</span>
          </button>
        </div>

        <button type="button" class="roll-cta-btn" id="roll-oracle-btn">
          🔮 Ask the Oracle (d100)
        </button>
      </div>

      <!-- Stage & Output -->
      <div class="dice-stage">
        <!-- Action Dice Display -->
        <div class="dice-row" id="action-dice-row">
          <div class="die-box">
            <span class="die-label">Action (d6)</span>
            <div class="die-face die-action" id="action-die-face">-</div>
          </div>
          <span class="vs-divider">VS</span>
          <div class="die-box">
            <span class="die-label">Challenge 1</span>
            <div class="die-face die-challenge" id="challenge-die-1">-</div>
          </div>
          <div class="die-box">
            <span class="die-label">Challenge 2</span>
            <div class="die-face die-challenge" id="challenge-die-2">-</div>
          </div>
        </div>

        <!-- Oracle Dice Display -->
        <div class="dice-row" id="oracle-dice-row" style="display: none;">
          <div class="die-box">
            <span class="die-label">Oracle Roll (d100)</span>
            <div class="die-face die-action" id="oracle-die-face" style="width: 80px; font-size: 1.8rem;">-</div>
          </div>
        </div>

        <div class="action-breakdown" id="action-breakdown">Roll to see outcome...</div>
        <div class="roll-result-banner" id="roll-result-banner" style="display: none;">-</div>
        <span class="match-badge" id="match-badge" style="display: none;">✦ MATCH! ✦</span>
      </div>

      <!-- Roll History -->
      <div class="control-row">
        <span class="control-label">Recent Roll Log:</span>
        <div class="roll-history" id="roll-history-container">
          <div style="font-size: 0.78rem; color: var(--text-dim); text-align: center; padding: 0.5rem;">No rolls yet.</div>
        </div>
      </div>
    </div>
  </aside>

  <!-- Toast Notification -->
  <div class="toast-msg" id="toast-msg">Notification</div>

  <!-- Back to Top Button -->
  <button type="button" class="back-to-top" id="back-to-top" title="Back to top" aria-label="Back to top">↑</button>

  <script src="app.js"></script>
</body>
</html>
`;

// 5. Output to dist/
const distDir = path.resolve(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });

fs.writeFileSync(path.join(distDir, 'index.html'), fullHtml, 'utf8');
fs.copyFileSync(path.resolve(__dirname, 'src/style.css'), path.join(distDir, 'style.css'));
fs.copyFileSync(path.resolve(__dirname, 'src/app.js'), path.join(distDir, 'app.js'));

// Export moves.json
fs.writeFileSync(
  path.join(distDir, 'moves.json'),
  JSON.stringify(parsedMoves, null, 2),
  'utf8'
);

console.log(`\n🎉 Build Complete!`);
console.log(` - Total moves compiled: ${parsedMoves.length}`);
console.log(` - Total spells compiled: ${parsedSpells.length}`);
console.log(` - Output directory: ${distDir}`);
console.log(` - Files generated: index.html, style.css, app.js, moves.json\n`);

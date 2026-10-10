/**
 * Hogsworn / Ironsworn Moves SPA - Client Logic
 */

(function () {
  'use strict';

  // State
  const state = {
    searchQuery: '',
    selectedCategory: 'all',
    selectedAudience: 'all',
    selectedType: 'all',
    showPinnedOnly: false,
    layoutMode: localStorage.getItem('hogsworn_layout') || 'normal', // 'normal' | 'compact'
    theme: localStorage.getItem('hogsworn_theme') || 'dark', // 'dark' | 'light'
    pinnedIds: new Set(JSON.parse(localStorage.getItem('hogsworn_pinned') || '[]')),
    
    // Dice Roller
    diceMode: 'action', // 'action' | 'oracle'
    selectedStat: null,
    statValue: 0,
    addsValue: 0,
    oracleOdds: '50-50',
    rollHistory: []
  };

  // DOM Elements
  const el = {
    themeBtn: document.getElementById('theme-toggle-btn'),
    diceBtn: document.getElementById('dice-toggle-btn'),
    diceDrawer: document.getElementById('dice-drawer'),
    diceOverlay: document.getElementById('dice-drawer-overlay'),
    closeDiceBtn: document.getElementById('close-drawer-btn'),
    
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    
    catTabs: document.querySelectorAll('.cat-tab'),
    audiencePills: document.querySelectorAll('.pill-audience'),
    typePills: document.querySelectorAll('.pill-type'),
    
    pinnedFilterBtn: document.getElementById('filter-pinned-btn'),
    pinnedCountBadge: document.getElementById('pinned-count'),
    pinnedSection: document.getElementById('pinned-section'),
    pinnedGrid: document.getElementById('pinned-grid'),
    
    expandAllBtn: document.getElementById('expand-all-btn'),
    layoutToggleBtn: document.getElementById('layout-toggle-btn'),
    
    resultsCount: document.getElementById('results-count'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    
    mainContainer: document.getElementById('main-container'),
    categoryGroups: document.querySelectorAll('.category-group'),
    moveCards: document.querySelectorAll('.move-card'),
    
    // Dice Elements
    modeTabs: document.querySelectorAll('.mode-tab'),
    actionControls: document.getElementById('action-dice-controls'),
    oracleControls: document.getElementById('oracle-dice-controls'),
    statPills: document.querySelectorAll('.stat-pill-btn'),
    statMinus: document.getElementById('stat-minus'),
    statPlus: document.getElementById('stat-plus'),
    statValDisplay: document.getElementById('stat-val-display'),
    addsMinus: document.getElementById('adds-minus'),
    addsPlus: document.getElementById('adds-plus'),
    addsValDisplay: document.getElementById('adds-val-display'),
    rollActionBtn: document.getElementById('roll-action-btn'),
    rollOracleBtn: document.getElementById('roll-oracle-btn'),
    oddsBtns: document.querySelectorAll('.odds-btn'),
    
    // Dice Results
    actionDiceRow: document.getElementById('action-dice-row'),
    oracleDiceRow: document.getElementById('oracle-dice-row'),
    actionDieFace: document.getElementById('action-die-face'),
    challengeDie1Face: document.getElementById('challenge-die-1'),
    challengeDie2Face: document.getElementById('challenge-die-2'),
    oracleDieFace: document.getElementById('oracle-die-face'),
    actionBreakdown: document.getElementById('action-breakdown'),
    rollResultBanner: document.getElementById('roll-result-banner'),
    matchBadge: document.getElementById('match-badge'),
    rollHistoryContainer: document.getElementById('roll-history-container'),
    
    toast: document.getElementById('toast-msg'),
    backToTop: document.getElementById('back-to-top')
  };

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    applyTheme(state.theme);
    applyLayout(state.layoutMode);
    setupEventListeners();
    updatePinnedCount();
    renderPinnedSection();
    filterMoves();
    handleHashNavigation();
  }

  // ==========================================================================
  // Theme & Layout
  // ==========================================================================
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hogsworn_theme', theme);
    if (el.themeBtn) {
      el.themeBtn.innerHTML = theme === 'dark' ? '☀️ <span class="btn-text">Light</span>' : '🌙 <span class="btn-text">Dark</span>';
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function applyLayout(mode) {
    state.layoutMode = mode;
    localStorage.setItem('hogsworn_layout', mode);
    if (mode === 'compact') {
      el.mainContainer.classList.add('layout-compact');
      if (el.layoutToggleBtn) el.layoutToggleBtn.classList.add('active');
    } else {
      el.mainContainer.classList.remove('layout-compact');
      if (el.layoutToggleBtn) el.layoutToggleBtn.classList.remove('active');
    }
  }

  function toggleLayout() {
    applyLayout(state.layoutMode === 'compact' ? 'normal' : 'compact');
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupEventListeners() {
    // Theme toggle
    if (el.themeBtn) el.themeBtn.addEventListener('click', toggleTheme);

    // Layout toggle
    if (el.layoutToggleBtn) el.layoutToggleBtn.addEventListener('click', toggleLayout);

    // Dice drawer open/close
    if (el.diceBtn) el.diceBtn.addEventListener('click', openDiceDrawer);
    if (el.closeDiceBtn) el.closeDiceBtn.addEventListener('click', closeDiceDrawer);
    if (el.diceOverlay) el.diceOverlay.addEventListener('click', closeDiceDrawer);

    // Search input
    if (el.searchInput) {
      el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        if (el.searchClear) {
          el.searchClear.style.display = state.searchQuery ? 'block' : 'none';
        }
        filterMoves();
      });

      if (el.searchClear) {
        el.searchClear.addEventListener('click', () => {
          el.searchInput.value = '';
          state.searchQuery = '';
          el.searchClear.style.display = 'none';
          filterMoves();
          el.searchInput.focus();
        });
      }
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== el.searchInput) {
        e.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
      } else if (e.key === 'Escape') {
        if (el.diceDrawer.classList.contains('active')) {
          closeDiceDrawer();
        } else if (state.searchQuery) {
          el.searchInput.value = '';
          state.searchQuery = '';
          if (el.searchClear) el.searchClear.style.display = 'none';
          filterMoves();
        }
      } else if ((e.key === 'd' || e.key === 'D') && document.activeElement !== el.searchInput) {
        // Toggle dice roller
        e.preventDefault();
        if (el.diceDrawer.classList.contains('active')) {
          closeDiceDrawer();
        } else {
          openDiceDrawer();
        }
      }
    });

    // Category tabs
    el.catTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.catTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.selectedCategory = tab.dataset.category;
        filterMoves();
      });
    });

    // Audience filter pills
    el.audiencePills.forEach(pill => {
      pill.addEventListener('click', () => {
        el.audiencePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedAudience = pill.dataset.audience;
        filterMoves();
      });
    });

    // Type filter pills
    el.typePills.forEach(pill => {
      pill.addEventListener('click', () => {
        el.typePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedType = pill.dataset.type;
        filterMoves();
      });
    });

    // Pinned filter toggle
    if (el.pinnedFilterBtn) {
      el.pinnedFilterBtn.addEventListener('click', () => {
        state.showPinnedOnly = !state.showPinnedOnly;
        el.pinnedFilterBtn.classList.toggle('active', state.showPinnedOnly);
        filterMoves();
      });
    }

    // Reset filters
    if (el.resetFiltersBtn) {
      el.resetFiltersBtn.addEventListener('click', resetAllFilters);
    }

    // Expand / Collapse all
    if (el.expandAllBtn) {
      let allExpanded = true;
      el.expandAllBtn.addEventListener('click', () => {
        allExpanded = !allExpanded;
        el.moveCards.forEach(card => {
          card.classList.toggle('collapsed', !allExpanded);
        });
        el.expandAllBtn.innerHTML = allExpanded ? '⊟ <span class="btn-text">Collapse All</span>' : '⊞ <span class="btn-text">Expand All</span>';
      });
    }

    // Back to top button
    if (el.backToTop) {
      window.addEventListener('scroll', () => {
        el.backToTop.classList.toggle('visible', window.scrollY > 300);
      });
      el.backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Move Card interactions (Delegated)
    document.addEventListener('click', handleGlobalClicks);

    // Hash navigation
    window.addEventListener('hashchange', handleHashNavigation);

    // Dice Controls Setup
    setupDiceControls();
  }

  // ==========================================================================
  // Global Event Delegation (Pins, Collapses, Links, Rolls)
  // ==========================================================================
  function handleGlobalClicks(e) {
    // 1. Star / Pin button
    const pinBtn = e.target.closest('.pin-btn');
    if (pinBtn) {
      e.stopPropagation();
      const card = pinBtn.closest('.move-card');
      if (card) {
        togglePin(card.id);
      }
      return;
    }

    // 2. Collapse / Expand toggle
    const collapseBtn = e.target.closest('.collapse-btn');
    if (collapseBtn) {
      e.stopPropagation();
      const card = collapseBtn.closest('.move-card');
      if (card) {
        card.classList.toggle('collapsed');
      }
      return;
    }

    // 3. Header click to toggle collapse (unless clicking actions)
    const cardHeader = e.target.closest('.card-header');
    if (cardHeader && !e.target.closest('.card-btn')) {
      const card = cardHeader.closest('.move-card');
      if (card) {
        card.classList.toggle('collapsed');
      }
      return;
    }

    // 4. Copy Link Button
    const copyBtn = e.target.closest('.copy-link-btn');
    if (copyBtn) {
      e.stopPropagation();
      const card = copyBtn.closest('.move-card');
      if (card) {
        const url = window.location.origin + window.location.pathname + '#' + card.id;
        navigator.clipboard.writeText(url).then(() => {
          showToast('Direct move link copied to clipboard!');
        }).catch(() => {
          showToast('Failed to copy link');
        });
      }
      return;
    }

    // 5. Stat roll badge chip (+edge, +heart, etc.)
    const statBadge = e.target.closest('.stat-roll-badge');
    if (statBadge) {
      e.preventDefault();
      e.stopPropagation();
      const stat = statBadge.dataset.stat;
      triggerStatRoll(stat);
      return;
    }

    // 6. Cross-reference link to another move
    const refLink = e.target.closest('.move-ref-link');
    if (refLink) {
      e.preventDefault();
      const targetId = refLink.getAttribute('href').replace('#', '');
      jumpToMove(targetId);
      return;
    }

    // 7. Table Roll Button
    const tableRollBtn = e.target.closest('.table-roll-btn');
    if (tableRollBtn) {
      e.preventDefault();
      const tableWrapper = tableRollBtn.closest('.table-wrapper');
      if (tableWrapper) {
        rollOnTable(tableWrapper);
      }
      return;
    }
  }

  // ==========================================================================
  // Filtering & Search
  // ==========================================================================
  function filterMoves() {
    let visibleCount = 0;
    const isSearching = state.searchQuery.length > 0;

    el.moveCards.forEach(card => {
      // Don't filter cards inside pinned grid clone
      if (card.closest('#pinned-grid')) return;

      const cardCat = card.dataset.category;
      const cardAudience = card.dataset.audience;
      const cardType = card.dataset.type;
      const cardId = card.id;
      const cardSearchText = card.dataset.searchText || '';
      const isSpell = card.dataset.isSpell === 'true';

      const matchCategory = state.selectedCategory === 'all' || cardCat === state.selectedCategory;
      const matchAudience = isSpell || state.selectedAudience === 'all' || cardAudience === state.selectedAudience;
      const matchType = isSpell || state.selectedType === 'all' || cardType === state.selectedType;
      const matchPinned = !state.showPinnedOnly || state.pinnedIds.has(cardId);
      const matchSearch = !isSearching || cardSearchText.includes(state.searchQuery);

      const isVisible = matchCategory && matchAudience && matchType && matchPinned && matchSearch;
      card.classList.toggle('hidden', !isVisible);

      if (isVisible) visibleCount++;
    });

    // Check category group visibility
    el.categoryGroups.forEach(group => {
      const visibleInGroup = group.querySelectorAll('.move-card:not(.hidden)').length;
      group.classList.toggle('hidden', visibleInGroup === 0);
      const countSpan = group.querySelector('.category-count');
      if (countSpan) {
        countSpan.textContent = `${visibleInGroup} ${group.dataset.itemLabel || 'moves'}`;
      }
    });

    // Update count indicator
    if (el.resultsCount) {
      const total = el.moveCards.length;
      el.resultsCount.textContent = `Showing ${visibleCount} of ${total} entries`;
    }

    // Show/hide pinned section
    if (el.pinnedSection) {
      const hasPins = state.pinnedIds.size > 0 && !state.showPinnedOnly;
      el.pinnedSection.classList.toggle('has-pins', hasPins);
    }
  }

  function resetAllFilters() {
    state.searchQuery = '';
    state.selectedCategory = 'all';
    state.selectedAudience = 'all';
    state.selectedType = 'all';
    state.showPinnedOnly = false;

    if (el.searchInput) {
      el.searchInput.value = '';
      if (el.searchClear) el.searchClear.style.display = 'none';
    }

    el.catTabs.forEach(t => t.classList.toggle('active', t.dataset.category === 'all'));
    el.audiencePills.forEach(p => p.classList.toggle('active', p.dataset.audience === 'all'));
    el.typePills.forEach(p => p.classList.toggle('active', p.dataset.type === 'all'));
    if (el.pinnedFilterBtn) el.pinnedFilterBtn.classList.remove('active');

    filterMoves();
    showToast('Filters reset');
  }

  // ==========================================================================
  // Pinned / Favorites System
  // ==========================================================================
  function togglePin(cardId) {
    if (state.pinnedIds.has(cardId)) {
      state.pinnedIds.delete(cardId);
      showToast('Removed from pinned');
    } else {
      state.pinnedIds.add(cardId);
      showToast('Pinned to top!');
    }

    localStorage.setItem('hogsworn_pinned', JSON.stringify(Array.from(state.pinnedIds)));
    updatePinnedCount();
    renderPinnedSection();
    updateCardPinButtons();

    if (state.showPinnedOnly) {
      filterMoves();
    }
  }

  function updatePinnedCount() {
    if (el.pinnedCountBadge) {
      el.pinnedCountBadge.textContent = state.pinnedIds.size;
    }
  }

  function updateCardPinButtons() {
    document.querySelectorAll('.move-card').forEach(card => {
      const pinBtn = card.querySelector('.pin-btn');
      if (pinBtn) {
        const isPinned = state.pinnedIds.has(card.id);
        pinBtn.classList.toggle('pinned', isPinned);
        pinBtn.setAttribute('title', isPinned ? 'Unpin move' : 'Pin to top');
        pinBtn.innerHTML = isPinned ? '★' : '☆';
      }
    });
  }

  function renderPinnedSection() {
    if (!el.pinnedGrid) return;
    el.pinnedGrid.innerHTML = '';

    if (state.pinnedIds.size === 0) {
      el.pinnedSection.classList.remove('has-pins');
      return;
    }

    el.pinnedSection.classList.add('has-pins');

    state.pinnedIds.forEach(id => {
      const orig = document.getElementById(id);
      if (orig) {
        const clone = orig.cloneNode(true);
        clone.id = 'pin-' + id;
        clone.classList.remove('hidden');
        el.pinnedGrid.appendChild(clone);
      }
    });

    updateCardPinButtons();
  }

  // ==========================================================================
  // Navigation & Deep Linking
  // ==========================================================================
  function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    jumpToMove(hash);
  }

  function jumpToMove(id) {
    // If the target is a category or move
    const target = document.getElementById(id);
    if (!target) return;

    // If card is hidden by filters, reset or expand filters
    if (target.classList.contains('hidden')) {
      const cardCat = target.dataset.category;
      state.selectedCategory = 'all';
      state.selectedAudience = 'all';
      state.selectedType = 'all';
      state.showPinnedOnly = false;
      el.catTabs.forEach(t => t.classList.toggle('active', t.dataset.category === 'all'));
      el.audiencePills.forEach(p => p.classList.toggle('active', p.dataset.audience === 'all'));
      el.typePills.forEach(p => p.classList.toggle('active', p.dataset.type === 'all'));
      if (el.pinnedFilterBtn) el.pinnedFilterBtn.classList.remove('active');
      filterMoves();
    }

    // Expand target card if collapsed
    target.classList.remove('collapsed');

    // Scroll to target
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Flash highlight pulse
    target.classList.remove('highlight-pulse');
    void target.offsetWidth; // trigger reflow
    target.classList.add('highlight-pulse');

    // Update URL hash without retriggering hashchange
    history.pushState(null, '', '#' + id);
  }

  // ==========================================================================
  // Table Roller (d100 on Pay the Price, Endure Harm, etc.)
  // ==========================================================================
  function rollOnTable(tableWrapper) {
    const table = tableWrapper.querySelector('table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) return;

    // Roll 1d100
    const roll = Math.floor(Math.random() * 100) + 1;

    // Remove previous highlights
    rows.forEach(r => r.classList.remove('highlight-row'));

    let matchedRow = null;
    let matchedText = '';

    rows.forEach(row => {
      const firstCol = row.querySelector('td:first-child');
      if (!firstCol) return;
      const rangeText = firstCol.textContent.trim();

      // Check range e.g. "1-10", "11-20", "51-100", or single number "5"
      if (rangeText.includes('-')) {
        const [low, high] = rangeText.split('-').map(n => parseInt(n.trim(), 10));
        if (roll >= low && roll <= high) {
          matchedRow = row;
          matchedText = row.querySelector('td:last-child')?.textContent.trim() || '';
        }
      } else {
        const val = parseInt(rangeText, 10);
        if (roll === val) {
          matchedRow = row;
          matchedText = row.querySelector('td:last-child')?.textContent.trim() || '';
        }
      }
    });

    if (matchedRow) {
      matchedRow.classList.add('highlight-row');
      matchedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast(`🎲 Rolled ${roll}: ${matchedText.substring(0, 75)}...`);
    } else {
      showToast(`🎲 Rolled ${roll}`);
    }
  }

  // ==========================================================================
  // Interactive Dice Roller
  // ==========================================================================
  function openDiceDrawer() {
    el.diceDrawer.classList.add('active');
    el.diceOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDiceDrawer() {
    el.diceDrawer.classList.remove('active');
    el.diceOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function setupDiceControls() {
    // Mode tabs
    el.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.diceMode = tab.dataset.mode;
        
        const isAction = state.diceMode === 'action';
        el.actionControls.style.display = isAction ? 'block' : 'none';
        el.oracleControls.style.display = isAction ? 'none' : 'block';
        el.actionDiceRow.style.display = isAction ? 'flex' : 'none';
        el.oracleDiceRow.style.display = isAction ? 'none' : 'flex';
        el.actionBreakdown.style.display = isAction ? 'block' : 'none';
      });
    });

    // Stat Pills
    el.statPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const statName = pill.dataset.stat;
        if (state.selectedStat === statName) {
          // Deselect
          state.selectedStat = null;
          state.statValue = 0;
          pill.classList.remove('active');
        } else {
          el.statPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          state.selectedStat = statName;
          state.statValue = parseInt(pill.dataset.val || '1', 10);
        }
        updateStatDisplay();
      });
    });

    // Stat Stepper
    if (el.statMinus) {
      el.statMinus.addEventListener('click', () => {
        state.statValue = Math.max(-2, state.statValue - 1);
        updateStatDisplay();
      });
    }
    if (el.statPlus) {
      el.statPlus.addEventListener('click', () => {
        state.statValue = Math.min(5, state.statValue + 1);
        updateStatDisplay();
      });
    }

    // Adds Stepper
    if (el.addsMinus) {
      el.addsMinus.addEventListener('click', () => {
        state.addsValue = Math.max(0, state.addsValue - 1);
        updateAddsDisplay();
      });
    }
    if (el.addsPlus) {
      el.addsPlus.addEventListener('click', () => {
        state.addsValue = Math.min(4, state.addsValue + 1);
        updateAddsDisplay();
      });
    }

    // Oracle Odds Selection
    el.oddsBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.oddsBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.oracleOdds = btn.dataset.odds;
      });
    });

    // Roll Buttons
    if (el.rollActionBtn) el.rollActionBtn.addEventListener('click', performActionRoll);
    if (el.rollOracleBtn) el.rollOracleBtn.addEventListener('click', performOracleRoll);
  }

  function updateStatDisplay() {
    if (el.statValDisplay) {
      el.statValDisplay.textContent = state.statValue >= 0 ? `+${state.statValue}` : `${state.statValue}`;
    }
  }

  function updateAddsDisplay() {
    if (el.addsValDisplay) {
      el.addsValDisplay.textContent = `+${state.addsValue}`;
    }
  }

  function triggerStatRoll(statName) {
    openDiceDrawer();
    // Switch to action roll mode
    el.modeTabs[0].click();

    // Select stat pill
    el.statPills.forEach(p => {
      const match = p.dataset.stat === statName.toLowerCase();
      p.classList.toggle('active', match);
      if (match) {
        state.selectedStat = statName;
        state.statValue = parseInt(p.dataset.val || '1', 10);
      }
    });

    updateStatDisplay();
    // Auto-roll
    performActionRoll();
  }

  function performActionRoll() {
    // Shake animation
    [el.actionDieFace, el.challengeDie1Face, el.challengeDie2Face].forEach(f => {
      if (f) {
        f.classList.remove('rolling');
        void f.offsetWidth;
        f.classList.add('rolling');
      }
    });

    const d6 = Math.floor(Math.random() * 6) + 1;
    const d10_1 = Math.floor(Math.random() * 10) + 1;
    const d10_2 = Math.floor(Math.random() * 10) + 1;

    const rawTotal = d6 + state.statValue + state.addsValue;
    const actionScore = Math.min(10, Math.max(1, rawTotal)); // Ironsworn caps score at 10

    let result = '';
    let resultClass = '';
    let isMatch = (d10_1 === d10_2);

    if (actionScore > d10_1 && actionScore > d10_2) {
      result = 'Strong Hit!';
      resultClass = 'res-strong';
    } else if (actionScore > d10_1 || actionScore > d10_2) {
      result = 'Weak Hit!';
      resultClass = 'res-weak';
    } else {
      result = 'Miss!';
      resultClass = 'res-miss';
    }

    // Display Dice
    if (el.actionDieFace) el.actionDieFace.textContent = d6;
    if (el.challengeDie1Face) el.challengeDie1Face.textContent = d10_1;
    if (el.challengeDie2Face) el.challengeDie2Face.textContent = d10_2;

    // Breakdown text
    const statStr = state.selectedStat ? `${state.selectedStat} (+${state.statValue})` : `Stat (+${state.statValue})`;
    const addsStr = state.addsValue > 0 ? ` + Adds (+${state.addsValue})` : '';
    const capStr = rawTotal > 10 ? ` (capped at 10)` : '';
    if (el.actionBreakdown) {
      el.actionBreakdown.textContent = `Score ${actionScore} [d6 (${d6}) + ${statStr}${addsStr}] vs Challenge [${d10_1}, ${d10_2}]${capStr}`;
    }

    // Result Banner
    if (el.rollResultBanner) {
      el.rollResultBanner.className = 'roll-result-banner ' + resultClass;
      el.rollResultBanner.textContent = result;
      el.rollResultBanner.style.display = 'block';
    }

    // Match badge
    if (el.matchBadge) {
      if (isMatch) {
        el.matchBadge.style.display = 'inline-block';
        el.matchBadge.textContent = '✦ MATCH! A twist occurs! ✦';
      } else {
        el.matchBadge.style.display = 'none';
      }
    }

    // Log history
    addHistoryItem(`Action: ${actionScore} vs (${d10_1}, ${d10_2}) ➔ ${result}${isMatch ? ' (Match)' : ''}`);
  }

  function performOracleRoll() {
    if (el.oracleDieFace) {
      el.oracleDieFace.classList.remove('rolling');
      void el.oracleDieFace.offsetWidth;
      el.oracleDieFace.classList.add('rolling');
    }

    const d100 = Math.floor(Math.random() * 100) + 1;
    if (el.oracleDieFace) el.oracleDieFace.textContent = d100;

    const thresholdMap = {
      'almost-certain': 11,
      'likely': 26,
      '50-50': 51,
      'unlikely': 76,
      'small-chance': 91
    };

    const threshold = thresholdMap[state.oracleOdds] || 51;
    const isYes = d100 >= threshold;
    const isMatch = (d100 % 11 === 0) || d100 === 100; // Doubles e.g. 11, 22, 33...

    const result = isYes ? 'YES' : 'NO';
    const resultClass = isYes ? 'res-strong' : 'res-miss';

    if (el.rollResultBanner) {
      el.rollResultBanner.className = 'roll-result-banner ' + resultClass;
      el.rollResultBanner.textContent = `${result} (Rolled ${d100}, needed ${threshold}+)`;
      el.rollResultBanner.style.display = 'block';
    }

    if (el.matchBadge) {
      if (isMatch) {
        el.matchBadge.style.display = 'inline-block';
        el.matchBadge.textContent = '✦ MATCH! Extreme result or twist! ✦';
      } else {
        el.matchBadge.style.display = 'none';
      }
    }

    addHistoryItem(`Oracle [${state.oracleOdds}]: ${d100} ➔ ${result}${isMatch ? ' (Twist)' : ''}`);
  }

  function addHistoryItem(text) {
    if (!el.rollHistoryContainer) return;
    const item = document.createElement('div');
    item.className = 'history-item';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    item.innerHTML = `<span class="history-val">${text}</span><span style="font-size: 0.7rem; color: var(--text-dim);">${time}</span>`;
    
    el.rollHistoryContainer.prepend(item);

    // Keep max 6 items
    while (el.rollHistoryContainer.children.length > 6) {
      el.rollHistoryContainer.removeChild(el.rollHistoryContainer.lastChild);
    }
  }

  // ==========================================================================
  // Toast Helper
  // ==========================================================================
  let toastTimer = null;
  function showToast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2400);
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

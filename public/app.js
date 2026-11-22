(() => {
  const state = {
    me: null,
    providers: { google: false, discord: false, dev: false },
    gameState: null,
    challengesData: null,
    route: window.location.pathname === '/info' ? 'info' : 'board',
    viewingTeamId: null,
    hovercardPinned: false,
    hovercardCellIndex: null,
    selectedSoloColor: '#22c55e',
    selectedNewTeamColor: '#38bdf8',
    selectedProfileColor: '#22c55e',
    eventSource: null
  };

  const $ = (id) => document.getElementById(id);

  // --- Utilities ---
  async function api(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function toast(message, kind = 'info') {
    const container = $('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s ease';
      setTimeout(() => el.remove(), 260);
    }, kind === 'bingo' ? 6000 : 3200);
  }

  // --- Festive Christmas Bingo Chaos Engine ---
  let chaosAnimId = null;
  let chaosActive = false;
  let snowParticles = [];
  let confettiBurst = [];

  function playHolidayFanfare() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      // Quick joyful 8-bit Jingle Bells motif (E E E - E E E - E G C D E!)
      const notes = [
        [659.25, 0.00, 0.11],
        [659.25, 0.13, 0.11],
        [659.25, 0.26, 0.22],
        [659.25, 0.52, 0.11],
        [659.25, 0.65, 0.11],
        [659.25, 0.78, 0.22],
        [659.25, 1.04, 0.11],
        [783.99, 1.17, 0.11],
        [523.25, 1.30, 0.16],
        [587.33, 1.48, 0.09],
        [659.25, 1.59, 0.40]
      ];
      const now = ctx.currentTime + 0.02;
      for (const [freq, offset, dur] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.14, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + dur + 0.02);
      }
    } catch {}
  }

  function buildChristmasGarland() {
    const garland = $('christmas-garland');
    if (!garland || garland.childElementCount > 0) return;
    const colors = ['#ef4444', '#22c55e', '#facc15', '#38bdf8', '#ec4899'];
    const count = Math.max(18, Math.floor(window.innerWidth / 52));
    for (let i = 0; i < count; i++) {
      const bulb = document.createElement('span');
      bulb.className = 'xmas-bulb';
      bulb.style.setProperty('--bulb-color', colors[i % colors.length]);
      bulb.style.setProperty('--bulb-delay', `${(i % 5) * 0.22}s`);
      garland.appendChild(bulb);
    }
  }

  function buildPersistentChaosDecor() {
    const decor = $('chaos-decor');
    if (!decor || decor.childElementCount > 0) return;
    const stickers = [
      { text: 'MERRY BINGOMAS!!', top: '9%', left: '1.5%', rot: '-12deg', color: '#ef4444', size: '1.15rem' },
      { text: 'HO HO HO!', top: '14%', right: '1.5%', rot: '11deg', color: '#22c55e', size: '1.1rem' },
      { text: 'BUILT DIFFERENT', bottom: '12%', left: '1.2%', rot: '8deg', color: '#facc15', size: '1rem' },
      { text: 'ELF DIFF 🎄', bottom: '9%', right: '1.5%', rot: '-9deg', color: '#38bdf8', size: '1.1rem' }
    ];
    for (const s of stickers) {
      const el = document.createElement('div');
      el.className = 'chaos-sticker';
      el.textContent = s.text;
      el.style.color = s.color;
      el.style.fontSize = s.size;
      el.style.setProperty('--rot', s.rot);
      if (s.top) el.style.top = s.top;
      if (s.bottom) el.style.bottom = s.bottom;
      if (s.left) el.style.left = s.left;
      if (s.right) el.style.right = s.right;
      decor.appendChild(el);
    }

    const snowmen = [
      { emoji: '☃️', bottom: '18px', left: '18px' },
      { emoji: '⛄', bottom: '18px', right: '22px' },
      { emoji: '🎅', top: '52px', right: '18px' },
      { emoji: '🎄', bottom: '74px', left: '26px' }
    ];
    for (const sm of snowmen) {
      const el = document.createElement('div');
      el.className = 'chaos-snowman';
      el.textContent = sm.emoji;
      if (sm.top) el.style.top = sm.top;
      if (sm.bottom) el.style.bottom = sm.bottom;
      if (sm.left) el.style.left = sm.left;
      if (sm.right) el.style.right = sm.right;
      decor.appendChild(el);
    }
  }

  function startSnowAndConfetti({ burst = false } = {}) {
    const canvas = $('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (snowParticles.length === 0) {
      snowParticles = Array.from({ length: 75 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 1.5 + Math.random() * 3.5,
        vy: 0.7 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 0.8,
        wobble: Math.random() * Math.PI * 2
      }));
    }

    if (burst) {
      const colors = ['#ef4444', '#22c55e', '#facc15', '#ffffff', '#38bdf8', '#ec4899'];
      for (let i = 0; i < 180; i++) {
        confettiBurst.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * 220,
          vx: (Math.random() - 0.5) * 8,
          vy: 3 + Math.random() * 6,
          size: 7 + Math.random() * 7,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.3,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 210
        });
      }
    }

    if (chaosAnimId) return;
    function tick() {
      if (!chaosActive && confettiBurst.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        chaosAnimId = null;
        return;
      }
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Gentle falling snow while Christmas chaos is active
      if (chaosActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        for (const f of snowParticles) {
          f.wobble += 0.02;
          f.x += f.vx + Math.sin(f.wobble) * 0.5;
          f.y += f.vy;
          if (f.y > canvas.height + 10) {
            f.y = -10;
            f.x = Math.random() * canvas.width;
          }
          if (f.x > canvas.width + 10) f.x = -10;
          if (f.x < -10) f.x = canvas.width + 10;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Festive confetti burst
      confettiBurst = confettiBurst.filter((p) => p.life > 0);
      for (const p of confettiBurst) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.rot += p.vrot;
        p.life -= 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      }

      chaosAnimId = requestAnimationFrame(tick);
    }
    chaosAnimId = requestAnimationFrame(tick);
  }

  function setChristmasChaosEnabled(enabled) {
    chaosActive = enabled;
    const garland = $('christmas-garland');
    const decor = $('chaos-decor');
    if (enabled) {
      buildChristmasGarland();
      buildPersistentChaosDecor();
      garland.classList.remove('hidden');
      decor.classList.remove('hidden');
      startSnowAndConfetti({ burst: false });
    } else {
      garland.classList.add('hidden');
      decor.classList.add('hidden');
      snowParticles = [];
    }
  }

  function showBingoCelebration({ teamName, teamColor, title, bingoCount }) {
    setChristmasChaosEnabled(true);
    startSnowAndConfetti({ burst: true });
    playHolidayFanfare();

    const overlay = $('bingo-celebration');
    const graffitiLayer = $('bingo-celeb-graffiti');
    graffitiLayer.innerHTML = '';

    const tags = [
      { text: 'BINGO!!!', top: '8%', left: '6%', rot: '-16deg', color: '#facc15', size: 'clamp(2.2rem, 5vw, 4rem)' },
      { text: 'HO HO HO!!', top: '10%', right: '7%', rot: '14deg', color: '#ef4444', size: 'clamp(2rem, 4.5vw, 3.6rem)' },
      { text: 'GG EZ', top: '34%', left: '3%', rot: '-22deg', color: '#4ade80', size: 'clamp(2.4rem, 5vw, 4.2rem)' },
      { text: 'BUILT DIFFERENT', top: '32%', right: '3%', rot: '18deg', color: '#38bdf8', size: 'clamp(1.7rem, 3.8vw, 3rem)' },
      { text: 'CERTIFIED GAMER', bottom: '18%', left: '4%', rot: '11deg', color: '#ec4899', size: 'clamp(1.7rem, 3.8vw, 3rem)' },
      { text: 'SLAYED 🛷', bottom: '20%', right: '5%', rot: '-14deg', color: '#facc15', size: 'clamp(2.1rem, 4.5vw, 3.6rem)' },
      { text: 'MERRY BINGOMAS!', bottom: '6%', left: '22%', rot: '-5deg', color: '#4ade80', size: 'clamp(1.8rem, 4vw, 3.2rem)' },
      { text: 'SANTA APPROVES', top: '20%', left: '26%', rot: '7deg', color: '#fb923c', size: 'clamp(1.4rem, 3vw, 2.3rem)' }
    ];
    tags.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'graffiti-tag';
      el.textContent = t.text;
      el.style.fontSize = t.size;
      el.style.setProperty('--tag-color', t.color);
      el.style.setProperty('--rot', t.rot);
      el.style.setProperty('--delay', `${i * 0.06}s`);
      if (t.top) el.style.top = t.top;
      if (t.bottom) el.style.bottom = t.bottom;
      if (t.left) el.style.left = t.left;
      if (t.right) el.style.right = t.right;
      graffitiLayer.appendChild(el);
    });

    const snowmen = [
      { emoji: '☃️', top: '56%', left: '10%', delay: '0.1s' },
      { emoji: '⛄', top: '56%', right: '10%', delay: '0.18s' },
      { emoji: '🎅', bottom: '8%', right: '20%', delay: '0.24s' },
      { emoji: '🎄', top: '16%', left: '16%', delay: '0.12s' },
      { emoji: '🦌', top: '16%', right: '18%', delay: '0.2s' },
      { emoji: '🎁', bottom: '8%', left: '12%', delay: '0.28s' }
    ];
    for (const sm of snowmen) {
      const el = document.createElement('div');
      el.className = 'graffiti-snowman';
      el.textContent = sm.emoji;
      el.style.setProperty('--delay', sm.delay);
      if (sm.top) el.style.top = sm.top;
      if (sm.bottom) el.style.bottom = sm.bottom;
      if (sm.left) el.style.left = sm.left;
      if (sm.right) el.style.right = sm.right;
      graffitiLayer.appendChild(el);
    }

    const winnerEl = $('bingo-celeb-winner');
    winnerEl.textContent = teamName || 'Winner';
    winnerEl.style.setProperty('--winner-color', teamColor || '#22c55e');

    const countLabel = bingoCount && bingoCount > 1 ? `Bingo #${bingoCount}` : 'a BINGO';
    $('bingo-celeb-detail').textContent = title
      ? `Scored ${countLabel} by completing "${title}"!`
      : `Just scored ${countLabel}!!`;

    overlay.classList.remove('hidden');
  }

  function syncChristmasChaosFromState() {
    const anyBingo = (state.gameState?.teams || []).some((t) => t.bingoCount > 0);
    setChristmasChaosEnabled(anyBingo);
  }

  // --- Color Swatch Helper ---
  function renderSwatches(containerId, currentColor, onPick) {
    const colors = state.gameState?.teamColors || ['#22c55e', '#38bdf8', '#facc15', '#f97316', '#a855f7', '#ef4444'];
    const el = $(containerId);
    el.innerHTML = '';
    for (const hex of colors) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `swatch ${hex.toLowerCase() === String(currentColor).toLowerCase() ? 'selected' : ''}`;
      btn.style.background = hex;
      btn.title = hex;
      btn.addEventListener('click', () => {
        onPick(hex);
        renderSwatches(containerId, hex, onPick);
      });
      el.appendChild(btn);
    }
  }

  // --- Data Sync ---
  function syncMeFromState() {
    if (!state.me || !state.gameState?.users) return;
    const updated = state.gameState.users[state.me.id];
    if (updated) {
      state.me = updated;
    } else {
      state.me = null;
      state.viewingTeamId = null;
    }
  }

  function getMyTeam() {
    if (!state.me?.teamId || !state.gameState?.teams) return null;
    return state.gameState.teams.find((t) => t.id === state.me.teamId) || null;
  }

  function getViewedTeam() {
    if (!state.gameState?.teams) return null;
    if (state.viewingTeamId) {
      const found = state.gameState.teams.find((t) => t.id === state.viewingTeamId);
      if (found) return found;
    }
    return getMyTeam() || state.gameState.teams[0] || null;
  }

  function connectSSE() {
    if (state.eventSource) {
      state.eventSource.close();
    }
    const es = new EventSource('/api/events');
    state.eventSource = es;

    es.onopen = () => {
      $('nav-live').classList.remove('offline');
    };

    es.onerror = () => {
      $('nav-live').classList.add('offline');
    };

    es.addEventListener('update', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.state) {
          state.gameState = msg.state;
          syncMeFromState();
          syncChristmasChaosFromState();
          renderAll();
        }
        if (msg.type === 'bingo' && msg.event?.teamName) {
          showBingoCelebration(msg.event);
        } else if (msg.type === 'reset' && msg.event?.kind === 'redeal') {
          $('bingo-celebration').classList.add('hidden');
          toast('Fresh Bingo boards dealt!');
        } else if (msg.type === 'reset' && msg.event?.kind === 'reset-all') {
          $('bingo-celebration').classList.add('hidden');
          toast('Game state was reset by host.');
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });
  }

  // --- Rendering ---
  function showView(viewId) {
    for (const id of ['view-loading', 'view-login', 'view-onboarding', 'view-dashboard', 'view-info']) {
      $(id).classList.toggle('hidden', id !== viewId);
    }
    const hideNav = viewId === 'view-loading' || viewId === 'view-login' || (viewId === 'view-info' && !state.me);
    $('navbar').classList.toggle('hidden', hideNav);
    $('btn-info').classList.toggle('btn-nav-active', viewId === 'view-info');
  }

  function navigateTo(route, push = true) {
    state.route = route;
    const targetPath = route === 'info' ? '/info' : '/';
    if (push && window.location.pathname !== targetPath) {
      window.history.pushState({ route }, '', targetPath);
    }
    hideHovercard(true);
    renderAll();
    if (route === 'info') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  async function ensureChallengesLoaded(force = false) {
    if (state.challengesData && !force) return state.challengesData;
    state.challengesData = await api('/api/challenges');
    return state.challengesData;
  }

  function renderInfoPage() {
    showView('view-info');
    if (state.me) renderNavbar();

    const backBtn = $('btn-info-back');
    backBtn.textContent = state.me ? '← Back to Board' : '← Back to Sign In';

    const navEl = $('info-tier-nav');
    const container = $('info-tiers-container');
    const tiers = state.challengesData?.tiers || [];

    if (tiers.length === 0) {
      navEl.innerHTML = '';
      container.innerHTML = `<div class="muted">Loading challenges...</div>`;
      ensureChallengesLoaded().then(() => {
        if (state.route === 'info') renderInfoPage();
      }).catch((err) => {
        container.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      });
      return;
    }

    navEl.innerHTML = tiers
      .map(
        (t) => `
          <a href="#tier-${t.tier}" class="info-tier-pill">
            <span class="tier-swatch" style="background:${escapeHtml(t.color)}"></span>
            T${t.tier} ${escapeHtml(t.name)}
            <span class="muted tiny">(${t.challenges?.length || 0})</span>
          </a>
        `
      )
      .join('');

    container.innerHTML = tiers
      .map((t) => {
        const cards = (t.challenges || [])
          .map((ch) => {
            const tagsHtml = (ch.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('');
            const text = ch.rules || ch.description || '';
            return `
              <article class="info-card">
                <div class="info-card-icon-wrap">
                  ${renderIconHtml(ch.icon, 'info-card-icon', 'info-card-icon-emoji')}
                </div>
                <div class="info-card-body">
                  <h3 class="info-card-title">${escapeHtml(ch.title)}</h3>
                  <p class="info-card-rules">${escapeHtml(text)}</p>
                  ${tagsHtml ? `<div class="inspector-tags">${tagsHtml}</div>` : ''}
                </div>
              </article>
            `;
          })
          .join('');

        return `
          <section id="tier-${t.tier}" class="info-tier-section">
            <div class="info-tier-heading">
              <div class="info-tier-heading-left">
                <span class="cell-tier" style="--tier-color:${escapeHtml(t.color)}">T${t.tier}</span>
                <h2>${escapeHtml(t.name)}</h2>
              </div>
              ${t.estimatedMinutes ? `<span class="muted tiny">Est. ${escapeHtml(t.estimatedMinutes)} min</span>` : ''}
            </div>
            <div class="info-grid">${cards}</div>
          </section>
        `;
      })
      .join('');
  }

  function renderNavbar() {
    if (!state.me || !state.gameState) return;
    $('nav-username').textContent = state.me.name;
    const avatarEl = $('nav-avatar');
    if (state.me.avatar) {
      avatarEl.innerHTML = `<img src="${escapeHtml(state.me.avatar)}" alt="" />`;
    } else {
      avatarEl.textContent = (state.me.name || '?').slice(0, 1).toUpperCase();
      const myTeam = getMyTeam();
      avatarEl.style.background = myTeam?.color || '#3c4a63';
    }
    $('btn-host').classList.toggle('hidden', !state.me.isHost);
  }

  function renderLogin() {
    showView('view-login');
    const { google, discord, dev } = state.providers;
    $('btn-discord-login').classList.toggle('hidden', !discord);
    $('btn-google-login').classList.toggle('hidden', !google);
    $('oauth-hint').classList.toggle('hidden', google || discord);
    $('dev-login-box').classList.toggle('hidden', !dev);

    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const errBox = $('login-error');
    if (err) {
      errBox.textContent = `Sign-in failed (${err.replace(/_/g, ' ')}). Check your OAuth settings and try again.`;
      errBox.classList.remove('hidden');
    } else {
      errBox.classList.add('hidden');
    }
  }

  function renderTeamSelectList(containerId, onJoin) {
    const el = $(containerId);
    const joinable = (state.gameState?.teams || []).filter((t) => !t.isSolo);
    if (joinable.length === 0) {
      el.innerHTML = `<div class="muted small">No squads yet — create the first one below!</div>`;
      return;
    }
    el.innerHTML = '';
    for (const team of joinable) {
      const isMine = state.me?.teamId === team.id;
      const row = document.createElement('div');
      row.className = 'team-select-item';
      const memberNames = team.members.map((m) => m.name).join(', ') || 'No members yet';
      row.innerHTML = `
        <div class="team-select-info">
          <span class="team-dot" style="background:${escapeHtml(team.color)}"></span>
          <div style="min-width:0">
            <div style="font-weight:600;font-size:0.9rem">${escapeHtml(team.name)}</div>
            <div class="muted tiny">${escapeHtml(memberNames)}</div>
          </div>
        </div>
        <button type="button" class="btn btn-sm ${isMine ? 'btn-ghost' : 'btn-primary'}" ${isMine ? 'disabled' : ''}>
          ${isMine ? 'Current' : 'Join'}
        </button>
      `;
      if (!isMine) {
        row.querySelector('button').addEventListener('click', () => onJoin(team.id));
      }
      el.appendChild(row);
    }
  }

  function renderOnboarding() {
    showView('view-onboarding');
    renderNavbar();
    $('onboard-username').textContent = state.me.name;
    renderSwatches('solo-color-picker', state.selectedSoloColor, (c) => { state.selectedSoloColor = c; });
    renderSwatches('team-color-picker', state.selectedNewTeamColor, (c) => { state.selectedNewTeamColor = c; });
    renderTeamSelectList('onboard-team-list', handleJoinTeam);
  }

  function renderDashboard() {
    showView('view-dashboard');
    renderNavbar();

    const game = state.gameState.game;
    const myTeam = getMyTeam();
    const viewedTeam = getViewedTeam();
    const isLockout = game.mode === 'lockout';
    const isSpectating = !isLockout && viewedTeam && myTeam && viewedTeam.id !== myTeam.id;

    // Header
    if (isLockout) {
      $('viewing-team-dot').style.background = myTeam?.color || '#facc15';
      $('viewing-team-name').textContent = 'Shared Lockout Board';
      $('viewing-subtitle').textContent = myTeam
        ? `Playing as ${myTeam.name} — first squad to claim a tile locks it for everyone.`
        : 'Spectating shared Lockout board';
      $('viewing-badge').classList.add('hidden');
      $('btn-back-to-my-board').classList.add('hidden');
    } else if (viewedTeam) {
      $('viewing-team-dot').style.background = viewedTeam.color;
      $('viewing-team-name').textContent = viewedTeam.isSolo
        ? `${viewedTeam.name}'s Board`
        : `Team ${viewedTeam.name}`;
      const memberStr = viewedTeam.members.map((m) => m.name).join(', ');
      const subtitleEl = $('viewing-subtitle');
      subtitleEl.textContent = viewedTeam.isSolo ? '' : (memberStr ? `Members: ${memberStr}` : '');
      subtitleEl.classList.toggle('hidden', !subtitleEl.textContent);
      $('viewing-badge').classList.toggle('hidden', !isSpectating);
      $('btn-back-to-my-board').classList.toggle('hidden', !isSpectating);
    }

    // Stats
    const statTeam = isLockout ? myTeam : viewedTeam;
    $('stat-checked').textContent = `${statTeam ? statTeam.checkedCount : 0} / 25`;
    const bingoCount = statTeam ? statTeam.bingoCount : 0;
    $('stat-bingos').textContent = `${bingoCount} ${bingoCount === 1 ? 'Bingo' : 'Bingos'}`;

    // Tier Legend
    const legendEl = $('tier-legend');
    legendEl.innerHTML = (state.gameState.tiers || [])
      .map(
        (t) => `
          <span class="tier-chip">
            <span class="tier-swatch" style="background:${escapeHtml(t.color)}"></span>
            T${t.tier} ${escapeHtml(t.name)}
          </span>
        `
      )
      .join('');

    // Board cells
    const board = isLockout ? game.sharedBoard : (viewedTeam?.board || []);
    const teamsById = Object.fromEntries(state.gameState.teams.map((t) => [t.id, t]));

    // Indices that belong to any completed bingo line on this displayed board
    const bingoIndices = new Set();
    if (isLockout) {
      for (const t of state.gameState.teams) {
        for (const line of t.bingos || []) {
          line.indices.forEach((i) => bingoIndices.add(i));
        }
      }
    } else if (viewedTeam) {
      for (const line of viewedTeam.bingos || []) {
        line.indices.forEach((i) => bingoIndices.add(i));
      }
    }

    const canClickBoard = Boolean(myTeam) && (isLockout || !isSpectating || state.me?.isHost);
    const gridEl = $('bingo-grid');
    gridEl.innerHTML = '';
    hideHovercard(true);

    for (const cell of board) {
      const claimTeam = cell.checkedByTeamId ? teamsById[cell.checkedByTeamId] : null;
      const claimColor = claimTeam?.color || viewedTeam?.color || '#22c55e';
      const lockedByOther = isLockout && cell.checked && myTeam && cell.checkedByTeamId !== myTeam.id && !state.me?.isHost;

      const tile = document.createElement('div');
      tile.className = [
        'bingo-cell',
        cell.isFreeSpace ? 'free-space' : '',
        cell.checked ? 'checked' : '',
        bingoIndices.has(cell.index) ? 'in-bingo' : '',
        (!canClickBoard || lockedByOther) ? 'readonly' : ''
      ].join(' ');
      tile.style.setProperty('--tier-color', cell.tierColor || '#64748b');
      tile.style.setProperty('--claim-color', claimColor);
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');

      const footerHtml = cell.checked
        ? `<span class="cell-check-badge">✓ ${escapeHtml(isLockout && claimTeam ? claimTeam.name : (cell.checkedByName || 'Done'))}</span>`
        : '';

      const tierBadge = cell.isFreeSpace ? 'FREE' : `T${cell.tier}`;

      tile.innerHTML = `
        <div class="cell-top">
          <span class="cell-tier">${tierBadge}</span>
          <button type="button" class="cell-info-btn" title="Challenge details" aria-label="Details">i</button>
        </div>
        <div class="cell-body">
          ${renderIconHtml(cell.icon, 'cell-icon', 'cell-icon-emoji')}
          <div class="cell-title">${escapeHtml(cell.title)}</div>
        </div>
        <div class="cell-footer">${footerHtml}</div>
      `;

      tile.addEventListener('mouseenter', () => {
        if (!state.hovercardPinned) {
          showHovercard(cell, claimTeam, tile, false);
        }
      });

      tile.addEventListener('mouseleave', () => {
        if (!state.hovercardPinned) {
          hideHovercard();
        }
      });

      tile.querySelector('.cell-info-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.hovercardPinned && state.hovercardCellIndex === cell.index) {
          hideHovercard(true);
        } else {
          showHovercard(cell, claimTeam, tile, true);
        }
      });

      const triggerToggle = async () => {
        if (!canClickBoard || lockedByOther) return;
        hideHovercard(true);
        const targetTeamId = (!isLockout && isSpectating && state.me?.isHost) ? viewedTeam.id : null;
        try {
          await api('/api/board/toggle', {
            method: 'POST',
            body: JSON.stringify({ cellIndex: cell.index, teamId: targetTeamId })
          });
        } catch (err) {
          toast(err.message, 'error');
        }
      };

      tile.addEventListener('click', triggerToggle);
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerToggle();
        }
      });

      gridEl.appendChild(tile);
    }

    // Leaderboard
    const lbEl = $('leaderboard-list');
    $('leaderboard-hint').textContent = isLockout ? 'Shared board' : 'Click to spectate';
    if (state.gameState.teams.length === 0) {
      lbEl.innerHTML = `<div class="muted small">No players have joined yet.</div>`;
    } else {
      lbEl.innerHTML = '';
      state.gameState.teams.forEach((team, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSelected = !isLockout && viewedTeam?.id === team.id;
        btn.className = `lb-item ${isSelected ? 'active' : ''}`;
        const membersText = team.isSolo
          ? 'Solo'
          : (team.members.map((m) => m.name).join(', ') || 'No members');

        btn.innerHTML = `
          <div class="lb-left">
            <span class="lb-rank">#${idx + 1}</span>
            <span class="team-dot" style="background:${escapeHtml(team.color)}"></span>
            <div style="min-width:0">
              <div class="lb-name">${escapeHtml(team.name)} ${team.id === myTeam?.id ? '<span class="muted tiny">(You)</span>' : ''}</div>
              <div class="lb-members">${escapeHtml(membersText)}</div>
            </div>
          </div>
          <div class="lb-score">
            ${team.bingoCount > 0 ? `<div class="lb-bingo-badge">${team.bingoCount} BINGO</div>` : ''}
            <div>${team.checkedCount}/25</div>
          </div>
        `;
        btn.addEventListener('click', () => {
          if (!isLockout) {
            state.viewingTeamId = team.id;
            renderDashboard();
          }
        });
        lbEl.appendChild(btn);
      });
    }

    // Activity Feed
    const actEl = $('activity-list');
    const items = state.gameState.activity || [];
    if (items.length === 0) {
      actEl.innerHTML = `<div class="muted small">No activity yet. Start checking off challenges!</div>`;
    } else {
      actEl.innerHTML = items
        .map(
          (a) => `
            <div class="activity-item kind-${escapeHtml(a.kind || 'info')}">
              <div>${escapeHtml(a.text)}</div>
              <span class="activity-time">${escapeHtml(formatTime(a.at))}</span>
            </div>
          `
        )
        .join('');
    }
  }

  function renderIconHtml(icon, imgClass, emojiClass) {
    if (!icon) return '';
    const str = String(icon).trim();
    if (str.startsWith('/') || str.startsWith('http://') || str.startsWith('https://')) {
      return `<img class="${imgClass}" src="${escapeHtml(str)}" alt="" loading="lazy" />`;
    }
    return `<span class="${emojiClass}" aria-hidden="true">${escapeHtml(str)}</span>`;
  }

  function showHovercard(cell, claimTeam, anchorEl, pinned = false) {
    const card = $('hovercard');
    if (!card || !anchorEl) return;

    state.hovercardPinned = pinned;
    state.hovercardCellIndex = cell.index;
    card.classList.toggle('pinned', pinned);

    const tagsHtml = (cell.tags || []).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
    const checkedInfo = cell.checked
      ? `<span style="color:${escapeHtml(claimTeam?.color || '#4ade80')};font-weight:600">✓ ${escapeHtml(cell.checkedByName || 'Completed')} · ${escapeHtml(formatTime(cell.checkedAt))}</span>`
      : `<span class="muted">Click square to check off</span>`;

    const tierLabel = cell.isFreeSpace
      ? 'FREE · Center Square'
      : `T${cell.tier} · ${cell.tierName}`;

    card.innerHTML = `
      <div class="hovercard-head">
        ${renderIconHtml(cell.icon, 'hovercard-icon', 'hovercard-icon-emoji')}
        <div style="min-width:0">
          <div style="margin-bottom:0.2rem">
            <span class="cell-tier" style="--tier-color:${escapeHtml(cell.tierColor)}">${escapeHtml(tierLabel)}</span>
          </div>
          <div class="hovercard-title">${escapeHtml(cell.title)}</div>
        </div>
      </div>
      <div class="hovercard-desc">${escapeHtml(cell.description || 'Complete this challenge in Minecraft and click to check it off.')}</div>
      ${tagsHtml ? `<div class="inspector-tags">${tagsHtml}</div>` : ''}
      <div class="hovercard-meta">${checkedInfo}</div>
    `;

    // Temporarily reveal invisibly to measure true rendered size
    card.style.visibility = 'hidden';
    card.classList.remove('hidden');
    card.setAttribute('aria-hidden', 'false');

    const rect = anchorEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const gap = 10;
    const pad = 12;

    // Prefer above the tile; flip below if there isn't enough room above
    let placement = 'top';
    let top = rect.top - cardRect.height - gap;
    if (top < pad) {
      placement = 'bottom';
      top = rect.bottom + gap;
      if (top + cardRect.height > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - cardRect.height - pad);
      }
    }

    const anchorCenterX = rect.left + rect.width / 2;
    let left = anchorCenterX - cardRect.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - cardRect.width - pad));

    const arrowX = Math.max(18, Math.min(anchorCenterX - left, cardRect.width - 18));
    card.dataset.placement = placement;
    card.style.setProperty('--arrow-x', `${arrowX}px`);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.visibility = 'visible';
  }

  function hideHovercard(force = false) {
    if (!force && state.hovercardPinned) return;
    const card = $('hovercard');
    if (!card) return;
    state.hovercardPinned = false;
    state.hovercardCellIndex = null;
    card.classList.add('hidden');
    card.classList.remove('pinned');
    card.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', (e) => {
    if (state.hovercardPinned && !e.target.closest('#hovercard') && !e.target.closest('.cell-info-btn')) {
      hideHovercard(true);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideHovercard(true);
  });
  window.addEventListener('scroll', () => hideHovercard(true), { passive: true });
  window.addEventListener('resize', () => hideHovercard(true));

  function renderProfileModal() {
    if (!state.me || !state.gameState) return;
    const myTeam = getMyTeam();
    $('profile-name-input').value = state.me.name;
    const isSolo = !myTeam || myTeam.isSolo;
    $('profile-team-name-wrap').classList.toggle('hidden', isSolo);
    if (!isSolo) {
      $('profile-team-name-input').value = myTeam.name;
    }
    state.selectedProfileColor = myTeam?.color || '#22c55e';
    renderSwatches('profile-color-picker', state.selectedProfileColor, (c) => {
      state.selectedProfileColor = c;
    });
    $('btn-switch-solo').disabled = Boolean(myTeam?.isSolo);
    $('btn-switch-solo').textContent = myTeam?.isSolo ? '⚔️ Currently Playing Solo' : '⚔️ Switch to Play Solo';
    renderTeamSelectList('profile-team-list', async (teamId) => {
      await handleJoinTeam(teamId);
      closeModal('modal-profile');
    });
  }

  function renderHostModal() {
    if (!state.me?.isHost || !state.gameState) return;
    const list = $('host-team-list');
    const teams = state.gameState.teams || [];
    if (teams.length === 0) {
      list.innerHTML = `<div class="muted small">No active players or teams.</div>`;
      return;
    }
    list.innerHTML = '';
    for (const team of teams) {
      const row = document.createElement('div');
      row.className = 'host-team-row';
      row.innerHTML = `
        <div class="team-select-info">
          <span class="team-dot" style="background:${escapeHtml(team.color)}"></span>
          <div>
            <div style="font-weight:600;font-size:0.88rem">${escapeHtml(team.name)}</div>
            <div class="muted tiny">${team.isSolo ? 'Solo' : `${team.members.length} members`} · ${team.checkedCount}/25</div>
          </div>
        </div>
        <div style="display:flex;gap:0.4rem">
          <button type="button" class="btn btn-secondary btn-sm btn-reroll">Reroll</button>
          <button type="button" class="btn btn-danger btn-sm btn-remove">Remove</button>
        </div>
      `;
      row.querySelector('.btn-reroll').addEventListener('click', async () => {
        if (!confirm(`Reroll a new card for "${team.name}"? Their current checkoffs will reset.`)) return;
        try {
          await api('/api/host/reroll-team', { method: 'POST', body: JSON.stringify({ teamId: team.id }) });
          toast(`Rerolled card for ${team.name}`);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      row.querySelector('.btn-remove').addEventListener('click', async () => {
        if (!confirm(`Remove "${team.name}"? Members will be sent back to team selection.`)) return;
        try {
          await api(`/api/host/team/${encodeURIComponent(team.id)}`, { method: 'DELETE' });
          toast(`Removed ${team.name}`);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      list.appendChild(row);
    }
  }

  function renderAll() {
    if (state.route === 'info') {
      renderInfoPage();
      if (state.me) {
        if (!$('modal-profile').classList.contains('hidden')) renderProfileModal();
        if (!$('modal-host').classList.contains('hidden')) renderHostModal();
      }
      return;
    }
    if (!state.me) {
      renderLogin();
      return;
    }
    if (!state.me.onboarded || !state.me.teamId) {
      renderOnboarding();
      return;
    }
    renderDashboard();
    if (!$('modal-profile').classList.contains('hidden')) renderProfileModal();
    if (!$('modal-host').classList.contains('hidden')) renderHostModal();
  }

  // --- Modals ---
  function openModal(id) {
    $(id).classList.remove('hidden');
    if (id === 'modal-profile') renderProfileModal();
    if (id === 'modal-host') renderHostModal();
  }
  function closeModal(id) {
    $(id).classList.add('hidden');
  }

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.dataset.closeModal));
  });

  // --- Actions ---
  async function handleJoinTeam(teamId) {
    try {
      const res = await api('/api/onboarding/team/join', {
        method: 'POST',
        body: JSON.stringify({ teamId })
      });
      state.me = res.user;
      state.gameState = res.state;
      state.viewingTeamId = res.team.id;
      toast(`Joined "${res.team.name}"!`);
      renderAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleChooseSolo(color) {
    try {
      const res = await api('/api/onboarding/solo', {
        method: 'POST',
        body: JSON.stringify({ color })
      });
      state.me = res.user;
      state.gameState = res.state;
      state.viewingTeamId = res.team.id;
      toast('Solo card dealt! Good luck!');
      renderAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleCreateTeam(name, color) {
    try {
      const res = await api('/api/onboarding/team/create', {
        method: 'POST',
        body: JSON.stringify({ name, color })
      });
      state.me = res.user;
      state.gameState = res.state;
      state.viewingTeamId = res.team.id;
      toast(`Created team "${res.team.name}"!`);
      renderAll();
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    }
  }

  // --- Event Wiring ---
  $('dev-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('dev-name-input').value.trim();
    if (!name) return;
    try {
      const res = await api('/auth/dev', { method: 'POST', body: JSON.stringify({ name }) });
      state.me = res.user;
      state.gameState = await api('/api/state');
      syncMeFromState();
      connectSSE();
      renderAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btn-choose-solo').addEventListener('click', () => handleChooseSolo(state.selectedSoloColor));

  $('onboard-create-team-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('onboard-team-name');
    const ok = await handleCreateTeam(input.value, state.selectedNewTeamColor);
    if (ok) input.value = '';
  });

  $('btn-back-to-my-board').addEventListener('click', () => {
    state.viewingTeamId = state.me?.teamId || null;
    renderDashboard();
  });

  $('btn-profile').addEventListener('click', () => openModal('modal-profile'));
  $('btn-host').addEventListener('click', () => openModal('modal-host'));

  $('btn-info').addEventListener('click', () => {
    navigateTo(state.route === 'info' ? 'board' : 'info');
  });

  $('btn-info-back').addEventListener('click', () => navigateTo('board'));

  $('brand-home').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('board');
  });

  $('btn-login-info').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('info');
  });

  window.addEventListener('popstate', () => {
    state.route = window.location.pathname === '/info' ? 'info' : 'board';
    renderAll();
  });

  $('btn-logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    state.me = null;
    state.viewingTeamId = null;
    if (state.eventSource) state.eventSource.close();
    renderAll();
  });

  $('profile-details-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: $('profile-name-input').value,
          teamName: $('profile-team-name-input').value,
          teamColor: state.selectedProfileColor
        })
      });
      state.me = res.user;
      state.gameState = res.state;
      toast('Profile saved!');
      closeModal('modal-profile');
      renderAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btn-switch-solo').addEventListener('click', async () => {
    await handleChooseSolo(state.selectedProfileColor);
    closeModal('modal-profile');
  });

  $('profile-create-team-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('profile-new-team-name');
    const ok = await handleCreateTeam(input.value, state.selectedProfileColor);
    if (ok) {
      input.value = '';
      closeModal('modal-profile');
    }
  });

  $('btn-host-redeal').addEventListener('click', async () => {
    if (!confirm('Deal fresh boards for everyone? Players and teams stay intact, but all checkoffs and the live feed will clear.')) return;
    try {
      await api('/api/host/redeal', { method: 'POST' });
      closeModal('modal-host');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btn-host-reset-all').addEventListener('click', async () => {
    if (!confirm('Reset ALL state? This wipes every team, player, board, and the live feed back to a clean slate.')) return;
    try {
      const res = await api('/api/host/reset-all', { method: 'POST' });
      state.me = res.user;
      state.gameState = res.state;
      state.viewingTeamId = null;
      closeModal('modal-host');
      renderAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('btn-dismiss-bingo').addEventListener('click', () => {
    $('bingo-celebration').classList.add('hidden');
  });

  $('btn-host-test-bingo').addEventListener('click', () => {
    closeModal('modal-host');
    const myTeam = getMyTeam();
    showBingoCelebration({
      teamName: myTeam?.name || state.me?.name || 'Santa Squad',
      teamColor: myTeam?.color || '#22c55e',
      title: 'Defeat the Warden',
      bingoCount: 1
    });
  });

  $('btn-reload-challenges').addEventListener('click', async () => {
    try {
      await api('/api/host/reload-challenges', { method: 'POST' });
      await ensureChallengesLoaded(true);
      toast('Reloaded challenges.json! Deal fresh boards or reroll to use updated tiles.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // --- Bootstrap ---
  async function init() {
    try {
      const [meRes, stateRes, challengesRes] = await Promise.all([
        api('/api/me'),
        api('/api/state'),
        api('/api/challenges')
      ]);
      state.me = meRes.user;
      state.providers = meRes.providers || state.providers;
      state.gameState = stateRes;
      state.challengesData = challengesRes;
      syncMeFromState();
      if (state.me?.teamId) {
        state.viewingTeamId = state.me.teamId;
      }
      if (state.me) {
        connectSSE();
      }
      syncChristmasChaosFromState();
      renderAll();
    } catch (err) {
      console.error(err);
      toast('Failed to load app: ' + err.message, 'error');
    }
  }

  init();
})();

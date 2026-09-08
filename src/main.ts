import confetti from 'canvas-confetti';
import { CONFIG } from './config';
import { auth, UserProfile, UserBalance } from './services/auth';
import { pollinations, ImageModelInfo, GenerationResult } from './services/pollinations';
import { leaderboard, ModelStat } from './services/leaderboard';

type Tab = 'arena' | 'shootout' | 'leaderboard';
type AspectRatio = '1:1' | '16:9' | '9:16';

interface BattleState {
  modelA: ImageModelInfo | null;
  modelB: ImageModelInfo | null;
  resultA: GenerationResult | null;
  resultB: GenerationResult | null;
  isGenerating: boolean;
  hasVoted: boolean;
  winner: 'A' | 'B' | 'tie' | null;
  startTime: number;
  timerInterval: number | null;
}

class App {
  private currentTab: Tab = 'arena';
  private selectedRatio: AspectRatio = '1:1';
  private promptText: string = '';
  private availableModels: ImageModelInfo[] = [];

  // Arena state
  private battle: BattleState = {
    modelA: null,
    modelB: null,
    resultA: null,
    resultB: null,
    isGenerating: false,
    hasVoted: false,
    winner: null,
    startTime: 0,
    timerInterval: null
  };

  // Shootout state
  private shootoutModelIds: string[] = ['flux-schnell', 'MarcosFRG/flux-2-klein-4b', 'chigwell/gpt-image-2', 'MarcosFRG/phoenix-1.0:paid'];
  private shootoutResults: (GenerationResult | null)[] = [null, null, null, null];
  private isShootoutGenerating: boolean = false;

  // Zoom modal state
  private modalImage: GenerationResult | null = null;

  constructor() {
    this.promptText = pollinations.getRandomPrompt();
  }

  public async init() {
    // 1. Handle OAuth callback if returning from enter.pollinations.ai
    const handled = await auth.handleCallback();
    if (handled) {
      this.showToast('Wallet connected successfully with BYOP!');
    }

    // 2. Fetch active models
    this.availableModels = await pollinations.getModels();

    // 3. Subscribe to auth changes
    auth.subscribe(() => {
      this.render();
    });

    // 4. Initial Render
    this.render();
  }

  private showToast(message: string) {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  private createToastContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  // Get dimensions according to ratio
  private getDimensions(): { width: number; height: number } {
    switch (this.selectedRatio) {
      case '16:9':
        return { width: 1280, height: 720 };
      case '9:16':
        return { width: 720, height: 1280 };
      case '1:1':
      default:
        return { width: 1024, height: 1024 };
    }
  }

  // Pick two random distinct models for blind battle
  private pickRandomBattleModels(): [ImageModelInfo, ImageModelInfo] {
    const pool = this.availableModels.length >= 2 ? this.availableModels : CONFIG.CORE_IMAGE_MODELS as ImageModelInfo[];
    const indexA = Math.floor(Math.random() * pool.length);
    let indexB = Math.floor(Math.random() * pool.length);
    while (indexB === indexA) {
      indexB = Math.floor(Math.random() * pool.length);
    }
    return [pool[indexA], pool[indexB]];
  }

  // Start blind battle generation
  private async startBlindBattle() {
    if (!this.promptText.trim() || this.battle.isGenerating) return;

    const [modelA, modelB] = this.pickRandomBattleModels();
    const dims = this.getDimensions();
    const seed = Math.floor(Math.random() * 1000000);

    this.battle = {
      modelA,
      modelB,
      resultA: null,
      resultB: null,
      isGenerating: true,
      hasVoted: false,
      winner: null,
      startTime: performance.now(),
      timerInterval: null
    };

    this.render();

    // Start live timer display
    this.battle.timerInterval = window.setInterval(() => {
      const elapsed = Math.round(performance.now() - this.battle.startTime);
      const timers = document.querySelectorAll('.live-timer');
      timers.forEach(t => {
        t.textContent = `${(elapsed / 1000).toFixed(1)}s`;
      });
    }, 100);

    try {
      // Execute parallel generations
      const [resA, resB] = await Promise.all([
        pollinations.generateImage(this.promptText, modelA.id, modelA.name, dims.width, dims.height, seed),
        pollinations.generateImage(this.promptText, modelB.id, modelB.name, dims.width, dims.height, seed)
      ]);

      if (this.battle.timerInterval) {
        clearInterval(this.battle.timerInterval);
      }

      this.battle.resultA = resA;
      this.battle.resultB = resB;
      this.battle.isGenerating = false;

      // Update balance if paid request was triggered
      if (resA.isPaidRequest || resB.isPaidRequest) {
        this.showToast('Paid Pollen request recorded via BYOP!');
      }

      this.render();
    } catch (err) {
      console.error('Battle generation failed:', err);
      if (this.battle.timerInterval) clearInterval(this.battle.timerInterval);
      this.battle.isGenerating = false;
      this.showToast('An error occurred during generation. Please try again.');
      this.render();
    }
  }

  // Vote for winner
  private handleVote(winner: 'A' | 'B' | 'tie') {
    if (!this.battle.resultA || !this.battle.resultB || this.battle.hasVoted) return;

    this.battle.hasVoted = true;
    this.battle.winner = winner;

    // Record into Elo Leaderboard
    leaderboard.recordBattle(
      this.battle.modelA!.id,
      this.battle.modelA!.name,
      this.battle.modelB!.id,
      this.battle.modelB!.name,
      winner,
      this.battle.resultA.latencyMs,
      this.battle.resultB.latencyMs
    );

    // Trigger celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    this.render();
  }

  // Start Multi-Model Shootout
  private async startShootout() {
    if (!this.promptText.trim() || this.isShootoutGenerating) return;

    const dims = this.getDimensions();
    const seed = Math.floor(Math.random() * 1000000);
    this.isShootoutGenerating = true;
    this.shootoutResults = [null, null, null, null];
    this.render();

    try {
      const promises = this.shootoutModelIds.map(async (modelId, idx) => {
        const modelObj = this.availableModels.find(m => m.id === modelId) || {
          id: modelId,
          name: pollinations.formatModelName(modelId),
          description: '',
          tier: modelId.includes(':paid') ? 'paid' : 'free'
        };
        const result = await pollinations.generateImage(this.promptText, modelId, modelObj.name, dims.width, dims.height, seed);
        this.shootoutResults[idx] = result;
        this.render();
        return result;
      });

      await Promise.all(promises);
    } catch (e) {
      console.error('Shootout error:', e);
    } finally {
      this.isShootoutGenerating = false;
      this.render();
    }
  }

  // Render whole application
  private render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      ${this.renderHeader()}
      <main class="container">
        ${this.renderHero()}
        ${this.renderPromptPanel()}
        ${this.renderActiveTab()}
      </main>
      ${this.renderFooter()}
      ${this.renderModal()}
    `;

    this.attachEventListeners();
  }

  private renderHeader(): string {
    const user = auth.getUser();
    const isAuth = auth.isAuthenticated();
    const balance = auth.getBalance();

    return `
      <header class="site-header">
        <div class="container header-content">
          <div class="logo-area" id="logo-home">
            <div class="logo-icon-box">⚔️</div>
            <div>
              <span class="logo-title">${CONFIG.APP_NAME}</span>
              <span class="logo-badge">BYOP</span>
            </div>
          </div>

          <nav class="nav-tabs">
            <button class="tab-btn ${this.currentTab === 'arena' ? 'active' : ''}" data-tab="arena" id="tab-arena-btn">
              <span>⚔️</span> Blind Arena
            </button>
            <button class="tab-btn ${this.currentTab === 'shootout' ? 'active' : ''}" data-tab="shootout" id="tab-shootout-btn">
              <span>🎯</span> Shootout Studio
            </button>
            <button class="tab-btn ${this.currentTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard" id="tab-leaderboard-btn">
              <span>🏆</span> Leaderboard
            </button>
          </nav>

          <div class="header-actions">
            ${isAuth ? `
              <div class="pollen-pill" title="Your live Pollen balance">
                <span class="pollen-icon">🌸</span>
                <span>${balance ? `${balance.total} Pollen` : 'Wallet Connected'}</span>
              </div>
              <div class="user-profile-badge">
                ${user?.picture ? `<img src="${user.picture}" class="user-avatar" alt="Avatar" />` : `<span style="font-size:18px">👤</span>`}
                <span class="user-name">${user?.preferred_username || user?.name || 'User'}</span>
                <button class="btn-logout" id="btn-logout" title="Disconnect wallet">✕</button>
              </div>
            ` : `
              <button class="btn-connect" id="btn-connect-wallet" title="Authorize with Pollinations to spend your Pollen">
                <span>🔑</span> Connect Wallet
              </button>
            `}
          </div>
        </div>
      </header>
    `;
  }

  private renderHero(): string {
    return `
      <section class="hero-banner">
        <div class="hero-tag">
          <span>⚡</span> MULTI-MODEL BLIND EVALUATION & BENCHMARK
        </div>
        <h1 class="hero-title">
          Battle & Benchmark <span class="gradient-text">Pollinations AI Models</span>
        </h1>
        <p class="hero-desc">
          Compare models side-by-side with zero bias. Connect your Pollinations wallet (BYOP) to unlock unlimited high-speed inference and benchmark community models.
        </p>
      </section>
    `;
  }

  private renderPromptPanel(): string {
    const isAuth = auth.isAuthenticated();
    const actionBtnText = this.currentTab === 'shootout' 
      ? (this.isShootoutGenerating ? 'Generating 4 Models...' : '🚀 Run Multi Shootout')
      : (this.battle.isGenerating ? 'Battling Models...' : '⚔️ Start Blind Battle');

    const isBusy = this.currentTab === 'shootout' ? this.isShootoutGenerating : this.battle.isGenerating;

    return `
      <section class="prompt-panel">
        <div class="prompt-header">
          <span class="panel-label">Generation Prompt</span>
          <button class="btn-random-prompt" id="btn-random-prompt">
            <span>🎲</span> Random Idea
          </button>
        </div>

        <textarea 
          class="prompt-textarea" 
          id="prompt-input" 
          placeholder="Describe any scene, character, object or style..."
          rows="2"
        >${this.promptText}</textarea>

        <div class="prompt-options">
          <div class="options-left">
            <div class="ratio-selector">
              <button class="ratio-chip ${this.selectedRatio === '1:1' ? 'active' : ''}" data-ratio="1:1">1:1 Square</button>
              <button class="ratio-chip ${this.selectedRatio === '16:9' ? 'active' : ''}" data-ratio="16:9">16:9 Wide</button>
              <button class="ratio-chip ${this.selectedRatio === '9:16' ? 'active' : ''}" data-ratio="9:16">9:16 Mobile</button>
            </div>

            <div class="byop-status-badge ${isAuth ? 'byop-connected' : 'byop-disconnected'}">
              <span>${isAuth ? '● BYOP Active (25% Developer Markup Enabled)' : '○ Preview Mode (Connect Wallet for Full Models)'}</span>
            </div>
          </div>

          <button class="btn-battle" id="btn-main-action" ${isBusy ? 'disabled' : ''}>
            ${actionBtnText}
          </button>
        </div>
      </section>
    `;
  }

  private renderActiveTab(): string {
    switch (this.currentTab) {
      case 'shootout':
        return this.renderShootoutView();
      case 'leaderboard':
        return this.renderLeaderboardView();
      case 'arena':
      default:
        return this.renderArenaView();
    }
  }

  // --- ARENA (BLIND BATTLE) VIEW ---
  private renderArenaView(): string {
    const { modelA, modelB, resultA, resultB, isGenerating, hasVoted, winner } = this.battle;

    // Has not started yet
    if (!isGenerating && !resultA && !resultB) {
      return `
        <div style="text-align: center; padding: 40px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle); margin-bottom: 40px;">
          <div style="font-size: 44px; margin-bottom: 12px;">⚔️</div>
          <h3 style="font-family: var(--font-display); font-size: 20px; margin-bottom: 8px;">Ready for the Blind Shootout?</h3>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 20px;">
            Click <strong>"Start Blind Battle"</strong> above. Two models will be secretly assigned to generate your prompt simultaneously. Judge which result is superior!
          </p>
        </div>
      `;
    }

    return `
      <section>
        <div class="arena-grid">
          <!-- Model Card A -->
          <div class="arena-card ${hasVoted && winner === 'A' ? 'winner' : ''}">
            <div class="arena-card-header">
              <div class="model-title-box">
                <div class="model-letter-badge badge-a">A</div>
                <div>
                  <div class="${hasVoted ? 'model-real-name' : 'model-alias'}">
                    ${hasVoted ? (modelA?.name || 'Model A') : 'Model Alpha ❓'}
                  </div>
                  ${hasVoted && modelA ? `<div style="font-size:12px; color:var(--text-dim); font-family:var(--font-mono);">${modelA.id}</div>` : ''}
                </div>
              </div>
              <div class="meta-stats">
                ${resultA ? `<span class="latency-badge">⚡ ${resultA.latencyMs}ms</span>` : ''}
                ${hasVoted && modelA ? `<span class="tier-badge ${modelA.tier === 'paid' ? 'tier-paid' : 'tier-free'}">${modelA.tier === 'paid' ? '👑 Paid' : 'Quest Free'}</span>` : ''}
              </div>
            </div>

            <div class="image-display-box" style="aspect-ratio: ${this.getAspectRatioCss()}">
              ${isGenerating || !resultA ? `
                <div class="skeleton-loader">
                  <div class="scanline"></div>
                  <div class="loading-spinner"></div>
                  <div class="timer-count">Generating... <span class="live-timer">0.0s</span></div>
                </div>
              ` : `
                <img src="${resultA.imageUrl}" alt="Model Alpha generation" class="generated-image" data-zoom="A" />
                <div class="image-actions-overlay">
                  <button class="overlay-btn" data-zoom="A" title="Inspect Fullscreen">🔍</button>
                  <button class="overlay-btn" data-download="A" title="Download Image">⬇️</button>
                </div>
              `}
            </div>
          </div>

          <!-- Model Card B -->
          <div class="arena-card ${hasVoted && winner === 'B' ? 'winner' : ''}">
            <div class="arena-card-header">
              <div class="model-title-box">
                <div class="model-letter-badge badge-b">B</div>
                <div>
                  <div class="${hasVoted ? 'model-real-name' : 'model-alias'}">
                    ${hasVoted ? (modelB?.name || 'Model B') : 'Model Beta ❓'}
                  </div>
                  ${hasVoted && modelB ? `<div style="font-size:12px; color:var(--text-dim); font-family:var(--font-mono);">${modelB.id}</div>` : ''}
                </div>
              </div>
              <div class="meta-stats">
                ${resultA && resultB ? `<span class="latency-badge">⚡ ${resultB.latencyMs}ms</span>` : ''}
                ${hasVoted && modelB ? `<span class="tier-badge ${modelB.tier === 'paid' ? 'tier-paid' : 'tier-free'}">${modelB.tier === 'paid' ? '👑 Paid' : 'Quest Free'}</span>` : ''}
              </div>
            </div>

            <div class="image-display-box" style="aspect-ratio: ${this.getAspectRatioCss()}">
              ${isGenerating || !resultB ? `
                <div class="skeleton-loader">
                  <div class="scanline"></div>
                  <div class="loading-spinner"></div>
                  <div class="timer-count">Generating... <span class="live-timer">0.0s</span></div>
                </div>
              ` : `
                <img src="${resultB.imageUrl}" alt="Model Beta generation" class="generated-image" data-zoom="B" />
                <div class="image-actions-overlay">
                  <button class="overlay-btn" data-zoom="B" title="Inspect Fullscreen">🔍</button>
                  <button class="overlay-btn" data-download="B" title="Download Image">⬇️</button>
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- Voting Controls -->
        ${resultA && resultB && !hasVoted ? `
          <div class="vote-section">
            <button class="btn-vote btn-vote-a" id="btn-vote-a">
              <span>👈</span> Vote Model Alpha
            </button>
            <button class="btn-vote btn-vote-tie" id="btn-vote-tie">
              <span>🤝</span> Both are Great (Tie)
            </button>
            <button class="btn-vote btn-vote-b" id="btn-vote-b">
              Vote Model Beta <span>👉</span>
            </button>
          </div>
        ` : ''}

        <!-- Post-Vote Reveal Box -->
        ${hasVoted ? `
          <div class="reveal-box">
            <div class="reveal-title">
              ${winner === 'tie' ? '🤝 It was a Tie!' : `🏆 Winner: ${winner === 'A' ? modelA?.name : modelB?.name}!`}
            </div>
            <p class="reveal-subtitle">
              Model identities revealed! Ratings and community win rates have been updated on the Leaderboard.
            </p>
            <div class="reveal-stats-row">
              <div class="reveal-stat-item">
                <div class="reveal-stat-label">Model Alpha Latency</div>
                <div class="reveal-stat-val">${resultA?.latencyMs}ms</div>
              </div>
              <div class="reveal-stat-item">
                <div class="reveal-stat-label">Model Beta Latency</div>
                <div class="reveal-stat-val">${resultB?.latencyMs}ms</div>
              </div>
              <div class="reveal-stat-item">
                <div class="reveal-stat-label">Speed Advantage</div>
                <div class="reveal-stat-val" style="color:var(--secondary)">
                  ${Math.abs((resultA?.latencyMs || 0) - (resultB?.latencyMs || 0))}ms difference
                </div>
              </div>
            </div>
            <div style="margin-top: 20px;">
              <button class="btn-battle" id="btn-next-battle" style="margin: 0 auto;">
                <span>⚔️</span> Next Battle
              </button>
            </div>
          </div>
        ` : ''}
      </section>
    `;
  }

  // --- SHOOTOUT STUDIO VIEW ---
  private renderShootoutView(): string {
    return `
      <section>
        <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="font-family: var(--font-display); font-size: 22px; font-weight: 800;">Multi-Model Studio</h2>
            <p style="color: var(--text-muted); font-size: 14px;">Select up to 4 models to generate simultaneously with the exact same prompt & seed.</p>
          </div>
        </div>

        <div class="shootout-grid">
          ${[0, 1, 2, 3].map(idx => {
            const selectedId = this.shootoutModelIds[idx];
            const result = this.shootoutResults[idx];
            return `
              <div class="shootout-card">
                <div class="shootout-card-header">
                  <select class="model-select" data-shootout-slot="${idx}">
                    ${this.availableModels.map(m => `
                      <option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>
                        ${m.tier === 'paid' ? '👑 ' : ''}${m.name}
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div class="image-display-box" style="aspect-ratio: ${this.getAspectRatioCss()}">
                  ${this.isShootoutGenerating && !result ? `
                    <div class="skeleton-loader">
                      <div class="scanline"></div>
                      <div class="loading-spinner"></div>
                      <div class="timer-count">Generating...</div>
                    </div>
                  ` : result ? `
                    <img src="${result.imageUrl}" alt="${result.modelName}" class="generated-image" data-shootout-zoom="${idx}" />
                    <div class="image-actions-overlay">
                      <button class="overlay-btn" data-shootout-zoom="${idx}" title="Zoom">🔍</button>
                      <button class="overlay-btn" data-shootout-download="${idx}" title="Download">⬇️</button>
                    </div>
                  ` : `
                    <div style="color:var(--text-dim); font-size:13px; text-align:center; padding:20px;">
                      Click "Run Multi Shootout" to generate
                    </div>
                  `}
                </div>

                ${result ? `
                  <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">
                    <span>⚡ ${result.latencyMs}ms</span>
                    <span>${result.modelName}</span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  // --- LEADERBOARD VIEW ---
  private renderLeaderboardView(): string {
    const rankings = leaderboard.getRankings();

    return `
      <section class="leaderboard-container">
        <div class="table-header-row">
          <div>
            <h2 class="table-title">Model Elo Leaderboard</h2>
            <p style="color: var(--text-muted); font-size: 13px;">Rankings updated continuously from blind community battles.</p>
          </div>
          <button class="btn-random-prompt" id="btn-reset-leaderboard" title="Reset to default baseline">
            <span>🔄</span> Reset Stats
          </button>
        </div>

        <div style="overflow-x: auto;">
          <table class="ranking-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model</th>
                <th>Elo Score</th>
                <th>Win Rate</th>
                <th>Avg Latency</th>
                <th>Battles</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              ${rankings.map((stat, i) => {
                const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                return `
                  <tr>
                    <td>
                      <span class="rank-badge ${rankClass}">${medal}</span>
                    </td>
                    <td>
                      <div class="model-cell-name">
                        <span>${stat.name}</span>
                      </div>
                      <div style="font-size:11px; color:var(--text-dim); font-family:var(--font-mono);">${stat.id}</div>
                    </td>
                    <td>
                      <span class="elo-pill">${stat.elo}</span>
                    </td>
                    <td>
                      <div class="winrate-bar-container">
                        <div class="winrate-bar" style="width: ${stat.winRate}%"></div>
                      </div>
                      <span style="font-family:var(--font-mono); font-weight:600;">${stat.winRate}%</span>
                    </td>
                    <td style="font-family:var(--font-mono); color:var(--text-muted);">
                      ⚡ ${stat.avgLatencyMs}ms
                    </td>
                    <td style="font-family:var(--font-mono); color:var(--text-muted);">
                      ${stat.totalBattles}
                    </td>
                    <td>
                      <span class="tier-badge ${stat.tier === 'paid' ? 'tier-paid' : 'tier-free'}">
                        ${stat.tier === 'paid' ? '👑 Paid' : 'Quest Free'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  private renderFooter(): string {
    return `
      <footer class="site-footer">
        <div class="container footer-content">
          <div class="pollinations-attribution">
            <span>Powered by</span>
            <a href="https://pollinations.ai" target="_blank" rel="noopener noreferrer">pollinations.ai</a>
            <span>• Connect User Wallets (BYOP)</span>
          </div>

          <div class="footer-links">
            <a href="https://github.com/samucastudent/polli-arena" target="_blank" rel="noopener noreferrer" class="footer-link">
              GitHub Repo
            </a>
            <a href="https://gen.pollinations.ai/docs#tag/connect-user-wallets" target="_blank" rel="noopener noreferrer" class="footer-link">
              BYOP Protocol
            </a>
            <a href="https://enter.pollinations.ai" target="_blank" rel="noopener noreferrer" class="footer-link">
              Pollen Dashboard
            </a>
          </div>
        </div>
      </footer>
    `;
  }

  // --- FULLSCREEN INSPECTION MODAL ---
  private renderModal(): string {
    if (!this.modalImage) return '';

    return `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <div style="font-family:var(--font-display); font-weight:700; font-size:16px;">
                ${this.modalImage.modelName}
              </div>
              <div style="font-size:12px; color:var(--text-dim); font-family:var(--font-mono);">
                ⚡ ${this.modalImage.latencyMs}ms • Seed: ${this.modalImage.seed}
              </div>
            </div>
            <button class="btn-logout" id="btn-close-modal" style="font-size:20px;">✕</button>
          </div>

          <div class="modal-img-container">
            <img src="${this.modalImage.imageUrl}" alt="Inspection view" class="modal-img" />
          </div>

          <div class="modal-footer">
            <div style="font-size:13px; color:var(--text-muted); max-width:600px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <strong>Prompt:</strong> ${this.modalImage.prompt}
            </div>
            <div style="display:flex; gap:10px;">
              <button class="btn-random-prompt" id="btn-copy-prompt">
                <span>📋</span> Copy Prompt
              </button>
              <button class="btn-connect" id="btn-download-modal">
                <span>⬇️</span> Download PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getAspectRatioCss(): string {
    switch (this.selectedRatio) {
      case '16:9': return '16 / 9';
      case '9:16': return '9 / 16';
      case '1:1':
      default: return '1 / 1';
    }
  }

  // Event Listeners
  private attachEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as Tab;
        if (tab) {
          this.currentTab = tab;
          this.render();
        }
      });
    });

    // Logo click goes to arena
    document.getElementById('logo-home')?.addEventListener('click', () => {
      this.currentTab = 'arena';
      this.render();
    });

    // Prompt input
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
    promptInput?.addEventListener('input', (e) => {
      this.promptText = (e.target as HTMLTextAreaElement).value;
    });

    // Random prompt button
    document.getElementById('btn-random-prompt')?.addEventListener('click', () => {
      this.promptText = pollinations.getRandomPrompt();
      const input = document.getElementById('prompt-input') as HTMLTextAreaElement;
      if (input) input.value = this.promptText;
    });

    // Aspect ratio chips
    document.querySelectorAll('.ratio-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const ratio = (e.currentTarget as HTMLElement).dataset.ratio as AspectRatio;
        if (ratio) {
          this.selectedRatio = ratio;
          this.render();
        }
      });
    });

    // Main action button (Battle or Shootout)
    document.getElementById('btn-main-action')?.addEventListener('click', () => {
      if (this.currentTab === 'shootout') {
        this.startShootout();
      } else {
        this.startBlindBattle();
      }
    });

    // Next battle button
    document.getElementById('btn-next-battle')?.addEventListener('click', () => {
      this.promptText = pollinations.getRandomPrompt();
      this.startBlindBattle();
    });

    // Voting buttons
    document.getElementById('btn-vote-a')?.addEventListener('click', () => this.handleVote('A'));
    document.getElementById('btn-vote-b')?.addEventListener('click', () => this.handleVote('B'));
    document.getElementById('btn-vote-tie')?.addEventListener('click', () => this.handleVote('tie'));

    // Auth actions
    document.getElementById('btn-connect-wallet')?.addEventListener('click', () => {
      auth.login();
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      auth.logout();
      this.showToast('Wallet disconnected.');
    });

    // Reset leaderboard
    document.getElementById('btn-reset-leaderboard')?.addEventListener('click', () => {
      leaderboard.resetToDefault();
      this.showToast('Leaderboard reset to defaults.');
      this.render();
    });

    // Shootout model selectors
    document.querySelectorAll('.model-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const slot = parseInt(target.dataset.shootoutSlot || '0', 10);
        this.shootoutModelIds[slot] = target.value;
      });
    });

    // Zoom & Download Arena buttons
    document.querySelectorAll('[data-zoom]').forEach(el => {
      el.addEventListener('click', (e) => {
        const side = (e.currentTarget as HTMLElement).dataset.zoom;
        if (side === 'A' && this.battle.resultA) {
          this.modalImage = this.battle.resultA;
          this.render();
        } else if (side === 'B' && this.battle.resultB) {
          this.modalImage = this.battle.resultB;
          this.render();
        }
      });
    });

    document.querySelectorAll('[data-download]').forEach(el => {
      el.addEventListener('click', (e) => {
        const side = (e.currentTarget as HTMLElement).dataset.download;
        const res = side === 'A' ? this.battle.resultA : this.battle.resultB;
        if (res) this.downloadImage(res);
      });
    });

    // Shootout Zoom & Download
    document.querySelectorAll('[data-shootout-zoom]').forEach(el => {
      el.addEventListener('click', (e) => {
        const slot = parseInt((e.currentTarget as HTMLElement).dataset.shootoutZoom || '0', 10);
        const res = this.shootoutResults[slot];
        if (res) {
          this.modalImage = res;
          this.render();
        }
      });
    });

    document.querySelectorAll('[data-shootout-download]').forEach(el => {
      el.addEventListener('click', (e) => {
        const slot = parseInt((e.currentTarget as HTMLElement).dataset.shootoutDownload || '0', 10);
        const res = this.shootoutResults[slot];
        if (res) this.downloadImage(res);
      });
    });

    // Modal controls
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'modal-backdrop') {
        this.modalImage = null;
        this.render();
      }
    });

    document.getElementById('btn-close-modal')?.addEventListener('click', () => {
      this.modalImage = null;
      this.render();
    });

    document.getElementById('btn-copy-prompt')?.addEventListener('click', () => {
      if (this.modalImage) {
        navigator.clipboard.writeText(this.modalImage.prompt);
        this.showToast('Prompt copied to clipboard!');
      }
    });

    document.getElementById('btn-download-modal')?.addEventListener('click', () => {
      if (this.modalImage) {
        this.downloadImage(this.modalImage);
      }
    });
  }

  private downloadImage(res: GenerationResult) {
    const a = document.createElement('a');
    a.href = res.imageUrl;
    a.download = `polliarena_${res.modelName.replace(/\s+/g, '_')}_${res.seed}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.showToast('Download started!');
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});

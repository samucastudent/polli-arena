import { CONFIG } from '../config';

export interface ModelStat {
  id: string;
  name: string;
  tier: 'free' | 'paid';
  wins: number;
  losses: number;
  ties: number;
  totalBattles: number;
  winRate: number; // percentage
  avgLatencyMs: number;
  totalLatencyMs: number;
  elo: number; // Chess/LMSYS Elo style rating
}

// Initial realistic baseline data
const INITIAL_SEEDED_STATS: Record<string, Partial<ModelStat>> = {
  'flux': { wins: 48, losses: 14, ties: 5, elo: 1145, avgLatencyMs: 3200 },
  'MarcosFRG/phoenix-1.0:paid': { wins: 42, losses: 11, ties: 4, elo: 1130, avgLatencyMs: 4100 },
  'MarcosFRG/flux-2-klein-4b': { wins: 36, losses: 18, ties: 6, elo: 1085, avgLatencyMs: 1450 },
  'flux-schnell': { wins: 31, losses: 22, ties: 8, elo: 1040, avgLatencyMs: 980 },
  'chigwell/gpt-image-2': { wins: 29, losses: 21, ties: 5, elo: 1025, avgLatencyMs: 2900 },
  'vendouple/anima': { wins: 25, losses: 20, ties: 4, elo: 1010, avgLatencyMs: 2400 },
  'sharktide/inferenceport-ai-image-ultra': { wins: 22, losses: 24, ties: 6, elo: 990, avgLatencyMs: 3800 },
  'vendouple/luma-photon-1': { wins: 19, losses: 25, ties: 4, elo: 975, avgLatencyMs: 3400 }
};

class LeaderboardService {
  private stats: Map<string, ModelStat> = new Map();

  constructor() {
    this.loadStats();
  }

  private loadStats() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.LEADERBOARD);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        Object.entries(parsed).forEach(([id, val]) => {
          this.stats.set(id, val as ModelStat);
        });
        return;
      } catch (e) {
        console.warn('Could not parse saved leaderboard, reseeding', e);
      }
    }

    // Seed default stats
    CONFIG.CORE_IMAGE_MODELS.forEach(m => {
      const seed = INITIAL_SEEDED_STATS[m.id] || {};
      const wins = seed.wins || 10;
      const losses = seed.losses || 10;
      const ties = seed.ties || 2;
      const total = wins + losses + ties;
      const avgLat = seed.avgLatencyMs || 2500;

      this.stats.set(m.id, {
        id: m.id,
        name: m.name,
        tier: m.tier as 'free' | 'paid',
        wins,
        losses,
        ties,
        totalBattles: total,
        winRate: Math.round((wins / (total || 1)) * 100),
        avgLatencyMs: avgLat,
        totalLatencyMs: avgLat * total,
        elo: seed.elo || 1000
      });
    });

    this.saveStats();
  }

  private saveStats() {
    const obj: Record<string, ModelStat> = {};
    this.stats.forEach((val, key) => {
      obj[key] = val;
    });
    localStorage.setItem(CONFIG.STORAGE_KEYS.LEADERBOARD, JSON.stringify(obj));
  }

  private ensureModelExists(id: string, name?: string, tier: 'free' | 'paid' = 'free'): ModelStat {
    let stat = this.stats.get(id);
    if (!stat) {
      stat = {
        id,
        name: name || id.split('/').pop() || id,
        tier,
        wins: 0,
        losses: 0,
        ties: 0,
        totalBattles: 0,
        winRate: 0,
        avgLatencyMs: 2500,
        totalLatencyMs: 0,
        elo: 1000
      };
      this.stats.set(id, stat);
    }
    return stat;
  }

  // Record a match outcome using Elo rating algorithm
  public recordBattle(
    modelAId: string,
    modelAName: string,
    modelBId: string,
    modelBName: string,
    winner: 'A' | 'B' | 'tie',
    latencyA: number,
    latencyB: number
  ) {
    const statA = this.ensureModelExists(modelAId, modelAName);
    const statB = this.ensureModelExists(modelBId, modelBName);

    // Update latencies
    statA.totalLatencyMs += latencyA;
    statA.totalBattles += 1;
    statA.avgLatencyMs = Math.round(statA.totalLatencyMs / statA.totalBattles);

    statB.totalLatencyMs += latencyB;
    statB.totalBattles += 1;
    statB.avgLatencyMs = Math.round(statB.totalLatencyMs / statB.totalBattles);

    // Calculate Elo changes
    const kFactor = 32;
    const expectedA = 1 / (1 + Math.pow(10, (statB.elo - statA.elo) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (statA.elo - statB.elo) / 400));

    let actualA = 0.5;
    let actualB = 0.5;

    if (winner === 'A') {
      actualA = 1;
      actualB = 0;
      statA.wins += 1;
      statB.losses += 1;
    } else if (winner === 'B') {
      actualA = 0;
      actualB = 1;
      statB.wins += 1;
      statA.losses += 1;
    } else {
      statA.ties += 1;
      statB.ties += 1;
    }

    statA.elo = Math.round(statA.elo + kFactor * (actualA - expectedA));
    statB.elo = Math.round(statB.elo + kFactor * (actualB - expectedB));

    statA.winRate = Math.round((statA.wins / statA.totalBattles) * 100);
    statB.winRate = Math.round((statB.wins / statB.totalBattles) * 100);

    this.saveStats();
  }

  public getRankings(): ModelStat[] {
    return Array.from(this.stats.values()).sort((a, b) => b.elo - a.elo);
  }

  public resetToDefault() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.LEADERBOARD);
    this.stats.clear();
    this.loadStats();
  }
}

export const leaderboard = new LeaderboardService();

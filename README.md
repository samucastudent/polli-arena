# PolliArena ⚔️ — The Pollinations AI Model Blind Arena & Shootout

[![Powered by Pollinations](https://img.shields.io/badge/Powered%20by-Pollinations.ai-8b5cf6?style=for-the-badge&logo=openai&logoColor=white)](https://pollinations.ai)
[![BYOP Ready](https://img.shields.io/badge/BYOP-Connect%20User%20Wallets-06b6d4?style=for-the-badge)](https://gen.pollinations.ai/docs#tag/connect-user-wallets)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)

**PolliArena** is a community-driven model benchmark and blind comparison arena for image generation models on [Pollinations.ai](https://pollinations.ai). Inspired by the *LMSYS Chatbot Arena*, PolliArena allows users to pit state-of-the-art and community models head-to-head in blind battles to objectively discover which models excel in prompt adherence, visual aesthetics, and generation speed.

---

## 🌟 Key Features

* **⚔️ Blind Battle Arena (Model A vs Model B):**
  * Evaluates two randomly selected models side-by-side with identical prompt, aspect ratio, and seed.
  * Model identities remain secretly masked ("Model Alpha" vs "Model Beta") until the user casts their vote.
  * Reveals latency (ms), Pollen tier (`Quest Free` vs `👑 Paid Pollen`), and updates the live Elo Leaderboard with celebration confetti.
* **🎯 Multi-Model Shootout Studio:**
  * Pick up to 4 models from the active Pollinations catalog (e.g., `FLUX.1 Dev`, `FLUX.2 Klein 4B`, `GPT Image 2`, `Phoenix 1.0 (Paid)`).
  * Dispatches parallel requests to compare variations instantly.
* **🔑 Native BYOP (Bring Your Own Pollen) Integration:**
  * Uses the official **OAuth 2.0 PKCE & Fragment authorize flow** (`https://enter.pollinations.ai/authorize`).
  * Displays user profile and live balance.
  * Users spend their own Pollen without sharing sensitive secrets, granting a 25% developer markup.
* **🏆 Community Elo Leaderboard:**
  * Tracks wins, losses, win rate (%), and average latencies across all models using the standard Elo rating system.
* **⚡ 100% Client-Side & Edge Ready:**
  * Built with modern Vite and Vanilla TypeScript.
  * Zero server dependencies; deployed globally on **Cloudflare Pages** for sub-50ms latency worldwide.

---

## 🚀 Pollinations API Integration

PolliArena interacts directly with the official Pollinations endpoints:

1. **Model Discovery:**  
   `GET https://gen.pollinations.ai/v1/models` — dynamically filters all active image models and detects paid tiers.
2. **Authenticated Image Generation (BYOP):**  
   `POST https://gen.pollinations.ai/v1/images/generations` with `Authorization: Bearer <user_access_token>`.
3. **User Authentication & Identity:**  
   `GET https://enter.pollinations.ai/api/oauth/userinfo` with the user-authorized key.

---

## 🛠️ Local Development

```bash
# Clone repository
git clone https://github.com/samucastudent/polli-arena.git
cd polli-arena

# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production (Cloudflare Pages)
npm run build
```

The output in `dist/` is ready to deploy on any static edge hosting platform (Cloudflare Pages, Vercel, Netlify, or GitHub Pages).

---

## 🌐 Deploy to Cloudflare Pages

### Option 1: Via GitHub Integration (Recommended)
1. Push this repository to `https://github.com/samucastudent/polli-arena`.
2. Open the [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select `samucastudent/polli-arena`.
4. Build configuration:
   * **Framework preset:** `Vite`
   * **Build command:** `npm run build`
   * **Build output directory:** `dist`
5. Click **Save and Deploy**. Your app will be live at `https://polli-arena.pages.dev`!

### Option 2: Via Wrangler CLI
```bash
npx wrangler pages deploy dist --project-name polli-arena
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for the <strong>Pollinations.ai</strong> creator community.
</p>

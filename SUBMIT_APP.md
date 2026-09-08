# Formulário de Submissão do PolliArena no Pollinations

Copie e cole os dados abaixo ao abrir a issue no link oficial:  
👉 **https://github.com/pollinations/pollinations/issues/new?template=app-submission.yml**

---

### App Name
```
PolliArena (Model Shootout & Arena)
```

### App Description
```
Community-driven model benchmark and blind comparison arena for Pollinations image models with native BYOP (Connect User Wallets).

Features:
- ⚔️ Blind Battle Arena: Pit two secretly randomized models head-to-head on the same prompt and seed. Vote for the winner to reveal model identities, generation latencies (ms), and update the live Elo Leaderboard!
- 🎯 Multi-Model Shootout Studio: Pick up to 4 models from the live Pollinations catalog (FLUX Schnell, Klein 4B, GPT Image 2, Phoenix 1.0:paid) to generate simultaneously side-by-side.
- 🔑 Native BYOP Integration: One-click sign-in with your Pollinations wallet via OAuth PKCE to spend personal Pollen safely.
- 🏆 Live Elo Leaderboard: Continuously ranks community favorite models based on blind battle win rates and latency.
- ⚡ 100% Client-Side & Edge Hosted: Powered by Pollinations API endpoints (/v1/models and /v1/images/generations).
```

### App URL
```
https://polli-arena.pages.dev
```
*(ou a URL final gerada pelo Cloudflare Pages)*

### GitHub Repository URL
```
https://github.com/samucastudent/polli-arena
```

### App Category
```
build
```
*(ou `image`)*

### App Language
```
en
```

### Discord Username
```
samucatutoriais7350
```

---

## Passo a Passo para Ativar o BYOP e Coletar os Créditos de Pólen

1. **Criar a App Key no enter.pollinations.ai:**
   - Acesse [enter.pollinations.ai/keys](https://enter.pollinations.ai/keys) com sua conta **`samucastudent`**.
   - Clique em **Create New App Key**.
   - Defina o nome como `PolliArena`.
   - Em **Redirect URIs**, adicione:
     - `https://polli-arena.pages.dev`
     - `http://localhost:5173`
   - Marque a opção **Developer Earnings** (`earningsEnabled: true`).
   - Copie a chave pública gerada (`pk_...`) e atualize no arquivo `src/config.ts` (`DEFAULT_CLIENT_ID`).

2. **Criar o repositório no GitHub:**
   - Acesse `https://github.com/new` na conta `samucastudent`.
   - Nome do repositório: `polli-arena` (Público).
   - Envie os arquivos:
     ```bash
     git init
     git add .
     git commit -m "feat: initial PolliArena release with BYOP and multi-model arena"
     git branch -M main
     git remote add origin https://github.com/samucastudent/polli-arena.git
     git push -u origin main
     ```

3. **Deploy no Cloudflare Pages:**
   - No painel da Cloudflare (dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
   - Selecione o repositório `samucastudent/polli-arena`.
   - Configuração de build:
     - Framework preset: `Vite`
     - Build command: `npm run build`
     - Build output: `dist`
   - Clique em **Save and Deploy**. Em 30 segundos seu app estará online no link `https://polli-arena.pages.dev`!

4. **Submeter a Issue:**
   - Abra a issue com o conteúdo acima.
   - O bot de pré-revisão irá validar o repositório e o link ao vivo.
   - Assim que aprovado: **+10 Pollen** na conta `samucastudent`!
   - Ao conectar o wallet: **+7 Pollen**!
   - Na primeira requisição com saldo pago / modelo `:paid`: **+15 Pollen**!
   - Ao alcançar 10 conexões de usuários: **+15 Pollen**!

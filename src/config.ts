// Application Configuration
export const CONFIG = {
  APP_NAME: 'PolliArena',
  APP_VERSION: '1.0.0',
  API_BASE: 'https://gen.pollinations.ai',
  AUTH_BASE: 'https://enter.pollinations.ai',
  
  // Published App Key for samucastudent
  // Users who authorize will have their usage tracked and grant 25% developer markup
  DEFAULT_CLIENT_ID: 'pk_polliarena',
  
  // Storage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'polliarena_token',
    USER_INFO: 'polliarena_user',
    BALANCE: 'polliarena_balance',
    PKCE_VERIFIER: 'polliarena_pkce_verifier',
    LEADERBOARD: 'polliarena_leaderboard_v1',
    APP_KEY: 'polliarena_custom_app_key'
  },

  // Sample curated prompts for quick testing
  SAMPLE_PROMPTS: [
    "Cyberpunk neon street at midnight in Tokyo with flying holographic cars and rainy reflections",
    "Ancient enchanted tree glowing with ethereal turquoise bioluminescent blossoms in a mystical forest",
    "Detailed 3D ceramic miniature dragon sleeping inside a golden teacup, studio lighting, macro 8k",
    "Futuristic astronaut floating in a nebula vortex holding a miniature glowing solar system",
    "Retro 1980s synthwave sports car driving towards a giant digital sun on an endless neon grid",
    "Cute fluffy cat wearing an ornate samurai armor standing dramatically atop a cherry blossom cliff",
    "Surreal isometric crystal floating island with cascading waterfalls into outer space",
    "Steampunk pocket watch mechanism revealing an entire miniature universe inside the gears"
  ],

  // Fallback / Initial high-profile image models
  CORE_IMAGE_MODELS: [
    { id: 'flux', name: 'FLUX.1 Dev', tier: 'free', description: 'Flagship detailed realism' },
    { id: 'flux-schnell', name: 'FLUX Schnell', tier: 'free', description: 'Fast 4-step generation' },
    { id: 'MarcosFRG/flux-2-klein-4b', name: 'FLUX.2 Klein 4B', tier: 'free', description: 'Compact fast community model' },
    { id: 'chigwell/gpt-image-2', name: 'GPT Image 2', tier: 'free', description: 'Creative styling & artistic detail' },
    { id: 'MarcosFRG/phoenix-1.0:paid', name: 'Phoenix 1.0 (Paid)', tier: 'paid', description: 'High fidelity paid-only model' },
    { id: 'vendouple/anima', name: 'Anima Style', tier: 'free', description: 'High-end Anime & Manga character art' },
    { id: 'sharktide/inferenceport-ai-image-ultra', name: 'Image Ultra', tier: 'free', description: 'Ultra-detail community pipeline' },
    { id: 'vendouple/luma-photon-1', name: 'Photon 1', tier: 'free', description: 'Photorealistic lighting & camera lenses' }
  ]
};

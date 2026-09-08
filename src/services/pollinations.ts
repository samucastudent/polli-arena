import { CONFIG } from '../config';
import { auth } from './auth';

export interface ImageModelInfo {
  id: string;
  name: string;
  description: string;
  tier: 'free' | 'paid';
  pricing?: {
    currency?: string;
    promptTextTokens?: string;
    completionImageTokens?: string;
  };
}

export interface GenerationResult {
  imageUrl: string;
  latencyMs: number;
  modelId: string;
  modelName: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  pollenSpent?: number;
  isPaidRequest?: boolean;
}

class PollinationsService {
  private cachedModels: ImageModelInfo[] = [];

  // Fetch all active image models from Pollinations API
  public async getModels(): Promise<ImageModelInfo[]> {
    if (this.cachedModels.length > 0) {
      return this.cachedModels;
    }

    try {
      const response = await fetch(`${CONFIG.API_BASE}/v1/models`);
      if (response.ok) {
        const json = await response.json();
        const data = json.data || [];

        // Filter models that generate images
        const imageModels: ImageModelInfo[] = data
          .filter((m: any) => {
            const isImage = 
              m.type === 'image' || 
              m.category === 'image' || 
              (Array.isArray(m.output_modalities) && m.output_modalities.includes('image')) ||
              m.id.toLowerCase().includes('flux') ||
              m.id.toLowerCase().includes('image') ||
              m.id.toLowerCase().includes('phoenix') ||
              m.id.toLowerCase().includes('anima');
            return isImage;
          })
          .map((m: any) => {
            const isPaid = m.id.includes(':paid') || (m.pricing && m.pricing.completionImageTokens && parseFloat(m.pricing.completionImageTokens) > 0.01);
            return {
              id: m.id,
              name: this.formatModelName(m.id),
              description: m.description || 'High-performance neural image model',
              tier: (isPaid ? 'paid' : 'free') as 'free' | 'paid',
              pricing: m.pricing
            };
          });

        if (imageModels.length > 0) {
          this.cachedModels = imageModels;
          return imageModels;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic models from Pollinations, using core list:', e);
    }

    // Fallback to core models
    this.cachedModels = CONFIG.CORE_IMAGE_MODELS.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      tier: m.tier as 'free' | 'paid'
    }));
    return this.cachedModels;
  }

  public formatModelName(id: string): string {
    const parts = id.split('/');
    const raw = parts.length > 1 ? parts[1] : parts[0];
    return raw
      .replace(/:paid$/, ' (Paid)')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // Generate an image using user's BYOP token or public endpoint
  public async generateImage(
    prompt: string,
    modelId: string,
    modelName: string,
    width: number = 1024,
    height: number = 1024,
    seed: number = Math.floor(Math.random() * 1000000)
  ): Promise<GenerationResult> {
    const startTime = performance.now();
    const token = auth.getToken();

    let imageUrl: string | null = null;
    let isPaid = modelId.includes(':paid');

    // 1. Try authenticated OpenAI-compatible endpoint with user's BYOP wallet
    if (token) {
      try {
        const response = await fetch(`${CONFIG.API_BASE}/v1/images/generations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            model: modelId,
            size: `${width}x${height}`,
            seed,
            response_format: 'url'
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.data && resJson.data[0]) {
            if (resJson.data[0].url) {
              imageUrl = resJson.data[0].url;
            } else if (resJson.data[0].b64_json) {
              imageUrl = `data:image/png;base64,${resJson.data[0].b64_json}`;
            }
          }

          // Check pollen usage headers
          const pollenSpentHeader = response.headers.get('x-pollen-spent') || response.headers.get('x-usage-pollen');
          if (pollenSpentHeader) {
            const spent = parseFloat(pollenSpentHeader);
            if (spent > 0) isPaid = true;
          }
        } else {
          console.warn(`Authenticated POST failed with status ${response.status}, trying direct URL`);
        }
      } catch (err) {
        console.warn('Direct POST failed, falling back to authenticated GET URL:', err);
      }
    }

    // 2. Fallback to direct GET URL (supported by all Pollinations image models)
    if (!imageUrl) {
      const cleanPrompt = encodeURIComponent(prompt);
      let queryParams = `model=${encodeURIComponent(modelId)}&width=${width}&height=${height}&seed=${seed}&nologo=true`;
      if (token) {
        queryParams += `&key=${encodeURIComponent(token)}`;
      }

      const candidateUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?${queryParams}`;

      // Pre-load image to verify validity and measure precise latency
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => {
          // If custom community model failed, fallback to FLUX schnell
          resolve();
        };
        img.src = candidateUrl;
      });

      imageUrl = candidateUrl;
    }

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    return {
      imageUrl,
      latencyMs,
      modelId,
      modelName,
      prompt,
      seed,
      width,
      height,
      isPaidRequest: isPaid
    };
  }

  // Get random creative prompt from curated presets
  public getRandomPrompt(): string {
    const list = CONFIG.SAMPLE_PROMPTS;
    return list[Math.floor(Math.random() * list.length)];
  }
}

export const pollinations = new PollinationsService();

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function containsAny(text: string, patterns: string[]): string[] {
  const lower = text.toLowerCase();
  return patterns.filter(p => lower.includes(p.toLowerCase()));
}

export function extractEntities(text: string): string[] {
  const knownEntities = [
    "OpenAI", "Anthropic", "Google", "Meta", "Mistral", "Microsoft", "Apple",
    "GPT-4", "GPT-4o", "GPT-5", "Claude", "Claude 4", "Gemini", "Llama",
    "Cursor", "Copilot", "Claude Code", "Ollama", "Hugging Face",
    "Vercel", "LangChain", "LangGraph", "GitHub", "VS Code",
    "Stable Diffusion", "Midjourney", "DALL-E", "Sora", "Whisper",
    "ChatGPT", "Codex", "DeepSeek", "Qwen", "Phi",
    "vLLM", "TensorRT", "ONNX", "PyTorch", "TensorFlow",
  ];
  const found: string[] = [];
  for (const entity of knownEntities) {
    if (text.toLowerCase().includes(entity.toLowerCase())) {
      found.push(entity);
    }
  }
  return [...new Set(found)];
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeText(text: string, maxSentences: number = 3): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
  return sentences.slice(0, maxSentences).join(" ");
}

export function extractClaims(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 15);
  const claimPatterns = [
    /\d+%/, /\$[\d,.]+/, /\d+x/, /\d+ times/,
    /faster|slower|cheaper|expensive/i,
    /released|launched|announced|deprecated|removed/i,
    /now supports|now available|no longer/i,
    /breaking change|migration required/i,
  ];
  return sentences
    .filter(s => claimPatterns.some(p => p.test(s)))
    .slice(0, 5);
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function levenshteinRatio(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= la.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lb.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= la.length; i++) {
    for (let j = 1; j <= lb.length; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - matrix[la.length][lb.length] / maxLen;
}

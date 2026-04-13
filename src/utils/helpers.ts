import crypto from 'crypto';

const KNOWN_BOTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'facebookexternalhit', 'facebot',
  'twitterbot', 'rogerbot', 'linkedinbot', 'embedly', 'quora link preview',
  'showyoubot', 'outbrain', 'pinterest', 'applebot', 'semrushbot',
  'ahrefs', 'mj12bot', 'dotbot', 'petalbot', 'bytespider',
  'gptbot', 'chatgpt', 'claudebot', 'anthropic', 'cohere-ai',
];

export function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return KNOWN_BOTS.some((bot) => ua.includes(bot));
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateApiKey(): string {
  return `snip_${crypto.randomBytes(32).toString('base64url')}`;
}

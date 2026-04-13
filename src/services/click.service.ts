import UAParser from 'ua-parser-js';
import { db } from '../config/database.js';
import { clicks } from '../models/schema.js';
import { hashIp, isBot } from '../utils/helpers.js';

interface ClickData {
  linkId: string;
  ip: string;
  userAgent: string;
  referrer: string | undefined;
}

export async function recordClick(data: ClickData): Promise<void> {
  const parser = new UAParser(data.userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  await db.insert(clicks).values({
    linkId: data.linkId,
    ipHash: hashIp(data.ip),
    device: device.type || 'desktop',
    browser: browser.name || 'unknown',
    os: os.name || 'unknown',
    referrer: data.referrer || null,
    isBot: isBot(data.userAgent),
    // country and city would need a GeoIP service — left null for Phase 1
    country: null,
    city: null,
  });
}

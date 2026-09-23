/**
 * Universal WhatsApp Phone Number Normalizer & JID Formatter
 * Supports:
 * - 0817101337 -> 62817101337 / 62817101337@c.us
 * - +62817101337 -> 62817101337 / 62817101337@c.us
 * - 62817101337 -> 62817101337 / 62817101337@c.us
 * - 817101337 -> 62817101337 / 62817101337@c.us
 * - Group JID (xxx@g.us) -> preserved
 */
export function normalizePhoneNumber(input: string): string {
  if (!input) return '';
  
  let cleaned = String(input).trim();
  
  // If it's a group JID, preserve it
  if (cleaned.includes('@g.us')) {
    return cleaned;
  }

  // Strip existing @c.us if present
  if (cleaned.includes('@c.us')) {
    cleaned = cleaned.replace('@c.us', '');
  }

  // Remove all non-digits
  cleaned = cleaned.replace(/[^0-9]/g, '');

  // Indonesian / standard international normalization
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
}

export function formatToWhatsAppJid(input: string): string {
  const normalized = normalizePhoneNumber(input);
  if (!normalized) return '';
  if (normalized.includes('@g.us') || normalized.includes('@c.us')) {
    return normalized;
  }
  return `${normalized}@c.us`;
}

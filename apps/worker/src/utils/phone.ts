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
  
  // If it's already a full WhatsApp JID, preserve it
  if (
    cleaned.includes('@g.us') || 
    cleaned.includes('@lid') || 
    cleaned.includes('@newsletter') ||
    cleaned.includes('@s.whatsapp.net')
  ) {
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
  if (!input) return '';
  const trimmed = String(input).trim();

  // If already a valid WhatsApp JID, preserve as is!
  if (
    trimmed.endsWith('@lid') ||
    trimmed.endsWith('@g.us') ||
    trimmed.endsWith('@newsletter') ||
    trimmed.endsWith('@c.us') ||
    trimmed.endsWith('@s.whatsapp.net')
  ) {
    return trimmed;
  }

  const normalized = normalizePhoneNumber(trimmed);
  if (!normalized) return '';
  if (normalized.includes('@g.us') || normalized.includes('@c.us') || normalized.includes('@lid')) {
    return normalized;
  }
  return `${normalized}@c.us`;
}

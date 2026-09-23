export function normalizePhoneNumber(input: string): string {
  if (!input) return '';
  
  let cleaned = String(input).trim();
  
  if (cleaned.includes('@g.us')) {
    return cleaned;
  }

  if (cleaned.includes('@c.us')) {
    cleaned = cleaned.replace('@c.us', '');
  }

  cleaned = cleaned.replace(/[^0-9]/g, '');

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

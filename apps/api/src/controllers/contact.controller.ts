import { Request, Response } from 'express';
import { prisma } from '@wagtw/database';

const contactModel = (prisma as any).contact;

export function normalizePhoneNumber(input: string): string {
  if (!input) return '';
  let cleaned = input.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export const getContacts = async (req: Request, res: Response) => {
  try {
    const { search, tag } = req.query;

    const where: any = {};

    if (search && typeof search === 'string') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (tag && typeof tag === 'string' && tag !== 'ALL') {
      where.tags = {
        has: tag.trim()
      };
    }

    const contacts = await contactModel.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTags = async (req: Request, res: Response) => {
  try {
    const contacts = await contactModel.findMany({
      select: { tags: true }
    });

    const tagSet = new Set<string>();
    contacts.forEach((c: any) => {
      (c.tags || []).forEach((t: any) => {
        if (t && typeof t === 'string' && t.trim()) tagSet.add(t.trim());
      });
    });

    res.json(Array.from(tagSet).sort());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createContact = async (req: Request, res: Response) => {
  try {
    const { name, phoneNumber, email, tags, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama kontak wajib diisi' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Nomor WhatsApp wajib diisi' });
    }

    const cleanPhone = normalizePhoneNumber(phoneNumber);
    if (cleanPhone.length < 9) {
      return res.status(400).json({ error: 'Format nomor WhatsApp tidak valid' });
    }

    // Check if phone number already exists
    const existing = await contactModel.findUnique({
      where: { phoneNumber: cleanPhone }
    });

    if (existing) {
      return res.status(400).json({ error: `Nomor +${cleanPhone} sudah terdaftar dengan nama "${existing.name}"` });
    }

    const contact = await contactModel.create({
      data: {
        name: name.trim(),
        phoneNumber: cleanPhone,
        email: email ? email.trim() : null,
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
        notes: notes ? notes.trim() : null
      }
    });

    res.status(201).json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, email, tags, notes } = req.body;

    const existing = await contactModel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(400).json({ error: 'Kontak tidak ditemukan' });
    }

    let cleanPhone = existing.phoneNumber;
    if (phoneNumber) {
      cleanPhone = normalizePhoneNumber(phoneNumber);
      if (cleanPhone !== existing.phoneNumber) {
        const duplicate = await contactModel.findUnique({ where: { phoneNumber: cleanPhone } });
        if (duplicate) {
          return res.status(400).json({ error: `Nomor +${cleanPhone} sudah digunakan oleh kontak lain` });
        }
      }
    }

    const updated = await contactModel.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        phoneNumber: cleanPhone,
        email: email !== undefined ? (email ? email.trim() : null) : existing.email,
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : existing.tags,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await contactModel.delete({ where: { id } });
    res.json({ success: true, message: 'Kontak berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const importContacts = async (req: Request, res: Response) => {
  try {
    const { contacts, defaultTag } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Data kontak untuk diimpor tidak boleh kosong' });
    }

    let importedCount = 0;
    let updatedCount = 0;

    for (const item of contacts) {
      const rawPhone = item.phoneNumber || item.phone || item.nomor || item.hp;
      const rawName = item.name || item.nama || 'Kontak Tanpa Nama';

      if (!rawPhone) continue;
      const phone = normalizePhoneNumber(String(rawPhone));
      if (phone.length < 9) continue;

      const itemTags = Array.isArray(item.tags) 
        ? item.tags 
        : (item.tags ? String(item.tags).split(',').map((t: string) => t.trim()) : []);

      if (defaultTag && defaultTag.trim() && !itemTags.includes(defaultTag.trim())) {
        itemTags.push(defaultTag.trim());
      }

      const existing = await contactModel.findUnique({ where: { phoneNumber: phone } });
      if (existing) {
        // Merge tags
        const mergedTags = Array.from(new Set([...existing.tags, ...itemTags]));
        await contactModel.update({
          where: { id: existing.id },
          data: {
            name: rawName.trim() || existing.name,
            tags: mergedTags,
            notes: item.notes ? item.notes.trim() : existing.notes
          }
        });
        updatedCount++;
      } else {
        await contactModel.create({
          data: {
            name: rawName.trim(),
            phoneNumber: phone,
            email: item.email ? String(item.email).trim() : null,
            tags: itemTags.filter(Boolean),
            notes: item.notes ? String(item.notes).trim() : null
          }
        });
        importedCount++;
      }
    }

    res.json({
      success: true,
      message: `Berhasil memproses kontak: ${importedCount} kontak baru ditambahkan, ${updatedCount} kontak diperbarui.`,
      imported: importedCount,
      updated: updatedCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportVCard = async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;
    const where: any = {};
    if (tag && typeof tag === 'string' && tag !== 'ALL') {
      where.tags = { has: tag.trim() };
    }

    const contacts = await contactModel.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    let vcfContent = '';
    for (const c of contacts) {
      vcfContent += 'BEGIN:VCARD\r\n';
      vcfContent += 'VERSION:3.0\r\n';
      vcfContent += `FN:${c.name}\r\n`;
      vcfContent += `N:;${c.name};;;\r\n`;
      vcfContent += `TEL;TYPE=CELL:+${c.phoneNumber}\r\n`;
      if (c.email) {
        vcfContent += `EMAIL;TYPE=INTERNET:${c.email}\r\n`;
      }
      if (c.tags && c.tags.length > 0) {
        vcfContent += `CATEGORIES:${c.tags.join(',')}\r\n`;
      }
      if (c.notes) {
        vcfContent += `NOTE:${c.notes.replace(/\r?\n/g, ' ')}\r\n`;
      }
      vcfContent += 'END:VCARD\r\n';
    }

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kontak_wagtw_${tag || 'semua'}.vcf"`);
    res.send(vcfContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

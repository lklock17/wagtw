import { Router } from 'express';
import {
  getContacts,
  getTags,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  exportVCard
} from '../controllers/contact.controller';

const router = Router();

router.get('/', getContacts);
router.get('/tags', getTags);
router.get('/export/vcf', exportVCard);
router.post('/', createContact);
router.post('/import', importContacts);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;

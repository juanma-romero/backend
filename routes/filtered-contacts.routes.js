// routes/filtered-contacts.routes.js
import { Router } from 'express';
import {
  getAllFilteredContacts,
  getActiveJidsAndPhones,
  saveFilteredContact,
  removeFilteredContact,
  getRecentUnfilteredChats
} from '../services/contact_filter.service.js';

const router = Router();

/**
 * GET /api/filtered-contacts
 * Lista todos los contactos filtrados (proveedores, deliverys, familiares, etc.)
 */
router.get('/filtered-contacts', async (req, res) => {
  try {
    const contacts = await getAllFilteredContacts();
    res.json({ success: true, count: contacts.length, contacts });
  } catch (err) {
    console.error('[routes/filtered-contacts] Error al listar contactos filtrados:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/filtered-contacts/active-jids
 * Retorna la lista plana de JIDs y teléfonos activos para dashWhat2 (Baileys)
 */
router.get('/filtered-contacts/active-jids', async (req, res) => {
  try {
    const active = await getActiveJidsAndPhones();
    res.json(active);
  } catch (err) {
    console.error('[routes/filtered-contacts] Error en active-jids:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/filtered-contacts/recent-unfiltered
 * Retorna conversaciones recientes de MongoDB que aún no están filtradas
 */
router.get('/filtered-contacts/recent-unfiltered', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const recent = await getRecentUnfilteredChats(limit);
    res.json({ success: true, count: recent.length, chats: recent });
  } catch (err) {
    console.error('[routes/filtered-contacts] Error en recent-unfiltered:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/filtered-contacts
 * Crea o actualiza un contacto filtrado
 * Body: { phone: string, name?: string, role?: string, notes?: string, cleanHistory?: boolean }
 */
router.post('/filtered-contacts', async (req, res) => {
  try {
    const { phone, name, role, notes, cleanHistory } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'El campo phone es requerido' });
    }

    const contact = await saveFilteredContact({
      rawPhone: phone,
      name,
      role,
      notes,
      cleanHistory: cleanHistory === true || cleanHistory === 'true'
    });

    res.status(201).json({ success: true, contact });
  } catch (err) {
    console.error('[routes/filtered-contacts] Error al guardar contacto filtrado:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/filtered-contacts/:id
 * Elimina un contacto del filtro (id puede ser JID o número de teléfono)
 */
router.delete('/filtered-contacts/:id', async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    await removeFilteredContact(id);
    res.json({ success: true, message: `Filtro removido para ${id}` });
  } catch (err) {
    console.error('[routes/filtered-contacts] Error al eliminar filtro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { hasSupabase, supabaseAdmin, readLocalDB, writeLocalDB } = require('../config/db');
const { verifyAdmin } = require('../middleware/verifyAuth');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// 1. Admin Dashboard Analytics + All Resources List
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    if (hasSupabase) {
      const [usersRes, resourcesRes, purchasesRes] = await Promise.all([
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('resources').select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from('purchases').select('amount_paid').eq('status', 'completed')
      ]);
      const resources = resourcesRes.data || [];
      const totalDownloads = resources.reduce((sum, r) => sum + (r.downloads_count || 0), 0);
      const totalRevenueInr = (purchasesRes.data || []).reduce((sum, p) => sum + (p.amount_paid || 0), 0);

      return res.json({
        totalStudents: usersRes.count || 0,
        totalResources: resources.length,
        totalDownloads,
        totalRevenueInr,
        resources
      });
    }

    const db = readLocalDB();
    const totalDownloads = db.resources.reduce((sum, r) => sum + (r.downloads_count || 0), 0);
    const totalRevenueInr = db.purchases
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

    res.json({
      totalStudents: db.users.length,
      totalResources: db.resources.length,
      totalDownloads,
      totalRevenueInr,
      resources: db.resources
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats fetch failed.' });
  }
});

// 2. Upload New PDF Note or Video Lecture
router.post(
  '/upload',
  verifyAdmin,
  upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'previewFile', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { title, description, category, subject, resource_type, is_free, price_inr, video_embed_url } = req.body;
      if (!title || !category) return res.status(400).json({ error: 'Title aur Category required hain.' });

      const isFreeBool = is_free === 'true' || is_free === true;
      let storagePath = null;
      let previewPath = null;

      if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
        const file = req.files.pdfFile[0];
        const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

        if (hasSupabase) {
          const { error } = await supabaseAdmin.storage
            .from('study-materials-private')
            .upload('pdfs/' + safeName, file.buffer, { contentType: 'application/pdf' });
          if (error) return res.status(500).json({ error: 'PDF upload failed: ' + error.message });
          storagePath = 'pdfs/' + safeName;
        } else {
          fs.writeFileSync(path.join(uploadsDir, safeName), file.buffer);
          storagePath = safeName;
        }
      }

      if (hasSupabase) {
        const { data, error } = await supabaseAdmin
          .from('resources')
          .insert({
            title,
            description,
            category,
            subject,
            resource_type: resource_type || 'pdf',
            is_free: isFreeBool,
            price_inr: isFreeBool ? 0 : Number(price_inr || 0),
            storage_path: storagePath,
            preview_path: previewPath,
            video_embed_url: video_embed_url || null
          })
          .select()
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ success: true, resource: data });
      }

      const db = readLocalDB();
      const newResource = {
        id: 'res-' + crypto.randomUUID().slice(0, 8),
        title,
        description: description || 'Exam-focused study resource.',
        category,
        subject: subject || 'General',
        resource_type: resource_type || 'pdf',
        is_free: isFreeBool,
        price_inr: isFreeBool ? 0 : Number(price_inr || 0),
        storage_path: storagePath,
        preview_path: previewPath,
        video_embed_url: video_embed_url || null,
        downloads_count: 0,
        created_at: new Date().toISOString()
      };
      db.resources.unshift(newResource);
      writeLocalDB(db);

      res.status(201).json({ success: true, resource: newResource });
    } catch (err) {
      res.status(500).json({ error: 'Upload failed.' });
    }
  }
);

// 3. Edit Price / Free-Paid Status
router.patch('/resource/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { price_inr, is_free } = req.body;

    if (hasSupabase) {
      const { data, error } = await supabaseAdmin
        .from('resources')
        .update({ is_free: Boolean(is_free), price_inr: is_free ? 0 : Number(price_inr || 0) })
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, resource: data });
    }

    const db = readLocalDB();
    const item = db.resources.find((r) => r.id === id);
    if (!item) return res.status(404).json({ error: 'Resource not found.' });

    item.is_free = Boolean(is_free);
    item.price_inr = item.is_free ? 0 : Number(price_inr || 0);
    writeLocalDB(db);
    res.json({ success: true, resource: item });
  } catch (err) {
    res.status(500).json({ error: 'Update failed.' });
  }
});

// 4. Delete Resource
router.delete('/resource/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (hasSupabase) {
      const { error } = await supabaseAdmin.from('resources').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    const db = readLocalDB();
    db.resources = db.resources.filter((r) => r.id !== id);
    writeLocalDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed.' });
  }
});

module.exports = router;
                                                                 

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const { hasSupabase, supabaseAdmin, readLocalDB, writeLocalDB, localTokens } = require('../config/db');
const { verifyAuth } = require('../middleware/verifyAuth');

// Minimal valid PDF generator for seeded demo items without an uploaded file
function createDemoPdfBuffer(title, category, subject) {
  const safeTitle = (title || 'StudyHub Notes').replace(/[()\\]/g, '');
  const safeMeta = `Category: ${category || 'Exam'} | Subject: ${subject || 'General'}`;
  const stream = `BT /F1 18 Tf 50 740 Td (StudyHub - Official Study Material) Tj /F1 13 Tf 0 -34 Td (${safeTitle}) Tj /F1 11 Tf 0 -24 Td (${safeMeta}) Tj 0 -30 Td (Thank you for downloading from StudyHub. Learn - Prepare - Achieve!) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000500 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
570
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

// 1. Browse, Search & Filter Resources
router.get('/', async (req, res) => {
  try {
    const { category, type, pricing, q } = req.query;

    if (hasSupabase) {
      let query = supabaseAdmin
        .from('resources')
        .select('id, title, description, category, subject, resource_type, is_free, price_inr, preview_path, downloads_count, created_at')
        .order('created_at', { ascending: false });

      if (category && category !== 'All') query = query.eq('category', category);
      if (type && type !== 'all') query = query.eq('resource_type', type);
      if (pricing === 'free') query = query.eq('is_free', true);
      if (pricing === 'paid') query = query.eq('is_free', false);
      if (q) query = query.or(`title.ilike.%${q}%,subject.ilike.%${q}%,category.ilike.%${q}%`);

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ mode: 'supabase', resources: data });
    }

    const db = readLocalDB();
    let list = [...db.resources];
    if (category && category !== 'All') list = list.filter((r) => r.category.toLowerCase() === category.toLowerCase());
    if (type && type !== 'all') list = list.filter((r) => r.resource_type === type);
    if (pricing === 'free') list = list.filter((r) => r.is_free);
    if (pricing === 'paid') list = list.filter((r) => !r.is_free);
    if (q) {
      const term = q.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          (r.subject || '').toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term)
      );
    }

    // Strip raw storage_path before returning to frontend
    const safeList = list.map(({ storage_path, video_embed_url, ...rest }) => rest);
    res.json({ mode: 'local', resources: safeList });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resources.' });
  }
});

// 2. Get Student My Library (Purchased + Free Saved Items)
router.get('/my-library', verifyAuth, async (req, res) => {
  try {
    if (hasSupabase) {
      const { data, error } = await supabaseAdmin
        .from('purchases')
        .select('id, amount_paid, razorpay_order_id, razorpay_payment_id, created_at, resources(*)')
        .eq('user_id', req.user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      const formatted = (data || []).map((p) => ({
        id: p.id,
        amount_paid: p.amount_paid,
        order_id: p.razorpay_order_id,
        payment_id: p.razorpay_payment_id,
        purchased_at: p.created_at,
        resource: p.resources
      }));
      return res.json({ library: formatted });
    }

    const db = readLocalDB();
    const myPurchases = db.purchases
      .filter((p) => p.user_id === req.user.id && p.status === 'completed')
      .map((p) => ({
        id: p.id,
        amount_paid: p.amount_paid,
        order_id: p.razorpay_order_id,
        payment_id: p.razorpay_payment_id,
        purchased_at: p.created_at,
        resource: db.resources.find((r) => r.id === p.resource_id) || null
      }))
      .filter((item) => item.resource !== null);

    res.json({ library: myPurchases });
  } catch (err) {
    res.status(500).json({ error: 'Could not load library.' });
  }
});

// 3. Authorize Secure Download / Video Playback (60-sec expiring link)
router.get('/download/:resourceId', verifyAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;

    if (hasSupabase) {
      const { data: resource } = await supabaseAdmin.from('resources').select('*').eq('id', resourceId).single();
      if (!resource) return res.status(404).json({ error: 'Resource not found.' });

      if (!resource.is_free) {
        const { data: purchase } = await supabaseAdmin
          .from('purchases')
          .select('id')
          .eq('user_id', req.user.id)
          .eq('resource_id', resourceId)
          .eq('status', 'completed')
          .single();
        if (!purchase) return res.status(403).json({ error: 'Purchase required to unlock this file.' });
      }

      if (resource.resource_type === 'video') {
        return res.json({ type: 'video', title: resource.title, videoUrl: resource.video_embed_url });
      }

      const { data: signed, error } = await supabaseAdmin.storage
        .from('study-materials-private')
        .createSignedUrl(resource.storage_path, 60);

      if (error) return res.status(500).json({ error: 'Signed URL generation failed.' });
      await supabaseAdmin.rpc('increment_downloads', { row_id: resourceId });
      return res.json({ type: 'pdf', downloadUrl: signed.signedUrl, expiresInSeconds: 60 });
    }

    // Local Demo Mode
    const db = readLocalDB();
    const resource = db.resources.find((r) => r.id === resourceId);
    if (!resource) return res.status(404).json({ error: 'Resource not found.' });

    if (!resource.is_free) {
      const purchased = db.purchases.find(
        (p) => p.user_id === req.user.id && p.resource_id === resourceId && p.status === 'completed'
      );
      if (!purchased) return res.status(403).json({ error: 'Please purchase this material first.' });
    } else {
      // Save free item to user library automatically if not already present
      const exists = db.purchases.find((p) => p.user_id === req.user.id && p.resource_id === resourceId);
      if (!exists) {
        db.purchases.unshift({
          id: 'free-' + crypto.randomUUID().slice(0, 8),
          user_id: req.user.id,
          resource_id: resourceId,
          razorpay_order_id: 'FREE-' + Date.now(),
          razorpay_payment_id: 'FREE_ACCESS',
          amount_paid: 0,
          status: 'completed',
          created_at: new Date().toISOString()
        });
      }
    }

    resource.downloads_count = (resource.downloads_count || 0) + 1;
    writeLocalDB(db);

    if (resource.resource_type === 'video') {
      return res.json({
        type: 'video',
        title: resource.title,
        videoUrl: resource.video_embed_url || 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      });
    }

    // Create 60-second temporary download token
    const token = crypto.randomBytes(16).toString('hex');
    localTokens.set(token, { resourceId, expiresAt: Date.now() + 60 * 1000 });

    res.json({
      type: 'pdf',
      downloadUrl: `/api/resources/local-file/${token}`,
      expiresInSeconds: 60
    });
  } catch (err) {
    res.status(500).json({ error: 'Download authorization error.' });
  }
});

// 4. Local Temporary Signed PDF Stream (Never exposes raw folder)
router.get('/local-file/:token', (req, res) => {
  const entry = localTokens.get(req.params.token);
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(403).send('Download link expired. Please click download again from StudyHub.');
  }

  const db = readLocalDB();
  const resource = db.resources.find((r) => r.id === entry.resourceId);
  if (!resource) return res.status(404).send('File not found.');

  const safeFileName = resource.title.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';

  if (resource.storage_path) {
    const filePath = path.join(__dirname, '..', 'uploads', path.basename(resource.storage_path));
    if (fs.existsSync(filePath)) {
      return res.download(filePath, safeFileName);
    }
  }

  const pdfBuffer = createDemoPdfBuffer(resource.title, resource.category, resource.subject);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
  res.send(pdfBuffer);
});

module.exports = router;
    

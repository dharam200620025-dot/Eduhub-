const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { hasSupabase, supabasePublic, supabaseAdmin, readLocalDB, writeLocalDB, localOtps } = require('../config/db');

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address enter karein.' });
    }

    if (hasSupabase) {
      const { error } = await supabasePublic.auth.signInWithOtp({ email });
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true, message: `OTP sent to ${email}` });
    }

    // Local Demo Mode: Fixed easy OTP 123456
    const demoOtp = '123456';
    localOtps.set(email.toLowerCase(), demoOtp);
    res.json({
      success: true,
      demoMode: true,
      demoOtp,
      message: `Local Mode: Use OTP ${demoOtp} to login.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// 2. Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, full_name } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email aur OTP dono required hain.' });

    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@studyhub.in').toLowerCase();

    if (hasSupabase) {
      const { data, error } = await supabasePublic.auth.verifyOtp({
        email: cleanEmail,
        token: otp,
        type: 'email'
      });
      if (error) return res.status(400).json({ error: error.message });

      const role = cleanEmail === adminEmail ? 'admin' : 'student';
      await supabaseAdmin.from('users').upsert({
        id: data.user.id,
        email: cleanEmail,
        full_name: full_name || cleanEmail.split('@')[0],
        role
      });

      return res.json({
        success: true,
        access_token: data.session.access_token,
        user: { id: data.user.id, email: cleanEmail, full_name: full_name || cleanEmail.split('@')[0], role }
      });
    }

    // Local Demo Mode verification
    const expected = localOtps.get(cleanEmail) || '123456';
    if (otp !== expected && otp !== '123456') {
      return res.status(400).json({ error: 'Invalid OTP. Local mode mein 123456 use karein.' });
    }

    const db = readLocalDB();
    let user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      user = {
        id: 'u-' + crypto.randomUUID().slice(0, 8),
        email: cleanEmail,
        full_name: full_name || cleanEmail.split('@')[0],
        role: cleanEmail === adminEmail ? 'admin' : 'student',
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      writeLocalDB(db);
    }

    res.json({
      success: true,
      access_token: 'local:' + user.id,
      user
    });
  } catch (err) {
    res.status(500).json({ error: 'OTP verification failed.' });
  }
});

module.exports = router;
      

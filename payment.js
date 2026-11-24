const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const router = express.Router();
const { hasSupabase, supabaseAdmin, readLocalDB, writeLocalDB } = require('../config/db');
const { verifyAuth } = require('../middleware/verifyAuth');

const hasRazorpay =
  Boolean(process.env.RAZORPAY_KEY_ID) &&
  Boolean(process.env.RAZORPAY_KEY_SECRET) &&
  !process.env.RAZORPAY_KEY_ID.includes('xxxx');

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// 1. Create Order (INR)
router.post('/create-order', verifyAuth, async (req, res) => {
  try {
    const { resourceId } = req.body;
    let resource = null;

    if (hasSupabase) {
      const { data } = await supabaseAdmin.from('resources').select('*').eq('id', resourceId).single();
      resource = data;
    } else {
      const db = readLocalDB();
      resource = db.resources.find((r) => r.id === resourceId);
    }

    if (!resource) return res.status(404).json({ error: 'Resource not found.' });
    if (resource.is_free || resource.price_inr <= 0) {
      return res.status(400).json({ error: 'Ye resource free hai, direct download karein.' });
    }

    let order;
    if (hasRazorpay) {
      order = await getRazorpay().orders.create({
        amount: resource.price_inr * 100,
        currency: 'INR',
        receipt: 'sh_' + Date.now()
      });
    } else {
      order = {
        id: 'order_demo_' + Date.now(),
        amount: resource.price_inr * 100,
        currency: 'INR'
      };
    }

    if (hasSupabase) {
      await supabaseAdmin.from('purchases').insert({
        user_id: req.user.id,
        resource_id: resource.id,
        razorpay_order_id: order.id,
        amount_paid: resource.price_inr,
        status: 'pending'
      });
    } else {
      const db = readLocalDB();
      db.purchases.unshift({
        id: 'pur-' + crypto.randomUUID().slice(0, 8),
        user_id: req.user.id,
        resource_id: resource.id,
        razorpay_order_id: order.id,
        razorpay_payment_id: null,
        amount_paid: resource.price_inr,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      writeLocalDB(db);
    }

    res.json({
      demoMode: !hasRazorpay,
      order,
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
      resourceTitle: resource.title,
      priceInr: resource.price_inr
    });
  } catch (err) {
    res.status(500).json({ error: 'Order creation failed.' });
  }
});

// 2. Verify Payment & Unlock Immediately
router.post('/verify-payment', verifyAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (hasRazorpay) {
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (expected !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid Razorpay signature.' });
      }
    }

    const paymentId = razorpay_payment_id || 'pay_demo_' + Date.now();

    if (hasSupabase) {
      const { data, error } = await supabaseAdmin
        .from('purchases')
        .update({ razorpay_payment_id: paymentId, status: 'completed' })
        .eq('razorpay_order_id', razorpay_order_id)
        .eq('user_id', req.user.id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Failed to update purchase.' });
      return res.json({
        success: true,
        receipt: { orderId: razorpay_order_id, paymentId, amountPaid: data.amount_paid, date: data.created_at }
      });
    }

    const db = readLocalDB();
    const orderRecord = db.purchases.find(
      (p) => p.razorpay_order_id === razorpay_order_id && p.user_id === req.user.id
    );
    if (!orderRecord) return res.status(404).json({ error: 'Order record not found.' });

    orderRecord.razorpay_payment_id = paymentId;
    orderRecord.status = 'completed';
    writeLocalDB(db);

    res.json({
      success: true,
      message: 'Payment successful! Resource unlocked in My Library.',
      receipt: {
        orderId: razorpay_order_id,
        paymentId,
        amountPaid: orderRecord.amount_paid,
        date: orderRecord.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

module.exports = router;
        

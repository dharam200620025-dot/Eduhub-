require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { hasSupabase } = require('./config/db');
const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: hasSupabase ? 'supabase' : 'local-demo' });
});

// Clean Page Routes
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/library', (req, res) => res.sendFile(path.join(__dirname, 'public', 'library.html')));

app.listen(PORT, () => {
  console.log(`\nStudyHub Server running at: http://localhost:${PORT}`);
  console.log(`Student Library:           http://localhost:${PORT}/library`);
  console.log(`Admin Dashboard:           http://localhost:${PORT}/admin`);
  console.log(`Storage Mode:              ${hasSupabase ? 'Supabase Live' : 'Local Demo Mode (No keys needed)'}\n`);
});

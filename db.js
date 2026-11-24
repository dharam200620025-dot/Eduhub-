const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const hasSupabase =
  Boolean(process.env.SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  !process.env.SUPABASE_URL.includes('your-project-id');

const supabaseAdmin = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const supabasePublic = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Local JSON database fallback (Jab tak Supabase keys set na hon)
const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'local-db.json');

const SEED_DATA = {
  users: [
    { id: 'u-admin', email: process.env.ADMIN_EMAIL || 'admin@studyhub.in', full_name: 'Admin', role: 'admin', created_at: new Date().toISOString() },
    { id: 'u-demo', email: 'student@studyhub.in', full_name: 'Demo Student', role: 'student', created_at: new Date().toISOString() }
  ],
  resources: [
    {
      id: 'res-upsc-polity',
      title: 'UPSC Indian Polity Complete Revision Notes',
      description: 'Chapter-wise Laxmikanth crisp revision PDF with Constitutional Articles chart & PYQs.',
      category: 'UPSC',
      subject: 'Indian Polity',
      resource_type: 'pdf',
      is_free: false,
      price_inr: 99,
      storage_path: null,
      preview_path: null,
      video_embed_url: null,
      downloads_count: 1420,
      created_at: new Date().toISOString()
    },
    {
      id: 'res-nda-maths',
      title: 'NDA Mathematics Formula Handbook & 500 MCQs',
      description: 'Complete Trigonometry, Calculus & Matrix short tricks for NDA written exam.',
      category: 'NDA',
      subject: 'Mathematics',
      resource_type: 'pdf',
      is_free: false,
      price_inr: 49,
      storage_path: null,
      preview_path: null,
      video_embed_url: null,
      downloads_count: 980,
      created_at: new Date().toISOString()
    },
    {
      id: 'res-upsssc-pet',
      title: 'UPSSSC PET & Lekhpal 10-Year Solved Papers',
      description: 'Previous year question papers with Hindi & English detailed explanations.',
      category: 'UPSSSC',
      subject: 'General Studies',
      resource_type: 'pdf',
      is_free: true,
      price_inr: 0,
      storage_path: null,
      preview_path: null,
      video_embed_url: null,
      downloads_count: 2650,
      created_at: new Date().toISOString()
    },
    {
      id: 'res-ssc-cgl-video',
      title: 'SSC CGL Quantitative Aptitude Marathon Lecture',
      description: 'Full video lecture on Percentage, Profit-Loss & DI shortcuts with attached PDF.',
      category: 'SSC',
      subject: 'Quant & Reasoning',
      resource_type: 'video',
      is_free: true,
      price_inr: 0,
      storage_path: null,
      preview_path: null,
      video_embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      downloads_count: 1890,
      created_at: new Date().toISOString()
    },
    {
      id: 'res-poly-os',
      title: 'Polytechnic IT: Operating Systems & DBMS Notes',
      description: 'BTEUP semester exam focused handwritten-style notes with SQL queries & diagrams.',
      category: 'Polytechnic',
      subject: 'Computer Science',
      resource_type: 'pdf',
      is_free: false,
      price_inr: 49,
      storage_path: null,
      preview_path: null,
      video_embed_url: null,
      downloads_count: 740,
      created_at: new Date().toISOString()
    },
    {
      id: 'res-ba-eco',
      title: 'B.A. Economics (5th Sem) Important Questions Bank',
      description: 'Macroeconomics & Indian Economy exam-oriented long & short answer guide.',
      category: 'B.A.',
      subject: 'Economics',
      resource_type: 'pdf',
      is_free: true,
      price_inr: 0,
      storage_path: null,
      preview_path: null,
      video_embed_url: null,
      downloads_count: 615,
      created_at: new Date().toISOString()
    }
  ],
  purchases: []
};

function readLocalDB() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(SEED_DATA, null, 2), 'utf8');
  }
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

function writeLocalDB(data) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
}

// In-memory store for local OTPs & download tokens
const localTokens = new Map();
const localOtps = new Map();

module.exports = {
  hasSupabase,
  supabaseAdmin,
  supabasePublic,
  readLocalDB,
  writeLocalDB,
  localTokens,
  localOtps
};
    

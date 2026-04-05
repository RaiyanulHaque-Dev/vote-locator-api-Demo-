// ============================================================
//  VOTE LOCATOR  |  Node.js + Express Backend API
//  Install: npm install express pg cors dotenv
//  Run:     node server.js
// ============================================================

require('dotenv').config();
const express = require('express');
const { Pool }  = require('pg');
const cors      = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Database connection ──────────────────────────────────────
const pool = new Pool({
  host:     'db.mqwmlwlqrdfanwxhczqi.supabase.co',
  port:     5432,
  database: 'postgres',
  user:     'postgres',
  password: process.env.Whatismy_name123,
  ssl:      { rejectUnauthorized: false }
});

// Test DB on startup
pool.query('SELECT NOW()', (err) => {
  if (err) console.error('DB connection failed:', err.message);
  else     console.log('Database connected.');
});

// ── Helper: format voter response ───────────────────────────
function formatVoter(row) {
  return {
    id:          row.id,
    name:        row.name,
    birth_date:  row.birth_date.toISOString().split('T')[0],
    vote_center: row.vote_center,
  };
}

// ── Routes ───────────────────────────────────────────────────

// GET /search?q=<name|id|date>
// Searches by Unique ID, name (partial), or birth_date (YYYY-MM-DD)
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  try {
    let rows = [];

    // 1. Try exact UID match
    if (/^UID\d+$/i.test(q)) {
      const r = await pool.query(
        'SELECT * FROM voters WHERE id ILIKE $1',
        [q]
      );
      rows = r.rows;
    }

    // 2. Try date match (YYYY-MM-DD)
    if (rows.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
      const r = await pool.query(
        'SELECT * FROM voters WHERE birth_date = $1',
        [q]
      );
      rows = r.rows;
    }

    // 3. Fallback: partial name search (case-insensitive)
    if (rows.length === 0) {
      const r = await pool.query(
        'SELECT * FROM voters WHERE name ILIKE $1 ORDER BY name',
        [`%${q}%`]
      );
      rows = r.rows;
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No voter found matching your query.' });
    }

    res.json({ results: rows.map(formatVoter) });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /voter/:id  — fetch single voter by UID
app.get('/voter/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM voters WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Voter not found.' });
    }
    res.json(formatVoter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Vote Locator API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET /search?q=Arif`);
  console.log(`  GET /search?q=UID1001`);
  console.log(`  GET /search?q=1998-03-12`);
  console.log(`  GET /voter/:id`);
  console.log(`  GET /health`);
});

module.exports = app;

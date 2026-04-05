require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Database connection ──────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test DB on startup
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('DB connection FAILED:', err.message);
    console.error('Full error:', JSON.stringify(err));
  } else {
    console.log('Database connected at:', result.rows[0].now);
  }
});

// ── Helper ───────────────────────────────────────────────────
function formatVoter(row) {
  return {
    id:          row.id,
    name:        row.name,
    birth_date:  row.birth_date.toISOString().split('T')[0],
    vote_center: row.vote_center,
  };
}

// ── Routes ───────────────────────────────────────────────────

// GET /search?q=...
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  console.log('Search request for:', q);

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  try {
    let rows = [];

    // 1. Try exact UID match
    if (/^UID\d+$/i.test(q)) {
      console.log('Searching by UID...');
      const r = await pool.query('SELECT * FROM voters WHERE id ILIKE $1', [q]);
      rows = r.rows;
    }

    // 2. Try date match
    if (rows.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
      console.log('Searching by date...');
      const r = await pool.query('SELECT * FROM voters WHERE birth_date = $1', [q]);
      rows = r.rows;
    }

    // 3. Partial name search
    if (rows.length === 0) {
      console.log('Searching by name...');
      const r = await pool.query(
        'SELECT * FROM voters WHERE name ILIKE $1 ORDER BY name',
        [`%${q}%`]
      );
      rows = r.rows;
    }

    console.log('Found rows:', rows.length);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No voter found.' });
    }

    res.json({ results: rows.map(formatVoter) });

  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});

// GET /voter/:id
app.get('/voter/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM voters WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Voter not found.' });
    res.json(formatVoter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});

// GET /health
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Vote Locator API running on http://localhost:${PORT}`);
  console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
});

module.exports = app;

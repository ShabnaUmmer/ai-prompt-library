const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// JWT Secret - Add this to Render environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const JWT_EXPIRY = '7d'; // Token expires in 7 days

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://ai-prompt-library-tau.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database setup
const db = new sqlite3.Database('./database.sqlite');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    complexity INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS prompt_tags (
    prompt_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (prompt_id, tag_id),
    FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
  )`);

  // Insert default tags
  const defaultTags = ['anime', 'fantasy', 'sci-fi', 'realistic', 'cartoon', '3d', 'portrait', 'landscape'];
  defaultTags.forEach(tag => {
    db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tag]);
  });
});

// Helper function to get tags for a prompt
const getPromptTags = (promptId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT t.id, t.name FROM tags t
       JOIN prompt_tags pt ON pt.tag_id = t.id
       WHERE pt.prompt_id = ?`,
      [promptId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
};

// ========== JWT MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user; // { id, username }
    next();
  });
};

// ========== AUTHENTICATION ENDPOINTS ==========

// Register
app.post('/api/register', async (req, res) => {
  console.log('Registration request:', req.body.username);
  const { username, password } = req.body;
  
  if (!username || username.length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword],
      function(err) {
        if (err) {
          console.error('Registration DB error:', err);
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'Username already exists' });
          }
          return res.status(500).json({ success: false, error: 'Registration failed' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
          { id: this.lastID, username: username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        
        res.json({ 
          success: true, 
          message: 'Registration successful!',
          token: token,
          user: { id: this.lastID, username }
        });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  console.log('Login request:', req.body.username);
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    res.json({ 
      success: true, 
      token: token,
      user: { id: user.id, username: user.username }
    });
  });
});

// Verify token endpoint
app.get('/api/verify', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    user: req.user 
  });
});

// Logout (just client-side token removal, no server action needed)
app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// ========== PROMPT ENDPOINTS (Protected with JWT) ==========

// GET all prompts
app.get('/api/prompts', authenticateToken, async (req, res) => {
  try {
    const prompts = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, title, complexity, created_at, updated_at FROM prompts WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    for (let prompt of prompts) {
      prompt.tags = await getPromptTags(prompt.id);
    }
    
    res.json({ success: true, data: prompts });
  } catch (error) {
    console.error('Error in GET /prompts:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// GET single prompt
app.get('/api/prompts/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM prompts WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    async (err, row) => {
      if (err || !row) {
        return res.status(404).json({ success: false, error: 'Prompt not found' });
      }
      
      const tags = await getPromptTags(id);
      res.json({
        success: true,
        data: { ...row, tags, view_count: 0 }
      });
    }
  );
});

// CREATE prompt
app.post('/api/prompts', authenticateToken, (req, res) => {
  const { title, content, complexity, tags = [] } = req.body;
  
  if (!title || title.length < 3) {
    return res.status(400).json({ success: false, error: 'Title must be at least 3 characters' });
  }
  if (!content || content.length < 20) {
    return res.status(400).json({ success: false, error: 'Content must be at least 20 characters' });
  }
  
  db.run(
    'INSERT INTO prompts (user_id, title, content, complexity) VALUES (?, ?, ?, ?)',
    [req.user.id, title, content, complexity],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      const promptId = this.lastID;
      
      if (tags && tags.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)');
        tags.forEach(tagId => {
          stmt.run(promptId, tagId);
        });
        stmt.finalize();
      }
      
      res.status(201).json({
        success: true,
        data: { id: promptId, title, content, complexity }
      });
    }
  );
});

// UPDATE prompt
app.put('/api/prompts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, content, complexity, tags = [] } = req.body;
  
  db.get('SELECT * FROM prompts WHERE id = ? AND user_id = ?', [id, req.user.id], (err, prompt) => {
    if (err || !prompt) {
      return res.status(404).json({ success: false, error: 'Prompt not found' });
    }
    
    db.run(
      'UPDATE prompts SET title = ?, content = ?, complexity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, content, complexity, id],
      (err) => {
        if (err) {
          return res.status(500).json({ success: false, error: 'Update failed' });
        }
        
        db.run('DELETE FROM prompt_tags WHERE prompt_id = ?', [id]);
        
        if (tags && tags.length > 0) {
          const stmt = db.prepare('INSERT INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)');
          tags.forEach(tagId => {
            stmt.run(id, tagId);
          });
          stmt.finalize();
        }
        
        res.json({ success: true, message: 'Prompt updated successfully' });
      }
    );
  });
});

// DELETE prompt
app.delete('/api/prompts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM prompts WHERE id = ? AND user_id = ?', [id, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Prompt not found' });
    }
    
    res.json({ success: true, message: 'Prompt deleted successfully' });
  });
});

// GET all tags (public, no auth needed)
app.get('/api/tags', (req, res) => {
  db.all('SELECT * FROM tags ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to fetch tags' });
    }
    res.json({ success: true, data: rows });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`JWT authentication enabled`);
  console.log(`Token expires in: ${JWT_EXPIRY}`);
});
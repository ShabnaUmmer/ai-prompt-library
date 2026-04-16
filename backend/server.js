const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ========== CORS CONFIGURATION - MUST BE VERY FIRST ==========
app.use((req, res, next) => {
  // Allow specific origin
  const allowedOrigin = 'https://ai-prompt-library-tau.vercel.app';
  
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }
  
  next();
});

// Alternative: Use cors middleware with specific options
app.use(cors({
  origin: 'https://ai-prompt-library-tau.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== SESSION CONFIGURATION ==========
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true, // Must be true for HTTPS (Render uses HTTPS)
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: 'none' // Must be 'none' for cross-origin
  }
}));

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

// Test endpoint to verify CORS is working
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CORS is working!',
    sessionId: req.session.id 
  });
});

// ========== AUTHENTICATION ENDPOINTS ==========
app.post('/api/register', async (req, res) => {
  console.log('Registration request received:', req.body);
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
        
        req.session.userId = this.lastID;
        req.session.username = username;
        
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ success: false, error: 'Session error' });
          }
          
          console.log('Registration successful for user:', username);
          res.json({ 
            success: true, 
            message: 'Registration successful!',
            user: { id: this.lastID, username }
          });
        });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

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
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, error: 'Session error' });
      }
      
      res.json({ 
        success: true, 
        user: { id: user.id, username: user.username }
      });
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      success: true, 
      user: { id: req.session.userId, username: req.session.username } 
    });
  } else {
    res.json({ success: false, user: null });
  }
});

// ========== PROMPT ENDPOINTS ==========
app.get('/api/prompts', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Please login first' });
  }
  
  try {
    const prompts = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, title, complexity, created_at, updated_at FROM prompts WHERE user_id = ? ORDER BY created_at DESC',
        [req.session.userId],
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

app.get('/api/prompts/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Please login first' });
  }
  
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM prompts WHERE id = ? AND user_id = ?',
    [id, req.session.userId],
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

app.post('/api/prompts', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Please login first' });
  }
  
  const { title, content, complexity, tags = [] } = req.body;
  
  if (!title || title.length < 3) {
    return res.status(400).json({ success: false, error: 'Title must be at least 3 characters' });
  }
  if (!content || content.length < 20) {
    return res.status(400).json({ success: false, error: 'Content must be at least 20 characters' });
  }
  
  db.run(
    'INSERT INTO prompts (user_id, title, content, complexity) VALUES (?, ?, ?, ?)',
    [req.session.userId, title, content, complexity],
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

app.put('/api/prompts/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Please login first' });
  }
  
  const { id } = req.params;
  const { title, content, complexity, tags = [] } = req.body;
  
  db.get('SELECT * FROM prompts WHERE id = ? AND user_id = ?', [id, req.session.userId], (err, prompt) => {
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

app.delete('/api/prompts/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Please login first' });
  }
  
  const { id } = req.params;
  
  db.run('DELETE FROM prompts WHERE id = ? AND user_id = ?', [id, req.session.userId], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: 'Prompt not found' });
    }
    
    res.json({ success: true, message: 'Prompt deleted successfully' });
  });
});

app.get('/api/tags', (req, res) => {
  db.all('SELECT * FROM tags ORDER BY name', (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to fetch tags' });
    }
    res.json({ success: true, data: rows });
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for: https://ai-prompt-library-tau.vercel.app`);
});
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL  
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// Database setup
const db = new sqlite3.Database('./database.sqlite');

// Create tables with proper error handling
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('Users table ready');
  });

  // Prompts table
  db.run(`CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    complexity INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating prompts table:', err);
    else console.log('Prompts table ready');
  });

  // Tags table
  db.run(`CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating tags table:', err);
    else console.log('Tags table ready');
  });

  // Prompt-Tags junction table
  db.run(`CREATE TABLE IF NOT EXISTS prompt_tags (
    prompt_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (prompt_id, tag_id),
    FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('Error creating prompt_tags table:', err);
    else console.log('Prompt_tags table ready');
  });

  // Insert default tags after tables are created
  setTimeout(() => {
    const defaultTags = ['anime', 'fantasy', 'sci-fi', 'realistic', 'cartoon', '3d', 'portrait', 'landscape'];
    defaultTags.forEach(tag => {
      db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tag]);
    });
    console.log('Default tags inserted');
  }, 100);
});

const viewCounts = new Map();

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

// ========== AUTHENTICATION ENDPOINTS ==========
app.post('/api/register', async (req, res) => {
  console.log('Registration request:', req.body);
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
        
        res.json({ 
          success: true, 
          message: 'Registration successful!',
          user: { id: this.lastID, username }
        });
      }
    );
  } catch (error) {
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
    
    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username }
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

// GET all prompts
app.get('/api/prompts', async (req, res) => {
  console.log('GET /api/prompts - User ID:', req.session.userId);
  
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
    
    console.log(`Found ${prompts.length} prompts for user ${req.session.userId}`);
    
    for (let prompt of prompts) {
      prompt.tags = await getPromptTags(prompt.id);
    }
    
    res.json({ success: true, data: prompts });
  } catch (error) {
    console.error('Error in GET /prompts:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
});

// GET single prompt
app.get('/api/prompts/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Please login first' });
  }
  
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM prompts WHERE id = ? AND user_id = ?',
    [id, req.session.userId],
    async (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ success: false, error: 'Prompt not found' });
      }
      
      const tags = await getPromptTags(id);
      const viewCount = (viewCounts.get(id) || 0) + 1;
      viewCounts.set(id, viewCount);
      
      res.json({
        success: true,
        data: { ...row, tags, view_count: viewCount }
      });
    }
  );
});

// CREATE prompt
app.post('/api/prompts', (req, res) => {
  console.log('POST /api/prompts - User ID:', req.session.userId);
  console.log('Request body:', req.body);
  
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
  if (!complexity || complexity < 1 || complexity > 10) {
    return res.status(400).json({ success: false, error: 'Complexity must be between 1 and 10' });
  }
  
  db.run(
    'INSERT INTO prompts (user_id, title, content, complexity) VALUES (?, ?, ?, ?)',
    [req.session.userId, title, content, complexity],
    function(err) {
      if (err) {
        console.error('Error creating prompt:', err);
        return res.status(500).json({ success: false, error: 'Database error: ' + err.message });
      }
      
      const promptId = this.lastID;
      console.log('Prompt created with ID:', promptId);
      
      if (tags && tags.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)');
        tags.forEach(tagId => {
          stmt.run(promptId, tagId);
        });
        stmt.finalize();
      }
      
      viewCounts.set(promptId.toString(), 0);
      
      res.status(201).json({
        success: true,
        data: { id: promptId, title, content, complexity },
        message: 'Prompt created successfully'
      });
    }
  );
});

// UPDATE prompt
app.put('/api/prompts/:id', (req, res) => {
  console.log('PUT /api/prompts/:id - ID:', req.params.id);
  
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

// DELETE prompt
app.delete('/api/prompts/:id', (req, res) => {
  console.log('DELETE /api/prompts/:id - ID:', req.params.id);
  
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
    
    viewCounts.delete(id);
    res.json({ success: true, message: 'Prompt deleted successfully' });
  });
});

// GET all tags
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
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(` Authentication enabled`);
  console.log(` Database: ./database.sqlite\n`);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}
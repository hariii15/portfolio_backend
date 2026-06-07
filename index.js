import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { readDB, writeDB, generateSlug, estimateReadingTime } from './db.js';
import { checkAdmin, optionalAdmin } from './auth.js';

dotenv.config();

let initialized = false;

// 1. Auto-detect service-account.json in the backend root
const defaultServiceAccountPath = path.resolve('service-account.json');
if (fs.existsSync(defaultServiceAccountPath)) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(defaultServiceAccountPath)
    });
    console.log('Firebase Admin initialized automatically from local service-account.json');
    initialized = true;
  } catch (error) {
    console.error('Error auto-initializing from service-account.json:', error);
  }
}

// 2. Fallbacks if not auto-initialized
if (!initialized) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized from JSON env variable.');
      initialized = true;
    } catch (error) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      });
      console.log('Firebase Admin initialized from JSON path.');
      initialized = true;
    } catch (e) {
      console.error('Error initializing from path:', e);
    }
  }
}
  
// 3. Fallback to default ADC if still not initialized
if (!initialized) {
  try {
    admin.initializeApp();
    console.log('Firebase Admin initialized with default credentials.');
  } catch (e) {
    console.warn('Firebase Admin failed default initialization. Auth validation will fail until config is corrected.', e.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// Public health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1. GET /api/blogs (Public / Admin listing)
app.get('/api/blogs', optionalAdmin, async (req, res) => {
  try {
    const blogs = await readDB();
    let filtered = blogs;

    // Visitors only see published posts
    if (!req.isAdmin) {
      filtered = blogs.filter(b => b.published === true);
    }

    const { q, tag } = req.query;
    if (q) {
      const query = q.toLowerCase();
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(query) || 
        b.excerpt.toLowerCase().includes(query) || 
        b.content.toLowerCase().includes(query)
      );
    }

    if (tag) {
      const tagQuery = tag.toLowerCase();
      filtered = filtered.filter(b => 
        b.tags && b.tags.some(t => t.toLowerCase() === tagQuery)
      );
    }

    // Sort by newest first
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/blogs/:slug (Public / Admin single details)
app.get('/api/blogs/:slug', optionalAdmin, async (req, res) => {
  try {
    const blogs = await readDB();
    const blog = blogs.find(b => b.slug === req.params.slug);
    if (!blog) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    // Only allow admin to view draft posts
    if (!blog.published && !req.isAdmin) {
      return res.status(403).json({ error: 'Forbidden. Draft posts can only be viewed by administrators.' });
    }

    res.json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/blogs (Admin create)
app.post('/api/blogs', checkAdmin, async (req, res) => {
  try {
    const { title, excerpt, content, coverImage, tags, published, slug: customSlug } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and Content are required.' });
    }

    const blogs = await readDB();
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    let slug = customSlug ? generateSlug(customSlug) : generateSlug(title);
    let uniqueSlug = slug;
    let counter = 1;
    while (blogs.some(b => b.slug === uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const newBlog = {
      id,
      title,
      slug: uniqueSlug,
      excerpt: excerpt || '',
      content,
      coverImage: coverImage || '',
      tags: Array.isArray(tags) ? tags.map(t => t.trim()) : [],
      published: published === true || published === 'true',
      readingTime: estimateReadingTime(content),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    blogs.push(newBlog);
    await writeDB(blogs);
    res.status(201).json(newBlog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. PUT /api/blogs/:id (Admin update)
app.put('/api/blogs/:id', checkAdmin, async (req, res) => {
  try {
    const { title, excerpt, content, coverImage, tags, published, slug: customSlug } = req.body;
    const blogs = await readDB();
    const index = blogs.findIndex(b => b.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const existingBlog = blogs[index];
    
    let slug = existingBlog.slug;
    if (title && title !== existingBlog.title && !customSlug) {
      slug = generateSlug(title);
    } else if (customSlug && customSlug !== existingBlog.slug) {
      slug = generateSlug(customSlug);
    }

    let uniqueSlug = slug;
    let counter = 1;
    while (blogs.some(b => b.slug === uniqueSlug && b.id !== existingBlog.id)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const updatedBlog = {
      ...existingBlog,
      title: title !== undefined ? title : existingBlog.title,
      slug: uniqueSlug,
      excerpt: excerpt !== undefined ? excerpt : existingBlog.excerpt,
      content: content !== undefined ? content : existingBlog.content,
      coverImage: coverImage !== undefined ? coverImage : existingBlog.coverImage,
      tags: Array.isArray(tags) ? tags.map(t => t.trim()) : existingBlog.tags,
      published: published !== undefined ? (published === true || published === 'true') : existingBlog.published,
      readingTime: content !== undefined ? estimateReadingTime(content) : existingBlog.readingTime,
      updatedAt: new Date().toISOString()
    };

    blogs[index] = updatedBlog;
    await writeDB(blogs);
    res.json(updatedBlog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. DELETE /api/blogs/:id (Admin delete)
app.delete('/api/blogs/:id', checkAdmin, async (req, res) => {
  try {
    const blogs = await readDB();
    const filtered = blogs.filter(b => b.id !== req.params.id);
    if (filtered.length === blogs.length) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    await writeDB(filtered);
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

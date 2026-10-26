import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initFirebase, isFirestoreEnabled } from './firebase.js';
import { checkAdmin, optionalAdmin } from './auth.js';
import {
  listBlogs,
  getBlogBySlug,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
} from './repositories/blogs.js';
import {
  ACTIVITY_TYPES,
  createActivity,
  listActivity,
} from './repositories/activity.js';
import { generateSlug, estimateReadingTime } from './db.js';

dotenv.config();
initFirebase();

const storage = isFirestoreEnabled() ? 'firestore' : 'json';

const app = express();
app.use(cors());
app.use(express.json());

// Public health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', storage, time: new Date().toISOString() });
});

// Admin session verification (used by the admin UI guards)
app.get('/api/auth/verify', checkAdmin, (req, res) => {
  res.json({ ok: true, uid: req.user.uid });
});

// 1. GET /api/blogs (Public / Admin listing)
app.get('/api/blogs', optionalAdmin, async (req, res) => {
  try {
    const blogs = await listBlogs();
    let filtered = blogs;

    // Visitors only see published posts
    if (!req.isAdmin) {
      filtered = blogs.filter((b) => b.published === true);
    }

    const { q, tag } = req.query;
    if (q) {
      const query = q.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          (b.title || '').toLowerCase().includes(query) ||
          (b.excerpt || '').toLowerCase().includes(query) ||
          (b.content || '').toLowerCase().includes(query)
      );
    }

    if (tag) {
      const tagQuery = tag.toLowerCase();
      filtered = filtered.filter(
        (b) => b.tags && b.tags.some((t) => t.toLowerCase() === tagQuery)
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
    const blog = await getBlogBySlug(req.params.slug);
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

    const blogs = await listBlogs();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    const slug = customSlug ? generateSlug(customSlug) : generateSlug(title);
    let uniqueSlug = slug;
    let counter = 1;
    while (blogs.some((b) => b.slug === uniqueSlug)) {
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
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()) : [],
      published: published === true || published === 'true',
      readingTime: estimateReadingTime(content),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await createBlog(newBlog);
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. PUT /api/blogs/:id (Admin update)
app.put('/api/blogs/:id', checkAdmin, async (req, res) => {
  try {
    const { title, excerpt, content, coverImage, tags, published, slug: customSlug } = req.body;
    const existingBlog = await getBlogById(req.params.id);

    if (!existingBlog) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const blogs = await listBlogs();

    let slug = existingBlog.slug;
    if (title && title !== existingBlog.title && !customSlug) {
      slug = generateSlug(title);
    } else if (customSlug && customSlug !== existingBlog.slug) {
      slug = generateSlug(customSlug);
    }

    let uniqueSlug = slug;
    let counter = 1;
    while (blogs.some((b) => b.slug === uniqueSlug && b.id !== existingBlog.id)) {
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
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()) : existingBlog.tags,
      published:
        published !== undefined
          ? published === true || published === 'true'
          : existingBlog.published,
      readingTime:
        content !== undefined ? estimateReadingTime(content) : existingBlog.readingTime,
      updatedAt: new Date().toISOString(),
    };

    const saved = await updateBlog(existingBlog.id, updatedBlog);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. DELETE /api/blogs/:id (Admin delete)
app.delete('/api/blogs/:id', checkAdmin, async (req, res) => {
  try {
    const deleted = await deleteBlog(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. GET /api/activity (Admin activity feed)
app.get('/api/activity', checkAdmin, async (req, res) => {
  try {
    const items = await listActivity();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. POST /api/activity (Admin records a completed tool session)
app.post('/api/activity', checkAdmin, async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!ACTIVITY_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: 'Activity type must be "typing", "quiz", or "cube".' });
    }

    const entry = await createActivity({
      type,
      uid: req.user.uid,
      data: data && typeof data === 'object' ? data : {},
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (storage: ${storage})`);
});

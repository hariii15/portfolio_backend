import { getFirestore } from '../firebase.js';
import { readDB, writeDB } from '../db.js';

const COLLECTION = 'blogs';

const makeId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Firestore rejects undefined values; normalise to the plain JSON shape the
// frontend already consumes.
const cleanRecord = (value) => JSON.parse(JSON.stringify(value));

const sortNewestFirst = (items) =>
  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

export async function listBlogs() {
  const db = getFirestore();
  if (db) {
    const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  return sortNewestFirst(await readDB());
}

export async function getBlogById(id) {
  const db = getFirestore();
  if (db) {
    const doc = await db.collection(COLLECTION).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  const blogs = await readDB();
  return blogs.find((blog) => blog.id === id) || null;
}

export async function getBlogBySlug(slug) {
  const db = getFirestore();
  if (db) {
    const snapshot = await db.collection(COLLECTION).where('slug', '==', slug).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  const blogs = await readDB();
  return blogs.find((blog) => blog.slug === slug) || null;
}

export async function createBlog(blog) {
  const db = getFirestore();
  if (db) {
    const record = cleanRecord({ ...blog, id: blog.id || makeId() });
    await db.collection(COLLECTION).doc(record.id).set(record);
    return record;
  }

  const blogs = await readDB();
  blogs.push(blog);
  await writeDB(blogs);
  return blog;
}

export async function updateBlog(id, blog) {
  const db = getFirestore();
  if (db) {
    const record = cleanRecord({ ...blog, id });
    await db.collection(COLLECTION).doc(id).set(record);
    return record;
  }

  const blogs = await readDB();
  const index = blogs.findIndex((item) => item.id === id);
  if (index === -1) return null;
  blogs[index] = blog;
  await writeDB(blogs);
  return blog;
}

export async function deleteBlog(id) {
  const db = getFirestore();
  if (db) {
    const ref = db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  const blogs = await readDB();
  const filtered = blogs.filter((blog) => blog.id !== id);
  if (filtered.length === blogs.length) return false;
  await writeDB(filtered);
  return true;
}

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'blogs.json');
const ACTIVITY_PATH = path.resolve(__dirname, 'activity.json');
const roadmapPath = (name) => {
  if (!['jayy-roadmap', 'lokitha-roadmap'].includes(name)) throw new Error('Unknown roadmap.');
  return path.resolve(__dirname, name === 'jayy-roadmap' ? 'roadmap-progress.json' : 'lokitha-roadmap-progress.json');
};

export async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeDB([]);
      return [];
    }
    throw error;
  }
}

export async function writeDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function readActivity() {
  try {
    const data = await fs.readFile(ACTIVITY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeActivity([]);
      return [];
    }
    throw error;
  }
}

export async function writeActivity(data) {
  await fs.writeFile(ACTIVITY_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function readRoadmapProgress(name = 'jayy-roadmap') {
  try {
    const data = await fs.readFile(roadmapPath(name), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return { items: {} };
    throw error;
  }
}

export async function writeRoadmapProgress(data, name = 'jayy-roadmap') {
  await fs.writeFile(roadmapPath(name), JSON.stringify(data, null, 2), 'utf8');
}

export function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function estimateReadingTime(content) {
  const wpm = 200;
  const words = content ? content.trim().split(/\s+/).length : 0;
  return `${Math.ceil(words / wpm)} min read`;
}

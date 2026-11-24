import { getFirestore } from '../firebase.js';
import { readRoadmapProgress, writeRoadmapProgress } from '../db.js';

const COLLECTION = 'roadmap_progress';
const documentId = (name) => {
  if (!['jayy-roadmap', 'lokitha-roadmap'].includes(name)) throw new Error('Unknown roadmap.');
  return name;
};

const cleanItems = (items) => Object.fromEntries(
  Object.entries(items || {}).filter(([key, value]) => /^[a-z0-9-]+$/.test(key) && value === true)
);

export async function getRoadmapProgress(name = 'jayy-roadmap') {
  const document = documentId(name);
  const db = getFirestore();
  if (db) {
    const snapshot = await db.collection(COLLECTION).doc(document).get();
    return snapshot.exists ? { items: cleanItems(snapshot.data()?.items) } : { items: {} };
  }

  const saved = await readRoadmapProgress(name);
  return { items: cleanItems(saved.items) };
}

export async function setRoadmapProgress(itemId, checked, name = 'jayy-roadmap') {
  const document = documentId(name);
  const safeId = String(itemId || '').trim();
  if (!/^[a-z0-9-]+$/.test(safeId)) throw new Error('Invalid roadmap item.');

  const db = getFirestore();
  if (db) {
    const ref = db.collection(COLLECTION).doc(document);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const items = cleanItems(snapshot.exists ? snapshot.data()?.items : {});
      if (checked === true) items[safeId] = true;
      else delete items[safeId];
      transaction.set(ref, { items, updatedAt: new Date().toISOString() });
    });
    return getRoadmapProgress(name);
  }

  const saved = await readRoadmapProgress(name);
  const items = cleanItems(saved.items);
  if (checked === true) items[safeId] = true;
  else delete items[safeId];
  await writeRoadmapProgress({ items, updatedAt: new Date().toISOString() }, name);
  return { items };
}

export async function clearRoadmapProgress(name = 'jayy-roadmap') {
  const document = documentId(name);
  const db = getFirestore();
  if (db) {
    await db.collection(COLLECTION).doc(document).set({ items: {}, updatedAt: new Date().toISOString() });
    return { items: {} };
  }

  await writeRoadmapProgress({ items: {}, updatedAt: new Date().toISOString() }, name);
  return { items: {} };
}

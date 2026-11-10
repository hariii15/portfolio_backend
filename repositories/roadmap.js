import { getFirestore } from '../firebase.js';
import { readRoadmapProgress, writeRoadmapProgress } from '../db.js';

const COLLECTION = 'roadmap_progress';
const DOCUMENT = 'jayy-roadmap';

const cleanItems = (items) => Object.fromEntries(
  Object.entries(items || {}).filter(([key, value]) => /^[a-z0-9-]+$/.test(key) && value === true)
);

export async function getRoadmapProgress() {
  const db = getFirestore();
  if (db) {
    const snapshot = await db.collection(COLLECTION).doc(DOCUMENT).get();
    return snapshot.exists ? { items: cleanItems(snapshot.data()?.items) } : { items: {} };
  }

  const saved = await readRoadmapProgress();
  return { items: cleanItems(saved.items) };
}

export async function setRoadmapProgress(itemId, checked) {
  const safeId = String(itemId || '').trim();
  if (!/^[a-z0-9-]+$/.test(safeId)) throw new Error('Invalid roadmap item.');

  const db = getFirestore();
  if (db) {
    const ref = db.collection(COLLECTION).doc(DOCUMENT);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const items = cleanItems(snapshot.exists ? snapshot.data()?.items : {});
      if (checked === true) items[safeId] = true;
      else delete items[safeId];
      transaction.set(ref, { items, updatedAt: new Date().toISOString() });
    });
    return getRoadmapProgress();
  }

  const saved = await readRoadmapProgress();
  const items = cleanItems(saved.items);
  if (checked === true) items[safeId] = true;
  else delete items[safeId];
  await writeRoadmapProgress({ items, updatedAt: new Date().toISOString() });
  return { items };
}

export async function clearRoadmapProgress() {
  const db = getFirestore();
  if (db) {
    await db.collection(COLLECTION).doc(DOCUMENT).set({ items: {}, updatedAt: new Date().toISOString() });
    return { items: {} };
  }

  await writeRoadmapProgress({ items: {}, updatedAt: new Date().toISOString() });
  return { items: {} };
}

import { getFirestore } from '../firebase.js';
import { readActivity, writeActivity } from '../db.js';

export const ACTIVITY_TYPES = ['typing', 'quiz', 'cube'];

// Each activity type gets its own top-level Firestore collection.
export const ACTIVITY_COLLECTIONS = {
  typing: 'typing_activity',
  quiz: 'quiz_activity',
  cube: 'cube_activity',
};

const makeId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const cleanData = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  // Firestore rejects undefined values. A JSON round-trip normalises the data
  // to the same shape the frontend already receives.
  return JSON.parse(JSON.stringify(value));
};

const sortNewestFirst = (items) =>
  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

export async function createActivity({ type, uid, data, createdAt }) {
  if (!ACTIVITY_TYPES.includes(type)) {
    throw new Error(`Unsupported activity type: ${type}`);
  }

  const entry = {
    id: makeId(),
    type,
    uid,
    data: cleanData(data),
    createdAt: createdAt || new Date().toISOString(),
  };

  const db = getFirestore();
  if (db) {
    await db.collection(ACTIVITY_COLLECTIONS[type]).doc(entry.id).set(entry);
    return entry;
  }

  const items = await readActivity();
  items.push(entry);
  await writeActivity(items.slice(-2000));
  return entry;
}

export async function listActivity(type) {
  if (type && !ACTIVITY_TYPES.includes(type)) {
    throw new Error(`Unsupported activity type: ${type}`);
  }

  const db = getFirestore();
  if (db) {
    const types = type ? [type] : ACTIVITY_TYPES;
    const snapshots = await Promise.all(
      types.map((activityType) =>
        db
          .collection(ACTIVITY_COLLECTIONS[activityType])
          .orderBy('createdAt', 'desc')
          .limit(2000)
          .get()
      )
    );

    return sortNewestFirst(
      snapshots.flatMap((snapshot) =>
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      )
    ).slice(0, 2000);
  }

  const items = (await readActivity()).slice().reverse();
  return (type ? items.filter((item) => item.type === type) : items).slice(0, 2000);
}

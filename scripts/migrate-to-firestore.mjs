import 'dotenv/config';
import { initFirebase, getFirestore } from '../firebase.js';
import { readDB, readActivity } from '../db.js';
import { ACTIVITY_COLLECTIONS } from '../repositories/activity.js';

const dryRun = process.argv.includes('--dry-run');

initFirebase();

const db = getFirestore();
if (!db) {
  console.error(
    'Firestore is not available. Add service-account.json to the backend root or set ' +
      'FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH / FIREBASE_PROJECT_ID + ' +
      'FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, then run this script again.'
  );
  process.exit(1);
}

const blogs = await readDB();
const activities = await readActivity();

console.log(`Local data: ${blogs.length} blog post(s), ${activities.length} activity item(s).`);
if (dryRun) {
  console.log('Dry run — nothing will be written.');
} else {
  const targets = [];

  for (const blog of blogs) {
    if (!blog.id) {
      console.warn(`Skipping blog without an id: ${blog.title || '(untitled)'}`);
      continue;
    }
    targets.push(['blogs', blog.id, blog]);
  }

  for (const item of activities) {
    const collection = ACTIVITY_COLLECTIONS[item.type];
    if (!collection) {
      console.warn(`Skipping activity with unsupported type "${item.type}" (id ${item.id}).`);
      continue;
    }
    if (!item.id) {
      console.warn(`Skipping activity without an id (type ${item.type}).`);
      continue;
    }
    targets.push([collection, item.id, item]);
  }

  // Firestore allows at most 500 writes per batch.
  for (let start = 0; start < targets.length; start += 500) {
    const batch = db.batch();
    for (const [collection, id, record] of targets.slice(start, start + 500)) {
      batch.set(db.collection(collection).doc(id), record);
    }
    await batch.commit();
  }

  console.log(
    targets.length > 0
      ? `Wrote ${targets.length} document(s) to Firestore.`
      : 'Nothing to migrate.'
  );
}

const collections = ['blogs', ...Object.values(ACTIVITY_COLLECTIONS)];
for (const name of collections) {
  const snapshot = await db.collection(name).count().get();
  console.log(`${name}: ${snapshot.data().count} document(s) in Firestore`);
}

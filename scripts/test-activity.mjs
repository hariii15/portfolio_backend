import { readActivity, writeActivity } from '../db.js';

const before = await readActivity();
const marker = `local-test-${Date.now()}`;
const entry = {
  id: marker,
  type: 'cube',
  uid: 'local-test',
  data: { method: 'Beginner', durationSec: 12.34, inspectionSec: 15, test: true },
  createdAt: new Date().toISOString(),
};

let wrote = false;
try {
  await writeActivity([...before, entry]);
  wrote = true;

  const after = await readActivity();
  const saved = after.find((item) => item.id === marker);

  console.log('Entries before:', before.length);
  console.log('Entries after: ', after.length);
  console.log('Test entry saved:', Boolean(saved));
  if (saved) console.log('Stored entry:', JSON.stringify(saved, null, 2));

  if (!saved || after.length !== before.length + 1) {
    throw new Error('Activity entry was not persisted correctly.');
  }
} finally {
  if (wrote) await writeActivity(before);
  console.log('Restored original activity file. Entries now:', (await readActivity()).length);
}

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initFirebase, getFirestore } from '../firebase.js';
import { createFilmProject, deleteFilmProject, getFilmProject } from '../repositories/film.js';
import { galleryProjection, applyProgress, passwordHash, createShare, loginShare, authorizeShare, readGallery, updateProgress } from '../repositories/filmShare.js';
const fixture = { title: 'Disposable gallery test', story: { freewriting: 'PRIVATE' }, sourceDocument: { base64: 'PRIVATE' }, sequences: [], scenes: [{ id: randomUUID(), title: 'Scene', shots: [{ id: randomUUID(), title: 'Shot', status: 'Planned' }], checklist: {} }], shots: [], checklist: {} };
assert.equal(galleryProjection(fixture).story, undefined);
assert.equal(galleryProjection(fixture).sourceDocument, undefined);
assert.equal(galleryProjection(fixture).ownerUid, undefined);
assert.notEqual(passwordHash('password123', 'salt-one'), passwordHash('password123', 'salt-two'));
assert.throws(() => applyProgress(structuredClone(fixture), { type: 'delete' }));
assert.throws(() => applyProgress(structuredClone(fixture), { type: 'checklist', key: '__proto__', checked: true }));
assert.throws(() => applyProgress(structuredClone(fixture), { type: 'shot', id: fixture.scenes[0].shots[0].id, status: 'invalid' }));
console.log('PASS: gallery excludes private data; password salting; restricted updates');
if (process.argv.includes('--firestore')) {
  initFirebase();
  const owner = `share-test-${randomUUID()}`, p = await createFilmProject(owner, fixture);
  let share;
  try {
    share = await createShare(owner, p.id, { email: 'crew@example.com', password: 'disposable-test-only' });
    await assert.rejects(() => loginShare(share.id, { email: 'crew@example.com', password: 'wrong' }), /incorrect/);
    const { token } = await loginShare(share.id, { email: 'crew@example.com', password: 'disposable-test-only' });
    await assert.rejects(() => authorizeShare(share.id, ''), /sign in/);
    await assert.rejects(() => authorizeShare('another-share', token), /expired/);
    const access = await authorizeShare(share.id, token);
    assert.equal((await readGallery(access)).story, undefined);
    await updateProgress(access, { type: 'shot', id: p.scenes[0].shots[0].id, status: 'Filmed' });
    await updateProgress(access, { type: 'checklist', sceneId: p.scenes[0].id, group: 'Angles', key: 'Eye level', checked: true });
    const saved = await getFilmProject(owner, p.id);
    assert.equal(saved.scenes[0].shots[0].status, 'Filmed');
    assert.equal(saved.scenes[0].coverageChecklist.Angles['Eye level'], true);
    assert.equal(saved.story.freewriting, 'PRIVATE');
    console.log('PASS: real Firebase login, scoped sessions, shot and checklist persistence, private story retained');
  } finally {
    const saved = await getFilmProject(owner, p.id);
    await deleteFilmProject(owner, p.id, saved.revision);
    if (share) {
      const sessions = await getFirestore().collection('film_share_sessions').where('shareId', '==', share.id).get();
      await Promise.all(sessions.docs.map(d => d.ref.delete()));
      await getFirestore().collection('film_shares').doc(share.id).delete();
    }
  }
}

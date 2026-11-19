import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { getFirestore } from '../firebase.js';
import { getFilmProject } from './film.js';

const db = () => getFirestore();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const digest = (value) => createHash('sha256').update(value).digest('hex');
export function passwordHash(password, salt) { return scryptSync(password, salt, 64).toString('hex'); }
export async function createShare(uid, filmId, { email, password }) {
  await getFilmProject(uid, filmId);
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 8 || password.length > 128) fail('Enter an email and a password of 8–128 characters.');
  const ref = db().collection('film_shares').doc();
  const salt = randomBytes(24).toString('hex');
  await ref.set({ filmId, ownerUid: uid, email: email.trim().toLowerCase(), salt, passwordHash: passwordHash(password, salt), active: true, createdAt: new Date().toISOString() });
  return { id: ref.id, path: `/film/share/${ref.id}` };
}
async function shareDoc(id) {
  const doc = await db().collection('film_shares').doc(id).get();
  if (!doc.exists || !doc.data().active) fail('This gallery link is unavailable.', 404);
  return doc.data();
}
export async function loginShare(id, { email, password }) {
  const share = await shareDoc(id);
  if (typeof password !== 'string' || password.length > 128 || typeof email !== 'string') fail('Email or password is incorrect.', 401);
  const calculated = Buffer.from(passwordHash(password, share.salt), 'hex');
  if (!timingSafeEqual(calculated, Buffer.from(share.passwordHash, 'hex')) || email.trim().toLowerCase() !== share.email) fail('Email or password is incorrect.', 401);
  const token = randomBytes(32).toString('hex');
  await db().collection('film_share_sessions').doc(digest(token)).set({ shareId: id, expiresAt: Date.now() + 7 * 86400000 });
  return { token };
}
export async function authorizeShare(id, token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) fail('Please sign in to this gallery.', 401);
  const session = await db().collection('film_share_sessions').doc(digest(token)).get();
  if (!session.exists || session.data().shareId !== id || session.data().expiresAt < Date.now()) fail('Your session expired. Please sign in again.', 401);
  return shareDoc(id);
}
const shotKeys = ['id', 'title', 'description', 'size', 'angle', 'movement', 'art', 'palette', 'referenceImage', 'sketch', 'date', 'status', 'takeNotes', 'dialogue', 'frameNotes', 'lightingMood', 'audio'];
const pick = (item, keys) => Object.fromEntries(keys.filter(k => item[k] !== undefined).map(k => [k, item[k]]));
export function galleryProjection(p) {
  return { id: p.id, title: p.title, updatedAt: p.updatedAt, revision: p.revision, shotOrder: p.shotOrder || [], checklist: p.checklist || {}, shots: (p.shots || []).map(s => pick(s, shotKeys)), scenes: (p.scenes || []).map(s => ({ ...pick(s, ['id', 'title', 'location', 'timeOfDay', 'checklist', 'coverageChecklist']), shots: s.shots.map(shot => pick(shot, shotKeys)) })) };
}
export async function readGallery(share) { return galleryProjection(await getFilmProject(share.ownerUid, share.filmId)); }
export function applyProgress(p, change) {
  if (!change || typeof change !== 'object') fail('Choose a progress update.');
  if (change.type === 'shot') {
    const shot = [...(p.shots || []), ...p.scenes.flatMap(s => s.shots)].find(s => s.id === change.id);
    if (!shot) fail('Shot not found.', 404);
    if (!['Planned', 'Ready', 'Filmed', 'Selected', 'Edited'].includes(change.status)) fail('Invalid shot status.');
    shot.status = change.status;
  } else if (change.type === 'checklist') {
    const target = change.sceneId ? p.scenes.find(s => s.id === change.sceneId) : p;
    if (!target) fail('Scene not found.', 404);
    if (typeof change.key !== 'string' || !change.key.length || change.key.length > 180 || ['__proto__', 'constructor', 'prototype'].includes(change.key) || typeof change.checked !== 'boolean') fail('Invalid checklist item.');
    if (change.group) {
      if (!['Angles', 'Frames'].includes(change.group) || !change.sceneId) fail('Invalid coverage group.');
      target.coverageChecklist ||= {};
      target.coverageChecklist[change.group] ||= {};
      target.coverageChecklist[change.group][change.key] = change.checked;
    } else { target.checklist ||= {}; target.checklist[change.key] = change.checked; }
  } else fail('Only filming progress and checklists can be changed.');
  return p;
}
export async function updateProgress(share, change) {
  const ref = db().collection('film_projects').doc(share.filmId);
  return db().runTransaction(async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data().ownerUid !== share.ownerUid) fail('Film not found.', 404);
    const p = applyProgress(doc.data(), change);
    p.revision += 1; p.updatedAt = new Date().toISOString();
    tx.set(ref, p);
    return galleryProjection({ ...p, id: doc.id });
  });
}

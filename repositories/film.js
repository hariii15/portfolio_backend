import { randomUUID } from "node:crypto";
import { getFirestore } from "../firebase.js";

const collection = () => {
  const db = getFirestore();
  if (!db)
    throw Object.assign(
      new Error(
        "Film storage is unavailable. Your draft is kept on this device; try saving again shortly.",
      ),
      { status: 503 },
    );
  return db.collection("film_projects");
};
export const validId = (id) => /^[a-zA-Z0-9-]{1,80}$/.test(id);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};

// Store plain JSON only, with bounded nesting/size and unique entity IDs.
export function validateProject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("A project is required.");
  const clean = JSON.parse(JSON.stringify(input));
  if (Buffer.byteLength(JSON.stringify(clean)) > 850000)
    fail(
      "This project is too large. Use reference links instead of more image uploads.",
      413,
    );
  const walk = (value, depth = 0) => {
    if (depth > 12) fail("Project structure is too deep.");
    if (Array.isArray(value)) {
      if (value.length > 600) fail("Too many items in one list.");
      value.forEach((v) => walk(v, depth + 1));
    } else if (value && typeof value === "object") {
      if (Object.keys(value).length > 200) fail("Too many fields.");
      for (const [key, item] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          fail("Invalid field.");
        walk(item, depth + 1);
      }
    } else if (typeof value === "string" && value.length > 180000)
      fail("A field is too long.");
  };
  walk(clean);
  if (
    typeof clean.title !== "string" ||
    !clean.title.trim() ||
    clean.title.length > 180
  )
    fail("Give your film a title of up to 180 characters.");
  if (!Array.isArray(clean.sequences) || !Array.isArray(clean.scenes))
    fail("Sequences and scenes must be lists.");
  if (
    !clean.story ||
    typeof clean.story !== "object" ||
    Array.isArray(clean.story)
  )
    fail("Story must be an object.");
  if (
    !clean.checklist ||
    typeof clean.checklist !== "object" ||
    Array.isArray(clean.checklist)
  )
    fail("Checklist must be an object.");
  const ids = new Set();
  const checkEntity = (item) => {
    if (
      !item ||
      !validId(item.id) ||
      ids.has(item.id) ||
      typeof item.title !== "string" ||
      !item.title.trim()
    )
      fail("Every scene, sequence and shot needs a unique ID and title.");
    ids.add(item.id);
  };
  clean.sequences.forEach(checkEntity);
  const sequences = new Set(clean.sequences.map((s) => s.id));
  for (const scene of clean.scenes) {
    checkEntity(scene);
    if (scene.sequenceId && !sequences.has(scene.sequenceId))
      fail("Scene sequence does not exist.");
    if (!Array.isArray(scene.shots)) fail("Shots must be a list.");
    scene.shots.forEach(checkEntity);
  }
  delete clean.ownerUid;
  delete clean.revision;
  delete clean.id;
  delete clean.createdAt;
  delete clean.updatedAt;
  return clean;
}

export async function listFilmProjects(uid) {
  const snapshot = await collection().where("ownerUid", "==", uid).get();
  return snapshot.docs
    .map((doc) => {
      const p = doc.data();
      return {
        id: doc.id,
        title: p.title,
        logline: p.logline || "",
        format: p.format || "",
        status: p.status || "Idea",
        art: p.art || "landscape",
        palette: p.palette || "ochre",
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        scenes: p.scenes?.length || 0,
        shots: p.scenes?.reduce((n, s) => n + s.shots.length, 0) || 0,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getFilmProject(uid, id) {
  const doc = await collection().doc(id).get();
  if (!doc.exists || doc.data().ownerUid !== uid) fail("Film not found.", 404);
  const { ownerUid: _owner, ...project } = doc.data();
  return { ...project, id: doc.id };
}

export async function createFilmProject(uid, input) {
  const project = validateProject(input);
  const now = new Date().toISOString();
  const record = {
    ...project,
    ownerUid: uid,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
  const ref = collection().doc(randomUUID());
  await ref.create(record);
  return {
    ...project,
    id: ref.id,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
}

export async function saveFilmProject(uid, id, input) {
  const project = validateProject(input);
  const ref = collection().doc(id);
  return getFirestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data().ownerUid !== uid)
      fail("Film not found.", 404);
    const previous = doc.data();
    if (input.revision !== previous.revision)
      fail(
        "This film changed in another tab. Download your draft, then reload to see the latest version.",
        409,
      );
    const record = {
      ...project,
      ownerUid: uid,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
      revision: previous.revision + 1,
    };
    tx.set(ref, record);
    const { ownerUid: _owner, ...saved } = record;
    return { ...saved, id };
  });
}

export async function deleteFilmProject(uid, id, revision) {
  const ref = collection().doc(id);
  await getFirestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data().ownerUid !== uid)
      fail("Film not found.", 404);
    if (Number(revision) !== doc.data().revision)
      fail("This film changed in another tab. Reload before deleting.", 409);
    tx.delete(ref);
  });
}

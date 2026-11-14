import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { initFirebase, isFirestoreEnabled } from "../firebase.js";
import {
  createFilmProject,
  deleteFilmProject,
  getFilmProject,
  listFilmProjects,
  saveFilmProject,
  validateProject,
} from "../repositories/film.js";

const scene = {
  id: randomUUID(),
  title: "A test scene",
  sequenceId: "",
  checklist: {},
  shots: [
    {
      id: randomUUID(),
      title: "A test shot",
      status: "Planned",
      size: "Wide shot",
    },
  ],
};
const project = {
  title: "Disposable Shotbook verification",
  story: {},
  sequences: [],
  scenes: [scene],
  checklist: {},
  equipment: [],
  templates: [],
};
assert.equal(validateProject(project).title, project.title);
assert.throws(() => validateProject({ ...project, title: "" }), /title/);
assert.throws(
  () => validateProject({ ...project, scenes: [scene, scene] }),
  /unique/,
);
assert.throws(
  () =>
    validateProject({
      ...project,
      scenes: [{ ...scene, sequenceId: "missing" }],
    }),
  /sequence/,
);
assert.throws(
  () => validateProject({ ...project, notes: "x".repeat(851000) }),
  /too large/,
);
assert.throws(
  () => validateProject({ ...project, scenes: [{ ...scene, shots: {} }] }),
  /Shots must/,
);
assert.throws(() => validateProject({ ...project, story: [] }), /Story/);
console.log(
  "PASS: project bounds, required data, duplicate IDs, and relationships",
);

if (process.argv.includes("--firestore")) {
  dotenv.config();
  initFirebase();
  assert.ok(
    isFirestoreEnabled(),
    "Firebase credentials are required for the integration test.",
  );
  const owner = `shotbook-test-${randomUUID()}`;
  let record;
  try {
    record = await createFilmProject(owner, project);
    assert.equal(record.revision, 1);
    assert.equal(
      (await getFilmProject(owner, record.id)).scenes[0].shots[0].title,
      "A test shot",
    );
    await assert.rejects(
      () => getFilmProject("another-user", record.id),
      (error) => error.status === 404,
    );
    assert.equal((await listFilmProjects(owner)).length, 1);
    const old = record;
    record = await saveFilmProject(owner, record.id, {
      ...record,
      scenes: [{ ...scene, shots: [{ ...scene.shots[0], status: "Filmed" }] }],
      checklist: { "On set: Room tone captured": true },
    });
    assert.equal(record.revision, 2);
    assert.equal(
      (await getFilmProject(owner, record.id)).scenes[0].shots[0].status,
      "Filmed",
    );
    assert.equal(
      (await getFilmProject(owner, record.id)).checklist[
        "On set: Room tone captured"
      ],
      true,
    );
    await assert.rejects(
      () => saveFilmProject(owner, old.id, old),
      (error) => error.status === 409,
    );
    await assert.rejects(
      () => deleteFilmProject(owner, old.id, old.revision),
      (error) => error.status === 409,
    );
    await assert.rejects(
      () => deleteFilmProject("another-user", record.id, record.revision),
      (error) => error.status === 404,
    );
    console.log(
      "PASS: Firestore create, reload, update, checklist persistence, ownership, and revision conflicts",
    );
  } finally {
    if (record) {
      await deleteFilmProject(owner, record.id, record.revision);
      assert.equal((await listFilmProjects(owner)).length, 0);
      console.log("PASS: disposable integration record removed");
    }
  }
}

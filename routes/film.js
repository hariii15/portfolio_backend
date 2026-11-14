import { Router } from "express";
import {
  createFilmProject,
  deleteFilmProject,
  getFilmProject,
  listFilmProjects,
  saveFilmProject,
  validId,
} from "../repositories/film.js";

const router = Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error("Film API:", error.message);
    res
      .status(error.status || 500)
      .json({
        error: error.status
          ? error.message
          : "Could not save or load this film. Please try again.",
      });
  }
};
router.param("id", (req, res, next, id) =>
  validId(id) ? next() : res.status(400).json({ error: "Invalid film ID." }),
);
router.get(
  "/",
  handle(async (req, res) => res.json(await listFilmProjects(req.user.uid))),
);
router.post(
  "/",
  handle(async (req, res) =>
    res.status(201).json(await createFilmProject(req.user.uid, req.body)),
  ),
);
router.get(
  "/:id",
  handle(async (req, res) =>
    res.json(await getFilmProject(req.user.uid, req.params.id)),
  ),
);
router.put(
  "/:id",
  handle(async (req, res) =>
    res.json(await saveFilmProject(req.user.uid, req.params.id, req.body)),
  ),
);
router.delete(
  "/:id",
  handle(async (req, res) => {
    await deleteFilmProject(req.user.uid, req.params.id, req.query.revision);
    res.status(204).end();
  }),
);
export default router;

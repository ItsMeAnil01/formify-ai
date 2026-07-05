import express from "express";
import { protect } from "../middleware/auth.js";
import { importUpload, imageUpload } from "../middleware/upload.js";
import {
  createForm,
  listForms,
  getForm,
  updateForm,
  setFormStatus,
  deleteForm,
  duplicateForm,
  getPublicForm,
  importQuestions,
  uploadImage,
} from "../controllers/formController.js";
import {
  listResponses,
  getAnalytics,
  exportCsv,
} from "../controllers/responseController.js";

const router = express.Router();

// Public (no auth) — must come before the protect middleware
router.get("/public/:slug", getPublicForm);

router.use(protect);

router.route("/").get(listForms).post(createForm);
router.post("/upload-image", imageUpload.single("image"), uploadImage);
router.route("/:id").get(getForm).put(updateForm).delete(deleteForm);
router.patch("/:id/status", setFormStatus);
router.post("/:id/duplicate", duplicateForm);
router.post("/:id/import-questions", importUpload.single("file"), importQuestions);

router.get("/:id/responses", listResponses);
router.get("/:id/analytics", getAnalytics);
router.get("/:id/export.csv", exportCsv);

export default router;

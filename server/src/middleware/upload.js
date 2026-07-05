import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "images");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// In-memory storage for spreadsheet imports — parsed immediately, never written to disk
export const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(csv|xlsx)$/i)) {
      return cb(new Error("Only .csv or .xlsx files are accepted"));
    }
    cb(null, true);
  },
});

// Disk storage for question/cover images — served back at /uploads/images/<filename>
export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${nanoid(12)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are accepted"));
    }
    cb(null, true);
  },
});

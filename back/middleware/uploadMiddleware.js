import multer from "multer";

const storage = multer.memoryStorage();

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error(`Type de fichier non autorisé : ${file.mimetype || "inconnu"}`));
}

export const chantierUpload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024, files: 1 },
  fileFilter,
});

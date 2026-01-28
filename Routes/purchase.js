const express = require("express");
const router = express.Router();

const {
  createPurchase,
  importPreview,
  downloadErrorFile,
} = require("../Controllers/purchase");
const { uploadExcel } = require("../Middleware/upload");
const { auth } = require("../Middleware/auth");

router.post("/purchase/create", auth, createPurchase);

router.post(
  "/purchase/import-preview",
  auth,
  uploadExcel.single("file"),
  importPreview,
);

router.get("/purchase/download-error/:filename", auth, downloadErrorFile);
module.exports = router;

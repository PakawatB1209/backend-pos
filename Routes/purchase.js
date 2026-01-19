const express = require("express");
const router = express.Router();

const { createPurchase, importPreview } = require("../Controllers/purchase");
const { uploadExcel } = require("../Middleware/upload");
const { auth } = require("../Middleware/auth");

router.post("/purchase", auth, createPurchase);

router.post(
  "/purchase/import-preview",
  auth,
  uploadExcel.single("file"),
  importPreview,
);

module.exports = router;

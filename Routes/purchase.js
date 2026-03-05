const express = require("express");
const router = express.Router();

const {
  createPurchase,
  importPreview,
  downloadErrorFile,
  getNextPurchaseNumber,
  getProductPurchaseHistory,
  getPurchaseById,
} = require("../Controllers/purchase");
const { uploadExcel } = require("../Middleware/upload");
const { auth } = require("../Middleware/auth");
const { checkPermission } = require("../Middleware/checkPermission");

router.post(
  "/purchase/create",
  auth,
  checkPermission("Purchase", "add"),
  createPurchase,
);

router.post(
  "/purchase/import-preview",
  auth,
  checkPermission("Purchase", "add"),
  uploadExcel.single("file"),
  importPreview,
);
module.exports = router;

router.get(
  "/purchase/next-number",
  auth,
  checkPermission("Purchase", "add"),
  getNextPurchaseNumber,
);

router.get("/purchase/:id", auth, getPurchaseById);

router.get("/history/:productId", auth, getProductPurchaseHistory);

const express = require("express");
const router = express.Router();

const {
  createPurchase,
  importPreview,
  getNextPurchaseNumber,
  getProductPurchaseHistory,
  getPurchaseById,
  getProductsForPurchasePopup,
  testCalculateWeight,
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

router.get("/select-products", auth, getProductsForPurchasePopup);

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

router.post("/purchase/test-weight", testCalculateWeight);

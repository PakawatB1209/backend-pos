const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const { checkPermission } = require("../Middleware/checkPermission");
const {
  createStock,
  getOneStock,
  list,
  removeOneStock,
  removeStockAll,
  getStockTransactions,
  getStockDetail,
  // stockOut,
} = require("../Controllers/stock");

// Stock Out / ขายออก (ถ้ามี)
// router.post("/stock/out", auth, stockOut);

// List All (GET)
router.get("/stock", auth, checkPermission("Inventory", "view"), list);
router.get("/stock/transactions", auth, getStockTransactions);

// Get One by ID (GET)
router.get(
  "/stock/:id",
  auth,
  checkPermission("Inventory", "view"),
  getOneStock,
);

// Get One Detail by ID (GET)
router.get(
  "/stock/detail/:id",
  auth,
  checkPermission("Inventory", "view"),
  getStockDetail,
);

// Create Manual (POST)
router.post("/stock", auth, checkPermission("Inventory", "add"), createStock);

// Remove (DELETE)
router.delete(
  "/stock/removeOneStock/:id",
  auth,
  checkPermission("Inventory", "delete"),
  removeOneStock,
);
router.delete(
  "/stock/removeStockAll",
  auth,
  checkPermission("Inventory", "delete"),
  removeStockAll,
);
module.exports = router;

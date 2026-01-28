const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const {
  createStock,
  getOneStock,
  list,
  removeOneStock,
  removeStockAll,
  getStockTransactions,
  // stockOut,
} = require("../Controllers/stock");

// Stock Out / ขายออก (ถ้ามี)
// router.post("/stock/out", auth, stockOut);

// List All (GET)
router.get("/stock", auth, list);
router.get("/stock/transactions", auth, getStockTransactions);

// Get One by ID (GET)
router.get("/stock/:id", auth, getOneStock);

// Create Manual (POST)
router.post("/stock", auth, createStock);

// Remove (DELETE)
router.delete("/stock/removeOneStock/:id", auth, removeOneStock);
router.delete("/stock/removeStockAll", auth, removeStockAll);
module.exports = router;

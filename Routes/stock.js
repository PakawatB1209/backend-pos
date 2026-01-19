const express = require("express");
const router = express.Router();

// Import Middleware สำหรับตรวจสอบสิทธิ์ (จำเป็นต้องมีเพราะ Controller ใช้ req.user)
// (ตรวจสอบ path ของคุณว่าเก็บ auth ไว้ที่ไหน เช่น '../middleware/auth')
const { auth } = require("../Middleware/auth");

// Import Controller
const {
  createStock,
  getOneStock,
  list,
  removeOneStock,
  removeStockAll,
  // stockOut, // (ถ้าคุณทำฟังก์ชัน stockOut แล้ว ให้ uncomment บรรทัดนี้)
} = require("../Controllers/stock");

// Stock Out / ขายออก (ถ้ามี)
// router.post("/stock/out", auth, stockOut);

// List All (GET)
router.get("/stock", auth, list);

// Get One by ID (GET)
router.get("/stock/:id", auth, getOneStock);

// Create Manual (POST)
router.post("/stock", auth, createStock);

// Remove (DELETE)
router.delete("/stock/removeOneStock/:id", auth, removeOneStock);
router.delete("/stock/removeStockAll", auth, removeStockAll);
module.exports = router;

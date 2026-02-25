const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");

const {
  getPosItemTypes,
  getPosProducts,
  getPosProductDetail,
  addToCustomSession,
  getCustomSessionList,
  clearCustomSession,
  deleteCustomSessionItem,
  saveCustomProduct,
} = require("../Controllers/pos");

// แสดงประเภทสินค้า (Item Type) เช่น Ring, Necklace
router.get("/POS/ItemTypes", auth, getPosItemTypes);

// แสดงรายการสินค้าในหน้า Catalog พร้อมสต็อก
router.get("/POS/Product/list", auth, getPosProducts);

// คลิกสินค้าในลิสต์เพื่อดูสเปกเชิงลึกมาหยอดใส่ฟอร์ม
router.get("/POS/Product/Detail/:id", auth, getPosProductDetail);

// กดปุ่ม Custom เพื่อเพิ่มสินค้าเข้าจอง (Badge +1)
router.post("/POS/add-to-custom-session", auth, addToCustomSession);

// ดึงรายการสินค้าทั้งหมดที่จองไว้มาโชว์ทางซ้าย (หน้า Editor)
router.get("/POS/custom-session-list", auth, getCustomSessionList);

// ล้างรายการสั่งทำทั้งหมด (Clear All)
router.delete("/POS/clear-custom-session", auth, clearCustomSession);

// ลบรายการสั่งทำทีละตัว (ปุ่ม X สีแดง)
router.delete(
  "/POS/delete-custom-item/:session_id",
  auth,
  deleteCustomSessionItem,
);

// กดปุ่ม Save เพื่อบันทึกสินค้าที่แต่งสเปกเสร็จแล้ว
router.post("/POS/save-custom-product", auth, saveCustomProduct);

module.exports = router;

const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");

const {
  getPosItemTypes,
  getPosProducts,
  getPosProductDetail,
  getPosProductsByIds,
} = require("../Controllers/pos_catalog");

const {
  addToCustomSession,
  getCustomSessionList,
  clearCustomSession,
  deleteCustomSessionItem,
  saveCustomProduct,
  updateCustomSessionItem,
  finishCustomOrder,
} = require("../Controllers/pos_custom");

const {
  addToSellSession,
  getSellSessionList,
  updateSellSessionItem,
  deleteSellSessionItem,
  clearSellSession,
} = require("../Controllers/pos_sell");

// ==========================================
// หมวด Catalog (ดูแคตตาล็อกสินค้า)
// ==========================================

// แสดงประเภทสินค้า (Item Type) เช่น Ring, Necklace
router.get("/POS/ItemTypes", auth, getPosItemTypes);

// แสดงรายการสินค้าในหน้า Catalog พร้อมสต็อก
router.get("/POS/Product/list", auth, getPosProducts);

// คลิกสินค้าในลิสต์เพื่อดูสเปกเชิงลึกมาหยอดใส่ฟอร์ม
router.get("/POS/Product/Detail/:id", auth, getPosProductDetail);

// ==========================================
// หมวด Custom Order (งานสั่งทำ)
// ==========================================

// กดปุ่ม Custom เพื่อเพิ่มสินค้าเข้าจอง (Badge +1)
router.post("/POS/custom/add-to-custom-session", auth, addToCustomSession);

// ดึงรายการสินค้าทั้งหมดที่จองไว้มาโชว์ทางซ้าย (หน้า Editor)
router.get("/POS/custom/custom-session-list", auth, getCustomSessionList);

// ปรับจำนวน (Qty) ในตะกร้า Custom
router.put(
  "/POS/custom/update-custom/:session_id",
  auth,
  updateCustomSessionItem,
);

// ล้างรายการสั่งทำทั้งหมด (Clear All)
router.delete("/POS/custom/clear-custom-session", auth, clearCustomSession);

// ลบรายการสั่งทำทีละตัว (ปุ่ม X สีแดง)
router.delete(
  "/POS/custom/delete-custom-item/:session_id",
  auth,
  deleteCustomSessionItem,
);

// กดปุ่ม Save เพื่อบันทึกสินค้าที่แต่งสเปกเสร็จแล้ว
router.post("/POS/custom/save-custom-product", auth, saveCustomProduct);

router.post("/POS/custom/finish-custom-order", auth, finishCustomOrder);

// ==========================================
// หมวด Sell Order (ขายหน้าร้าน / ตะกร้าสินค้า)
// ==========================================

// เพิ่มสินค้าลงตะกร้าขาย (Sell Session) จากหน้า POS
router.post("/POS/sell/add", auth, addToSellSession);

// ดึงรายการสินค้าในตะกร้าขายทั้งหมดมาแสดง (โชว์ฝั่งซ้ายของจอ)
router.get("/POS/sell/list", auth, getSellSessionList);

// อัปเดตข้อมูลรายชิ้นในตะกร้าขาย (เช่น เปลี่ยนจำนวน, แก้ราคา หรือใส่ส่วนลดรายชิ้น)
router.put("/POS/sell/update/:session_id", auth, updateSellSessionItem);

// ลบสินค้า 1 รายการออกจากตะกร้าขาย (กดไอคอนถังขยะ)
router.delete("/POS/sell/delete/:session_id", auth, deleteSellSessionItem);

// ล้างตะกร้าขายทั้งหมด (กดปุ่ม Clear มุมซ้ายล่าง)
router.delete("/POS/sell/clear", auth, clearSellSession);
module.exports = router;

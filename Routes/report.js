const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const {
  getDayBookList,
  exportOrderReportExcel,
  getOrderReport,
} = require("../Controllers/report");
const { checkPermission } = require("../Middleware/checkPermission");

// Day Book
router.get(
  "/day-book",
  auth,
  // checkPermission("Report", "view"),
  getDayBookList,
);

// ดึงข้อมูล Report ไปโชว์บนตารางหน้าเว็บ
router.get(
  "/orders",
  auth,
  // checkPermission("Report", "view"),
  getOrderReport,
);

// ดึงข้อมูลเพื่อส่งออกเป็นไฟล์ Excel
router.get(
  "/orders/export-excel",
  auth,
  // checkPermission("Report", "view"),
  exportOrderReportExcel,
);
module.exports = router;

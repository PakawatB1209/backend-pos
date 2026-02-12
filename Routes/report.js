const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const { getDayBookList } = require("../Controllers/report");
const { checkPermission } = require("../Middleware/checkPermission");

// path: /api/report/day-book
router.get(
  "/day-book",
  auth,
  checkPermission("Report", "view"),
  getDayBookList,
);

module.exports = router;

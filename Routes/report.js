const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const { getDayBookList } = require("../Controllers/report");

// path: /api/report/day-book
router.get("/day-book", auth, getDayBookList);

module.exports = router;

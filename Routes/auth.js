const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { userForgotPassword, login } = require("../Controllers/auth");
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 นาที
  max: 5, // ยอมให้ยิงได้ 5 ครั้ง
  message: {
    success: false,
    message: "กรอกรหัสผ่านผิดหลายครั้งเกินไป กรุณารอ 10 นาที",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post("/login", loginLimiter, login);

router.post("/forgotPassword", userForgotPassword);

module.exports = router;

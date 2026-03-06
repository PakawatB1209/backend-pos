// routes/test.js (หรือไฟล์ไหนก็ได้ที่ active อยู่)
const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const {
  getCurrentRate,
  getRate,
  listExchangeRates,
} = require("../Controllers/exchangeRate"); // Import ฟังก์ชันมา

// test pull exchange-rate to database
// router.get("/test-rate", async (req, res) => {
//   try {
//     const currency = req.query.currency || "USD"; // รับค่าจาก Query Param

//     console.log(`🧪 Testing Rate for: ${currency}`);
//     const start = Date.now(); // จับเวลา

//     // เรียกใช้ฟังก์ชันที่คุณต้องการเทส
//     const rate = await getCurrentRate(currency);

//     const duration = Date.now() - start; // ดูว่าใช้เวลากี่ ms

//     res.json({
//       success: true,
//       currency: currency,
//       rate: rate,
//       duration_ms: duration,
//       message:
//         duration < 100 ? "Very Fast (Likely Cache)" : "Slower (Likely API)",
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

router.get("/exchange-rates", listExchangeRates);

// show front
router.get("/get-rate", auth, getRate);

module.exports = router;

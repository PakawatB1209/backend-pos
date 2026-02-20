const express = require("express");
require("dotenv").config();
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./Config/db");
const path = require("path");
const { readdirSync } = require("fs");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
// const companyRouters = require('./Routes/company')
// const authRouters = require('./Routes/auth')
//const fileUpload = require("express-fileupload");

const startExchangeRateJob = require("./cron/exchangeRateCron");
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 100, // จำกัด 100 requests ต่อ IP ภายใน 15 นาที
  message: {
    success: false,
    message: "เรียกใช้งาน API ถี่เกินไป กรุณารอ 15 นาทีแล้วลองใหม่",
  },
  standardHeaders: true, // ส่งข้อมูล Rate limit กลับไปใน Header แบบมาตรฐาน
  legacyHeaders: false, // ปิด Header แบบเก่า (X-RateLimit-*)
});
const app = express();

connectDB();
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
); //helmet
app.use(morgan("dev"));
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));
app.use((req, res, next) => {
  // สั่งให้ทำความสะอาด "ข้อมูลด้านใน" โดยไม่ทำการเขียนทับตัวแปรหลัก (req.body, req.query)
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api", apiLimiter);
// app.use('/123',companyRouters)
// app.use('/234',authRouters)
// readdirSync("./Routes").map((r) => {
//   console.log("Loading Route:", r);
//   app.use("/api/" + r.split(".")[0], require("./Routes/" + r));
// });

readdirSync("./Routes").map((r) => app.use("/api", require("./Routes/" + r)));

startExchangeRateJob();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

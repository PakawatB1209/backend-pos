const express = require("express");
require("dotenv").config();
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./Config/db");
const path = require("path");
const { readdirSync } = require("fs");
// const companyRouters = require('./Routes/company')
// const authRouters = require('./Routes/auth')
//const fileUpload = require("express-fileupload");

const startExchangeRateJob = require("./cron/exchangeRateCron");

const app = express();

connectDB();

app.use(morgan("dev"));
app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));
//app.use(fileUpload());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
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

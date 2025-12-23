const express = require("express");

const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./Config/db");
const path = require("path");
const { readdirSync } = require("fs");
// const companyRouters = require('./Routes/company')
// const authRouters = require('./Routes/auth')

const app = express();

connectDB();

app.use(morgan("dev"));
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use('/123',companyRouters)
// app.use('/234',authRouters)

readdirSync("./Routes").map((r) => app.use("/api", require("./Routes/" + r)));

app.listen(3000, () => console.log("server running on post 3000"));

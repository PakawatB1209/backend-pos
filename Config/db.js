const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = async () => {
  try {
    // await mongoose.connect("mongodb://localhost:27017/");
    // console.log("Connect DB");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connect DB: POS-jewely");
  } catch (error) {}
};

module.exports = connectDB;

const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = async () => {
  try {
    // await mongoose.connect(
    //   "mongodb+srv://SA:$ystem64@poscooperativeeducation.jwqfqk0.mongodb.net/?retryWrites=true&w=majority&appName=poscooperativeeducation"
    // );
    // console.log("Connect DB");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connect DB: POS-jewely");
  } catch (error) {}
};

module.exports = connectDB;

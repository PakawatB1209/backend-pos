const mongoose = require("mongoose");

const ClaritySchema = new mongoose.Schema(
  {
    clarity_name: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("clarity", ClaritySchema);

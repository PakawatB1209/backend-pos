const mongoose = require("mongoose");

const CutingSchema = new mongoose.Schema(
  {
    cuting_name: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("cuting", CutingSchema);

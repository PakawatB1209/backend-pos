const mongoose = require("mongoose");

const MetalSchema = new mongoose.Schema(
  {
    metal_name: String,
    metal_color: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("metal", MetalSchema);

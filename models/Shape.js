const mongoose = require("mongoose");

const ShapeSchema = new mongoose.Schema(
  {
    shape_name: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("shape", ShapeSchema);

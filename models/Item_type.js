const mongoose = require("mongoose");

const ItemTypeSchema = new mongoose.Schema(
  {
    itemtype_name: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("itemtype", ItemTypeSchema);

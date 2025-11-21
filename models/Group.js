const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema(
  {
    group_name: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("group", GroupSchema);

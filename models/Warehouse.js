const mongoose = require("mongoose");

const WarehouseSchema = new mongoose.Schema(
  {
    warehouse_name: String,
    warehouse_type: {
      type: String,
      enum: ["finishedgoods", "stone", "semimount", "others"],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("warehouse", WarehouseSchema);

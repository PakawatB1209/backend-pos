const mongoose = require("mongoose");

const WarehouseSchema = new mongoose.Schema(
  {
    warehouse_name: String,
    warehouse_type: {
      type: String,
      enum: ["productmaster", "stone", "semimount", "accessory", "others"],
      required: true,
    },
    comp_id: {
      type: mongoose.Schema.ObjectId,
      ref: "comp",
      required: true,
    },
  },
  { timestamps: true }
);

WarehouseSchema.index({ warehouse_name: 1, comp_id: 1 }, { unique: true });

module.exports = mongoose.model("warehouse", WarehouseSchema);

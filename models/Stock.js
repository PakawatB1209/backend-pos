const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema(
  {
    warehouse_id: { type: mongoose.Schema.ObjectId, ref: "warehouse" },
    product_id: { type: mongoose.Schema.ObjectId, ref: "product" },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    comp_id: {
      type: mongoose.Schema.ObjectId,
      ref: "comp",
      required: true,
    },
  },
  { timestamps: true }
);

StockSchema.index({ warehouse_id: 1, product_id: 1 }, { unique: true });
module.exports = mongoose.model("stock", StockSchema);

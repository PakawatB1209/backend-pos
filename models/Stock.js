const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema(
  {
    warehouse_id: { type: mongoose.Schema.ObjectId, ref: "warehouse" },
    product_id: { type: mongoose.Schema.ObjectId, ref: "product" },
    quantity: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("stock", StockSchema);

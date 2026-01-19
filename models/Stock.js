const mongoose = require("mongoose");

const setTwoDecimals = (val) => {
  if (val === undefined || val === null) return 0;
  return Math.round(val * 100) / 100;
};

const StockSchema = new mongoose.Schema(
  {
    warehouse_id: {
      type: mongoose.Schema.ObjectId,
      ref: "warehouse",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.ObjectId,
      ref: "product",
      required: true,
    },
    comp_id: { type: mongoose.Schema.ObjectId, ref: "comp", required: true },
    quantity: { type: Number, default: 0, min: 0 },
    cost: {
      type: Number,
      default: 0,
      min: 0,
      set: setTwoDecimals,
    },
    price: { type: Number, default: 0, min: 0, set: setTwoDecimals },

    total_stone_weight: { type: Number, default: 0, set: setTwoDecimals },
    total_net_weight: { type: Number, default: 0, set: setTwoDecimals },
    total_gross_weight: { type: Number, default: 0, set: setTwoDecimals },
  },
  { timestamps: true },
);

StockSchema.index(
  { warehouse_id: 1, product_id: 1, comp_id: 1 },
  { unique: true },
);

module.exports = mongoose.model("stock", StockSchema);

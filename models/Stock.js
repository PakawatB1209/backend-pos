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
    unit: { type: String },
    cost: {
      type: Number,
      default: 0,
      min: 0,
      set: setTwoDecimals,
    }, // ทุนเฉลี่ย
    price: { type: Number, default: 0, min: 0, set: setTwoDecimals }, //ราคาขายเฉลี่ย (ที่คุณเพิ่งคำนวณมา)

    total_gross_weight: { type: Number, default: 0, set: setTwoDecimals },
    last_in_date: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

StockSchema.virtual("amount").get(function () {
  return (this.quantity || 0) * (this.cost || 0);
});

StockSchema.virtual("total_sale_price").get(function () {
  return (this.quantity || 0) * (this.price || 0);
});

StockSchema.index(
  { warehouse_id: 1, product_id: 1, comp_id: 1 },
  { unique: true },
);

module.exports = mongoose.model("stock", StockSchema);

const mongoose = require("mongoose");

const SellSessionSchema = new mongoose.Schema(
  {
    comp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comp",
      required: true,
    },
    sales_staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customer",
      default: null,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },

    // ข้อมูลการขาย
    qty: { type: Number, default: 1 },
    original_price: { type: Number, default: 0 },
    unit_price: { type: Number, default: 0 },
    total_item_price: { type: Number, default: 0 },
    discount_percent: { type: Number, default: 0 }, // ส่วนลดแบบเปอร์เซ็นต์
    discount_amount: { type: Number, default: 0 }, // หรือส่วนลดแบบยอดเงินดิบๆ
  },
  { timestamps: true },
);

module.exports = mongoose.model("SellSession", SellSessionSchema);

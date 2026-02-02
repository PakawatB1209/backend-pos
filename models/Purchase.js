const mongoose = require("mongoose");

const PurchaseSchema = new mongoose.Schema(
  {
    comp_id: { type: mongoose.Schema.ObjectId, ref: "comp", required: true },
    purchase_number: { type: String, required: true },
    date: { type: Date, default: Date.now },
    vendor_name: { type: String },
    ref1: { type: String },
    ref2: { type: String },
    note: { type: String },

    currency: { type: String, default: "THB" },
    // exchange_rate: { type: Number, default: 1 },
    total_amount: { type: Number, default: 0 },
    items: [
      {
        product_id: { type: mongoose.Schema.ObjectId, ref: "product" },
        warehouse_id: { type: mongoose.Schema.ObjectId, ref: "warehouse" },
        stone_weight: { type: Number, default: 0 },
        net_weight: { type: Number, default: 0 },
        gross_weight: { type: Number, default: 0 },
        quantity: { type: Number, required: true, min: 0 },
        unit: { type: String },
        cost: { type: Number, default: 0, min: 0 },
        amount: { type: Number, default: 0, min: 0 },
        price: { type: Number, default: 0, min: 0 },
      },
    ],
    created_by: { type: mongoose.Schema.ObjectId, ref: "user" },
  },
  { timestamps: true },
);

PurchaseSchema.index({ comp_id: 1, purchase_number: 1 }, { unique: true });

PurchaseSchema.index({ comp_id: 1, date: -1 });
PurchaseSchema.index({ comp_id: 1, vendor_name: 1 });

module.exports = mongoose.model("purchase", PurchaseSchema);

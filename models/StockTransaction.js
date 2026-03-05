const mongoose = require("mongoose");

const StockTransactionSchema = new mongoose.Schema(
  {
    comp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comp",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },
    warehouse_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "warehouse",
      required: true,
    },

    type: { type: String, enum: ["in", "out", "adjust"], required: true },
    action_type: { type: String, required: true },

    qty: { type: Number, required: true },
    total_gross_weight: { type: Number, default: 0 },
    balance_after: { type: Number, required: true },

    cost: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },

    document_ref: { type: mongoose.Schema.Types.ObjectId },
    document_number: { type: String },

    vendor: { type: String },
    doc_date: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    note: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StockTransaction", StockTransactionSchema);

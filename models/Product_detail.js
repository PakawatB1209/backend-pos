const mongoose = require("mongoose");
const { Schema } = mongoose;

const ProductDetailSchema = new Schema(
  {
    product_detail_id: { type: Schema.Types.ObjectId, auto: true },
    unit: { type: String, enum: ["pcs", "gram", "carat"], default: "pcs" },
    color: { type: String },
    size: { type: String },
    masters: [
      {
        _id: false,
        master_id: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
      },
    ],
    quality: { type: String, enum: ["A", "AA", "AAA"] },
    gross_weight: { type: Number, default: 0, min: 0 },
    net_weight: { type: Number, default: 0, min: 0 },
    weight: { type: Number, default: 0, min: 0 },
    // price: { type: Number, default: 0, min: 0 },
    // cost: { type: Number, default: 0, min: 0 },
    description: { type: String },
    comp_id: { type: mongoose.Schema.ObjectId, ref: "comp", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("productdetail", ProductDetailSchema);

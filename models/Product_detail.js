const mongoose = require("mongoose");
const { Schema } = mongoose;

const ProductDetailSchema = new Schema(
  {
    product_detail_id: { type: Schema.Types.ObjectId, auto: true },
    unit: { type: String, enum: ["pcs", "gram", "carat"] },
    color: { type: String },
    size: { type: String },
    metal_id: { type: Schema.Types.ObjectId, ref: "metal" },
    itemtype_id: { type: Schema.Types.ObjectId, ref: "itemtype" },
    shape_id: { type: Schema.Types.ObjectId, ref: "shape" },
    group_id: { type: Schema.Types.ObjectId, ref: "group" },
    cuting_id: { type: Schema.Types.ObjectId, ref: "cuting" },
    clarity_id: { type: Schema.Types.ObjectId, ref: "clarity" },
    quality: { type: String, enum: ["A", "AA", "AAA"] },
    gross_weight: { type: Number },
    net_weight: { type: Number },
    weight: { type: Number },
    price: { type: Number },
    cost: { type: Number },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("productdetail", ProductDetailSchema);

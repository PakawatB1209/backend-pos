const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    product_code: String,
    product_name: String,
    product_detail_id: { type: mongoose.Schema.ObjectId, ref: "productdetail" },
    product_Image: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("product", ProductSchema);

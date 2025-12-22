const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    product_code: String,
    product_name: String,
    product_detail_id: { type: mongoose.Schema.ObjectId, ref: "productdetail" },
    comp_id: { type: mongoose.Schema.ObjectId, ref: "comp" },
    file: { type: [String], default: [] },
    product_category: {
      type: String,
      index: true,
      enum: ["productmaster", "stone", "semimount", "accessory", "others"],
    },
    product_item_type: {
      type: String,
      index: true,
    },
    related_accessories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "product" },
    ],
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ProductSchema.virtual("cover").get(function () {
  if (this.file && this.file.length > 0) {
    return this.file[0];
  }
  return null;
});

module.exports = mongoose.model("product", ProductSchema);

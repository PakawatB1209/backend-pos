const mongoose = require("mongoose");
const { Schema } = mongoose;

const ProductDetailSchema = new Schema(
  {
    product_detail_id: { type: Schema.Types.ObjectId, auto: true },
    unit: { type: String, enum: ["pcs", "g", "ct", "pair"], default: "pcs" },
    color: { type: String },
    size: { type: String },
    masters: [
      {
        _id: false,
        master_id: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
        qty: { type: Number, default: 1 },
        weight: { type: Number, default: 0 },
      },
    ],
    stones: [
      {
        _id: false,
        stone_name: { type: mongoose.Schema.ObjectId, ref: "masters" }, // Diamond
        shape: { type: mongoose.Schema.ObjectId, ref: "masters" }, // Round
        size: { type: mongoose.Schema.ObjectId, ref: "masters" }, // Size ID
        color: { type: mongoose.Schema.ObjectId, ref: "masters" }, // D
        cutting: { type: mongoose.Schema.ObjectId, ref: "masters" }, // Excellent
        quality: { type: mongoose.Schema.ObjectId, ref: "masters" }, // Good
        clarity: { type: mongoose.Schema.ObjectId, ref: "masters" }, // VVS1

        qty: { type: Number, default: 0 },
        weight: { type: Number, default: 0 },
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
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        if (ret.masters && Array.isArray(ret.masters)) {
          ret.masters = ret.masters.map((m) => {
            if (
              m.master_id &&
              typeof m.master_id === "object" &&
              m.master_id.master_type
            ) {
              const type = m.master_id.master_type;
              if (type !== "stone" && type !== "stone_name") {
                delete m.qty;
                delete m.weight;
              }
            }

            return m;
          });
        }
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("productdetail", ProductDetailSchema);

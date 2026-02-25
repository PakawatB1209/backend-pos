const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    comp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comp",
      required: true,
    },
    sale_staff_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customer",
    },

    order_no: {
      type: String,
      required: true,
      unique: true,
    },
    order_date: {
      type: Date,
      default: Date.now,
    },

    items: [
      {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
        product_code: String,
        product_name: String,
        image: String,

        custom_spec: {
          // --- General ---
          item_type_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "masters",
          },
          metal_id: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
          metal_color: String,
          product_size: String,
          size: String,
          nwt: Number,
          gwt: Number,
          description: String,

          // --- Primary Stone (พลอยหลัก) ---
          stone_name_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "masters",
          },
          stone_shape_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "masters",
          },
          stone_size: String,
          s_weight: Number,
          stone_color: String,
          cutting: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
          quality: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
          clarity: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },

          // 🟢 --- Additional Stones (พลอยรอง) ---
          additional_stones: [
            {
              stone_name_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "masters",
              },
              stone_shape_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "masters",
              },
              stone_size: String,
              s_weight: Number,
              stone_color: String,
              cutting: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
              quality: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
              clarity: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
              qty: Number,
            },
          ],
        },

        qty: { type: Number, default: 1 },
        unit_price: { type: Number, required: true },
        total_item_price: { type: Number, required: true },
      },
    ],

    sub_total: { type: Number, default: 0 },
    discount_total: { type: Number, default: 0 },
    grand_total: { type: Number, required: true },

    payment_status: {
      type: String,
      enum: ["Unpaid", "Partial", "Paid"],
      default: "Unpaid",
    },
    order_status: {
      type: String,
      enum: ["Pending", "Production", "Ready", "Completed", "Cancelled"],
      default: "Pending",
    },

    remark: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema);

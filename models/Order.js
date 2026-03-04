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
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "customer" },
    order_no: { type: String, required: true, unique: true },
    order_type: {
      type: String,
      enum: ["Custom", "Sell"],
      required: true,
      default: "Custom",
    },
    order_date: { type: Date, default: Date.now },

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
          item_type_name: String,
          metal_id: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
          metal_name: String,
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
          stone_name: String,
          stone_shape_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "masters",
          },
          stone_shape_name: String,
          stone_size: String,
          s_weight: Number,
          stone_color: String,
          cutting: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
          cutting_name: String,
          quality: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
          quality_name: String,
          clarity: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
          clarity_name: String,

          // --- Additional Stones (พลอยรอง) ---
          additional_stones: [
            {
              stone_name_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "masters",
              },
              stone_name: String,
              stone_shape_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "masters",
              },
              stone_shape_name: String,
              stone_size: String,
              s_weight: Number,
              stone_color: String,
              cutting: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
              cutting_name: String,
              quality: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
              quality_name: String,
              clarity: { type: mongoose.Schema.Types.ObjectId, ref: "masters" },
              clarity_name: String,
              qty: Number,
            },
          ],
        },

        qty: { type: Number, default: 1 },
        original_price: { type: Number, required: true, default: 0 },
        discount_percent: { type: Number, default: 0 },
        discount_amount: { type: Number, default: 0 },
        unit_price: { type: Number, required: true },
        total_item_price: { type: Number, required: true },
        deposit: { type: Number, default: 0 },
      },
    ],

    total_items: { type: Number, default: 0 },
    total_deposit: { type: Number, default: 0 },
    sub_total: { type: Number, default: 0 },
    discount_total: { type: Number, default: 0 },
    tax_total: { type: Number, default: 0 },
    tax_rate: { type: Number, default: 7 },
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
    sale_staff_name: String,
    remark: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema);

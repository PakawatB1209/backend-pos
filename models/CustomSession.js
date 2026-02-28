const mongoose = require("mongoose");

const CustomSessionSchema = new mongoose.Schema(
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
      unique: true,
    }, // สินค้าตัวที่กำลัง Custom
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customer",
      required: true,
    }, // เจ้าของงาน
    sales_staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "user" }, // พนักงานที่ทำรายการ
    is_saved: { type: Boolean, default: false },

    qty: { type: Number, default: 1 },
    custom_spec: { type: Object, default: {} },
  },
  { timestamps: true },
);

CustomSessionSchema.index({ comp_id: 1, customer_id: 1 });
// ตั้งเวลาลบเองอัตโนมัติเมื่อครบ 24 ชม. (กันขยะค้างระบบ)
CustomSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("CustomSession", CustomSessionSchema);

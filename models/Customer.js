const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    comp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comp",
      required: true,
    },
    customer_id: { type: String, required: true },
    business_type: {
      type: String,
      enum: ["Corporation", "Individual"],
      default: "Corporation",
      required: true,
    },
    customer_name: { type: String, required: true },
    company_name: { type: String },
    contact_person: { type: String, required: true },
    customer_email: { type: String },
    customer_phone: {
      type: String,
      match: [/^0[0-9]{9}$/], // start with 0xxxxxxxxx
      required: true,
    },
    customer_gender: { type: String, required: true },
    customer_date: { type: Date },
    address: {
      province: { type: String, required: true },
      district: { type: String, required: true },
      sub_district: { type: String, required: true },
      zipcode: { type: String, required: true },
    },

    customer_tax_id: { type: String, maxlength: 18 },

    tax_addr: { type: String, required: true },

    note: { type: String },
  },
  { timestamps: true }
);
CustomerSchema.index({ comp_id: 1, customer_name: 1 }, { unique: true });

module.exports = mongoose.model("customer", CustomerSchema);

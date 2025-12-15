const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    customer_id: { type: String, required: true },
    customer_name: { type: String, required: true },
    customer_addr: { type: String, required: true },
    customer_subdist_business: { type: String, required: true },
    customer_date: { type: String },
    customer_email: { type: String },
    customer_phone: { type: String, required: true },
    customer_tax_id: { type: String, maxlength: 18 },
    customer_gender: { type: String, required: true },
    note: { type: String },
    tax_addr: { type: String, required: true },
    contact_person: { type: String, required: true },
    company_name: { type: String, required: true },
    comp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comp",
      required: true,
    },
  },
  { timestamps: true }
);

CustomerSchema.index({ comp_id: 1, customer_name: 1 }, { unique: true });

module.exports = mongoose.model("customer", CustomerSchema);

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
    company_name: {
      type: String,
      required: function () {
        return this.business_type === "Corporation";
      },
    },
    contact_person: { type: String, required: true },
    customer_email: { type: String },
    customer_phone: {
      type: String,
      required: true,
      match: [/^\+?[0-9]{8,15}$/, "Please enter a valid phone number."],
    },
    customer_gender: {
      type: String,
      required: function () {
        return this.business_type === "Individual";
      },
    },
    customer_date: { type: Date },
    address: {
      address_line: { type: String, required: true },
      country: { type: String, required: true },
      province: { type: String, required: true },
      district: { type: String, required: true },
      sub_district: { type: String, required: true },
      zipcode: { type: String, minLength: 5, maxlength: 10, required: true },
    },

    customer_tax_id: { type: String, maxlength: 18 },

    tax_addr: {
      company_name: { type: String },
      address_line: { type: String },
      country: { type: String },
      province: { type: String },
      district: { type: String },
      sub_district: { type: String },
      zipcode: { type: String, minLength: 5, maxlength: 10 },
    },

    note: { type: String },
  },
  { timestamps: true },
);
CustomerSchema.index({ comp_id: 1, customer_name: 1 }, { unique: true });

module.exports = mongoose.model("customer", CustomerSchema);

const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
  {
    comp_name: { type: String, required: true },
    comp_addr: { type: String, required: true },
    comp_subdist: { type: String, required: true },
    comp_dist: { type: String, required: true },
    comp_prov: { type: String, required: true },
    comp_zip: { type: String, required: true },
    comp_email: { type: String, required: true },
    comp_taxid: { type: String, required: true },
    comp_phone: {
      type: String,
      match: [/^(0|\+66)[0-9]{9}$/], // start with 0xxxxxxxxx
      required: true,
    },
    comp_person_name: { type: String, required: true },
    comp_person_phone: { type: String, required: true },
    comp_person_email: { type: String, required: true },
    comp_file: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("comp", CompanySchema);

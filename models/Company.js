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
    comp_phone: { type: String, required: true },
    comp_person_name: { type: String, required: true },
    comp_person_phone: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("comp", CompanySchema);

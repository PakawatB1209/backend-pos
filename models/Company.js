const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
  {
    comp_name: String,
    comp_addr: String,
    comp_subdist: String,
    comp_dist: String,
    comp_prov: String,
    comp_zip: String,
    comp_email: String,
    comp_taxid: String,
    comp_phone: String,
    comp_person_name: String,
    comp_person_phone: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("comp", CompanySchema);

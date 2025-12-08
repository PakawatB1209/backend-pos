const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    country: { type: String, default: "Thailand" },
    province: { type: String, required: true },
    district: { type: String, required: true },
    sub_district: { type: String, required: true },
    zipcode: { type: String, required: true, maxlength: 10 },
  },
  { timestamps: true }
);

AddressSchema.index(
  { province: 1, district: 1, sub_district: 1, zipcode: 1 },
  { unique: true }
);

module.exports = mongoose.model("Address", AddressSchema);

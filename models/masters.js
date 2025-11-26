const mongoose = require("mongoose");

const mastersSchema = new mongoose.Schema({
  master_name: { type: String, required: true },
  master_color: { type: String },
  master_type: { type: String, required: true },
});

module.exports = mongoose.model("masters", mastersSchema);

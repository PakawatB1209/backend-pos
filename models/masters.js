const mongoose = require("mongoose");

const mastersSchema = new mongoose.Schema({
  master_name: { type: String, required: true },
  master_color: { type: String, default: null },
  master_type: { type: String, required: true },
  comp_id: {
    type: mongoose.Schema.ObjectId,
    ref: "comp",
    required: true,
  },
});
mastersSchema.index(
  { comp_id: 1, master_type: 1, master_name: 1 },
  { unique: true }
);
module.exports = mongoose.model("masters", mastersSchema);

const mongoose = require("mongoose");
const Permission = require("./Permission");
const Company = require("./Company");

const UserSchema = new mongoose.Schema(
  {
    user_name: String,
    user_email: String,
    user_password: String,
    user_role: {
      type: String,
      enum: ["Admin", "User"],
      default: "User",
      required: true,
    },
    user_phone: String,
    permission_id: { type: mongoose.Schema.ObjectId, ref: "permission" },
    comp_id: { type: mongoose.Schema.ObjectId, ref: "comp" },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", UserSchema);

const mongoose = require("mongoose");
const Permission = require("./Permission");
const Company = require("./Company");

const UserSchema = new mongoose.Schema(
  {
    user_name: { type: String, required: true },
    user_email: String,
    user_password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters."],
      required: true,
    },
    user_role: {
      type: String,
      enum: ["Admin", "User"],
      default: "User",
      required: true,
    },
    user_phone: {
      type: String,
      match: [/^0[0-9]{9}$/], // start with 0xxxxxxxxx
    },
    permissions: [{ type: mongoose.Schema.ObjectId, ref: "permission" }],
    comp_id: { type: mongoose.Schema.ObjectId, ref: "comp" },
    status: { type: Boolean, default: true },
    password_changed_at: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("user", UserSchema);

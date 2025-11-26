const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    permission_name: String,
    permission_menu: {
      type: String,
      required: true,
    },
    permission_action: {
      type: String,
      required: true,
      enum: ["add", "view", "update", "delete", "export"],
    },
  },
  { timestamps: true }
);

permissionSchema.index(
  { permission_menu: 1, permission_action: 1 },
  { unique: true }
);

module.exports = mongoose.model("permission", permissionSchema);

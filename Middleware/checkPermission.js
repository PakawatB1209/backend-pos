const User = require("../models/User");
const Permission = require("../models/Permission");

exports.checkPermission = (requiredMenu, requiredAction) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).populate("permissions");

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.user_role === "Admin") {
        return next();
      }

      const hasPermission = user.permissions.some((p) => {
        return (
          p.permission_menu === requiredMenu &&
          p.permission_action === requiredAction
        );
      });

      if (hasPermission) {
        next();
      } else {
        return res.status(403).json({
          success: false,
          message: `Access Denied: You need '${requiredAction}' permission for '${requiredMenu}'.`,
        });
      }
    } catch (err) {
      console.log("Check Permission Error:", err);
      return res.status(500).json({ message: "Server Error" });
    }
  };
};

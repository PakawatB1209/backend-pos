const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.auth = async (req, res, next) => {
  try {
    const token = req.headers["authtoken"];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied",
      });
    }
    const decoded = jwt.verify(token, "jwtsecret");

    req.user = decoded.user;

    next();
  } catch (err) {
    console.log("Middleware Auth Error:", err);

    res.status(401).json({
      success: false,
      message: "Token Invalid or Expired",
    });
  }
};

exports.adminCheck = async (req, res, next) => {
  try {
    const { id } = req.user;

    // console.log("Searching ID:", id);

    const adminUser = await User.findById(id).select("user_role");

    // console.log("Found User:", adminUser);

    if (!adminUser || adminUser.user_role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Admin Access Denied",
      });
    }

    next();
  } catch (err) {
    console.log("Error:", err);
    res.status(403).json({ success: false, message: "Error" });
  }
};

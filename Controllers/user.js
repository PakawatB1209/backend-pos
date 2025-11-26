const User = require("../models/User");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
require("dotenv").config();

exports.createUser = async (req, res) => {
  try {
    const {
      user_name,
      user_email,
      user_password,
      user_role,
      user_phone,
      comp_id,
      permissions,
    } = req.body;

    if (!user_name || !user_password || !comp_id || !user_email) {
      return res
        .status(400)
        .json({ success: false, error: "Complete all fields." });
    }

    const roleToBeCreated = user_role || "User";

    if (roleToBeCreated === "User") {
      const currentUsersCount = await User.countDocuments({
        comp_id: comp_id,
        user_role: "User",
      });

      if (currentUsersCount >= 3) {
        return res.status(400).json({
          success: false,
          error: "Limited to no more than 3 per company",
        });
      }
    }

    const exists = await User.findOne({
      $or: [{ user_email }, { user_name }],
    });

    if (exists) {
      return res
        .status(400)
        .json({ success: false, error: "This user already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user_password, salt);

    const newUser = await User.create({
      user_name,
      user_email,
      user_role: roleToBeCreated,
      user_password: hashedPassword,
      user_phone,
      comp_id,
      permissions: permissions || [],
      status: true,
    });

    const userResponse = newUser.toObject();
    delete userResponse.user_password;

    return res.status(201).json({
      success: true,
      message: "created successfully",
      data: userResponse,
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.createUsersendEmail = async (req, res) => {
  try {
    const {
      user_name,
      user_email,
      user_password,
      user_role,
      user_phone,
      comp_id,
      permissions,
    } = req.body;

    if (!user_name || !user_password || !comp_id || !user_email) {
      return res
        .status(400)
        .json({ success: false, error: "Complete all fields." });
    }

    const roleToBeCreated = user_role || "User";

    if (roleToBeCreated === "User") {
      const countUsers = await User.countDocuments({
        comp_id: comp_id,
        user_role: "User",
      });

      if (countUsers >= 3) {
        return res.status(400).json({
          success: false,
          error: "Limited to no more than 3 per company",
        });
      }
    }

    const exists = await User.findOne({
      $or: [{ user_email }, { user_name }],
    });

    if (exists) {
      return res
        .status(400)
        .json({ success: false, error: "This user or email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user_password, salt);

    const newUser = await User.create({
      user_name,
      user_email,
      user_password: hashedPassword,
      user_role: roleToBeCreated,
      user_phone,
      comp_id,
      permissions: permissions || [],
      status: true,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: `"Jewelry System Admin" <${process.env.ADMIN_EMAIL}>`,
      to: user_email,
      subject: `Welcome! Your Account Credentials for ${user_name}`,
      text: `
Hello ${user_name},

Welcome to the Jewelry Management System.
Here are your login credentials:

----------------------------------
 USER ACCOUNT INFORMATION
----------------------------------
Username : ${newUser.user_name}
Email    : ${newUser.user_email}
Password : ${user_password}
Role     : ${roleToBeCreated}
Status   : ${newUser.status ? "Active" : "Inactive"}
----------------------------------

Please verify your information and change your password after the first login.

Best regards,
System Admin
      `,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${user_email}`);

    const userResponse = newUser.toObject();

    return res.status(201).json({
      success: true,
      message: "created successfully",
      data: userResponse,
    });
  } catch (err) {
    console.error("Error in createUserAndSendEmail:", err);

    res
      .status(500)
      .json({ success: false, error: "Server error or Email sending failed" });
  }
};

exports.getOneUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findById(id)
      .select("-user_password -__v")
      .populate("comp")
      .populate("permissions");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.log("Error getting user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getUserRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findById(id).select("user_role").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      role: user.user_role,
    });
  } catch (err) {
    console.log("Error getting role:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.list = async (req, res) => {
  try {
    //Get comp_id from Query String (e.g., /users?comp_id=xxxx)
    const { comp_id } = req.query;

    let query = {};

    if (comp_id) {
      query.comp_id = comp_id;
    }

    const users = await User.find(query)
      .select("-__v")
      .populate("comp_id")
      .populate("permissions")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.changeFirstPassword = async (req, res) => {
  try {
    const { id } = req.user;
    const { new_password } = req.body;

    if (!new_password) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a new password." });
    }

    const user = await User.findById(id);

    const salt = await bcrypt.genSalt(10);
    user.user_password = await bcrypt.hash(new_password, salt);

    user.password_changed_at = new Date();

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully. You can now log in.",
    });
  } catch (err) {
    console.log("Error change first password:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_name, user_email, user_phone, status, permissions, comp_id } =
      req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const checkOr = [];
    if (user_email) checkOr.push({ user_email });
    if (user_name) checkOr.push({ user_name });

    if (checkOr.length > 0) {
      const exists = await User.findOne({
        _id: { $ne: id },
        $or: checkOr,
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "This user or email already exists.",
        });
      }
    }

    if (user_name) user.user_name = user_name;
    if (user_email) user.user_email = user_email;
    if (user_phone) user.user_phone = user_phone;

    if (comp_id) user.comp_id = comp_id;
    if (permissions) user.permissions = permissions;

    if (typeof status !== "undefined") user.status = status;

    await user.save();

    const userResponse = user.toObject();
    // delete userResponse.user_password;
    delete userResponse.__v;

    return res.status(200).json({
      success: true,
      message: "Admin update user successful",
      data: userResponse,
    });
  } catch (err) {
    console.log("Server Error update user by admin:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateUserbyuser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_name, user_email, user_password, user_phone } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const checkOr = [];
    if (user_email) checkOr.push({ user_email });
    if (user_name) checkOr.push({ user_name });

    if (checkOr.length > 0) {
      const exists = await User.findOne({
        _id: { $ne: id },
        $or: checkOr,
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "This user or email already exists.",
        });
      }
    }

    if (user_name) user.user_name = user_name;
    if (user_email) user.user_email = user_email;
    if (user_phone) user.user_phone = user_phone;

    if (user_password) {
      const salt = await bcrypt.genSalt(10);
      user.user_password = await bcrypt.hash(user_password, salt);
      user.password_changed_at = new Date();
    }

    await user.save();

    const userResponse = user.toObject();
    // delete userResponse.user_password;
    delete userResponse.__v;

    return res.status(200).json({
      success: true,
      message: "Update successful",
      data: userResponse,
    });
  } catch (err) {
    console.log("Server Error update user:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.resetPassUserbyAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_password } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    if (!user_password) {
      return res.status(400).json({
        success: false,
        message: "Please enter the new password.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.user_password = await bcrypt.hash(user_password, salt);
    user.password_changed_at = null;

    await user.save();

    const userResponse = user.toObject();
    // delete userResponse.user_password;
    delete userResponse.__v;

    return res.status(200).json({
      success: true,
      message: "Reset Password Success",
      data: userResponse,
    });
  } catch (err) {
    console.log("Server Error reset password:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.resetPassUserbyAdmin_send = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_password } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    if (!user_password) {
      return res.status(400).json({
        success: false,
        message: "Please enter the new password.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.user_password = await bcrypt.hash(user_password, salt);
    user.password_changed_at = null;

    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: `"System Admin" <${process.env.ADMIN_EMAIL}>`,
      to: user.user_email,
      subject: `[Notification] Your password has been reset by Admin`,
      text: `
Hello ${user.user_name},

This is a notification that your password has been reset by the Administrator.

--------------------------
 NEW LOGIN CREDENTIALS
--------------------------
Username : ${user.user_name}
Password : ${user_password}
Date     : ${new Date().toLocaleString("th-TH")}

Please login and change your password immediately if this was not requested by you.

Best regards,
IT Support Team
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${user.user_email}`);

    const userResponse = user.toObject();
    // delete userResponse.user_password;
    delete userResponse.__v;

    res.status(200).json({
      success: true,
      message: "Password changed and notification email sent.",
      data: userResponse,
    });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "This user's information was not found",
      });
    }

    const userResponse = user.toObject(); // หรือถ้า user เป็น doc อยู่แล้วก็ใช้ได้เลย แต่ถ้ามาจาก .lean() ไม่ต้องใช้
    // delete userResponse.user_password;
    delete userResponse.__v;

    res.status(200).json({
      success: true,
      message: "Successfully deleted user",
      data: userResponse,
    });
  } catch (error) {
    console.log("Error remove user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.removeAll = async (req, res) => {
  try {
    const currentAdminId = req.user.id;
    const result = await User.deleteMany({ _id: { $ne: currentAdminId } });

    res.status(200).json({
      success: true,
      message: `All users deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.log("Error remove all users:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    if (typeof status === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Please specify the status (true/false).",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status: status },
      { new: true }
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const userResponse = user.toObject();
    // delete userResponse.user_password;
    delete userResponse.__v;

    res.status(200).json({
      success: true,
      message: `User status updated to ${
        status ? "Active" : "Inactive"
      } successfully.`,
      data: userResponse,
    });
  } catch (error) {
    console.log("Error change status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

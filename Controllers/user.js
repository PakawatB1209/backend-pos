const User = require("../models/User");
const Permission = require("../models/Permission");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const PNF = require("google-libphonenumber").PhoneNumberFormat;
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();
require("dotenv").config();

exports.createUser = async (req, res) => {
  try {
    const adminId = req.user.id;

    const adminUser = await User.findById(adminId);

    if (!adminUser || !adminUser.comp_id) {
      return res.status(403).json({
        success: false,
        error: "User is not associated with a company (Cannot create User).",
      });
    }
    const targetCompId = adminUser.comp_id;

    const {
      user_name,
      user_email,
      user_password,
      user_role,
      user_phone,
      permissions,
    } = req.body;

    if (!user_name || !user_password) {
      return res
        .status(400)
        .json({ success: false, error: "Username and password are required." });
    }

    let finalPhone = user_phone;

    if (user_phone) {
      try {
        const number = phoneUtil.parseAndKeepRawInput(user_phone, "TH");

        if (!phoneUtil.isValidNumber(number)) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid phone number format (รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง)",
          });
        }
        finalPhone = phoneUtil.format(number, PNF.E164);
      } catch (err) {
        console.log("Phone parse error:", err.message);
        return res.status(400).json({
          success: false,
          error:
            "Unable to parse phone number (ไม่สามารถตรวจสอบเบอร์โทรศัพท์ได้)",
        });
      }
    }

    const roleToBeCreated = user_role || "User";

    if (roleToBeCreated === "User") {
      const currentUsersCount = await User.countDocuments({
        comp_id: targetCompId,
        user_role: "User",
        status: true,
      });

      if (currentUsersCount >= 3) {
        return res.status(400).json({
          success: false,
          error: "Limited to no more than 3 per company",
        });
      }
    }

    if (permissions && permissions.length > 0) {
      const count = await Permission.countDocuments({
        _id: { $in: permissions },
      });

      if (count !== permissions.length) {
        return res.status(400).json({
          success: false,
          error: "One or more Permission IDs are invalid.",
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
      user_phone: finalPhone,
      comp_id: targetCompId,
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
    const adminId = req.user.id;

    const adminUser = await User.findById(adminId).select(
      "comp_id user_role status"
    );

    if (
      !adminUser ||
      adminUser.status !== true ||
      adminUser.user_role !== "Admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Admin Access Denied",
      });
    }

    if (!adminUser.comp_id) {
      return res.status(403).json({
        success: false,
        error: "Please assign a company before creating a user",
      });
    }

    const targetCompId = adminUser.comp_id;

    const {
      user_name,
      user_email,
      user_password,
      user_role,
      user_phone,
      permissions,
    } = req.body;

    if (!user_name || !user_password) {
      return res
        .status(400)
        .json({ success: false, error: "Username and password are required." });
    }

    if (!user_email) {
      return res
        .status(400)
        .json({ success: false, error: "Email is required to send password." });
    }

    let finalPhone = user_phone;

    if (user_phone) {
      try {
        const number = phoneUtil.parseAndKeepRawInput(user_phone, "TH");

        if (!phoneUtil.isValidNumber(number)) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid phone number format (รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง)",
          });
        }
        finalPhone = phoneUtil.format(number, PNF.E164);
      } catch (err) {
        console.log("Phone parse error:", err.message);
        return res.status(400).json({
          success: false,
          error:
            "Unable to parse phone number (ไม่สามารถตรวจสอบเบอร์โทรศัพท์ได้)",
        });
      }
    }

    const roleToBeCreated = user_role || "User";

    if (roleToBeCreated === "User") {
      const countUsers = await User.countDocuments({
        comp_id: targetCompId,
        user_role: "User",
        status: true,
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
      user_phone: finalPhone,
      comp_id: targetCompId,
      permissions: permissions || [],
      status: true,
      password_changed_at: null,
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

    const userResponse = newUser.toObject();
    delete userResponse.user_password;
    delete userResponse.__v;

    return res.status(201).json({
      success: true,
      message: "created successfully",
      data: userResponse,
    });
  } catch (err) {
    console.error("Error in createUserAndSendEmail:", err);
    return res
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
      .populate("comp_id")
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
    const { comp_id, user_role } = req.query;

    const query = {};

    if (comp_id) {
      query.comp_id = comp_id;
    }

    if (user_role) {
      query.user_role = user_role;
    }

    const users = await User.find(query)
      .select("-__v")
      .populate("comp_id")
      .populate("permissions")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.log("Error list users:", error);
    return res.status(500).json({ success: false, message: "Server error" });
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
    if (user_phone) {
      try {
        const number = phoneUtil.parseAndKeepRawInput(user_phone, "TH");

        if (!phoneUtil.isValidNumber(number)) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format (เบอร์โทรศัพท์ไม่ถูกต้อง)",
          });
        }
        user.user_phone = phoneUtil.format(number, PNF.E164);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Unable to parse phone number (รูปแบบเบอร์โทรศัพท์ผิดพลาด)",
        });
      }
    }
    if (comp_id) user.comp_id = comp_id;

    if (permissions) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: "Permissions must be an array of IDs.",
        });
      }

      if (permissions.length > 0) {
        const validCount = await Permission.countDocuments({
          _id: { $in: permissions },
        });

        if (validCount !== permissions.length) {
          return res.status(400).json({
            success: false,
            message: "Some Permission IDs are invalid or do not exist.",
          });
        }
      }

      user.permissions = permissions;
    }

    if (typeof status !== "undefined") user.status = status;

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.user_password;
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
    const id = req.user.id;

    const { user_name, user_email, user_password, user_phone } = req.body;

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
    if (user_phone) {
      try {
        const number = phoneUtil.parseAndKeepRawInput(user_phone, "TH");

        if (!phoneUtil.isValidNumber(number)) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format (เบอร์โทรศัพท์ไม่ถูกต้อง)",
          });
        }
        user.user_phone = phoneUtil.format(number, PNF.E164);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Unable to parse phone number (รูปแบบเบอร์โทรศัพท์ผิดพลาด)",
        });
      }
    }

    if (user_password) {
      if (user_password.length < 3) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 3 characters.",
        });
      }

      const salt = await bcrypt.genSalt(10);
      user.user_password = await bcrypt.hash(user_password, salt);
      user.password_changed_at = new Date();
    }

    await user.save();

    const userResponse = user.toObject();

    delete userResponse.user_password;
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

exports.userRequestResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter email.",
      });
    }

    const user = await User.findOne({ user_email: email }).populate(
      "comp_id",
      "comp_name"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email not found",
      });
    }

    let compId = user.comp_id;
    if (compId && typeof compId === "object" && compId._id) {
      compId = compId._id;
    }

    const admin = await User.findOne({
      comp_id: compId,
      user_role: "Admin",
      status: true,
    }).select("user_email user_name");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin for this company not found",
      });
    }

    const companyInfo = user.comp_id
      ? `${user.comp_id.comp_name} (ID: ${compId})`
      : "No Company Assigned";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: `"System Notification" <${process.env.ADMIN_EMAIL}>`,
      to: admin.user_email,
      subject: `[Request] Password Reset Request from ${user.user_name}`,
      text: `
Admin,

User has requested a password reset.

User Details:
-------------
Username : ${user.user_name}
Email    : ${user.user_email}
Company  : ${companyInfo}
Role     : ${user.user_role}

Please login to the system and reset the password for this user manually.

Login URL: http://localhost:5173/

System Auto-Message
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "Admin notified. Please wait for the new password via email.",
    });
  } catch (err) {
    console.error("Error requesting reset:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// exports.resetPassUserbyAdmin = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { user_password } = req.body;

//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid ID format",
//       });
//     }

//     if (!user_password) {
//       return res.status(400).json({
//         success: false,
//         message: "Please enter the new password.",
//       });
//     }

//     const user = await User.findById(id);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const salt = await bcrypt.genSalt(10);
//     user.user_password = await bcrypt.hash(user_password, salt);
//     user.password_changed_at = null;

//     await user.save();

//     const userResponse = user.toObject();
//     // delete userResponse.user_password;
//     delete userResponse.__v;

//     return res.status(200).json({
//       success: true,
//       message: "Reset Password Success",
//       data: userResponse,
//     });
//   } catch (err) {
//     console.log("Server Error reset password:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

exports.resetPassUserbyAdmin = async (req, res) => {
  try {
    const adminId = req.user.id;

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

    const adminUser = await User.findById(adminId).select("comp_id");

    if (!adminUser || !adminUser.comp_id || !user.comp_id) {
      return res.status(403).json({
        success: false,
        message: "Permission Denied: Company information missing.",
      });
    }

    if (adminUser.comp_id.toString() !== user.comp_id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "Permission Denied: You cannot reset password for user in another company.",
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

// exports.resetPassUserbyAdmin_send = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { user_password } = req.body;

//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid ID format",
//       });
//     }

//     if (!user_password) {
//       return res.status(400).json({
//         success: false,
//         message: "Please enter the new password.",
//       });
//     }

//     const user = await User.findById(id);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const salt = await bcrypt.genSalt(10);
//     user.user_password = await bcrypt.hash(user_password, salt);
//     user.password_changed_at = null;

//     await user.save();

//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.ADMIN_EMAIL,
//         pass: process.env.ADMIN_PASS,
//       },
//     });

//     const mailOptions = {
//       from: `"System Admin" <${process.env.ADMIN_EMAIL}>`,
//       to: user.user_email,
//       subject: `[Notification] Your password has been reset by Admin`,
//       text: `
// Hello ${user.user_name},

// This is a notification that your password has been reset by the Administrator.

// --------------------------
//  NEW LOGIN CREDENTIALS
// --------------------------
// Username : ${user.user_name}
// Password : ${user_password}
// Date     : ${new Date().toLocaleString("th-TH")}

// Please login and change your password immediately if this was not requested by you.

// Best regards,
// IT Support Team
//       `,
//     };

//     await transporter.sendMail(mailOptions);
//     console.log(`Email sent to ${user.user_email}`);

//     const userResponse = user.toObject();
//     // delete userResponse.user_password;
//     delete userResponse.__v;

//     res.status(200).json({
//       success: true,
//       message: "Password changed and notification email sent.",
//       data: userResponse,
//     });
//   } catch (err) {
//     console.error("Error resetting password:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

exports.resetPassUserbyAdmin_send = async (req, res) => {
  try {
    const adminId = req.user.id;

    const { id } = req.params;
    const { user_password } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    if (!user_password) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter the new password." });
    }

    const userToReset = await User.findById(id);
    if (!userToReset) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const adminUser = await User.findById(adminId).select("comp_id user_role");

    if (!adminUser || !adminUser.comp_id || !userToReset.comp_id) {
      return res.status(403).json({
        success: false,
        message: "Permission Denied: Company information missing.",
      });
    }

    if (adminUser.comp_id.toString() !== userToReset.comp_id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "Permission Denied: You can only manage users within your own company.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    userToReset.user_password = await bcrypt.hash(user_password, salt);
    userToReset.password_changed_at = null;

    await userToReset.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: `"System Admin" <${process.env.ADMIN_EMAIL}>`,
      to: userToReset.user_email,
      subject: `[Notification] Your password has been reset by Admin`,
      text: `
Hello ${userToReset.user_name},

This is a notification that your password has been reset by the Administrator.

--------------------------
 NEW LOGIN CREDENTIALS
--------------------------
Username : ${userToReset.user_name}
Password : ${user_password}
Date     : ${new Date().toLocaleString("th-TH")}

Please login and change your password immediately if this was not requested by you.

Best regards,
IT Support Team
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${userToReset.user_email}`);

    const userResponse = userToReset.toObject();
    delete userResponse.user_password;
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

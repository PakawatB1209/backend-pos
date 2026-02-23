const User = require("../models/User");
const Permission = require("../models/Permission");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const excelJS = require("exceljs");
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

    let finalPhone;

    if (user_phone && user_phone.trim()) {
      const number = phoneUtil.parseAndKeepRawInput(user_phone, "TH");

      if (!phoneUtil.isValidNumber(number)) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number format",
        });
      }

      finalPhone = phoneUtil.format(number, PNF.E164);
    }

    // if (user_phone) {
    //   try {
    //     const number = phoneUtil.parseAndKeepRawInput(user_phone, "TH");

    //     if (!phoneUtil.isValidNumber(number)) {
    //       return res.status(400).json({
    //         success: false,
    //         error:
    //           "Invalid phone number format (รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง)",
    //       });
    //     }
    //     finalPhone = phoneUtil.format(number, PNF.E164);
    //   } catch (err) {
    //     console.log("Phone parse error:", err.message);
    //     return res.status(400).json({
    //       success: false,
    //       error:
    //         "Unable to parse phone number (ไม่สามารถตรวจสอบเบอร์โทรศัพท์ได้)",
    //     });
    //   }
    // }

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

    const orConditions = [];

    if (user_email) orConditions.push({ user_email });
    if (user_name) orConditions.push({ user_name });

    const exists = await User.findOne({
      $or: orConditions,
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
      "comp_id user_role status user_email",
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

    const orConditions = [];

    if (user_email) orConditions.push({ user_email });
    if (user_name) orConditions.push({ user_name });

    const exists = await User.findOne({
      $or: orConditions,
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
      replyTo: adminUser.user_email,
      subject: `Welcome! Your Account Credentials for ${user_name}`,

      // Text Version
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

      // HTML Version
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>

<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.25);">

          <tr>
            <td style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:28px 36px;color:#FFFFFF;font-size:18px;font-weight:bold;">
              JEWELRY SYSTEM
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:36px 0;">
              <img
                src="https://www.svgrepo.com/show/492701/supporting-business-person.svg"
                width="160px"
                alt="New Account"
              />
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 40px 40px;color:#1F2937;">
              <h2>Welcome !</h2>

              <p style="font-size:16px;line-height:1.5;">
                Hello <strong>${user_name}</strong>,<br /><br />
                Welcome to the Jewelry Management System. Your account has been successfully created.
                Here are your login credentials:
              </p>

              <table width="100%" cellpadding="14" cellspacing="0" border="0"
                style="background:#EFF6FF; border:1px solid #DBEAFE; border-radius:12px; margin:24px 0; font-size:15px; border-collapse: separate; border-spacing:0; overflow:hidden;">
                
                <tr>
                  <td width="35%" style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Username :
                  </td>
                  <td width="65%" style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${newUser.user_name}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Email :
                  </td>
                  <td style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${newUser.user_email}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Password :
                  </td>
                  <td style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${user_password}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Role :
                  </td>
                  <td style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${roleToBeCreated}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold;">
                    Status :
                  </td>
                  <td style="color:#374151;">
                    ${newUser.status ? '<span style="color:#16A34A;font-weight:bold;">Active</span>' : '<span style="color:#DC2626;font-weight:bold;">Inactive</span>'}
                  </td>
                </tr>

              </table>
              <p style="font-size:14px;color:#DC2626;margin-top:16px;">
                *Important: Please verify your information and change your password immediately after the first login.
              </p>

              <p style="text-align:center;margin-top:32px;">
                <a href="${process.env.LOGIN_URL || "http://localhost:5173/"}"
                  style="background:#2563EB;color:#FFFFFF;padding:14px 40px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block;">
                  Login Now
                </a>
              </p>

              <p style="margin-top:40px;font-size:14px;color:#6B7280;border-top:1px solid #E5E7EB;padding-top:20px;">
                Best regards,<br />
                <strong>System Admin</strong>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
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
    const { comp_id, user_role } = req.query;
    const query = {};

    if (comp_id) query.comp_id = comp_id;
    if (user_role) query.user_role = user_role;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-__v")
        .populate("comp_id")
        .populate("permissions")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: users.length,
      total_record: total,
      total_page: Math.ceil(total / limit),
      current_page: page,
      limit: limit,
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
            message: "Invalid phone number format",
          });
        }
        user.user_phone = phoneUtil.format(number, PNF.E164);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Unable to parse phone number",
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
            message: "Invalid phone number format",
          });
        }
        user.user_phone = phoneUtil.format(number, PNF.E164);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Unable to parse phone number",
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
      "comp_name",
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
      replyTo: user.user_email,
      subject: `[Request] Password Reset Request from ${user.user_name}`,

      // Text version (สำหรับ Email Client ที่ไม่รองรับ HTML)
      text: `
Admin,
User has requested a password reset.

User Details:
Username : ${user.user_name}
Email    : ${user.user_email}
Company  : ${companyInfo}
Role     : ${user.user_role}

Please login to the system and reset the password for this user manually.
Login URL: ${process.env.ADMIN_DASHBOARD_URL || "http://localhost:5173/"}
`,

      // HTML version (Style ใหม่ + ข้อมูลเดิม + ตารางดีไซน์ล่าสุด)
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>

<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.25);">

          <tr>
            <td style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:28px 36px;color:#FFFFFF;font-size:18px;font-weight:bold;">
              YOUR COMPANY
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:36px 0;">
              <img
                src="https://cdn-icons-png.flaticon.com/512/1000/1000997.png"
                width="48"
                alt="User Request"
              />
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 40px 40px;color:#1F2937;">
              <h2>Password Reset Request</h2>

              <p style="font-size:16px;line-height:1.5;">
                Hello <strong>Admin</strong>,<br /><br />
                User has requested a password reset. Please review the details below:
              </p>

              <table width="100%" cellpadding="14" cellspacing="0" border="0"
                style="background:#EFF6FF; border:1px solid #DBEAFE; border-radius:12px; margin:24px 0; font-size:15px; border-collapse: separate; border-spacing:0; overflow:hidden;">
                
                <tr>
                  <td width="35%" style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Username :
                  </td>
                  <td width="65%" style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${user.user_name}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Email :
                  </td>
                  <td style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${user.user_email}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Company :
                  </td>
                  <td style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${companyInfo}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold;">
                    Role :
                  </td>
                  <td style="color:#374151;">
                    ${user.user_role}
                  </td>
                </tr>

              </table>
              <p style="font-size:16px;line-height:1.5;">
                Please login to the system and reset the password for this user manually.
              </p>

              <p style="text-align:center;margin-top:32px;">
                <a href="${process.env.ADMIN_DASHBOARD_URL || "http://localhost:5173/"}"
                  style="background:#2563EB;color:#FFFFFF;padding:14px 40px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block;">
                  Login to System
                </a>
              </p>

              <p style="margin-top:40px;font-size:14px;color:#6B7280;border-top:1px solid #E5E7EB;padding-top:20px;">
                System Auto-Message<br />
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
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
      1;
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

    const adminUser = await User.findById(adminId).select(
      "comp_id user_role user_email",
    );

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
      replyTo: adminUser.user_email,
      to: userToReset.user_email,
      subject: `[Notification] Your password has been reset by Admin`,

      // แบบ Text
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

      // แบบ HTML
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>

<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);">

          <tr>
            <td style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:24px 36px;color:#FFFFFF;font-size:20px;font-weight:bold;">
              YOUR COMPANY
            </td>
          </tr>

          <tr>
            <td style="padding:40px 36px;color:#374151;">
              
              <div style="text-align:center; margin-bottom: 24px;">
                <img src="https://cdn-icons-png.flaticon.com/512/747/747376.png" width="48" alt="Security" />
              </div>

              <h2 style="margin-top:0;color:#111827;">Password Reset Notification</h2>

              <p style="font-size:16px;line-height:1.5;">
                Hello <strong>${userToReset.user_name}</strong>,<br /><br />
                This is to inform you that your password has been reset by the system administrator.
              </p>

              <table width="100%" cellpadding="14" cellspacing="0" border="0"
                style="background:#EFF6FF; border:1px solid #DBEAFE; border-radius:12px; margin:24px 0; font-size:15px; border-collapse: separate; border-spacing:0; overflow:hidden;">
                
                <tr>
                  <td width="35%" style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Name :
                  </td>
                  <td width="65%" style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${user.user_name}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold; border-bottom:1px solid #DBEAFE;">
                    Email Address :
                  </td>
                  <td style="color:#374151; border-bottom:1px solid #DBEAFE;">
                    ${user.user_email}
                  </td>
                </tr>

                <tr>
                  <td style="color:#1E3A8A; font-weight:bold;">
                    Phone Number :
                  </td>
                  <td style="color:#374151;">
                    ${user.user_phone || "<i>Not provided</i>"}
                  </td>
                </tr>

              </table>

              <p style="font-size:16px;line-height:1.5;">
                Please log in and change your password immediately if you did not request this action.
              </p>

              <p style="text-align:center;margin-top:32px;">
                <a href="${process.env.LOGIN_URL || "#"}"
                  style="background:#2563EB;color:#FFFFFF;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
                  Login to System
                </a>
              </p>

              <p style="margin-top:40px;font-size:14px;color:#6B7280;border-top:1px solid #E5E7EB;padding-top:20px;">
                Best regards,<br />
                <strong>IT Support Team</strong>
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
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

    const userResponse = user.toObject();
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
      { new: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const userResponse = user.toObject();
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

exports.exportUsersExcel = async (req, res) => {
  try {
    // 1. หา comp_id ของคนที่กำลังกด Export (ระบบ Tenant Isolation)
    const currentUser = await User.findById(req.user.id).select("comp_id");

    if (!currentUser || !currentUser.comp_id) {
      return res
        .status(403)
        .json({ success: false, message: "Company not found" });
    }

    // 2. ดึงข้อมูล User ทั้งหมด "เฉพาะในบริษัทเดียวกัน" เรียงจากสร้างใหม่ไปเก่า
    // 🚨 สำคัญมาก: .select("-user_password") เพื่อป้องกันไม่ให้ดึงรหัสผ่านที่เข้ารหัสไว้ออกมา
    // 💡 .populate("permissions") เผื่ออยากเอาชื่อสิทธิ์ต่างๆ ออกมาโชว์ด้วย
    const users = await User.find({ comp_id: currentUser.comp_id })
      .select("-user_password")
      .populate("permissions")
      .sort({ createdAt: -1 });

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No users found to export." });
    }

    // 3. สร้าง Workbook และ Worksheet
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users Data");

    // 4. กำหนดหัวตาราง (Columns)
    worksheet.columns = [
      { header: "Name", key: "user_name", width: 25 },
      { header: "Email", key: "user_email", width: 25 },
      { header: "Phone", key: "user_phone", width: 20 },
      { header: "Role", key: "user_role", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Permissions (Menu - Action)", key: "permissions", width: 40 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Password Changed At", key: "password_changed_at", width: 20 },
    ];

    // ตกแต่งหัวตารางให้เป็นตัวหนา
    worksheet.getRow(1).font = { bold: true };

    // 5. นำข้อมูลยัดใส่ทีละแถว
    users.forEach((u) => {
      // แปลง Array สิทธิ์การใช้งานให้ออกมาเป็นข้อความอ่านง่ายๆ (ถ้ามี)
      // ตัวอย่าง: "Customer-View, Customer-Edit, Product-View"
      const permissionList =
        u.permissions?.length > 0
          ? u.permissions
              .map((p) => `${p.permission_menu}-${p.permission_action}`)
              .join(", ")
          : "-";

      worksheet.addRow({
        user_name: u.user_name,
        user_email: u.user_email || "-",
        user_phone: u.user_phone || "-",
        user_role: u.user_role,
        // แปลง true/false เป็นข้อความ Active/Inactive
        status: u.status ? "Active" : "Inactive",
        permissions: permissionList,

        // จัดฟอร์แมตวันที่ให้สวยงาม
        createdAt: u.createdAt
          ? new Date(u.createdAt).toLocaleDateString("th-TH")
          : "-",
        password_changed_at: u.password_changed_at
          ? new Date(u.password_changed_at).toLocaleDateString("th-TH")
          : "Never",
      });
    });

    // 6. ตั้งค่า Header เพื่อให้ Browser สั่งดาวน์โหลดไฟล์ Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Users_Export.xlsx",
    );

    // 7. เขียนไฟล์และส่งออก
    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (err) {
    console.error("Export Users Excel Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error during export" });
  }
};

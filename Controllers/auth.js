const User = require("../models/User");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { token } = require("morgan");
const nodemailer = require("nodemailer");

exports.login = async (req, res) => {
  try {
    const { identifier, user_password } = req.body;

    console.log("req.body:", req.body);

    if (!identifier || !user_password) {
      return res.status(400).send("identifier or password missing");
    }

    const isEmail = identifier.includes("@");

    const user = await User.findOne(
      isEmail ? { user_email: identifier } : { user_name: identifier },
    );

    if (!user) {
      return res.status(400).send("User not found");
    }

    const isMatch = await bcrypt.compare(user_password, user.user_password);
    if (!isMatch) {
      return res.status(400).send("Password wrong");
    }

    const payload = {
      user: {
        id: user._id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
      (err, token) => {
        if (err) throw err;

        let forceChangePassword = false;

        if (user.user_role === "User" && user.password_changed_at === null) {
          forceChangePassword = true;
        }

        return res.json({
          success: true,
          token,
          user: {
            id: user._id,
            name: user.user_name,
            pass: user.user_password,
            email: user.user_email,
            role: user.user_role,
            phone: user.user_phone,
            status: user.status,
            permissionId: user.permission_id,
            companyId: user.comp_id,
          },
          forceChangePassword,
        });
      },
    );
  } catch (error) {
    console.log(error);
    return res.status(500).send("Server error");
  }
};

// exports.userForgotPassword = async (req, res) => {
//   try {
//     const { user_email } = req.body;

//     // 1. หาพนักงานที่กดปุ่มลืมรหัสผ่าน
//     const user = await User.findOne({ user_email: user_email });
//     if (!user) {
//       return res.status(404).json({ error: "Email not found" });
//     }

//     // 🟢 2. ค้นหา Admin ประจำบริษัทนั้น (ใช้ findOne เพราะมีคนเดียว)
//     const companyAdmin = await User.findOne({
//       comp_id: user.comp_id,
//       user_role: "Admin", // หรือเช็คชื่อ Role ตามที่ตกลงไว้
//       status: true, // เช็คให้ชัวร์ว่าบัญชี Admin นี้ยัง Active อยู่
//     });

//     // ถ้าบังเอิญระบบหา Admin ของบริษัทนี้ไม่เจอ
//     if (!companyAdmin) {
//       return res
//         .status(404)
//         .json({ error: "Admin not found for this company." });
//     }

//     if (!companyAdmin.user_email) {
//       return res.status(400).json({
//         error:
//           "System cannot send request because the Admin does not have an email address registered.",
//       });
//     }

//     // 3. ตั้งค่าระบบส่งอีเมล (ผู้ส่งคือระบบ)
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.ADMIN_EMAIL,
//         pass: process.env.ADMIN_PASS,
//       },
//     });

//     // 4. เตรียมข้อมูลจดหมาย
//     const mailOptions = {
//       from: `"System Alert" <${process.env.ADMIN_EMAIL}>`,
//       replyTo: user.user_email,
//       to: companyAdmin.user_email, // ส่งหา Admin
//       subject: `[Action Required] Password Reset Request: ${user.user_name}`,

//       // แบบ Text (เผื่อแอปอีเมลของ Admin ไม่รองรับ HTML)
//       text: `
// Hello Admin,

// The following employee has requested a password reset:

// Name: ${user.user_name}
// Email: ${user.user_email}
// Phone: ${user.user_phone || "Not provided"}

// Please proceed to the system to reset the password for this user.

// Thank you,
// IT Support Team
// `,

//       // แบบ HTML สวยงาม
//       html: `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8" />
// </head>

// <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#F3F4F6;">
//   <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
//     <tr>
//       <td align="center">

//         <table width="600" cellpadding="0" cellspacing="0"
//           style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);">

//           <tr>
//             <td style="background:#EF4444;padding:24px 36px;color:#FFFFFF;font-size:20px;font-weight:bold;">
//               Action Required
//             </td>
//           </tr>

//           <tr>
//             <td style="padding:40px 36px;color:#374151;">
//               <h2 style="margin-top:0;color:#111827;">Password Reset Request</h2>

//               <p style="font-size:16px;line-height:1.5;">
//                 Hello Admin,<br /><br />
//                 An employee has requested a password reset. Please review the details below and take appropriate action in the management dashboard.
//               </p>

//               <table width="100%" cellpadding="12" cellspacing="0"
//                 style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;margin:24px 0;font-size:15px;">
//                 <tr>
//                   <td width="30%" style="color:#991B1B;font-weight:bold;border-bottom:1px solid #FECACA;">Name :</td>
//                   <td style="border-bottom:1px solid #FECACA;">${user.user_name}</td>
//                 </tr>
//                 <tr>
//                   <td style="color:#991B1B;font-weight:bold;border-bottom:1px solid #FECACA;">Email Address :</td>
//                   <td style="border-bottom:1px solid #FECACA;">${user.user_email}</td>
//                 </tr>
//                 <tr>
//                   <td style="color:#991B1B;font-weight:bold;">Phone Number :</td>
//                   <td>${user.user_phone || "<i>Not provided</i>"}</td>
//                 </tr>
//               </table>

//               <p style="text-align:center;margin-top:32px;">
//                 <a href="${process.env.ADMIN_DASHBOARD_URL || "#"}"
//                   style="background:#DC2626;color:#FFFFFF;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
//                   Go to Management Dashboard
//                 </a>
//               </p>

//               <p style="margin-top:40px;font-size:14px;color:#6B7280;border-top:1px solid #E5E7EB;padding-top:20px;">
//                 This is an automated message. Please do not reply directly to this email.<br />
//                 <strong>System Support Team</strong>
//               </p>
//             </td>
//           </tr>

//         </table>

//       </td>
//     </tr>
//   </table>
// </body>
// </html>
//       `,
//     };

//     // 5. สั่งส่งจดหมาย
//     transporter.sendMail(mailOptions, (err, info) => {
//       if (err) {
//         console.log("Email Error:", err);
//         return res.status(500).json({ error: "Error sending email" });
//       }

//       return res.status(200).json({
//         message: "Forgot password request sent to admin.",
//       });
//     });
//   } catch (err) {
//     console.log("Server Error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };

exports.userForgotPassword = async (req, res) => {
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
      // Text version
      text: `
Admin,
User has requested a password reset.

User Details:
Username : ${user.user_name}
Email    : ${user.user_email}
Company  : ${companyInfo}
Role     : ${user.user_role}

Please login to the system and reset the password for this user manually.
Login URL: ${process.env.LOGIN_URL || "http://localhost:5173/"}
`,
      // HTML version
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>

<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
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

              <p>
                Hello <strong>Admin</strong>,<br /><br />
                User has requested a password reset. Please review the details below:
              </p>

              <table width="100%" cellpadding="10" cellspacing="0"
                style="background:#F1F5F9;border-radius:14px;margin:24px 0;">
                <tr>
                  
                  <td>
                    <strong style="color:#2563EB;">User Details:</strong><br/>
                    <hr style="border:0;border-top:1px solid #CBD5E1;margin:10px 0;" />
                    
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 15px;">
                      <tr>
                        <td width="90" style="padding-bottom: 6px;"><strong>Username:</strong></td>
                        <td style="padding-bottom: 6px; padding-left: 8px;">${user.user_name}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 6px;"><strong>Email:</strong></td>
                        <td style="padding-bottom: 6px; padding-left: 8px;">${user.user_email}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 6px;"><strong>Company:</strong></td>
                        <td style="padding-bottom: 6px; padding-left: 8px;">${companyInfo}</td>
                      </tr>
                      <tr>
                        <td><strong>Role:</strong></td>
                        <td style="padding-left: 8px;">${user.user_role}</td>
                      </tr>
                    </table>

                  </td>
                  </tr>
              </table>

              <p>
                Please login to the system and reset the password for this user manually.
              </p>

              <p style="text-align:center;margin-top:32px;">
                <a href="${process.env.LOGIN_URL || "http://localhost:5173/"}"
                  style="background:#2563EB;color:#FFFFFF;padding:14px 40px;border-radius:999px;text-decoration:none;font-weight:bold;">
                  Login to System
                </a>
              </p>

              <p style="margin-top:40px;font-size:14px;color:#6B7280;">
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

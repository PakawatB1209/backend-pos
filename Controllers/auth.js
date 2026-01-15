const User = require("../models/User");
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
      isEmail ? { user_email: identifier } : { user_name: identifier }
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

    jwt.sign(payload, "jwtsecret", { expiresIn: "12h" }, (err, token) => {
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
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Server error");
  }
};

exports.userForgotPassword = async (req, res) => {
  try {
    const { user_email } = req.body;

    const user = await User.findOne({ user_email: user_email });
    if (!user) {
      return res.status(404).json({ error: "Email not found" });
    }
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD, // Must verify identity
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `Forgot Password Request: ${user.user_name}`,
      text: `
Admin,

The following employee has requested a password reset:

Name: ${user.user_name}
Email: ${user.user_email}
Phone: ${user.user_phone}

Please proceed to reset the password for this user:
URL: (Pending URL for ${user._id})

Thank you.
`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Error sending email" });
      }

      return res.status(200).json({
        message: "Forgot password request sent to admin.",
      });
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { token } = require("morgan");
const nodemailer = require("nodemailer");

exports.login = async (req, res) => {
  try {
    const { user_name, user_password } = req.body;

    console.log("req.body:", req.body);

    if (!user_name || !user_password) {
      return res.status(400).send("username or password missing");
    }

    const user = await User.findOne({ user_name });

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

    jwt.sign(payload, "jwtsecret", { expiresIn: 3600 }, (err, token) => {
      if (err) throw err;
      return res.json({ token, payload });
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
Admin ครับ,

พนักงานคนนี้กดลืมรหัสผ่าน:

ชื่อ: ${user.user_name}
อีเมล: ${user.user_email}
เบอร์: ${user.user_phone}

กรุณาเข้าไปรีเซ็ตรหัสผ่านให้พนักงานคนนี้:
URL: รอURLของ${user._id}

ขอบคุณครับ
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

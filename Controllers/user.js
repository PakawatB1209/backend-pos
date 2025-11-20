const User = require("../models/User");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
require("dotenv").config();

exports.createUser = async (req, res) => {
  try {
    const { user_name, user_email, user_password, user_phone, comp_id } =
      req.body;

    // 1.Limited to no more than 3 per company
    const countUsers = await User.countDocuments({ comp_id });

    if (countUsers >= 3) {
      return res.status(400).json({
        error: "บริษัทนี้มีพนักงานครบ 3 คนแล้ว",
      });
    }

    // 2.CHECK Duplicate Email or Username

    const exists = await User.findOne({
      $or: [{ user_email }, { user_name }],
    });

    if (exists) {
      return res.status(400).json({ error: "user นี้มีอยู่แล้ว" });
    }

    // 3.Create User in MongoDB

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user_password, salt);
    console.log(hashedPassword);
    const newUser = await User.create({
      user_name,
      user_email,
      user_password: hashedPassword,
      user_phone,
      //   permission_id,
      comp_id,
      status: true,
    });
    return res.status(200).json({
      message: "User created",
      newUser,
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createUsersendEmail = async (req, res) => {
  try {
    const { user_name, user_email, user_password, user_phone, comp_id } =
      req.body;

    // 1.Limited to no more than 3 per company
    const countUsers = await User.countDocuments({ comp_id });

    if (countUsers >= 3) {
      return res.status(400).json({
        error: "บริษัทนี้มีพนักงานครบ 3 คนแล้ว",
      });
    }

    // 2. CHECK Duplicate Email or Username
    const exists = await User.findOne({
      $or: [{ user_email }, { user_name }],
    });

    if (exists) {
      return res.status(400).json({ error: "user นี้มีอยู่แล้ว" });
    }

    // 3) Create User in MongoDB

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user_password, salt);
    console.log(hashedPassword);
    const newUser = await User.create({
      user_name,
      user_email,
      user_password: hashedPassword,
      user_phone,
      //   permission_id,
      comp_id,
      status: true,
    });

    // 4.Send Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: user_email,
      subject: `User Email and Password for ${user_name}`,
      text: `
Hello ${user_name},
------------------
 USER ACCOUNT INFO
------------------
Username : ${newUser.user_name}
Email    : ${newUser.user_email}
Password : ${user_password}
Status   : ${newUser.status ? "Active" : "Inactive"}
Created  : ${newUser.createdAt}

Thank You.
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.status(500).json({ error: "Error sending email" });
      }

      console.log("Email sent:", info.response);

      return res.status(200).json({
        message: "User created & email sent successfully",
        newUser,
      });
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createAdminsendEmail = async (req, res) => {
  try {
    const { user_name, user_email, user_password } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user_password, salt);
    console.log(hashedPassword);
    const newUser = await User.create({
      user_name,
      user_email,
      user_password: hashedPassword,
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
      from: process.env.ADMIN_EMAIL,
      to: user_email,
      subject: `New Admin created for ${user_name}`,
      text: `
Hello ${user_name},
------------------
 Admin ACCOUNT INFO
------------------
Username : ${newUser.user_name}
Email    : ${newUser.user_email}
Password : ${user_password}
Status   : ${newUser.status ? "Active" : "Inactive"}
Created  : ${newUser.createdAt}

Thank You.
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.status(500).send("Error sending email");
      }

      console.log("Email sent:", info.response);
      return res.status(200).json({
        message: "Email sent successfully!",
      });
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.read = async (req, res) => {
  try {
    const id = req.params.id;
    const usered = await User.findOne({ _id: id }).populate("comp_id");
    //   .populate("permission_id");
    res.send(usered);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.list = async (req, res) => {
  try {
    const usered = await User.find()
      .populate("comp_id")
      .populate("permission_id");
    res.send(usered);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const update_user = await User.findOneAndUpdate({ _id: id }, req.body, {
      new: true,
    });
    res.send(update_user);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.updateUserbyuser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_name, user_email, user_password, user_phone } = req.body;

    // Check existing user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check duplicate username / email
    const exists = await User.findOne({
      _id: { $ne: id },
      $or: [{ user_email }, { user_name }],
    });

    if (exists) {
      return res.status(400).json({ error: "ข้อมูล user นี้ซ้ำ" });
    }

    // Update fields
    if (user_name) user.user_name = user_name;
    if (user_email) user.user_email = user_email;
    if (user_phone) user.user_phone = user_phone;
    if (user_password) {
      const salt = await bcrypt.genSalt(10);
      user.user_password = await bcrypt.hash(user_password, salt);
    }

    await user.save();
    return res.status(200).json({
      message: "User updated",
      user,
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.resetPassUserbyAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_password } = req.body;

    // Check existing user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update fields
    if (user_password) {
      const salt = await bcrypt.genSalt(10);
      user.user_password = await bcrypt.hash(user_password, salt);
    }

    await user.save();
    return res.status(200).json({
      message: "Reset Password",
      user,
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.resetPassUserbyAdmin_send = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user_password) {
      const salt = await bcrypt.genSalt(10);
      user.user_password = await bcrypt.hash(user_password, salt);
    }

    await user.save();

    //Send Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASS,
      },
    });

    const mailOptions = {
      from: process.env.ADMIN_EMAIL,
      to: user.user_email,
      subject: `Reset Password for ${user.user_name}`,
      text: `
Hello ${user.user_name},

Your password has been reset by Administrator.

------------------
  New Password
------------------
Password : ${user_password}
Updated  : ${user.updatedAt}

Thank You.
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.status(500).json({ error: "Error sending email" });
      }

      console.log("Email sent:", info.response);

      return res.status(200).json({
        message: "Password reset successfully and email sent.",
        user,
      });
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const remove_user = await User.findOneAndDelete({ _id: id });
    res.send(remove_user);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.removeall = async (req, res) => {
  try {
    const remove_user_all = await User.deleteMany({});
    res.send(remove_user_all);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

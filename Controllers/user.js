const User = require("../models/User");
const nodemailer = require("nodemailer");
require("dotenv").config();

exports.createUser = async (req, res) => {
  //   try {
  //     // const admin_id = req.user.id; // token
  //     // const admin = await User.findById(admin_id);

  //     // if (!admin) return res.status(404).send("Manager not found");
  //     // if (admin.role !== "manager") return res.status(403).send("Not allowed");

  //     const { user_name, user_email, phone, permission_id } = req.body;

  //     //const comp_id = admin.comp_id;

  //     // 1) Check user limit (max 3)
  //     const count = await User.countDocuments();
  //     if (count >= 4) {
  //       return res.status(400).send("This company already has 3 employees");
  //     }

  //     // 2) Check duplicate username/email
  //     const exists = await User.findOne({
  //       $or: [{ user_name }, { user_email }],
  //     });

  //     if (exists) {
  //       return res.status(400).send("Username or Email already exists");
  //     }

  //     // 5) Save employee
  //     const newUser = new User({
  //       user_name,
  //       user_email,
  //       user_password: hashed,
  //       permission_id,
  //       comp_id,
  //     });

  //     await newUser.save();

  //     return res.json({
  //       message: "Employee created",
  //       tempPassword: tempPass, // ส่งให้ admin เอาไปบอกพนักงาน
  //     });
  //   } catch (error) {
  //     console.log(error);
  //     return res.status(500).send("Server error");
  //   }

  try {
    console.log(req.body);
    const usered = await new User(req.body).save();
    res.send(usered);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.createUsersendEmail = async (req, res) => {
  try {
    const { user_name, user_email } = req.body;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: user_email,
      subject: `New account created for ${user_name}`,
      text: `Your account has been created successfully.`,
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
    const usered = await User.findOne({ _id: id })
      .populate("comp_id")
      .populate("permission_id");
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

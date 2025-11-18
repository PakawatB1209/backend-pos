import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // app password
    },
  });

  const mailOptions = {
    from: `POS System <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  return transporter.sendMail(mailOptions);
};

export const sendTempPassword = async (email, password) => {
  const html = `
    <h2>Jewelry POS</h2>
    <p>รหัสผ่านชั่วคราวของคุณคือ:</p>
    <h3>${password}</h3>
    <p>กรุณาเปลี่ยนรหัสทันทีหลังเข้าสู่ระบบ</p>
  `;

  await sendEmail(email, "Temporary Password", html);
};

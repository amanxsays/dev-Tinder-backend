require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "amanjhasahab07@gmail.com",
    pass: process.env.EMAIL_KEY
  },
});

const sendEmail=async (to,subject,text,html) => {
    try {
        const info = await transporter.sendMail({
            from: 'amanjhasahab07@gmail.com',
            to,
            subject,
            text,
            html
    });
    console.log("Mail sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error.message);
    }
};
module.exports ={sendEmail};

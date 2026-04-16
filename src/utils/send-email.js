// require("dotenv").config();
// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   //host: "smtp.gmail.com",
//   service:"gmail",
//   //port: 465,
//   //secure: true,
//   auth: {
//     user: "amanjhasahab07@gmail.com",
//     pass: process.env.EMAIL_KEY
//   },
// });

// const sendEmail=async (to,subject,text,html) => {
//     try {
//         const info = await transporter.sendMail({
//             from: '"DevTinder" <amanjhasahab07@gmail.com>',
//             to,
//             subject,
//             text,
//             html
//     });
//     console.log("Mail sent:", info.response);
//     } catch (error) {
//         console.error("Error sending email:", error.message);
//         throw error;
//     }
// };
// module.exports ={sendEmail};


require("dotenv").config();
const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ family: 4 });

const sendEmail = async (to, subject, text, html) => {
    try {
        const response = await axios.post(
            'https://mailserver.automationlounge.com/api/v1/messages/send',
            {
                to: to,
                subject: subject,
                html: html 
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PROMAIL_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                httpsAgent: httpsAgent
            }
        );

        console.log("Mail sent via Promailer API:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error sending API email:", error.response?.data || error.message);
        throw error;
    }
};

module.exports = { sendEmail };
require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, text, html) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "DevTinder <onboarding@resend.dev>",
      to,
      subject,
      text,
      html,
    });

    if (error) {
      console.error("❌ Resend error:", error);
      return { success: false, error };
    }

    console.log("✅ Email sent via Resend");
    console.log("Email ID:", data.id);

    return { success: true, id: data.id };
  } catch (err) {
    console.error("❌ Unexpected error:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail };

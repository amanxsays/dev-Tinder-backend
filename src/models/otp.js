const mongoose = require("mongoose");
const validater= require('validator');

const otpSchema = new mongoose.Schema(
  {
    emailId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate(value) {
        if (!validater.isEmail(value))
          throw new Error("Email id is invalid : " + value);
      },
    },
    otp: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Otp = mongoose.model("Otp", otpSchema);
module.exports = Otp;

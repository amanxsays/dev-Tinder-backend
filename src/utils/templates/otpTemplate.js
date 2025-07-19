const otpTemplate = (OTP) => {
  return `
<html>
<head>
  <meta charset="UTF-8">
  <title>Your OTP Code</title>
  <style>
    .container {
      max-width: 500px;
      margin: auto;
      padding: 20px;
      font-family: Arial, sans-serif;
      border: 1px solid #eee;
      border-radius: 8px;
      background-color: #f9f9f9;
    }
    .header {
      text-align: center;
      padding-bottom: 10px;
    }
    .otp {
      font-size: 32px;
      font-weight: bold;
      color: #2b6cb0;
      letter-spacing: 4px;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #777;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo" src="http://34.171.74.126/image.png" alt="DevTinder Logo" />
      <h2>Hello 👋🏻</h2>
      <p>Your One-Time Password (OTP) is:</p>
    </div>
    <div class="otp">${OTP}</div>
    <p style="text-align:center">Please use this code to verify your identity. This code is valid for 2 minutes.</p>
    <div class="footer">
      <p>If you did not request this, please ignore this email.</p>
      <p>— DevTinder Team</p>
    </div>
  </div>
</body>
</html>`

}

module.exports = otpTemplate;
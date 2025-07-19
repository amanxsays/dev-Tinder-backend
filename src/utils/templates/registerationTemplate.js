const registerationTemplate = (firstName,lastName) => {
  return `<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome to DevTinder</title>
  <style>
    .container {
      max-width: 600px;
      margin: auto;
      padding: 24px;
      font-family: Arial, sans-serif;
      border: 1px solid #ddd;
      border-radius: 8px;
      background-color: #f9f9f9;
      text-align: center;
    }
    .logo {
      width: 120px;
      margin-bottom: 20px;
    }
    .heading {
      color: #333;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="container">
    <img class="logo" src="http://34.171.74.126/image.png" alt="DevTinder Logo" />
    <h2 class="heading">🎉 Congratulations ${firstName} ${lastName} 👍🏻</h2>
    <p>You have successfully registered on <strong>DevTinder</strong> ✅</p>
    <p>Start discovering developers now 🚀</p>
    <div class="footer">
      <p>If you did not register, please ignore this email.</p>
      <p>— DevTinder Team</p>
    </div>
  </div>
</body>
</html>`
}

module.exports= registerationTemplate
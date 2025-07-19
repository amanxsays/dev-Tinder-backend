const notificationTemplate =()=>{
return `<html>
<head>
  <meta charset="UTF-8">
  <title>Pending Requests Reminder</title>
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
    .link-button {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background-color: #7ca3cbff;
      color: #fff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
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
    <h2 class="heading">👋🏻 You have some pending requests from yesterday!</h2>
    <p>Please take a moment to check them on <strong>DevTinder</strong>.</p>
    <a class="link-button" href="http://34.171.74.126" target="_blank">View Now</a>
    <div class="footer">
      <p>If you already viewed them, you can ignore this message.</p>
      <p>— DevTinder Team</p>
    </div>
  </div>
</body>
</html>`
}

module.exports=notificationTemplate
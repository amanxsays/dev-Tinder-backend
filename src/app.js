const express = require("express");
const path = require("path");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const statsRouter = require("./routes/stats");
const userRouter = require("./routes/user");
const cors = require("cors");
const { createCorsOptions } = require("./utils/corsOptions");
const http= require("http");
const initializeSocket = require("./utils/socket");
const chatRouter = require("./routes/chat");
const mobileAuthRouter = require('./routes/mobileAuth');
const pushRouter = require('./routes/push');
const aiRouter = require('./routes/ai');
const { startNotificationDispatcher } = require('./services/notificationDispatcher');
const { notificationsEnabled } = require('./services/notificationService');

require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();
require("./utils/cronjobs")

const corsOptions = createCorsOptions(process.env.FRONTEND_API_URL);
const app = express();
const server= http.createServer(app);
initializeSocket(server);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
// app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/", authRouter);
app.use('/', mobileAuthRouter);
app.use('/', pushRouter);
app.use('/', aiRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter);
app.use("/", statsRouter);
//Maintaining single responsibility principal

connectDB()
  .then(async () => {
    console.log("Connected To DB");
    if (notificationsEnabled()) {
      await Promise.all([require('./models/pushInstallation').init(), require('./models/notificationEvent').init()]);
    }
    const stopDispatcher = startNotificationDispatcher();
    process.once('SIGTERM', stopDispatcher);
    process.once('SIGINT', stopDispatcher);
    server.listen(process.env.PORT, () => {
      console.log("Server is listening");
    });
  })
  .catch((err) => {
    console.error("Failed to connect to DB" + err.message);
  });

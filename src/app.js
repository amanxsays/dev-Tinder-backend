const express= require('express');
const connectDB= require('./config/database')
const cookieParser= require('cookie-parser');
const authRouter= require("./routes/auth");
const profileRouter= require("./routes/profile");
const requestRouter= require("./routes/request");
const userRouter= require("./routes/user");
const cors= require('cors');
require("dotenv").config();

corsOptions = {
    origin: 'http://localhost:5173', // Allow only a specific origin
    credentials: true,            // Enable cookies and credentials
};
const app=express();

app.use(cors(corsOptions));
app.use(express.json()); 
app.use(cookieParser());

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);

connectDB().then(()=>{
    console.log("Connected To DB");
    app.listen(process.env.PORT , ()=>{
    console.log("Server is listening");
})
}).catch((err)=>{
    console.error("Failed to connect to DB"+err.message);
})


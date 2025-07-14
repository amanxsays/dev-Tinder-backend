const express= require('express');
const connectDB= require('./config/database')
const cookieParser= require('cookie-parser');
const authRouter= require("./routes/auth");
const profileRouter= require("./routes/profile");
const requestRouter= require("./routes/request");
const userRouter= require("./routes/user");

const app=express();

app.use(express.json()); 
app.use(cookieParser());

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);

connectDB().then(()=>{
    console.log("Connected To DB");
    app.listen(7777, ()=>{
    console.log("Server is listening");
})
}).catch((err)=>{
    console.error("Failed to connect to DB"+err.message);
})


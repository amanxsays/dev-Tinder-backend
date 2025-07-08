const express= require('express');

const app=express();

app.get("/",(req,res)=>{
    res.send("Reply from Server to Home Page")
})
app.get("/aman",(req,res)=>{
    res.send("Reply from Server to AMAN Page now")
})

app.listen(7777, ()=>{
    console.log("Server is listening");
})

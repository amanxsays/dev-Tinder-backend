const cron = require('node-cron');
const {subDays, startOfDay, endOfDay} = require('date-fns');
const ConnectionRequest = require('../models/connectionRequests');
const { sendEmail }= require("./send-email");
const notificationTemplate = require('./templates/notificationTemplate');

cron.schedule('0 10 * * *',async () => {
    //10 am everyday
  const toEmails=await findUsersHavingRequests();
  for(const to of toEmails){
    const res=await sendEmail(to,"Hiii User 👋🏻","",notificationTemplate());
}});

//data to whom we have to send mails: i.e those connection requests which are tagged as interested  and was of yesterday we need toUserId of that and then corres. email
const findUsersHavingRequests=async ()=>{
    const yesterday= subDays(new Date(),1);
    const yestStart= startOfDay(yesterday);
    const yestEnd= endOfDay(yesterday);
    const pendingRequests= await ConnectionRequest.find({
        status: "interested",
        createdAt:{
            $gte: yestStart,
            $lt: yestEnd
        }
    }).populate("toUserId");
    const emails=[... new Set(pendingRequests.map(req => req.toUserId.emailId))];
    return emails;
}
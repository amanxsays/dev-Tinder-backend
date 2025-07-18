const validater= require('validator');

const validateSignupData=(req)=>{
    const {firstName ,lastName ,emailId ,password} = req.body;
    if(!firstName) throw new Error("FirstName is invalid");
    if(!lastName) throw new Error("lastName is invalid");
    if(firstName.length > 20) throw new Error("firstName is too large");
    if(lastName.length > 20) throw new Error("lastName is too large");
    if(!validater.isEmail(emailId)) throw new Error("Email id is invalid : "+emailId);
    if(!validater.isStrongPassword(password)) throw new Error("Password is too weak: "+password);
}

const validateEditProfileData=(req)=>{
    const allowedKeys =["firstName","lastName","age","skills","gender","photoUrl","about"];
    const canUpdate=Object.keys(req.body).every( field => allowedKeys.includes(field));
    const {firstName ,lastName ,skills ,about} = req.body;

    if(!canUpdate) throw new Error("Can't update some sensitive fields i.e email or password !!!");
    if(firstName=='') throw new Error("FirstName is invalid");
    if(firstName && firstName.length > 20) throw new Error("firstName is too large");
    if(lastName && lastName.length > 20) throw new Error("lastName is too large");
    if(about && about.length>100) throw new Error("Your About is too long !!!");
    if(skills && skills.length>20) throw new Error("Your Skills are more than 20 !!!");
}

module.exports={validateSignupData, validateEditProfileData};
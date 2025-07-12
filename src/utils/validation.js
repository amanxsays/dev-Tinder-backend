const validateSignupData=(req)=>{
    const {firstName ,lastName ,emailId ,password} = req.body;
    if(!firstName) throw new Error("FirstName is invalid");
    else if(!lastName) throw new Error("lastName is invalid");
    else if(firstName.length > 20) throw new Error("firstName is too large");
    else if(lastName.length > 20) throw new Error("lastName is too large");
}

module.exports=validateSignupData;
const userCheck=(req,res,next)=>{
    const token = "xyzx";
    if(token==="xyz") next();
    else res.status(401).send("Unaothorized Login Attempt")
}

module.exports = {userCheck};
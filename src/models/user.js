const mongoose= require('mongoose');
const validater= require('validator');
const jwt= require('jsonwebtoken');
const bcrypt= require('bcrypt');

const userSchema= new mongoose.Schema({
    firstName:{
        type: String,
        required: true,
        maxLength: 20,
    },
    lastName:{
        type: String
    },
    emailId:{
        type: String,
        lowercase: true,
        required: true,
        unique: true,
        trim: true,
        validate(value){
            if(!validater.isEmail(value)) throw new Error("Email id is invalid : "+value);
        }
    },
    password:{
        type: String,
        required: true,
        validate(value){
            if(!validater.isStrongPassword(value)) throw new Error("Password is too weak: "+value);
        }
    },
    age:{
        type: Number,
        min: 18,
    },
    gender:{
        type: String,
    },
    photoUrl:{
        type: String,
        validate(value){
            if(!validater.isURL(value)) throw new Error("Image URL is invalid: "+value);
        }
    },
    about:{
        type: String
    },
    skills:{
        type: [String],
    }
},
{ timestamps: true}
);

userSchema.methods.getJWT= async function(){
    const user=this;
    const token = await jwt.sign({_id: user._id}, process.env.JWT_KEY ,{ expiresIn: "7d"});
    return token;
}

userSchema.methods.validatePass= async function(passwordInputByUser){
    const user=this;
    const isVerified=await bcrypt.compare(passwordInputByUser, user.password);
    return isVerified;
}

const User= mongoose.model("User", userSchema);

module.exports= User;
const mongoose= require('mongoose');
const validater= require('validator');

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
        validate(value){
            if(!["male","female","others"].includes(value)){
                throw new Error("Gender data is not valid");
            }
        }
    },
    photoUrl:{
        type: String,
        default: "https://cdn.pixabay.com/photo/2016/08/31/11/54/icon-1633249_1280.png",
        validate(value){
            if(!validater.isURL(value)) throw new Error("Image URL is invalid: "+value);
        }
    },
    skills:{
        type: [String],
    }
},
{ timestamps: true}
);

const User= mongoose.model("User", userSchema);

module.exports= User;
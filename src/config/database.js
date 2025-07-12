const mongoose= require('mongoose');

const connectDB=async ()=>{
    await mongoose.connect("mongodb+srv://amanxsays:kU7ftDyVQfihW2JP@namastenode.dfzkfmv.mongodb.net/devTinder");
}

module.exports = connectDB;

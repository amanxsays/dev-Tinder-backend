function userDto(user) {
    if (!user) return user;
    const result = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete result.password;
    delete result.otp;
    delete result.__v;
    return result;
}
module.exports = { userDto };

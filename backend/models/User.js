const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  profileImage: {
    type: String,  // Store the relative path to the uploaded image
    default: '/uploads/default-profile.png'  // Fallback profile image
  },
  // Other fields...
});

module.exports = mongoose.model('User', UserSchema);




const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  fullName: String,
  phone: String,
  pincode: String,
  state: String,
  city: String,
  addressLine: String,
  isDefault: { type: Boolean, default: false }
});

module.exports = mongoose.model('Address', addressSchema);

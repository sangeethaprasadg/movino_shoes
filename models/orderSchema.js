
const mongoose = require('mongoose');
const { Schema } = mongoose;


const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  size: {
    type: String,
    required: true
},
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request',  'Refunded', 'Returned','Return Rejected']
  },
  couponApplied: {
    type: Boolean,
    default: false
  }
});


const orderSchema = new Schema({
  orderId: {
    type: String,
    unique: true,
    default: () => `MOV${Date.now()}`
},
   user: {
     type: Schema.Types.ObjectId,
     ref: 'User',
     required: true
   },
   paymentMethod: {
     type: String,
     enum: ['COD', 'Razorpay', 'Wallet'],
     default: 'COD'
   },
   orderItems: [orderItemSchema],
   createdAt: {
     type: Date,
     default: Date.now
   },

  
  
   
 });
 

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;

// const mongoose = require('mongoose')
// const {Schema} = mongoose;


// const cartSchema = new Schema ({
//     userId:{
//         type:Schema.Types.ObjectId,
//         ref:"User",
//         required:true
//     },
//     items:[{
//         productId:{
//             type:Schema.Types.ObjectId,
//             ref:"Product",
//             required:true
//         },
//         quantity:{
//             type:Number,
//             default:1
//         },
//         price:{
//             type:Number,
//             required:true
//         },
//         totalPrice:{
//             type:Number,
//             required:true
//         },
//         // status:{
//         //     type:String,
//         //     default:'placed'
//         // },
//         // cancellationReason:{
//         //     type:String,
//         //     default:"none"
//         // }
//     }]
// })




//  cartSchema.pre("save", function (next) {
//     this.items.forEach((item) => {
//         item.totalPrice = item.quantity * item.price;
//     });
//     next();
// });


// const Cart = mongoose.model("Cart",cartSchema);
// module.exports = Cart;


const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
      
        quantity: {
            type: Number,
            default: 1,
            validate: {
                validator: Number.isInteger,
                message: '{VALUE} is not an integer value.'
            },
            min: [1, 'Quantity must be at least 1.']
        },
        price: {
            type: Number,
            required: true,
            default: 0
        },
        totalPrice: {
            type: Number,
            required: true,
            default: 0
        }
    }],
    status: {
        type: String,
        enum: ['active', 'placed', 'cancelled'],
        default: 'active',
    },
    cancellationReason: {
        type: String,
        default: 'none',
    }
}, { timestamps: true });

// Pre-save middleware to calculate totalPrice for each item
cartSchema.pre("save", function (next) {
    this.items.forEach((item) => {
        item.totalPrice = item.quantity * item.price;
    });
    next();
});

// Add indexes for faster querying
cartSchema.index({ userId: 1 });
cartSchema.index({ "items.productId": 1 });

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
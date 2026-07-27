const mongoose = require('mongoose')
const{ Schema }= mongoose;


const variantSchema = new Schema({
    size: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: true });

const productSchema = new mongoose.Schema({
  name:
   { type: String,
     required: true,
     index: true},

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
  },

  subcategory: 
  { type: String, 
    required: true },
  price: 
  { type: Number, 
    required: true },
  images: 
  { type: [String],
    //  required: true 
    },

stock: {
  type: Number,
  default: 0
},

variants: {
  type: [variantSchema],
  default: []
},


  description: 
  { type: String, 
    required: true,
    index: true },
  isDeleted:
   { type: Boolean,
     default: false },
  isListed: {
    type: Boolean,
    default: true
  },
  isBlocked: { 
    type: Boolean, 
    default: false },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
    // variants: [variantSchema], 
}, { timestamps: true });



// Method to search products by query string
productSchema.statics.searchProducts = function(query) {
  const filter = {};
  if (query) {
    filter.$or = [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ];
  }
  return this.find(filter);
};



const Product = mongoose.model("Product",productSchema)
module.exports = Product;
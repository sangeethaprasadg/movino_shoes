const mongoose = require('mongoose')
const {Schema} = mongoose;


const categorySchema = new mongoose.Schema({

    
    categoryName: {
      type: String,
      required: true,
    },
    subCategory: {
      type: String,
      required: true,
    },
    image: {
      type: String, 
      required: true,
    },
    isListed: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
    type: Boolean,
    default: false
},

isBlocked: {
    type: Boolean,
    default: false
},
   
   
  },
  { timestamps: true } // for createdAt and updatedAt
);





const Category = mongoose.model("Category",categorySchema);
module.exports = Category;
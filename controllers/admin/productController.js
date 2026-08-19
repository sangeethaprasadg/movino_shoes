const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");



const sharp = require('sharp');
const fs = require('fs');
const path = require('path');



// 1. GET all products

const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const searchQuery = req.query.search || '';

   // Fetch all products (listed and unlisted)
// Apply search filter only on product name.
const query = {
  name: {
    $regex: searchQuery,
    $options: "i",
  },
};

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

  

      const products = await Product.find(query)
      .populate('category') 
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);


    res.render('products/productList', {
      products,
      totalPages,
      currentPage: page,
      searchQuery,
      limit,
      error: req.query.error
    });

  } catch (err) {
    console.log(err);
    res.redirect("/admin/pageerror");
  }
};

// 2. GET add product form


const getAddProductForm = async (req, res) => {
  try {
    const categories = await Category.find({ isBlocked: false }); // Fetch categories from DB
    res.render('products/addProduct', {
      categories, 
      error: req.query.error,
      exists: req.query.exists
    });
  } catch (error) {
    console.error('Error loading add product form:', error);
    res.status(500).send("Server Error");
  }
};



// 3. POST add new product



const postAddProduct = async (req, res) => {
  try {
    const { name, category, subcategory, price,description,size,variantStock } = req.body;
//already existing
    const existing = await Product.findOne({ name: name.trim() });
    if (existing) {
      return res.redirect('/admin/products/add?exists=true');
    }
    // Check if at least 3 images are uploaded
    if (!req.files || req.files.length < 3) {
    
      return res.redirect('/admin/products/add?error=minimumImages');
    }

    // const images = req.body.images;
    const images = req.files.map(file => file.filename);

 
const variants = [];

if (size  && variantStock) {
    for (let i = 0; i < size.length; i++) {

        if (
            size[i] &&
            
            variantStock[i] !== ""
        ) {
            variants.push({
                size: size[i],
                
                stock: Number(variantStock[i])
            });
        }
    }
}


// Calculate total stock

const totalStock = variants.reduce((sum, variant) => {
    return sum + variant.stock;
}, 0);



    const newProduct = new Product({
      name,
      category,
      subcategory,
      price,
      images,
      description,
      stock: totalStock,
      variants,
    });


    console.log(variants);
    await newProduct.save();

    // Pass success message via query string
    res.redirect('/admin/products?added=success');
  } catch (error) {
    console.error('Error adding product:', error);
    res.redirect('/admin/products/add?error=server');
  }
};


// 4. GET edit product form


const editProductForm = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found');

    // Fetch all categories
    const categories = await Category.find(); 

    // Render the editProduct view with product, categories, error, and exists
    res.render('products/editProduct', {
      product,
      categories,
      error: req.query.error,
      exists: req.query.exists
    });

  } catch (error) {
    console.error('Error fetching product for edit:', error);
    res.status(500).send('Server Error');
  }
};







const updateProduct = async (req, res) => {
  try {


    const productId = req.params.id;
    const { name, category: categoryId, subcategory, price, description,size, variantStock} = req.body;






    // Convert category name to ObjectId
    // const categoryDoc = await Category.findOne({ categoryName: categoryId });

    const categoryDoc = await Category.findById(categoryId);

    if (!categoryDoc) {
      return res.status(400).send('Invalid category selected');
    }



    // Check if product exists
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      console.log('No product found with ID:', productId);
      return res.status(404).send('Product not found');
    }

    // Check for duplicate product name
    const nameExists = await Product.findOne({ name: name.trim(), _id: { $ne: productId } });

const variants = [];

const sizes = Array.isArray(size) ? size : [size];
const stocks = Array.isArray(variantStock)
    ? variantStock
    : [variantStock];


if (size && variantStock) {
   for (let i = 0; i < sizes.length; i++) {

       if (sizes[i] && stocks[i] !== "") {
    variants.push({
        size: sizes[i],
        stock: Number(stocks[i])
    });
}
    }
}

const totalStock = variants.reduce((sum, variant) => {
    return sum + variant.stock;
}, 0);



    if (nameExists) {
      return res.redirect(`/admin/products/edit/${productId}?exists=true`);
    }




    // Prepare updated fields
    const updatedFields = {
      name: name || existingProduct.name,
      category: categoryDoc._id || existingProduct.category,
      subcategory: subcategory || existingProduct.subcategory,
      price: price || existingProduct.price,
      description: description || existingProduct.description,
      stock: totalStock,
      variants: variants,
    };

    




    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log("New images uploaded:", req.files.length);


  if (req.files.length < 3) {
    // Stop and show error only if they tried to replace with less than 3 new images
    return res.redirect(`/admin/products/edit/${productId}?error=minImages`);
  }
// if (req.files && req.files.length > 0) {
//   if (req.files.length < 3) {
//     return res.redirect(`/admin/products/edit/${productId}?error=minImages`);
//   }

  // Delete old images
  if (existingProduct.images && existingProduct.images.length > 0) {
    existingProduct.images.forEach(img => {
      const imgPath = path.join(__dirname, '../public/uploads/products', img);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    });
  }

  // Save new images filenames from req.files
  updatedFields.images = req.files.map(file => file.filename);

} else {
  // No new images uploaded, keep existing images
  updatedFields.images = existingProduct.images;
}


    // Update product in database
    await Product.findByIdAndUpdate(productId, updatedFields, { new: true });

    res.redirect('/admin/products?updated=success');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send('Internal Server Error');
  }
};



// Unlist product (Soft Delete)
// Product is hidden from users but remains in the database.

const unlistProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    await Product.findByIdAndUpdate(productId, {
      isListed: false,
    });

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error unlisting product:", error);
    res.status(500).send("Internal Server Error");
  }
};


// 7. GET deleted products
const viewDeletedProducts = async (req, res) => {
  try {
    const deletedProducts = await Product.find({ isDeleted: true });
   
    res.render('products/deletedProduct', { deletedProducts });
  } catch (error) {
    console.error('Error fetching deleted products:', error);
    res.status(500).send('Server Error');
  }
};

// 8. GET recover soft-deleted product

// List Product
// Makes an unlisted product visible again on the user side.
const listProduct = async (req, res) => {
  try {

    const productId = req.params.id;

    const product = await Product.findById(productId).populate("category");



    if (!product) {
      return res.status(404).send("Product not found");
    }

    if (!product.category.isListed) {
      return res.redirect("/admin/products?error=category-unlisted");
    }

    product.isListed = true;
    await product.save();

    res.redirect("/admin/products");

  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};



//search option with reset

const searchProducts = async (req, res) => {
  const query = req.query.query || '';  // Default to an empty string if no query is passed
  
  try {
      // Call the search method from the Product model
      const products = await Product.searchProducts(query);

      // Render the 'products' view with products and query
      res.render('shop', {
          products: products,
          query: query
      });
  } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
  }
};



// add variants 

const getProductVariants = async (req, res) => {

    try {

        const product = await Product.findById(req.params.id);

        if (!product) {

            return res.status(404).json({
                success: false,
                message: "Product not found"
            });

        }

        res.json({

            success: true,
            productName: product.name,
            totalStock: product.stock,
            variants: product.variants

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false
        });

    }

};

   

// Exporting all functions
module.exports = {
  getAllProducts,
  getAddProductForm,
  postAddProduct,
  editProductForm,
  updateProduct,
  unlistProduct,
  viewDeletedProducts,
  listProduct,
  searchProducts,
  getProductVariants,
  

  
};





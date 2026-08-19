const express = require('express')
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require('../controllers/admin/orderController'); 



const {userAuth,adminAuth} = require("../middlewares/auth")
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema");


const upload = require('../middlewares/multer');
const { uploadCategory, uploadProduct } = require('../middlewares/multer');

const resizeProductImages = require('../middlewares/imageResize');



// const multer = require("multer");
// const path = require("path");






//============Admin Auth ===============
router.get("/pageerror",adminController.pageerror)
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/',adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);



//===========customer management============

// router.get("/users",adminAuth,customerController.customerInfo);
router.post("/toggle-status/:id", adminAuth, customerController.toggleUserStatus);
router.get("/users", adminAuth, customerController.getUsers);
router.patch("/users/:id/block", customerController.toggleBlockUser);








//============category management===========//

// List, Search, Pagination,block,unblock




router.get("/categories", adminAuth,categoryController.getCategories);

// Add category
router.get("/categories/add",adminAuth, categoryController.addCategoryPage);
// router.post("/categories/add",adminAuth, upload.single("image"), categoryController.addCategory);
router.post("/categories/add", adminAuth, uploadCategory.single("image"), categoryController.addCategory);


// Edit category
router.get("/categories/edit/:id", adminAuth,categoryController.editCategoryPage);

router.post("/categories/edit/:id", adminAuth, uploadCategory.single("image"), categoryController.editCategory);

// Soft delete
router.post(
  "/categories/toggle-list/:id",
  adminAuth,
  categoryController.toggleCategoryListing
);









//================== Product Management ==================//
// Show form to add product
router.get('/products/add', adminAuth, productController.getAddProductForm);

// Handle product creation

router.post('/products/add', adminAuth, uploadProduct.array('images', 5), resizeProductImages, productController.postAddProduct);

// List active products
router.get('/products', adminAuth, productController.getAllProducts);

// Soft delete a product
router.get('/products/unlist/:id', adminAuth, productController.unlistProduct);

// Edit product form
router.get('/products/edit/:id', adminAuth, productController.editProductForm);

// Handle edit post

router.post('/products/edit/:id', adminAuth, uploadProduct.array('images', 5), resizeProductImages, productController.updateProduct);

// View deleted products
router.get('/products/deleted', adminAuth, productController.viewDeletedProducts);


// List product again
router.get('/products/list/:id', adminAuth, productController.listProduct);


//add variants

router.get('/products/variants/:id',adminAuth, productController.getProductVariants);









// ================== Order Management ==================

router.get('/orders', adminAuth, orderController.listOrders); // ✅ List all orders
router.get('/orders/:orderId', adminAuth, orderController.viewOrderDetails); // ✅ View single order
router.post(
    "/orders/update-status/:orderId/:itemId",
    orderController.updateOrderStatus
); // ✅ Update status
router.post('/orders/verify-return/:orderId/:itemId', adminAuth, orderController.verifyReturnRequest); // ✅ Verify return request


module.exports = router;

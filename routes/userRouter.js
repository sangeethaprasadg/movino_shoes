const express = require('express')
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require('../config/passport');
const productController = require('../controllers/admin/productController');
const cartController = require('../controllers/user/cartController');
const wishlistController = require('../controllers/user/wishlistController');
const orderController = require('../controllers/user/orderController');


const {userAuth,adminAuth} = require("../middlewares/auth")


const multer = require('multer');
const path = require('path');


// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/uploads/users/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
      }
    });
    const upload = multer({ storage });

    router.post('/upload-profile-image', userAuth, upload.single('profileImage'), userController.uploadProfileImage);




router.get("/pageNotFound",userController.pageNotFound);

//hoempage and shopping page
router.get('/',userController.loadHomepage);
router.get('/shop',userController.getShopPage); //for shopping products



router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp)


router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}));
router.get("/auth/google/callback",passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
});

router.get("/login",userController.loadLogin);
router.post("/login",userController.login);

router.get('/logout', userController.logout);  // Logout route


router.get('/products', productController.searchProducts);

router.get('/product-detail/:id', userController.getProductDetail);



//profile page

router.get('/profile', userAuth, userController.loadProfile);
router.post("/remove-profile-image", userController.removeProfileImage);
router.get('/edit-profile', userController.getEditProfile);
router.post('/edit-profile', userController.postEditProfile);

//edit profile
router.post('/update-name', userAuth, userController.updateName); //updatename

router.post('/send-otp', userAuth, userController.sendOTP);
router.post('/verify-email-otp', userAuth, userController.verifyEmailOTP);

router.post('/change-password',userAuth, userController.changePassword);














//forgot password
router.get("/forgot-password",userAuth, userController.loadForgotPassword);
router.post("/forgot-password", userController.handleForgotPassword);
router.get("/verify-forgot-otp", userController.loadForgotOtp);
router.post("/verify-forgot-otp", userController.verifyForgotOtp);
router.get("/reset-password", userController.loadResetPassword);
router.post("/reset-password", userController.handleResetPassword);






//address

router.get('/address', userAuth,userController.viewAddress);
router.post('/address/add',userAuth, userController.addAddress);
router.post('/address/edit/:id',userAuth, userController.editAddress);
router.post('/address/delete/:id',userAuth, userController.deleteAddress);
router.post('/address/default/:id',userAuth, userController.setDefaultAddress);




//cart management
router.get("/cart", userAuth, cartController.loadCartPage);
router.post("/cart/add/:id", userAuth, cartController.addToCart);
router.post("/cart/remove/:id", userAuth, cartController.removeFromCart);
router.post("/cart/update-quantity/:id", userAuth, cartController.updateCartQuantity);

//wishlist

router.get('/wishlist', userAuth,wishlistController.viewWishlist);
router.get('/wishlist/add/:id', userAuth,wishlistController.addToWishlist);
router.get('/wishlist/remove/:id', userAuth,wishlistController.removeFromWishlist);
router.post('/wishlist/remove/:id', userAuth,wishlistController.removeFromWishlist);





//checkout

router.get('/checkout', userAuth, userController.checkoutPage);
// Save address (both add and edit)
router.post('/save-address', userAuth,userController.saveAddress);
router.post('/edit-address', userController.editAddressCheckout);
router.post('/delete-address/:id', userAuth, userController.deleteAddressCheckout);


//order complete

router.post('/place-order', userAuth,orderController.placeOrder);
router.get('/order-complete/:orderId', orderController.getOrderCompletePage);
// router.get('/order/:orderId', orderController.getOrderCompletePage);





//order-details page
router.get('/order/:orderId', userAuth, orderController.getOrderDetails);
router.post('/cancel-item/:orderId/:itemId', userAuth, orderController.cancelOrderItem);


//order listing page

router.get('/my-orders', userAuth, orderController.getUserOrders);


// router.post('/return-order/:orderId', userAuth, orderController.returnOrder);//return request
router.post('/return-order/:orderId/:itemId', userAuth, orderController.returnOrder);


router.get('/invoice/:orderId', userAuth, orderController.downloadInvoice);
router.get('/search-order', userAuth, orderController.searchOrder);






//wallet management




router.get('/wallet', userController.walletPage);


module.exports = router;
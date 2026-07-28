const User = require("../../models/userSchema");
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt')
const Product = require('../../models/productSchema'); 
const crypto = require('crypto');

const Category = require('../../models/categorySchema');
const Address = require('../../models/addressSchema'); 
const Cart = require('../../models/cartSchema');
const Wallet = require('../../models/walletSchema');





const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;

        // Fetch 6 latest active products
        // const products = await Product.find({ isDeleted: false }).limit(6);
        const products = await Product.find({
            isDeleted: false,
            isListed: true,
            status: "Active"
          }).limit(4);
       
          console.log('Homepage products fetched:', products.map(p => ({ id: p._id.toString(), isDeleted: p.isDeleted })));
      if (user) {
            const userData = await User.findOne({ _id: user._id });
            return res.render("home", { user: userData, products }); // Pass products here
        } else {
            return res.render('home', { user: null, products }); // Also pass products when no user
        }
    } catch (error) {
        console.log("Error in loading homepage:", error);
        res.status(500).send('Server error');
    }
};




const loadSignup = async (req, res) => {
    try {
        return res.render("signup");
    } catch (error) {
        console.log('Signup Page not loading:', error);
        res.status(500).send('Server Error');
    }
};

//function to generate 0tp

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); //random 6 digit generation

}
//defining function
async function sendVerificationEmail(email,otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });
       
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP IS ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        });

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}


const signup = async (req, res) => {

    try {
        const { name,email, password } = req.body;
        const cPassword = req.body['confirm-password'];
        
         if (password !== cPassword) {

            return res.render("signup", { message: "Passwords do not match" });
        }
        //checking the user so for that fetching the user from database

      
        const findUser = await User.findOne({ email });
        console.log("👤 User found:", findUser);
        if (findUser) {
            return res.render('signup', { message: "User with this email already exists" });
        }

        //otp generation
        const otp = generateOtp();
        console.log("Generated OTP:", otp);


        const emailSent = await sendVerificationEmail(email, otp);
        console.log("Email Sent Status:", emailSent); 

        if (!emailSent) {
            console.error("Email sending failed");
            return res.json("email.error");
        }

        req.session.userOtp = otp;
        req.session.userData = { name,email, password };

        res.render("verify-otp"); 
        console.log("OTP Sent", otp);

    } catch (error) {
        console.error("signup error", error);
        res.redirect("/pageNotFound");
    }
};

const securePassword = async(password)=>{
    try {
        
        const passwordHash = await bcrypt.hash(password,10)

        return passwordHash;


    } catch (error) {
        
    }
}


//otp verification

const verifyOtp = async (req,res)=>{
    try {
        const {otp}=req.body;
      

       
        console.log("Entered OTP:", otp);
        console.log("Session OTP:", req.session.userOtp)

     if(otp===req.session.userOtp){
        const user = req.session.userData
        //secure the password
        const passwordHash = await securePassword(user.password);


        //save user data to database
        const saveUserData = new User({
            name:user.name,
            email:user.email,
            password:passwordHash,

        })

        await saveUserData.save();

        // Store user ID in session after successful signup
        // req.session.user = saveUserData._id;

    
          // Clear OTP and user data from session after successful verification
          req.session.userOtp = null;
          req.session.userData = null;
       


  // Redirect to login page with success message
 
    //       // Redirect to homepage
    console.log({ success: true, redirectUrl: "/login" });
    return res.json({ success: true, redirectUrl: "/login" });
    
   

 
     }else{
        res.status(400).json({success:false,message:"Invalid OTP,Please try again"})     //invalid otp
     }

    } catch (error) {
        console.error("Error verifying OTP",error);
        res.status(500).json({success:false,message:"An error occured"})

        
    }
}


//resend otp
const resendOtp = async (req,res)=>{
    try {
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const otp = generateOtp();
        req.session.userOtp = otp;


        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp)
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP.Please try again"})
        }
    } catch (error) {
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal Server Error.Please try again"})
    }
}


const loadLogin = async(req,res)=>{
try {
    console.log("Session User:", req.session.user); // Debugging log
    if(!req.session.user){
        return res.render("login")
    }else{
        res.redirect("/")
    }
} catch (error) {
    res.redirect("/pageNotFound")
    console.error
}
}





const pageNotFound = async (req, res) => {
    try {
        res.render("page-404");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};




const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render("login", { message: "User not found" });
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect Password" });
        }

        req.session.user = findUser; // Store the whole user object in session
        res.redirect("/"); // Redirect to the homepage after login
    } catch (error) {
        console.error("Login error", error);
        res.render("login", { message: "Login failed, try again later" });
    }
};



const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/login');  // Redirect to login page after logout
    });
};




const getShopPage = async (req, res) => {
    try {
      // Get filter parameters from query string
      const query = req.query.query || '';
      const sort = req.query.sort || '';
      const selectedCategory = req.query.category || '';
      const selectedSubCategory = req.query.subCategory || '';
      const priceMin = req.query.priceMin ? Number(req.query.priceMin) : '';
      const priceMax = req.query.priceMax ? Number(req.query.priceMax) : '';
  
      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 8; // Products per page
      const skip = (page - 1) * limit;
  
      // Build the query object for MongoDB
      const filterQuery = {};

      // Show only listed and active products on the user shop page.
filterQuery.isDeleted = false;
filterQuery.isListed = true;
filterQuery.status = "Active";
  
      // Text search if query parameter exists
      if (query) {
        filterQuery.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ];
      }
  
//    category and subcategory filter

   // Category Filter
// Product stores category as ObjectId.
// So first find the category document, then filter using its _id.

if (selectedCategory) {

    const category = await Category.findOne({
        categoryName: selectedCategory
    });

    if (category) {
        filterQuery.category = category._id;
    }
}

// Subcategory is stored as a string,
// so regex filtering is fine.

if (selectedSubCategory) {

    filterQuery.subcategory = {
        $regex: `^${selectedSubCategory}$`,
        $options: "i"
    };

}




    
  
      // Price range filter
      if (priceMin !== '' || priceMax !== '') {
        filterQuery.price = {};
        if (priceMin !== '') filterQuery.price.$gte = priceMin;
        if (priceMax !== '') filterQuery.price.$lte = priceMax;
      }
  
      // Build sort options
      const sortOptions = {
        'low-to-high': { price: 1 },
        'high-to-low': { price: -1 },
        'a-z': { name: 1 },
        'z-a': { name: -1 },
      }[sort] || { createdAt: -1 }; // Default sort by createdAt
  
      // Fetch filtered products with pagination and sorting
      const totalProducts = await Product.countDocuments(filterQuery);
      const totalPages = Math.ceil(totalProducts / limit);
  
      const products = await Product.find(filterQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        // .populate('category')
        .lean();
      
        // console.log('Fetched Products:', products);


      // Fetch all listed categories for filters
      const categories = await Category.find({ status: 'listed' }).lean();


   // Fetch subcategories dynamically based on selected category
   let subCategories = [];
   if (selectedCategory) {
     const category = await Category.findOne({ name: selectedCategory });
     
     
     if (category) {
       subCategories = category.subCategories; // Assuming category has a 'subCategories' field
     }
   }





 

      // Render the shop page with required data
      res.render('shop', {
        title: 'Shop',
        user: req.session.user || null, // Pass user object to the view
        products,
        categories,
        subCategories, // Pass subcategories for dynamic dropdown
        query,
        sort,
        selectedCategory,
        selectedSubCategory,
        priceMin,
        priceMax,
        currentPage: page,
        totalPages,
        totalProducts,
        categoriesJson: JSON.stringify(categories), // Pass categories for client-side JS
      });
    } 
catch (error) {
  console.error("========== SHOP ERROR ==========");
  console.error(error);
  console.error("================================");

  res.send(error.message);
}


  };
  
 





const getProductDetail = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId)
   
    .populate('category')  // <<-- This is key to access isBlocked from category
    .lean();


    

    if (!product) {
      return res.status(404).render('404', { message: 'Product not found' });
    }





// Check if categoryId is missing
if (!product.category) {
  console.warn("⚠️ Product has no valid categoryId or category not found.");
}

console.log(product);
console.log(product.variants);
    res.render('product-detail', { 
      product ,
      user: req.session.user || null,
      error: req.query.error 
    });
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).send("Internal Server Error");
  }
};


//PROFILE 

const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    // const imagePath = "/uploads/users/" + req.file.filename;
    const imagePath = `/uploads/users/${req.file.filename}`;

    await User.findByIdAndUpdate(userId, {
      profileImage: imagePath
    });

    // Update session image if you’re showing image from session
    req.session.user.profileImage = imagePath;

    res.redirect('/profile');
  } catch (err) {
    console.error("Profile image upload failed:", err);
    res.status(500).send("Server error");
   
  }
};

//forgot password



const sendOtpMail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        // service: "Gmail",
        // auth: {
        //     user: "your_email@gmail.com",
        //     pass: "your_app_password", // App password from Gmail
        // },
        service: 'gmail',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.NODEMAILER_EMAIL,
        to: email,
        subject: "Your OTP for Password Reset",
        text: `Your OTP code is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);
};


       



const loadForgotPassword = (req, res) => {
    res.render("forgotPassword"); 
};

const handleForgotPassword = async (req, res) => {
    const email = req.body.email;

    // Validate email and check if user exists
    const user = await User.findOne({ email: email });
    if (!user) {
        return res.render("forgotPassword", { error: "Email not found" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.forgotOtp = otp;
    req.session.resetEmail = email;


    console.log("Generated OTP:", otp);
    // Send OTP via email (replace with your mailer)
    await sendOtpMail(email, otp);
   
    res.redirect("/verify-forgot-otp");
};


const loadForgotOtp = (req, res) => {
    res.render("verifyForgotOtp", { error: null });
};

const verifyForgotOtp = (req, res) => {
    const { otp } = req.body;
    const sessionOtp = req.session.forgotOtp;

    if (otp === sessionOtp) {
        // OTP verified
        return res.redirect("/reset-password");
    } else {
        return res.render("verifyForgotOtp", { error: "Invalid OTP" });
    }
};


const loadResetPassword = (req, res) => {
    res.render("resetPassword");
};

const handleResetPassword = async (req, res) => {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.render("resetPassword", { error: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.updateOne({ email: req.session.resetEmail }, { $set: { password: hashedPassword } });

    // Clear session values
    req.session.resetEmail = null;
    req.session.forgotOtp = null;

   res.json({
    success: true,
    message: "Password changed successfully!"
});
};





//  Edit Profile page


const getEditProfile = (req, res) => {
    const user = req.session.user; 
    if (!user) {
        return res.redirect('/login'); 
    }
    res.render('edit-profile', { user });
};

const postEditProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const userId = req.session.user.id; 

   
        await User.findByIdAndUpdate(userId, { name, email });

      
        req.session.user.name = name;
        req.session.user.email = email;

        res.redirect('/profile'); 
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Internal Server Error');
    }
};
const updateName = async (req, res) => {
    try {
        const userId = req.session.user._id;
        let { name } = req.body;

        name = name.trim();

        if (!name) {
            return res.json({
                success: false,
                message: "Name is required"
            });
        }

        if (name.length < 3 || name.length > 30) {
            return res.json({
                success: false,
                message: "Name must be between 3 and 30 characters"
            });
        }

        const nameRegex = /^[A-Za-z ]+$/;

        if (!nameRegex.test(name)) {
            return res.json({
                success: false,
                message: "Name can contain only letters and spaces"
            });
        }

        await User.findByIdAndUpdate(userId, { name });

        req.session.user.name = name;

        res.json({
            success: true,
            updatedName: name
        });

    } catch (error) {
        console.error(error);

        res.json({
            success: false,
            message: "Something went wrong"
        });
    }
};






// Generate and Send OTP
const sendOTP = async (req, res) => {


    try {
        let { email } = req.body;
        email = email.trim().toLowerCase();

        const userId = req.session.user._id;

        // Current user
        const currentUser = await User.findById(userId);

        // Empty validation
        if (!email) {
            return res.json({
                success: false,
                message: "Email is required"
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        // Same email validation
        if (currentUser.email === email) {
            return res.json({
                success: false,
                message: "This is already your current email"
            });
        }

        // Duplicate email validation
        const existingUser = await User.findOne({
            email,
            _id: { $ne: userId }
        });

        if (existingUser) {
            return res.json({
                success: false,
                message: "Email already exists"
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        req.session.otp = otp;
        req.session.newEmail = email;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify Your Email",
            text: `Your OTP is ${otp}`
        });

        console.log("OTP:", otp);

        res.json({
            success: true,
            message: "OTP sent successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};



// Verify OTP and Update Email
const verifyEmailOTP = async (req, res) => {
  try {
      const { otp, email } = req.body;

      if (parseInt(req.session.otp) === parseInt(otp) && req.session.newEmail === email) {
          const userId = req.session.user._id;

          // Update in DB
          await User.findByIdAndUpdate(userId, { email });
          req.session.user.email = email;

          // Clear session
          req.session.otp = null;
          req.session.newEmail = null;

         res.json({
    success: true,
    updatedEmail: email
});
      } else {
          res.status(400).json({ success: false, message: 'Invalid OTP or Email' });
      }
  } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
};



// password





const changePassword = async (req, res) => {
  try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
          return res.status(400).json({ success: false, message: 'Please provide all fields' });
      }

      if (newPassword.length < 6) {
          return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }

      const user = req.user;

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
          return res.status(400).json({ success: false, message: 'Incorrect current password' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
      console.error('Change Password Error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
};

//address



const viewAddress = async (req, res) => {
    const userId = req.session.user._id;
  
    const addresses = await Address.find({ userId });
  
    const defaultAddress = addresses.find(addr => addr.isDefault === true);
    const otherAddresses = addresses.filter(addr => addr.isDefault !== true);
  

    // console.log('Default Address:', defaultAddress);

    res.render('address', {
      user: req.session.user,
      defaultAddress,
      otherAddresses
    });
  };



const addAddress = async (req, res) => {
    try {
      const { fullName, phone, pincode, state, city, addressLine } = req.body;
      const userId = req.session.user._id;
  
      await Address.create({
        userId,
        fullName,
        phone,
        pincode,
        state,
        city,
        addressLine
      });
  
      res.redirect('/address');
    } catch (error) {
      console.error(error);
      res.status(500).send('Something went wrong');
    }
  };
  

const editAddress = async (req, res) => {
  await Address.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/address');
};

const deleteAddress = async (req, res) => {
  await Address.findByIdAndDelete(req.params.id);
  res.redirect('/address');
};

const setDefaultAddress = async (req, res) => {
  const userId = req.session.user._id;
  const addressId = req.params.id;
  await Address.updateMany({ userId }, { $set: { isDefault: false } });
  await Address.findByIdAndUpdate(addressId, { isDefault: true });
  res.redirect('/address');
};


//checkout 

const checkoutPage = async (req, res) => {
    try {
      const userId = req.session.user?._id;
  
      if (!userId) {
        return res.redirect('/login');
      }
  
      // ✅ Use Cart model to fetch items
      const cart = await Cart.findOne({ userId, status: 'active' }).populate('items.productId');
  
      if (!cart || cart.items.length === 0) {
        return res.render('checkout', {
          user: req.session.user,
          cartItems: [],
          otherAddresses: [],
          totalPrice: 0
        });
      }
  
      const addresses = await Address.find({ userId });
  
      let totalPrice = 0;
      cart.items.forEach(item => {
        if (item.productId) {
          totalPrice += item.productId.price * item.quantity;
        }
      });
  
      res.render('checkout', {
        user: req.session.user,
        cartItems: cart.items,
        otherAddresses: addresses,
        totalPrice
      });
  
    } catch (err) {
      console.error("Checkout page error:", err.message);
      res.status(500).send("Error loading checkout page");
    }
  };
  
  

  const saveAddress = async (req, res) => {
    try {
      const data = req.body;
      const userId = req.session.user?._id;
  
      if (!userId) {
        return res.status(401).send('Unauthorized');
      }
  
      if (data._id) {
        //  Edit existing address
        await Address.updateOne(
          { _id: data._id, userId },
          {
            fullName: data.fullName,
            addressLine: data.addressLine,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
            phone: data.phone
          }
        );
      } else {
        // ➕ Add new address
        await Address.create({
          userId,
          fullName: data.fullName,
          addressLine: data.addressLine,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          phone: data.phone,
          isDefault: false
        });
      }
  
      res.redirect('/checkout');
    } catch (err) {
      console.error('Error saving address:', err);
      res.status(500).send('Something went wrong');
    }
  };
  


  

const editAddressCheckout = async (req, res) => {
  try {
    const { _id, fullName, addressLine, city, state, pincode, phone } = req.body;

    await Address.findByIdAndUpdate(_id, {
      fullName,
      addressLine,
      city,
      state,
      pincode,
      phone
    });

    res.redirect('/checkout'); // Or wherever your address page is
  } catch (err) {
    console.error('Edit Address Error:', err);
    res.status(500).send('Internal Server Error');
  }
};

const deleteAddressCheckout = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const addressId = req.params.id;

    if (!userId) {
      return res.redirect('/login');
    }

    // Delete only if it belongs to the logged-in user
    await Address.deleteOne({ _id: addressId, userId });

    res.redirect('/checkout');
  } catch (err) {
    console.error("Delete address error:", err);
    res.status(500).send("Something went wrong while deleting address");
  }
};

  

//wallet


// const walletPage = async (req, res) => {
//   try {

//       const userId = req.session.user._id;
//       const user = await User.findById(userId); 

//       if (!user) {
//         return res.redirect('/login'); // or any fallback
//       }

    

//       res.render('wallet', { user });
//   } catch (error) {
//       console.error('Error loading wallet:', error);
//       res.redirect('/profile'); // fallback
//   }
// };




const walletPage = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const wallet = await Wallet.findOne({ user: userId });

    res.render('wallet', {
      user: req.session.user,
      balance: wallet?.balance || 0,
      transactions: wallet?.transactions || []
    });

  } catch (err) {
    console.error('❌ Error loading wallet page:', err);
    res.status(500).send('Server error loading wallet');
  }
};



module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    getShopPage,
    getProductDetail,
    loadForgotPassword,
    handleForgotPassword,
    loadForgotOtp,
    verifyForgotOtp,
    sendOtpMail,
    loadResetPassword,
    handleResetPassword,
    getEditProfile,
    postEditProfile,
    updateName,
    changePassword,
    sendOTP,
    verifyEmailOTP,
    viewAddress,
    addAddress,
    editAddress,
    deleteAddress,
    setDefaultAddress,
    checkoutPage,
    saveAddress,
    editAddressCheckout,
    deleteAddressCheckout,
    uploadProfileImage,
    walletPage
   



   

};
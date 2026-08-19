const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const Category = require('../../models/categorySchema');
const { validateCartItems } = require('../../helpers/cartValidation');



const loadCartPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId })
    .populate("items.productId", "name images price") // Ensure price is populated
    .lean();
        if (!cart || cart.items.length === 0) {
            return res.render("cart", { user: req.session.user, cartItems: [], totalPrice: 0 });
        }

        // Calculate total price
        const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

        res.render("cart", {
            user: req.session.user,
            cartItems: cart.items,
            totalPrice,
        });
    } catch (error) {
        console.error("Error loading cart page:", error);
        res.status(500).send("Internal Server Error");
    }
};




const addToCart = async (req, res) => {

    if (!req.session.user) {
        return res.status(401).send('Unauthorized: Please log in first.');//checking whether the user is login or not
      }
    const userId = req.session.user._id;
    const productId = req.params.id;

    const { size, quantity } = req.body;

  


    const from = req.query.from;
  
  
    const product = await Product.findById(productId).populate('category');

    
if (!product) {
    return res.redirect(`/product-detail/${productId}?error=unavailable`);
}

    if (!size) {
    return res.redirect(`/product-detail/${productId}?error=selectsize`);
}

const validationResult = await validateCartItems([
    {
        product: product._id,
        size: size,
        quantity: Number(quantity)
    }
]);

if (!validationResult.valid) {

    if (from === 'wishlist') {
        return res.redirect('/wishlist?error=outofstock');
    }

    return res.redirect(
        `/product-detail/${productId}?error=unavailable`
    );
}









const selectedVariant = product.variants.find(
    variant => variant.size === size
);

if (!selectedVariant) {
    return res.redirect(`/product-detail/${productId}?error=invalidsize`);
}
  

if (!product || product.isBlocked || product.category?.isBlocked) {
  return res.status(400).json({ success: false, message: "Product's category is blocked or unavailable." });
}

 // 🚨 New check: If stock is zero, don't add to cart


// 🚨 Check the selected size's stock
if (selectedVariant.stock <= 0) {

    if (from === 'wishlist') {

        return res.redirect('/wishlist?error=outofstock');
    } else {

        return res.redirect(`/product-detail/${productId}?error=outofstock`);
    }
}







    let cart = await Cart.findOne({ userId });

const totalProductQuantity = cart
    ? cart.items
        .filter(item => item.productId.toString() === productId)
        .reduce((total, item) => total + item.quantity, 0)
    : 0;





    
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
  
const item = cart.items.find(
    i =>
        i.productId.toString() === productId &&
        i.size === size
);
  

if (item) {

    item.quantity += Number(quantity);

    // Maximum 5 products per user
   if (totalProductQuantity + Number(quantity) > 5) {
   return res.redirect(`/product-detail/${productId}?error=maxlimit`);
}

   if (item.quantity > selectedVariant.stock) {

    if (from === 'wishlist') {
        return res.redirect('/wishlist?error=outofstock');
    }

    return res.redirect(
        `/product-detail/${productId}?error=outofstock`
    );
}
}





    else {

        if (totalProductQuantity + Number(quantity) > 5) {
   return res.redirect(`/product-detail/${productId}?error=maxlimit`);
}
    
cart.items.push({
    productId,
    size,
    quantity: Number(quantity),
    price: product.price,
    totalPrice: product.price * Number(quantity)
});



    }
  
    // Remove from wishlist
    const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      wishlist.items = wishlist.items.filter(i => i.productId.toString() !== productId);
      await wishlist.save();
    }
  
    await cart.save();

  // ✅ Conditional redirect
  if (from === 'product') {
    res.redirect('/cart');
  } else {
    res.redirect('/wishlist?cart=added');
  }
};


   

  




const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.params.id;
        const { size } = req.body;

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            return res.status(404).json({ message: "Cart not found." });
        }

        // Remove the item
     cart.items = cart.items.filter(item =>
    !(
        item.productId._id.toString() === productId &&
        item.size === size
    )
);
        await cart.save();

        // Recalculate the new total
        const updatedTotal = cart.items.reduce((sum, item) => {
            return sum + item.productId.price * item.quantity;
        }, 0);

        // Respond with the new total as JSON
        res.json({ cartTotal: updatedTotal });

    } catch (error) {
        console.error("Error removing from cart:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};







const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.params.id;
        const { change,size } = req.body;

        const cart = await Cart.findOne({ userId });
        if (!cart) return res.status(404).send("Cart not found.");

        const cartItem = cart.items.find(item => item.productId.toString() === productId && item.size === size);
        if (!cartItem) return res.status(404).send("Product not in cart.");

// First update the quantity
cartItem.quantity += change;

// Maximum quantity limit
if (cartItem.quantity > 5) {
   return res.status(400).send("Maximum 5 units allowed per product.");
}

        if (cartItem.quantity <= 0) {
    cart.items = cart.items.filter(item =>
        !(
            item.productId.toString() === productId &&
            item.size === size
        )
    );

        } else {
           const product = await Product.findById(productId);

const selectedVariant = product.variants.find(
    variant => variant.size === size
);

if (!selectedVariant) {
    return res.status(400).send("Invalid size.");
}

if (cartItem.quantity > selectedVariant.stock) {
    return res.status(400).send("Exceeds stock availability.");
}

cartItem.totalPrice = cartItem.quantity * product.price;
        }

        await cart.save();

        const updatedCart = await Cart.findOne({ userId }).lean();
        const cartTotal = updatedCart.items.reduce((sum, i) => sum + i.totalPrice, 0);

        res.json({
            newQuantity: cartItem.quantity,
            newTotalPrice: cartItem.totalPrice,
            cartTotal
        });
    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).send("Internal Server Error");
    }
};

// wishlist

// cartController.js





module.exports = {
    loadCartPage,
    addToCart,
    removeFromCart,
    updateCartQuantity,
};

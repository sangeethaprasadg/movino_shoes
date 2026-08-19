const Product = require('../models/productSchema');

const validateCartItems = async (cartItems) => {

    for (const item of cartItems) {

        // Support both add-to-cart object and actual cart item
        const productId = item.productId || item.product;

        const product = await Product.findById(productId);

        // Product doesn't exist
        if (!product) {
            return {
                valid: false,
                message: 'One of the products in your cart is no longer available.'
            };
        }


        // Product deleted
        if (product.isDeleted === true) {
            return {
                valid: false,
                message: `${product.name} is no longer available.`
            };
        }


        // Product unlisted
        if (product.isListed === false) {
            return {
                valid: false,
                message: `${product.name} is currently unavailable.`
            };
        }


        // Product inactive
        if (
            product.status &&
            product.status !== 'Active'
        ) {
            return {
                valid: false,
                message: `${product.name} is currently unavailable.`
            };
        }


        // Find selected variant
        const variant = product.variants.find(
            v => String(v.size) === String(item.size)
        );


        if (!variant) {
            return {
                valid: false,
                message: `${product.name} - selected size is no longer available.`
            };
        }


        // Stock is zero
        if (variant.stock <= 0) {
            return {
                valid: false,
                message: `${product.name} is out of stock.`
            };
        }


        // Requested quantity greater than current stock
        if (variant.stock < Number(item.quantity)) {
            return {
                valid: false,
                message: `${product.name} has only ${variant.stock} item(s) available.`
            };
        }

    }


    return {
        valid: true
    };

};


module.exports = {
    validateCartItems
};
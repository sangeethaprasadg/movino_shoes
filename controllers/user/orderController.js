const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const { v4: uuidv4 } = require('uuid'); // ensure this is at the top
const PDFDocument = require('pdfkit');

//order complete

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?._id;
   

    if (!userId) {
      return res.status(401).send("User not authenticated");
    }

    const addressId = req.body.addressId;
    if (!addressId) {
      // return res.status(400).send("Address is required");
      return res.status(400).json({ error: "Address is required" });
    }

    const cart = await Cart.findOne({ userId, status: "active" }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).send("Cart is empty");
    }
for (const item of cart.items) {
  const product = await Product.findById(item.productId._id);

  if (!product || product.stock < item.quantity) {
    return res.status(400).send(
      `${product?.name || "Product"} is out of stock or does not have enough quantity available.`
    );
  }
}




    const orderItems = cart.items.map((item) => {
      const price = item.productId.price;
      const totalPrice = item.quantity * price;

      return {
        product: item.productId._id,
        size: item.size,
        quantity: item.quantity,
        price,
        totalPrice,
        finalAmount: totalPrice,
        address: addressId,
        status: "Pending",
        invoiceDate: new Date(),
        createdOn: new Date(),
      };
    });

    const newOrder = new Order({
      user: userId,
      orderItems,
      paymentMethod: "COD", // ✅ add this
      createdAt: new Date()
    });

    const savedOrder = await newOrder.save();
// Reduce variant stock
for (const item of cart.items) {

  

    const product = await Product.findById(item.productId._id);

    const selectedVariant = product.variants.find(
        variant => variant.size === item.size
    );
 


    if (!selectedVariant) {
        throw new Error(`Invalid size selected for ${product.name}`);
    }

    selectedVariant.stock -= item.quantity;

    product.stock = product.variants.reduce(
        (total, variant) => total + variant.stock,
        0
    );

    await product.save();
}

    // Clear Cart
    await Cart.deleteOne({ _id: cart._id });

   
    res.redirect(`/order-complete/${savedOrder.orderId}`);

  } catch (err) {
    console.error("Error placing order:", err);
    res.status(500).send("Something went wrong while placing the order.");
  }
};







const getOrderCompletePage = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }) // ✅ Correct: Match by UUID
      .populate('orderItems.product');

    if (!order) {
      return res.status(404).send('Order not found1');
    }

    res.render('order-complete', { order,
      user: req.session.user
     });
  } catch (err) {
    console.error("Error loading order complete page:", err);
    res.status(500).send('Internal server error');
  }
};






const returnOrder = async (req, res) => {

  try {
    const { reason } = req.body;
    const { orderId, itemId } = req.params;
    // Get the order using orderId from the URL
    const order = await Order.findOne({ orderId });




    if (!order) {
      return res.status(404).send('Order not found2');
    }

    // Find the specific item inside the order
    const item = order.orderItems.find(item => item._id.toString() === itemId);

    if (!item) {
      return res.status(404).send('Item not found in order');
    }

    // Only allow return if status is Delivered
    if (item.status !== 'Delivered') {
      return res.status(400).send('Only delivered items can be returned');
    }

    // Mark the item as returned and store reason
    item.returnRequested = true;
    item.returnReason = reason;
    item.status = 'Return Request'; // optional

    // Save the updated order
    await order.save();
    
    return res.redirect(`/order/${orderId}?returnSuccess=true`);


    
  } catch (error) {
    console.error("❌ Error in returnOrder:", error);
    return res.status(500).send('Server error');
  }
};


const downloadInvoice = async (req, res) => {

  const order = await Order.findOne({ orderId: req.params.orderId }).populate('orderItems.product')

  const doc = new PDFDocument();
  res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  doc.fontSize(18).text('Invoice', { align: 'center' });
  doc.text(`Order ID: ${order.orderId}`);
  // doc.text(`Date: ${order.orderDate.toDateString()}`);
  doc.text(`Date: ${order.createdAt.toDateString()}`);


  // order.products.forEach(p => {
    order.orderItems.forEach(item => {

    // doc.text(`${p.productId.name} - Qty: ${p.quantity} - ₹${p.price}`);
    doc.text(`${item.product.name} - Qty: ${item.quantity} - ₹${item.price}`);

  });

  doc.text(`Total: ₹${order.totalAmount}`);
  doc.end();
};





const searchOrder = async (req, res) => {
    const { orderId } = req.query;
    const userId = req.session.user._id;
    const order = await Order.findOne({ orderId, user: userId });
    if (!order) return res.render('order-search', { message: 'No order found' });
    res.redirect(`/order/${orderId}`);
  };
  




  
//order listing

const getUserOrders = async (req, res) => {
  try {
    const userId = req.session.user?._id;

    if (!userId) {
      return res.redirect('/login');
    }

    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 }); // latest first

    res.render('my-orders', { orders , user: req.session.user}); // adjust view path if needed
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).send("Internal Server Error");
  }
};






const cancelOrderItem = async (req, res) => {




  try {
    const { orderId, itemId } = req.params;
    const reason = req.body.reason || 'No reason given';


   

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).send('Order not found3');

    const item = order.orderItems.id(itemId);
    if (!item) return res.status(404).send('Item not found');

    // Check if already cancelled
    if (item.status === 'Cancelled') {
      return res.status(400).send('Item already cancelled');
    }

    item.status = 'Cancelled';

    // Optional: Save cancellation reason somewhere
    item.cancellationReason = reason;

    // ✅ Increment product stock
    
    const product = await Product.findById(item.product);

if (product) {

   

    const selectedVariant = product.variants.find(
        variant => variant.size === item.size
    );

   

    if (selectedVariant) {
        selectedVariant.stock += item.quantity;
    }

    product.stock = product.variants.reduce(
        (total, variant) => total + variant.stock,
        0
    );

    await product.save();
}



// ✅ Save the updated order
await order.save();




    
    // ✅ This is already correct - using order.orderId
    res.redirect(`/order/${order.orderId}?cancelled=true`);
  } catch (err) {
    console.error("Error cancelling item:", err);
    res.status(500).send("Internal server error");
  }
};


const getOrderDetails = async (req, res) => {
  try {

    const cancelled = req.query.cancelled === 'true';
   
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('orderItems.product');

    console.log("Order fetched from DB:", order); // ✅ Log result

    if (!order) return res.status(404).send('Order not found4');

    res.render('order-detail', { order,cancelled });
  } catch (err) {
    console.error("Error loading order detail page:", err);
    res.status(500).send('Internal server error');
  }
};

module.exports = {
    placeOrder,
    getOrderCompletePage,
    returnOrder,
    downloadInvoice,
    searchOrder ,
    getUserOrders,
    cancelOrderItem,
    getOrderDetails
}
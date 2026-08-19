const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema'); // if needed for user info
const Wallet = require('../../models/walletSchema'); // if you have a wallet model
const Product = require('../../models/productSchema'); // adjust path based on your folder structure


//earch, filter, sorting, and pagination.

const listOrders = async (req, res) => {
    try {
      const { search = '', status = '', sort = 'desc', page = 1, limit = 5 } = req.query;
  
      const query = {};
  
     if (search) {

    // Find users whose names match the search
    const users = await User.find({
        name: { $regex: search, $options: "i" }
    }).select("_id");

    const userIds = users.map(user => user._id);

    query.$or = [
        {
            orderId: {
                $regex: search,
                $options: "i"
            }
        },
        {
            user: {
                $in: userIds
            }
        }
    ];
}
  
      if (status) {
        query['orderItems.status'] = status;
      }
  
      const skip = (page - 1) * limit;
  
     let orders = await Order.find(query)
    .populate('user')
    .sort({ createdAt: sort === 'asc' ? 1 : -1 })
    .skip(skip)
    .limit(limit);


// Calculate overall order status

orders.forEach(order => {

    const statuses = order.orderItems.map(item => item.status);

    // All items have the same final status
    if (statuses.every(status => status === "Delivered")) {

        order.displayStatus = "Delivered";

    } else if (statuses.every(status => status === "Cancelled")) {

        order.displayStatus = "Cancelled";

    } else if (statuses.every(status => status === "Shipped")) {

        order.displayStatus = "Shipped";

    } else if (statuses.every(status => status === "Returned")) {

        order.displayStatus = "Returned";

    } else if (statuses.every(status => status === "Refunded")) {

        order.displayStatus = "Refunded";

    } else {

        // Any mixed / Processing / Pending status
        // means the order is still ongoing
        order.displayStatus = "Pending";

    }

});












const total = await Order.countDocuments(query);
    
      res.render('orders/list', {
        orders,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        search,
        status,
        sort
      });
  
    } catch (err) {
      console.error("Error listing orders:", err);
      res.status(500).send("Internal Server Error");
    }
  };
  




// 2. View order details


const viewOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('user')
      .populate('orderItems.product');

    if (!order) return res.status(404).send("Order not found");

    res.render('orders/detail', { order });
  } catch (err) {
    console.error("Error loading order detail:", err);
    res.status(500).send("Internal Server Error");
  }
};




// 3. Update order status (pending, shipped, delivered, etc.)
const updateOrderStatus = async (req, res) => {

  try {

    const { orderId, itemId } = req.params;
    const { status } = req.body;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Find the selected item
    const item = order.orderItems.id(itemId);

    if (!item) {
      return res.status(404).send("Item not found");
    }

    // Update only this item
    item.status = status;

    await order.save();

    res.redirect(`/admin/orders/${order.orderId}`);

  } catch (err) {

    console.error("Error updating order status:", err);

    res.status(500).send("Internal Server Error");

  }

};





const verifyReturnRequest = async (req, res) => {
 
  try {
    const { orderId, itemId } = req.params;
    const { action } = req.body;  // ✅ Get accept/reject from body

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).send("Order not found");

    const item = order.orderItems.id(itemId);
    if (!item) return res.status(400).send("Order item not found");

    if (item.status !== 'Return Request') {
      return res.status(400).send("Invalid return request");
    }

    if (action === 'reject') {
      item.status = 'Return Rejected';
      await order.save();
      return res.redirect(`/admin/orders/${orderId}`);
    }

    // Refund process
    const userId = order.user;
    const refundAmount = item.finalAmount;

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: [],
      });
    }

    wallet.balance += refundAmount;
    wallet.transactions.push({
      amount: refundAmount,
      type: 'credit',
      description: `Refund for returned item in order ${orderId}`,
    });

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



    item.status = 'Refunded';

    await wallet.save();
    await order.save();

    res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error("Error verifying return:", err);
    res.status(500).send("Internal Server Error");
  }
};






module.exports = {
  listOrders,
  viewOrderDetails,
  updateOrderStatus,
  verifyReturnRequest
};

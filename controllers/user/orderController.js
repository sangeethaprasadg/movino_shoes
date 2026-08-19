const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const { v4: uuidv4 } = require('uuid'); // ensure this is at the top
const PDFDocument = require('pdfkit');
const Address = require('../../models/addressSchema');

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


    // Final product and stock validation before placing order
for (const item of cart.items) {

    const product = await Product.findById(item.productId._id);

    // Product no longer exists
    if (!product) {
        return res.status(400).send(
            "One of the products in your cart is no longer available."
        );
    }

    // Product is deleted
    if (product.isDeleted) {
        return res.status(400).send(
            `${product.name} is no longer available.`
        );
    }

    // Product is unlisted
    if (!product.isListed) {
        return res.status(400).send(
            `${product.name} is currently unavailable.`
        );
    }

    // Product is inactive
    if (product.status !== "Active") {
        return res.status(400).send(
            `${product.name} is currently unavailable.`
        );
    }

    // Find the exact selected variant
    const selectedVariant = product.variants.find(
        variant => String(variant.size) === String(item.size)
    );

    // Variant no longer exists
    if (!selectedVariant) {
        return res.status(400).send(
            `${product.name} - selected size is no longer available.`
        );
    }

    // Stock completely finished
    if (selectedVariant.stock <= 0) {
        return res.status(400).send(
            `${product.name} is out of stock.`
        );
    }

    // Current stock is less than cart quantity
    if (selectedVariant.stock < item.quantity) {
        return res.status(400).send(
            `${product.name} has only ${selectedVariant.stock} item(s) available.`
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
 
    c


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

  try {

    // =========================
    // GET ORDER
    // =========================

    const order = await Order.findOne({
      orderId: req.params.orderId
    }).populate('orderItems.product');

    if (!order) {
      return res.status(404).send("Order not found");
    }


    // =========================
    // GET ACTIVE ITEMS
    // CANCELLED ITEMS EXCLUDED
    // =========================

    const activeItems = order.orderItems.filter(
      item => item.status !== "Cancelled"
    );


    // =========================
    // GET ADDRESS
    // =========================

    let address = null;

    if (activeItems.length > 0 && activeItems[0].address) {

      address = await Address.findById(
        activeItems[0].address
      );

    }


    // =========================
    // CALCULATE TOTAL
    // =========================

    let totalAmount = 0;

    activeItems.forEach(item => {

      const itemTotal =
        Number(item.finalAmount) ||
        Number(item.totalPrice) ||
        (
          Number(item.price || 0) *
          Number(item.quantity || 0)
        );

      totalAmount += itemTotal;

    });


    // =========================
    // CREATE PDF
    // =========================

    const doc = new PDFDocument({
      size: "A4",
      margin: 45
    });


    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Movino-Invoice-${order.orderId}.pdf`
    );

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    doc.pipe(res);


    // =========================
    // COLORS
    // =========================

    const primary = "#339999";
    const dark = "#222222";
    const grey = "#666666";
    const lightGrey = "#F5F7F7";
    const border = "#D9D9D9";


    // =========================
    // HEADER
    // =========================

    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text("MOVINO", 45, 45);

    doc
      .fillColor(grey)
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Premium Footwear",
        47,
        77
      );


    doc
      .fillColor(dark)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(
        "INVOICE",
        430,
        50
      );


    doc
      .moveTo(45, 100)
      .lineTo(550, 100)
      .strokeColor(primary)
      .lineWidth(2)
      .stroke();


    // =========================
    // ORDER INFORMATION
    // =========================

    doc
      .fillColor(dark)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        "ORDER INFORMATION",
        45,
        125
      );

    doc
      .fillColor(grey)
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Order ID: ${order.orderId}`,
        45,
        145
      )
      .text(
        `Order Date: ${order.createdAt.toLocaleDateString("en-IN")}`,
        45,
        161
      )
      .text(
        `Payment Method: ${order.paymentMethod || "COD"}`,
        45,
        177
      );


    // =========================
    // SHIPPING ADDRESS
    // =========================

    doc
      .fillColor(dark)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        "DELIVERY ADDRESS",
        315,
        125
      );


   if (address) {

  doc
    .fillColor(grey)
    .font("Helvetica")
    .fontSize(9);

  doc.text(
    address.fullName || "",
    315,
    145,
    {
      width: 220
    }
  );

  doc.text(
    address.addressLine || "",
    315,
    162,
    {
      width: 220,
      lineGap: 2
    }
  );

  doc.text(
    `${address.city || ""}, ${address.state || ""}`,
    315,
    195,
    {
      width: 220
    }
  );

  doc.text(
    `PIN: ${address.pincode || ""}`,
    315,
    212
  );

  doc.text(
    `Phone: ${address.phone || ""}`,
    400,
    212
  );

} else {

  doc
    .fillColor(grey)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Delivery address unavailable",
      315,
      145
    );

}


    // =========================
    // TABLE
    // =========================

    const tableTop = 245;

    // Table header

    doc
      .rect(
        45,
        tableTop,
        505,
        32
      )
      .fill(primary);


    doc
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(
        "PRODUCT",
        55,
        tableTop + 11
      )
      .text(
        "SIZE",
        285,
        tableTop + 11
      )
      .text(
        "QTY",
        340,
        tableTop + 11
      )
      .text(
        "UNIT PRICE",
        380,
        tableTop + 11
      )
      .text(
        "TOTAL",
        490,
        tableTop + 11
      );


    // =========================
    // PRODUCTS
    // =========================

    let currentY = tableTop + 32;


    if (activeItems.length === 0) {

      doc
        .fillColor(grey)
        .font("Helvetica")
        .fontSize(10)
        .text(
          "All items in this order have been cancelled.",
          55,
          currentY + 15
        );

      currentY += 50;

    } else {

      activeItems.forEach((item, index) => {

        const itemTotal =
          Number(item.finalAmount) ||
          Number(item.totalPrice) ||
          (
            Number(item.price || 0) *
            Number(item.quantity || 0)
          );


        // Alternate row background

        if (index % 2 === 0) {

          doc
            .rect(
              45,
              currentY,
              505,
              42
            )
            .fill(lightGrey);

        }


        doc
          .fillColor(dark)
          .font("Helvetica")
          .fontSize(8.5);


        // Product

        doc.text(
          item.product?.name || "Product",
          55,
          currentY + 15,
          {
            width: 215,
            ellipsis: true
          }
        );


        // Size

        doc.text(
          item.size || "-",
          285,
          currentY + 15
        );


        // Quantity

        doc.text(
          String(item.quantity || 0),
          340,
          currentY + 15
        );


        // Unit price

        doc.text(
         `₹${Number(item.price || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`,
          380,
          currentY + 15
        );


        // Total

        doc.text(
      `₹${itemTotal.toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`,
          490,
          currentY + 15
        );


        // Row border

        doc
          .moveTo(
            45,
            currentY + 42
          )
          .lineTo(
            550,
            currentY + 42
          )
          .strokeColor(border)
          .lineWidth(0.5)
          .stroke();


        currentY += 42;

      });

    }


    // =========================
    // TOTAL SECTION
    // =========================

    currentY += 25;


    doc
      .moveTo(
        350,
        currentY
      )
      .lineTo(
        550,
        currentY
      )
      .strokeColor(border)
      .lineWidth(1)
      .stroke();


    currentY += 20;


    doc
      .fillColor(grey)
      .font("Helvetica")
      .fontSize(10)
      .text(
        "Subtotal:",
        400,
        currentY
      );


    doc
      .fillColor(dark)
      .text(
        `₹${totalAmount.toFixed(2)}`,
        490,
        currentY
      );


    currentY += 25;


    doc
      .moveTo(
        350,
        currentY
      )
      .lineTo(
        550,
        currentY
      )
      .strokeColor(primary)
      .lineWidth(1.5)
      .stroke();


    currentY += 20;


    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(
        "GRAND TOTAL:",
        370,
        currentY
      );


    doc
      .text(
        `₹${totalAmount.toFixed(2)}`,
        490,
        currentY
      );


    // =========================
    // PAYMENT INFORMATION
    // =========================

    currentY += 55;


    doc
      .fillColor(dark)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        "PAYMENT INFORMATION",
        45,
        currentY
      );


    currentY += 18;


    doc
      .fillColor(grey)
      .font("Helvetica")
      .fontSize(9)
      .text(
        `Payment Method: ${order.paymentMethod || "COD"}`,
        45,
        currentY
      );


    // =========================
    // FOOTER
    // =========================

    doc
      .moveTo(45, 720)
      .lineTo(550, 720)
      .strokeColor(border)
      .lineWidth(1)
      .stroke();


    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(
        "Thank you for shopping with MOVINO!",
        45,
        735,
        {
          align: "center",
          width: 505
        }
      );


    doc
      .fillColor(grey)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Premium footwear. Comfort, performance and style.",
        45,
        753,
        {
          align: "center",
          width: 505
        }
      );


    // =========================
    // END PDF
    // =========================

    doc.end();


  } catch (error) {

    console.error(
      "Error generating invoice:",
      error
    );

    res
      .status(500)
      .send("Unable to generate invoice");

  }

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

 

    if (!order) return res.status(404).send('Order not found4');

  res.render('order-detail', {
    order,
    user: req.session.user || null
});

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
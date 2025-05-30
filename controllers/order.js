const Order = require("../models/order");
const Cart = require("../models/cart");
const User = require("../models/user");
const Coupon = require("../models/coupon");

const { client } = require("../config/paypalConnect");
const paypal = require("@paypal/checkout-server-sdk");

async function handleGetCheckout(req, res) {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    const coupons = await Coupon.find({ isActive: true });
    const userDetails = await User.findById(userId);

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    res.status(200).render("client/checkout", {
      userDetails,
      address: userDetails.addresses,
      cart,
      coupon: coupons,
      items: cart.items,
    });
  } catch (error) {
    res.status(500).render("client/server-error", { message: error.message });
  }
}

async function handleCreateCODOrder(req, res) {
  try {
    const { address, paymentMethod, couponCode } = req.body;
    const user = await User.findById(req.user.id);
    const cart = await Cart.findOne({ user: user._id }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    if (!address || !paymentMethod) {
      req.flash("error", "Address and payment method are required.");
      return res.redirect("/checkout");
    }

    let coupon = null;
    let discount = 0;

    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      const now = new Date();

      if (!coupon) {
        req.flash("error", "Invalid or inactive coupon code.");
        return res.redirect("/checkout");
      }

      if (coupon.expiryDate < now) {
        req.flash("error", "Coupon has expired.");
        return res.redirect("/checkout");
      }

      if (coupon.usedBy.includes(user._id)) {
        req.flash("error", "You have already used this coupon.");
        return res.redirect("/checkout");
      }

      discount = coupon.discountAmount || 0;
      coupon.usedBy.push(user._id);
      await coupon.save();
    }

    const orderedItems = cart.items.map((item) => ({
      product: item.product,
      quantity: item.quantity,
    }));

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const tax = subtotal * 0.3; 
    const total = subtotal + tax - discount;

    const newOrder = new Order({
      user,
      items: orderedItems,
      totalAmount: total,
      address,
      paymentMethod,
      orderDate: new Date(),
      status: "pending",
      isPaid: paymentMethod.toLowerCase() === "paypal" ? false : true,
    });

    await newOrder.save();

    cart.items = [];
    await cart.save();

    req.flash("success", "Order placed successfully!");
    res.render("client/order-summary", {
      items: orderedItems,
      user,
      address,
      coupon,
      price: {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).render("client/server-error", { message: error.message });
  }
}

async function createPaypalOrder(req, res) {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    const { couponCode } = req.body;

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    let discount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
      });
      if (
        coupon &&
        !coupon.usedBy.includes(userId) &&
        coupon.expiryDate > new Date()
      ) {
        discount = coupon.discountAmount || 0;
      }
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const tax = subtotal * 0.3; 
    const total = subtotal + tax - discount;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: total.toFixed(2),
            breakdown: {
              item_total: { currency_code: "USD", value: subtotal.toFixed(2) },
              tax_total: { currency_code: "USD", value: tax.toFixed(2) },
              discount: { currency_code: "USD", value: discount.toFixed(2) },
            },
          },
        },
      ],
    });

    const order = await client().execute(request);
    res.status(200).json({ orderID: order.result.id });
  } catch (err) {
    console.error("PayPal Order Create Error:", err);
    res.status(500).json({ error: "Failed to create PayPal order" });
  }
}

async function capturePaypalOrder(req, res) {
  try {
    const { orderID, address, couponCode } = req.body;
    const user = await User.findById(req.user.id);
    const cart = await Cart.findOne({ user: user._id }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const capture = await client().execute(request);

    if (capture.result.status !== "COMPLETED") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    let discount = 0;
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
      });
      if (
        coupon &&
        !coupon.usedBy.includes(user._id) &&
        coupon.expiryDate > new Date()
      ) {
        discount = coupon.discountAmount || 0;
        coupon.usedBy.push(user._id);
        await coupon.save();
      }
    }

    const orderedItems = cart.items.map((item) => ({
      product: item.product,
      quantity: item.quantity,
    }));

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const tax = subtotal * 0.3; 
    const total = subtotal + tax - discount;

    const newOrder = new Order({
      user,
      items: orderedItems,
      totalAmount: total,
      address,
      paymentMethod: "PayPal",
      paymentStatus: "paid",
      paymentDetails: capture.result,
      status: "pending",
      orderDate: new Date(),
    });

    await newOrder.save();

    cart.items = [];
    await cart.save();

    res.status(201).json({
      message: "Order placed successfully",
      orderId: newOrder._id,
    });
  } catch (err) {
    console.error("PayPal Capture Error:", err);
    res.status(500).json({ error: "Payment capture failed" });
  }
}

async function handleGetMyOrders(req, res) {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ user: userId }).populate("items.product");

    res.status(200).render("client/my-orders", { orders });
  } catch (error) {
    res.status(500).render("client/server-error", { message: error.message });
  }
}

async function handleCancelOrder(req, res) {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const order = await Order.findOne({ user: userId, _id: orderId });

    if (!order) {
      req.flash("error", "Order not found.");
      return res.redirect("/my-orders");
    }

    order.status = "canceled";
    await order.save();

    req.flash("success", "Order canceled successfully.");
    res.redirect("/my-orders");
  } catch (error) {
    res.status(500).render("client/server-error", { message: error.message });
  }
}

async function latestOrder(req, res) {
  try {
    const order = await Order.findOne()
      .sort({ createdAt: -1 })
      .populate("user")
      .populate("items.product");

    res.render("client/order-summary1", { order });
  } catch (error) {
    res.status(500).render("client/server-error", { message: error.message });
  }
}

module.exports = {
  handleGetCheckout,
  handleCreateCODOrder,
  createPaypalOrder,
  capturePaypalOrder,
  handleGetMyOrders,
  handleCancelOrder,
  latestOrder,
};

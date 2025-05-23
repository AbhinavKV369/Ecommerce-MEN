const Order = require("../models/order");
const Cart = require("../models/cart");
const User = require("../models/user");
const Coupon = require("../models/coupon");

const { client } = require("../config/paypalConnect");

async function handleGetCheckout(req, res) {
  try {
    const user = req.user.id;
    const cart = await Cart.findOne({ user }).populate("items.product");
    const coupon = await Coupon.find()
    const userDetails = await User.findById({ _id: user });

    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    res.status(200).render("client/checkout", {
      userDetails,
      address: userDetails.addressses,
      cart,
      coupon,
      items: cart.items,
    });
  } catch (error) {
    res.status(500).render("client/server-error", {
      error: error.message,
    });
  }
}

async function handleCreateOrder(req, res) {
  try {
    const { address, paymentMethod, couponCode } = req.body;
    const user = await User.findById(req.user.id);
    const cart = await Cart.findOne({ user: user._id }).populate("items.product");

    const orderedItems = cart.items.map((item) => ({
      product: item.product,
      quantity: item.quantity,
    }));

    let coupon = null;
    let discount = 0;

    if (couponCode) {
      coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon) {
        discount = coupon.discountAmount || 0;
        coupon.usedBy.push(user._id);
        await coupon.save();
      }
    }

    let subtotal = 0;
    cart.items.forEach((item) => {
      subtotal += item.product.price * item.quantity;
    });

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
    });

    await newOrder.save();

    cart.items = [];
    await cart.save();

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
    res.status(500).render("client/server-error", {
      message: error.message,
    });
  }
}

async function handleGetMyOrders(req, res) {
  const userId = req.user.id;

  try {
    const orders = await Order.find({ user: userId }).populate("items.product");

    res.status(200).render("client/my-orders", {
      orders,
    });
  } catch (error) {
    res.status(500).render("client/server-error", {
      message: error.message,
    });
  }
}

async function handleCancelOrder(req, res) {
  const user = req.user.id;
  const orderId = req.params.id;
  try {
    const order = await Order.findOne({ user: user, _id: orderId });

    order.status = "canceled";
    await order.save();

    res.redirect("/my-orders");
  } catch (error) {
    res.status(500).render("client/server-error", {
      message: error.message,
    });
  }
}

async function latestOrder(req, res) {
  const order = await Order.findOne()
    .sort({ createdAt: -1 })
    .populate("user")
    .populate("items.product");
  res.render("client/order-summary1", {
    order,
  });
}

module.exports = {
  handleGetCheckout,
  handleCreateOrder,
  handleGetMyOrders,
  handleCancelOrder,
  latestOrder,
};

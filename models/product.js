const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  engine: {
    type: String,
    required: true,
    trim: true,
  },
  gvw: {
    type: String,
    required: true,
    trim: true,
  },
  productImages: [String],
  price: {
    type: Number,
    required: true,
    min: 100000,
  },
  category: {
    type: String,
    enum: ["truck", "bus", "lmv", "mmv"],
    required: true,
  },
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const uri = "mongodb+srv://brianmtonga592:1Brisothi20*@cluster0.4d9rw0d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const PORT = process.env.PORT || 4000;
const app = express();

dotenv.config();

// Middleware Configuration
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Adjust the limit as needed
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Adjust the limit as needed

mongoose.connect(uri)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
  });

  app.use('/images', express.static('upload/images'));

  // Multer setup for image uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = './upload/images';
      fs.exists(dir, (exist) => {
        if (!exist) {
          return fs.mkdir(dir, (error) => cb(error, dir));
        }
        return cb(null, dir);
      });
    },
    filename: (req, file, cb) => {
      cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
  });
  
  const upload = multer({ storage: storage });
  
  // Routes
  app.get("/", (req, res) => {
    res.send("Express App is Running");
  });
  
  // User Schema
  const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    cartData: { type: Object, default: {} },
    date: { type: Date, default: Date.now }
  });
  
  const User = mongoose.model('User', userSchema);
  
  // Inventory Schema
  const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    location: { type: String, required: true },
    imageUrl: { type: String, required: true }
  });
  
  const Item = mongoose.model('Item', itemSchema);
  
  // Sale Schema
  const saleSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    saleDate: { type: Date, default: Date.now }
  });
  
  const Sale = mongoose.model('Sale', saleSchema);
  
  // Register new users
  app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
  
    try {
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ success: false, errors: "User with this email already exists" });
      }
  
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      let cart = {};
      for (let i = 0; i < 300; i++) {
        cart[i] = 0;
      }
  
      user = new User({ name: username, email, password: hashedPassword, cartData: cart });
      await user.save();
  
      const token = jwt.sign({ user: { id: user._id } }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ success: true, token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // User login
  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      let user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ success: false, errors: "Invalid email or password" });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, errors: "Invalid email or password" });
      }
  
      const token = jwt.sign({ user: { id: user._id } }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ success: true, token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // Upload a single image
  app.post("/upload", upload.single('item'), (req, res) => {
    res.json({
      success: 1,
      image_url: `${process.env.BASE_URL}/images/${req.file.filename}`
    });
  });
  
  // Fetch all items
  app.get('/api/items', async (req, res) => {
    try {
      const items = await Item.find();
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Add a new item
  app.post('/api/item', async (req, res) => {
    const { name, description, category, location, imageUrl } = req.body;
  
    try {
      const newItem = new Item({ name, description, category, location, imageUrl });
      const savedItem = await newItem.save();
      res.status(201).json(savedItem);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  
  // Fetch item by ID
  app.get('/api/items/:id', async (req, res) => {
    try {
      const item = await Item.findById(req.params.id);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Update item stock
  app.put('/api/items/:id', async (req, res) => {
    const { stock } = req.body;
  
    try {
      if (isNaN(stock) || stock < 0) {
        return res.status(400).json({ message: 'Invalid stock value' });
      }
  
      const item = await Item.findById(req.params.id);
      if (!item) return res.status(404).json({ message: 'Item not found' });
  
      item.stock = stock;
      await item.save();
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Delete an item
  app.delete('/api/items/:id', async (req, res) => {
    try {
      const item = await Item.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Record a sale
  app.post('/api/sales', async (req, res) => {
    const { productId, quantity } = req.body;
  
    if (!productId || !quantity) {
      return res.status(400).json({ message: 'Product ID and quantity are required' });
    }
  
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid quantity sold' });
    }
  
    try {
      const item = await Item.findById(productId);
      if (!item) return res.status(404).json({ message: 'Item not found' });
  
      if (item.stock < quantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }
  
      item.stock -= quantity;
      await item.save();
  
      const sale = new Sale({ productId, quantity, sellingPrice: item.price });
      await sale.save();
      res.status(201).json({ message: 'Sale recorded successfully', sale });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Fetch all sales
  app.get('/api/sales', async (req, res) => {
    try {
      const sales = await Sale.find().populate('productId', 'name');
      res.json(sales);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
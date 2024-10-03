const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration
dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// MongoDB Connection
const uri = process.env.MONGO_URI || "mongodb+srv://brianmtonga592:1Brisothi20*@cluster0.4d9rw0d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(uri)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Error connecting to MongoDB:", error.message));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json());
app.use('/images', express.static('upload/images'));

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];  // Get the token from Authorization header
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = decoded;  // Attach the decoded user to the request object
    next();
  });
};

// Multer Setup for Image Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './upload/images';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String, default: '/images/default-profile.png' }  // New field for profile image
});

// Hash password before saving the user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Signup Route (Register a new user)
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ email, password });
    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'User created successfully', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Inventory Schema
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  imageUrl: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Added userId to link items to users
});

const Item = mongoose.model('Item', itemSchema);

// Upload Image
app.post("/upload", upload.single('item'), (req, res) => {
  res.json({
    success: 1,
    image_url: `${process.env.BASE_URL}/images/${req.file.filename}`
  });
});

// Upload Profile Image Route
app.post('/api/users/upload', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const imageUrl = `/images/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user.id, { profileImage: imageUrl }, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile image uploaded successfully!',
      profileImage: user.profileImage,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
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

// Add new item
app.post('/api/item', async (req, res) => {
  const { name, description, category, location, imageUrl, userId } = req.body; // Accept userId

  try {
    const newItem = new Item({ name, description, category, location, imageUrl, userId }); // Link the item to the user
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
  } catch (err) {
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
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Record a sale
const saleSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
});

const Sale = mongoose.model('Sale', saleSchema);

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
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Fetch all sales
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await Sale.find().populate('productId', 'name');
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// GET /api/users/me
// Fetch user details
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// GET /api/items/user
app.get('/api/items/user', async (req, res) => {
  const userId = req.headers['user-id']; // Assuming the user ID is sent in headers
  try {
    const items = await Item.find({ userId });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

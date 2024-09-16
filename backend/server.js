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

app.get("/", (req, res) => {
  res.send("Express App is Running");
});

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

app.use('/images', express.static('upload/images'));

app.post("/upload", upload.single('item'), (req, res) => {
  res.json({
    success: 1,
    image_url: `http://localhost:4000/images/${req.file.filename}`
  });
});

const Users = mongoose.model('Users', {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  }
});

app.post('/signup', async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: false, errors: "existing user found with same email address" });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = {
    user: {
      id: user.id
    }
  };

  const token = jwt.sign(data, 'secret_ecom');
  res.json({ success: true, token });
});

app.post('/login', async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id
        }
      };
      const token = jwt.sign(data, 'secret_ecom');
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  } else {
    res.json({ success: false, errors: "Wrong Email Id" });
  }
});

const itemSchema = new mongoose.Schema({
  id: Number,
  title: String,
  description: String,
  location: String,
  image: String,
});

const Item = mongoose.model('Item', itemSchema);

app.post('/additem', async (req, res) => {
  try {
    const { title, description, location, image } = req.body;

    // Log the payload to the console
    console.log('Payload received from client:', req.body);

    if (!title || !description || !location || !image) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    let id;
    const items = await Item.find({});
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      id = lastItem.id + 1;
    } else {
      id = 1;
    }

    const newItem = new Item({
      id,
      title,
      description,
      location,
      image,
    });

    await newItem.save();
    res.status(201).json({
      success: true,
      message: 'Item posted successfully!',
      item: newItem,
    });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

app.post('/removeitem', async (req, res) => {
  await Item.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name
  });
});

app.get('/allitems', async (req, res) => {
  let items = await Item.find({});
  console.log("All Products Fetched");
  res.send(items);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

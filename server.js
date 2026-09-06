const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('vclub.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    price REAL,
    image TEXT,
    category TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'vclub-secret-key',
  resave: false,
  saveUninitialized: true
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

function checkAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

app.get('/', (req, res) => {
  const listings = db.prepare('SELECT * FROM listings').all();
  res.render('index', { listings });
});

app.get('/listing/:id', (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).send('Listing not found');
  res.render('listing', { listing });
});

app.get('/admin/login', (req, res) => {
  res.render('admin/login');
});

app.post('/admin/login', (req, res) => {
  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASS || 'adminpassword';

  if (req.body.username === validUser && req.body.password === validPass) {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.send("<script>alert('Invalid Credentials'); window.location='/admin/login';</script>");
  }
});

app.get('/admin/dashboard', checkAdmin, (req, res) => {
  const listings = db.prepare('SELECT * FROM listings').all();
  res.render('admin/dashboard', { listings });
});

app.post('/admin/add-listing', checkAdmin, upload.single('image'), (req, res) => {
  const { title, description, price, category } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : '';
  
  db.prepare('INSERT INTO listings (title, description, price, image, category) VALUES (?, ?, ?, ?, ?)')
    .run(title, description, price, image, category);
    
  res.redirect('/admin/dashboard');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

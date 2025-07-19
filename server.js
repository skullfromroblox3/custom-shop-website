const express      = require('express');
const multer       = require('multer');
const session      = require('express-session');
const bodyParser   = require('body-parser');
const fs           = require('fs');
const path         = require('path');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PROD_FILE = path.join(DATA_DIR, 'products.json');
const USER_FILE = path.join(DATA_DIR, 'users.json');

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'super-secret-for-demo', // for prod, move to .env
  resave: false,
  saveUninitialized: false
}));

function loadJSON(fp){ return JSON.parse(fs.readFileSync(fp)); }
function saveJSON(fp,d){ fs.writeFileSync(fp, JSON.stringify(d, null, 2)); }

function requireAdmin(req, res, next){
  if (req.session.user && req.session.user.isAdmin) return next();
  res.redirect('/login');
}

// — Public shop page
app.get('/', (req, res) => {
  const products = loadJSON(PROD_FILE);
  res.render('shop', { products, user: req.session.user });
});

// — Login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadJSON(USER_FILE);
  if (users[username] && users[username].password === password){
    req.session.user = { name: username, isAdmin: users[username].isAdmin };
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid creds' });
});
app.get('/logout', (req, res) => {
  req.session.destroy(()=>res.redirect('/'));
});

// ─── Admin panel ───────────────────────────────────────────
app.get('/admin', requireAdmin, (req, res) => {
  const products = loadJSON(PROD_FILE);
  console.log('Loaded products for admin:', products);  // for debugging
  res.render('admin', { products });
});

// ─── Multer storage ─────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, 'public', 'uploads'));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`);
    }
  })
});

// — Create product
app.post('/admin/add', requireAdmin, upload.single('image'), (req, res) => {
  const products = loadJSON(PROD_FILE);
  const { name, price } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  products.push({
    id: uuid(),
    name,
    price: parseFloat(price),
    image: imagePath
  });
  saveJSON(PROD_FILE, products);
  res.redirect('/admin');
});

// — Delete product
app.post('/admin/delete/:id', requireAdmin, (req, res) => {
  let products = loadJSON(PROD_FILE);
  products = products.filter(p => p.id !== req.params.id);
  saveJSON(PROD_FILE, products);
  res.redirect('/admin');
});

app.listen(PORT, ()=>console.log(`Shop running on http://localhost:${PORT}`));

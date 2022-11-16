var ejs = require("ejs");
var mysql = require("mysql");
var express = require("express");
var bodyParser = require("body-parser");
var session = require("express-session");

var port = process.env.PORT || 3000;
var localhost = "127.0.0.1";
// process.env.PORT : will be provided a temporary port number if 8000 is not available

var app = express();

mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "node_project",
});

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: "secret" }));

// function declarations
function isProductInCart(cart, id) {
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id == id) {
      return true;
    }
  }

  return false;
}

function calculateTotal(cart, req) {
  total = 0;
  for (let i = 0; i < cart.length; i++) {
    //if we're offering a discounted price
    if (cart[i].sale_price) {
      total = total + cart[i].sale_price * cart[i].quantity;
    } else {
      total = total + cart[i].price * cart[i].quantity;
    }
  }
  req.session.total = total;
  return total;
}

// Creating URL's
app.get("/", (req, res) => {
  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project",
  });

  con.query("select * from products", (err, result) => {
    res.render("pages/index", { result: result });
  });
});

app.post('/add_to_cart', (req,res) => {
  var id = req.body.id;
  var name = req.body.name;
  var price = req.body.price;
  var sale_price = req.body.sale_price;
  var quantity = req.body.quantity;
  var image = req.body.image;
  var product = {
    id: id,
    name: name,
    price: price,
    sale_price: sale_price,
    quantity: quantity,
    image: image,
  };

  if (req.session.cart) {
    var cart = req.session.cart;
    if (!isProductInCart(cart, id)) {
      cart.push(product);
    }
  } else {
    req.session.cart = [product];
    var cart = req.session.cart;
  }

  // calculate total
  calculateTotal(cart, req);

  //return to cart page
  res.redirect('/cart');
});

app.get("/cart", (req, res) => {
  var cart = req.session.cart;
  var total = req.session.total;
  res.render("pages/cart", {
    cart: cart,
    total: total,
  });
});

app.post("/remove_product", function (req, res) {
  var id = req.body.id;
  var cart = req.session.cart;
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id == id) {
      cart.splice(cart.indexOf(i), 1);
    }
  }
  //re-calculate
  calculateTotal(cart, req);
  res.redirect("/cart");
});

app.post("/edit_product_quantity", (req, res) => {
  //get values from inputs
  var id = req.body.id;
  var quantity = req.body.quantity;
  var increase_btn = req.body.increase_product_quantity;
  var decrease_btn = req.body.decrease_product_quantity;

  var cart = req.session.cart;

  if (increase_btn) {
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].id == id) {
        if (cart[i].quantity > 0) {
          cart[i].quantity = parseInt(cart[i].quantity) + 1;
        }
      }
    }
  }

  if (decrease_btn) {
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].id == id) {
        if (cart[i].quantity > 1) {
          cart[i].quantity = parseInt(cart[i].quantity) - 1;
        }
      }
    }
  }

  calculateTotal(cart, req);
  res.redirect("/cart");
});

app.get("/checkout", (req, res) => {
  var total = req.session.total;
  res.render("pages/checkout", { total });
});

app.post("/place_order", (req, res) => {
  var name = req.body.name;
  var email = req.body.email;
  var phone = req.body.phone;
  var city = req.body.city;
  var address = req.body.address;
  var cost = req.session.total;
  var status = "not paid";
  var date = new Date();
  var product_ids = "";
  var id = Date.now();
  req.session.order_id = id;

  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project",
  });

  var cart = req.session.cart;
  for (let i = 0; i < cart.length; i++) {
    product_ids = product_ids + "," + cart[i].id;
  }

  con.connect((err) => {
    if (err) {
      console.log(err);
    } else {
      var query =
        "insert into orders(id,cost,name,email,status,city,address,phone,date,product_ids) values ?";
      var values = [
        [
          id,
          cost,
          name,
          email,
          status,
          city,
          address,
          phone,
          date,
          product_ids,
        ],
      ];
      con.query(query, [values], (err, result) => {
        for (let i = 0; i < cart.length; i++) {
          const query =
            "insert into order_items (order_id,product_id,product_name,product_price,product_image,product_quantity,product_date)";
          var values = [
            [
              id,
              cart[i].id,
              cart[i].name,
              cart[i].price,
              cart[i].image,
              cart[i].quantity,
              new Date(),
            ],
          ];
          con.query(query, [values], (err, result) => {});
        }
        res.redirect("/payment");
      });
    }
  });
});

app.get("/payment", (req, res) => {
  var total = req.session.total;
  res.render("pages/payment", { total });
});

app.get("/verify_payment", (req, res) => {
  var transaction_id = req.query.transaction_id;
  var order_id = req.session.order_id;

  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project",
  });

  con.connect((err) => {
    if (err) {
      console.log(err);
    } else {
      var query =
        "insert into payments (order_id,transaction_id,date) values ?";
      var values = [[order_id, transaction_id, new Date()]];
      con.query(query, [values], (err, result) => {
        con.query(
          "update orders set status='paid' where id='" + order_id + "'",
          (err, result) => {}
        );
        res.redirect("/thank_you");
      });
    }
  });
});

app.get("/thank_you", (req, res) => {
  var order_id = req.session.order_id;
  res.render("pages/thank_you", { order_id });
});

app.get("/single_product", (req, res) => {
  var id = req.query.id;

  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project",
  });

  con.query("select * from products where id='" + id + "'", (err, result) => {
    res.render("pages/single_product", { result: result });
  });
});

app.get("/products", (req, res) => {
  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project",
  });

  con.query("select * from products", (err, result) => {
    res.render("pages/products", { result: result });
  });
});

app.get("/about", (req, res) => {
  res.render("pages/about");
});

app.listen(port, localhost, () => {
  console.log(`listening to port no. ${port}`);
});

// Dummy Personal Email Address for PayPal
// sb-i435bf20217671@personal.example.com
// Password:
//  Q?4#HQow

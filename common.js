"use strict";

//globals
global.l = () => {};
try {
  l = console.log.bind(console);
} catch (e) {
  console.log("cannot bind console");
}

global.jsons = (o) => JSON.stringify(o, null, "\t");
global.jscopy = (o) => JSON.parse(JSON.stringify(o, null, "\t"));

global.TIME_1S = 1000;
global.TIME_1M = 60 * TIME_1S;
global.TIME_1H = 60 * TIME_1M;
global.DATE_ISO = "YYYY-MM-DD";

global.DATE_TIME_ISO = "YYYY-MM-DD HH:mm";
global.TIME = "HH:mm";
global.DATE_DISPLAY_WEEKDAY_MONTH = "dddd, D MMM";
global.DB_PAGE_SIZE = 500;

//built-in modules
global.fs = require("fs").promises;
global.http = require("http");
global.https = require("https");
global.util = require("util");
global.stream = require("stream");

//modules for every app
global._ = require("lodash");
global.bcrypt = require("bcrypt");
global.day = require("dayjs");
let day_utc = require("dayjs/plugin/utc");
day.extend(day_utc); //https://github.com/iamkun/dayjs/blob/dev/docs/en/Plugin.md#utc https://stackoverflow.com/questions/45854169/how-can-i-use-an-es6-import-in-node

global.express = require("express");
global.path = require("path");
global.passport = require("passport");
global.passportLocalStrategy = require("passport-local").Strategy;
global.passportJwtStrategy = require("passport-jwt").Strategy;
global.passportJwtExctract = require("passport-jwt").ExtractJwt;
global.sequelize = require("sequelize").Sequelize;
global.request = require("request-promise"); //need request package separately in package.json, as it's listed as a peer dep
global.sparkpost = require("sparkpost");
global.validator = require("validator");
global.jwtLib = require("jsonwebtoken");
var nodemailer = require('nodemailer');

const QueryTypes = require("sequelize").QueryTypes;
//query types
global.selectQuery = QueryTypes.SELECT;
global.updateQuery = QueryTypes.UPDATE;
global.deleteQuery = QueryTypes.DELETE;
global.insertQuery = QueryTypes.INSERT;
//app specific
global.aws = require("aws-sdk");

global.Common = {};

Common.init = () => {
  //l('Common init')

  process.on("uncaughtException", function (e) {
    if (typeof e.message != "string") {
      e.message = jsons(e);
    }
    // l("ERROR uncaughtException", e.message);
    if (typeof e.stack == "object") {
      l(e.stack);
    }
  });

  process.on("unhandledRejection", function (e) {
    if (typeof e.message != "string") {
      e.message = jsons(e);
    }
    l("ERROR unhandledRejection", e.message);
    if (typeof e.query == "string") {
      l("query", e.query);
    }
    if (typeof e.stack == "string") {
      l(e.stack);
    }
  });

  var pgconfig = {
    user: process.env.DB_USER || "karll",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "jobs",
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || "5432",
  };
  global.pgpool = new sequelize(
    pgconfig.database,
    pgconfig.user,
    pgconfig.password,
    {
      host: pgconfig.host,
      port: pgconfig.port,
      dialect: "postgres",
      logging: console.log,
      pool: {
        max: 5,
        min: 0,
        idle: 10000
      }
    }
  );

  if (typeof process.env.SPARKPOST_API_KEY == "string") {
    global.sparkpost_client = new sparkpost(process.env.SPARKPOST_API_KEY);
    //l("sparkpost_client", process.env.SPARKPOST_API_KEY)
  }

  if (typeof process.env.BRAINTREE_MERCHANT_ID == "string") {
    global.braintree = require("braintree");
    var env = braintree.Environment.Production;
    if (
      typeof process.env.NODE_ENV == "string" &&
      process.env.NODE_ENV == "development"
    ) {
      env = braintree.Environment.Sandbox;
    }
    //always sandbox, remove this line when production credentials are available
    env = braintree.Environment.Sandbox;

    global.braintree_gateway = braintree.connect({
      environment: env,
      merchantId: process.env.BRAINTREE_MERCHANT_ID,
      publicKey: process.env.BRAINTREE_PUBLIC_KEY,
      privateKey: process.env.BRAINTREE_PRIVATE_KEY,
    });
  }

  process.env.AWS_ACCESS_KEY_ID = 'secret-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'access-key';
  if (typeof process.env.AWS_ACCESS_KEY_ID == "string") {
    aws.config.update({
      region: "us-east-1", //US East (N. Virginia) https://docs.aws.amazon.com/general/latest/gr/rande.html
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    global.s3 = new aws.S3();
  }
};

//don't use async on this function
Common.initWebApp = () => {
  global.app = express();

  //var logger = require('morgan')
  var bodyParser = require("body-parser");
  app.use(bodyParser.json({ limit: "10mb", extended: true }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

  var compression = require("compression");
  app.use(compression());
  //var errorHandler = require('errorhandler')
  var multer = require("multer"); // middleware for handling `multipart/form-data`, eg file upload
  Common.upload = multer({ dest: "uploads/" });
  //app.use(multer()) no need for use(), put it in request handling

  var methodOverride = require("method-override");
  app.use(methodOverride());

  var helmet = require("helmet"); // secure headers
  // https://stackoverflow.com/questions/47217966/in-a-frame-because-it-set-x-frame-options-to-sameorigin-in-node-app
  // refused to display in a frame because it set 'X-Frame-Options' to 'sameorigin'.
  app.use(
    helmet({
      frameguard: false, //if needed to embedded in iframe, frameguard must be false; if not, just comment
    })
  );

  // need to access dev server without ssl: http://localhost:5000/api/monitor
  // not needed if using vue-cli proxy
  if (process.env.NODE_ENV == "production") {
    const expressEnforcesSSL = require("express-enforces-ssl");
    app.enable("trust proxy"); //required for production, otherwise error "redirected too many times". https://blog.heroku.com/node-habits-2017
    app.use(expressEnforcesSSL());
  }

  /*
      not useful when using netlify as front-end, only API requests will be served here
              "connect-history-api-fallback": "1.x.x",

      var history = require("connect-history-api-fallback")
      app.use(
          history({
              verbose: true
          })
      )
      */

  //app.use(Common.allowCrossDomain) // no need. Development: using proxy with npm run dev. Production: use netlify proxy
  // https://help.shopify.com/en/api/guides/samesite-cookies
  // https://github.com/expressjs/cookie-session

  var session = require("cookie-session");
  app.use(
    session({
      name: "session",
      keys: [process.env.COOKIE_SECRET],
      sameSite: "strict",
      maxAge: 14 * 3600 * 1000, //14h
      //secure: true, don't set this manually, it break dev env. Will be secure in production. https://github.com/expressjs/cookie-session
      path: "/",
    })
  );

  //should be after api-users, to setup passport too? works here though
  var app_server = http.createServer(app);
  var port = process.env.PORT || 3000;
  app_server.listen(port, () => {
    l("app_server started on port", port);
  });
};

/* various utility functions */
Common.date2string = (d) => {
  var curr_date = d.getDate();
  var curr_month = d.getMonth() + 1;
  var curr_year = d.getFullYear();
  if (curr_month < 10) {
    curr_month = "0" + curr_month;
  }

  return curr_year + "-" + curr_month + "-" + curr_date;
};

//code friendly. "First's name" > "first_s_name"
Common.string2var = (s) => {
  var v = s.toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (v.charAt(0).match(/[0-9]/)) {
    v = "_" + v;
  }
  return v;
};

//SELECT ... WHERE name=? AND phone=? => WHERE name=$1 AND phone=$2
Common.prepareSql = (sql) => {
  var p = 0;
  return sql.replace(/\?/g, function () {
    return "$" + ++p;
  });
};

//"eq 5", "lt 2013-03-04", "gt 8"
Common.getSqlFilter = (param) => {
  var f = {
    operator: "=",
    value: null,
  };
  if (!(typeof param != "undefined" && param != "")) {
    return f;
  }

  var o = param.substr(0, 2);
  switch (o) {
    case "lt":
      f.operator = "<=";
      break;
    case "eq":
      f.operator = "=";
      break;
    case "gt":
      f.operator = ">=";
      break;
  }
  f.value = param.substr(3);
  return f;
};

//permissions is optional
Common.ensureAuthenticated = function (permissions) {
  return function (req, res, next) {
    //l('ensureAuthenticated req', jsons(req.user), 'req.isAuthenticated()', req.isAuthenticated())
    if (req.isAuthenticated()) {
      if (typeof permissions == "string" && permissions.length) {
        if (req.user.permissions.indexOf(permissions) == -1) {
          res.status(403);
          res.json({ error: "this requires permissions " + permissions });
          return null;
        }
      }
      //no permissions required, continue
      return next();
    } else {
      res.status(401);
      res.send({ error: "no access, please login" });
      return null;
    }
  };
};

/* not needed
Common.allowCrossDomain = (req, res, next) => {
    var allow = false

    if (process.env.NODE_ENV == 'development') {
        //all dev, different dashboard & api servers. Not production.
        allow = true
    }

    if (typeof process.env.ALLOW_CORS_ON_FIXED == 'string') {
        if (process.env.ALLOW_CORS_ON_FIXED.split(',').indexOf(req.path) > -1) {
            allow = true
        }
    }

    if (typeof process.env.ALLOW_CORS_ON_PARTIAL == 'string') {
        process.env.ALLOW_CORS_ON_PARTIAL.split(',').forEach(function(partial_path) {
            if (req.path.indexOf(partial_path) > -1) {
                allow = true
            }
        })
    }

    if (!allow) {
        next()
        return
    }

    //consider using https://github.com/expressjs/cors
    res.header('Access-Control-Allow-Credentials', 'true') //allow session cookies
    var oneof = false
    if (req.headers['origin']) {
        res.header('Access-Control-Allow-Origin', req.headers.origin)
        oneof = true
    }
    if (req.headers['access-control-request-method']) {
        res.header('Access-Control-Allow-Methods', req.headers['access-control-request-method'])
        //safari https://groups.google.com/forum/#!topic/angular/3hP4JpTHLYY
        res.header('Access-Control-Request-Method', req.headers['access-control-request-method'])
        oneof = true
    }
    if (req.headers['access-control-request-headers']) {
        //l("req.headers['access-control-request-headers']", req.headers['access-control-request-headers'])
        //safari http://stackoverflow.com/questions/16824661/cors-request-not-working-in-safari
        //"accept, origin, content-type" -- we're good, sending exactly what we get, no need to add "origin"
        res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'])
        oneof = true
    }
    if (oneof) {
        res.header('Access-Control-Max-Age', 60 * 60 * 24 * 365)
    }

    // intercept OPTIONS method
    if (oneof && req.method == 'OPTIONS') {
        res.sendStatus(200)
    } else {
        next()
    }
}
*/

Common.rawBody = (req, res, next) => {
  //l("Common.rawBody")
  req.rawBody = "";
  req.on("data", function (chunk) {
    req.rawBody += chunk;
  });
  //req.on('end', function(){});
  next(); //placing this inside function() won't call next()
};

Common.sendEmail = function (email) {
  var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    service: 'gmail',
    port: 25,
    secure: false,
    auth: {
      user: 'oliviabarrios92@gmail.com',
      pass: 'brr1200yu'
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  var mailOptions = {
    from: 'syuzanna',
    to: email.to,
    subject: email.subject,
    html: "Mail content here."
  };
  
 /* if (typeof email.from_name == "string") {
    mailOptions.from = email.from_name;
  } */
  // autodetect if html or text
  let is_html = /<[a-z][\s\S]*>/i.test(email.body);
  if (is_html) {
    mailOptions.html = email.body;
  } else {
    mailOptions.text = email.body;
  }

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });

  /* if (typeof email.cc == "string") {
    // https://github.com/SparkPost/node-sparkpost/blob/master/examples/transmissions/send_with_cc.js
    transmission.recipients.push({
      address: {
        email: email.cc,
        header_to: email.to,
      },
    });
    transmission.content.headers["CC"] = email.cc;
  }
  if (typeof email.bcc == "string") {
    // https://www.sparkpost.com/docs/faq/cc-bcc-with-rest-api/
    transmission.recipients.push({
      address: {
        email: email.bcc,
        header_to: email.to,
      },
    });
  }
  if (typeof email.reply_to == "string") {
    transmission.content.reply_to = email.reply_to;
  } 

  l("sendEmail", jsons(email));

  sparkpost_client.transmissions
    .send(transmission)
    .then((data) => {
      l("sendEmail done", email.to, email.subject, "is_html", is_html);
    })
    .catch((err) => {
      l("error sparkpost_client.transmissions.send", err);
    }); */
};

//call processEach on each array item, with a delay
Common.processArrayWithDelay = (items, processEach, delay, processDone) => {
  if (items.length == 0) {
    return processDone();
  }

  //don'tt wait for processEach to complete async. If that's needed, call processEach(item, items, processEach, delay, processDone) and settimeout before this call
  var item = items.pop();
  processEach(item);

  setTimeout(function () {
    Common.processArrayWithDelay(items, processEach, delay, processDone);
  }, delay);
};

Common.getClientIp = (req) => {
  var ipAddress;
  // Amazon EC2 / Heroku workaround to get real client IP
  var forwardedIpsStr = req.header("x-forwarded-for");
  if (forwardedIpsStr) {
    // 'x-forwarded-for' header may return multiple IP addresses in
    // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
    // the first one
    var forwardedIps = forwardedIpsStr.split(",");
    ipAddress = forwardedIps[0];
  }
  if (!ipAddress) {
    // Ensure getting client IP address still works in
    // development environment
    ipAddress = req.connection.remoteAddress;
  }
  return ipAddress;
};

Common.moneyFormat = (money_format, price, options) => {
  if (typeof options == "undefined") {
    options = {};
  }
  if (typeof options.keepCurrency == "undefined") {
    options.keepCurrency = true; //so currency converters work in front-end
  }

  if (typeof price != "number") {
    price = parseFloat(price);
  }
  if (isNaN(price)) {
    price = 0;
  }
  if (typeof options.tax_percent == "number" && options.tax_percent > 0) {
    price = price * (1 + options.tax_percent / 100);
  }
  if (typeof options.always_with_decimals !== "boolean") {
    options.always_with_decimals = false;
  }

  //clear currency converter when asked (only for order_notes, in textarea)
  if (options.keepCurrency == false) {
    money_format = money_format.replace("<span class=money>", "");
    money_format = money_format.replace("<span class='money'>", "");
    money_format = money_format.replace('<span class="money">', "");
    money_format = money_format.replace('<span class="price">', "");
    money_format = money_format.replace("<span class=cbb-currency>", "");
    money_format = money_format.replace("<span class=doubly>", "");
    money_format = money_format.replace("<span class=hidden>", "");
    money_format = money_format.replace("</span>", "");
  }
  money_format = money_format.replace("<p>", "");
  money_format = money_format.replace("</p>", "");

  var price_s = price.toFixed(0);
  //have decimals if not .00
  //have decimals, except when shop settings is amount_no_decimals -- helps with currency convertors. But this will add .00 to ALL offers, to customers and in the admin. Should add a different setting in app.
  if (money_format.indexOf("amount_no_decimals") == -1) {
    if (price % 1 != 0 || options.always_with_decimals) {
      price_s = price.toFixed(2);
    }
  }

  //http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
  price_s = price_s.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  var money = money_format;
  money = money.replace(/{{( )*amount( )*}}/, price_s);
  money = money.replace(/{{( )*amount_no_decimals( )*}}/, price_s);
  money = money.replace(
    /{{( )*amount_no_decimals_with_space_separator( )*}}/,
    price_s
  );

  var price_comma = price_s
    .replace(".", "DOT")
    .replace(",", ".")
    .replace("DOT", ",");
  money = money.replace(/{{( )*amount_with_comma_separator( )*}}/, price_comma);
  money = money.replace(
    /{{( )*amount_no_decimals_with_comma_separator( )*}}/,
    price_comma
  );

  //currencies
  money = money.replace("&#xe3f;", "฿");

  return money;
};

//e.g. $129,340.34
Common.parseCurrency = (amount) => {
  if (typeof amount == "number") {
    return amount;
  }
  if (typeof amount != "string") {
    return null;
  }

  var pattern = /[^0-9.-]+/g;
  var clean_amount = amount.replace(pattern, "");
  return parseFloat(clean_amount);
};

//null if undefined, or has just spaces, or null
Common.nullifyString = (s) => {
  if (typeof s == "undefined") {
    return null;
  }
  if (s == null) {
    return null;
  }

  if (typeof s == "string") {
    s = s.trim();
  }

  if (s == "") {
    return null;
  }

  return s;
};

Common.slugify = (s) => {
  if (typeof s == "undefined") {
    return "";
  }
  if (s == null) {
    return "";
  }

  //http://stackoverflow.com/questions/150033/regular-expression-to-match-non-english-characters
  s = s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") // replace spaces with -
    .replace(/[\.\/]/g, "-") //replace dots, slashes with -
    //.replace(/&/g, "%26") // & NO, only in URL
    .replace(/[^\w\-\$\£\%&\u00C0-\u1FFF\u2C00-\uD7FF]+/g, "") // remove all non-word chars; preserve $ £ for prices, works fine in URL; preserve %, &; preserve UTF-8 letters
    .replace(/\-\-+/g, "-") // replace multiple - with single -
    .replace(/^-+/, "") // trim - from start of text
    .replace(/-+$/, ""); // trim - from end of text
  return s;
};

//including min,max as possible values
Common.randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

//http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
Common.shuffleArray = (array) => {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};

Common.stripHTML = (text) => {
  return text.replace(/(<([^>]+)>)/gi, "");
};

Common.nl2br = (str) => {
  if (typeof str === "undefined" || str === null) {
    return "";
  }
  var breakTag = "<br>";
  return (str + "").replace(
    /([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
    "$1" + breakTag + "$2"
  );
};

Common.trimLength = (str, maxLen) => {
  var separator = " ";
  if (str.length <= maxLen) {
    return str;
  }
  return str.substr(0, str.lastIndexOf(separator, maxLen));
};

//build a has from a string (similar to md5, but simpler), used to set storage keys for viewed messages on client
Common.uniqueHash = (s) => {
  var hash = 0,
    i,
    chr,
    len;
  if (s.length === 0) return hash;
  for (i = 0, len = s.length; i < len; i++) {
    chr = s.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
};

Common.getRandomInt = (min, max) => {
  //return Math.floor(Math.random() * Math.floor(max))
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

//https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
Common.generateUuid = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

//https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
Common.generateId = (N = 16) => {
  //let s = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array(N)
    .join()
    .split(",")
    .map(function () {
      return s.charAt(Math.floor(Math.random() * s.length));
    })
    .join("");
};

Common.arrayHasObject = (a, o, props) => {
  for (let t of a) {
    for (let p of props) {
      if (t[p] != o[p]) {
        break;
      }
      //all props matched
      return true;
    }
  }
  return false;
};

Common.walkDir = async (dir, fileList = []) => {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const stat = await fs.stat(path.join(dir, file));
    if (stat.isDirectory())
      fileList = await Common.walkDir(path.join(dir, file), fileList);
    else fileList.push(path.join(dir, file));
  }
  return fileList;
};

Common.timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = Common;

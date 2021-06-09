global.Common = require("./common.js");
Common.init();
Common.initWebApp();

require('dotenv').config();
require("./api-users.js"); //this relies on Common.initWebApp() to be executed already, in order to setup passport auth
require("./api-braintree.js");
const User = require("./models/User");

//require('./api-products.js')
// app & db availability monitoring
app.get("/api/monitor", async (req, res) => {
  try {
    let user = await User.findOne();
    if (!user) {
      res.send("connected to db, but no users created yet");
      return;
    }
    res.json(user.toJSON());    
  } catch (error) {
    console.error(error);
  }
});

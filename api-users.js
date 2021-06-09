// no need for versioning, APIs used only by our dashboard code
// make sure all http calls return something in all cases, and only once

/*
since this is included only once in app.js, setup passport here if a web app
*/

const User = require("./models/User");
const Org = require("./models/Org");
const { Op } = require("sequelize");

if (typeof app == "function") {
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport session setup.
  //   To support persistent login sessions, Passport needs to be able to
  //   serialize users into and deserialize users out of the session.  Typically,
  //   this will be as simple as storing the user ID when serializing, and finding
  //   the user by ID when deserializing.
  passport.serializeUser(function (user, done) {
    //l("serializeUser", user)
    done(null, JSON.stringify(user));
  });

  //id/user = JSON.stringify(user) from above
  passport.deserializeUser(function (user, done) {
    /*findById(id, function (err, user) {
      done(err, user);
      });*/
    //l("deserializeUser", id)
    done(null, JSON.parse(user));
  });

  var opts = {};
  opts.jwtFromRequest = passportJwtExctract.fromAuthHeaderAsBearerToken();
  opts.secretOrKey = process.env.JWT_SECRET;
  passport.use(
    new passportJwtStrategy(opts, async (jwt_payload, done) => {
      var user = await User.findByPk(jwt_payload.id);
      if (user === null) {
        return done(null, false, {
          message: "Sorry, we couldn't find an account.",
        });
      }
      done(null, user);
      await User.update(
        { last_signin_date: "now()" },
        {
          where: {
            id: user.id,
          },
        }
      );
      return;
    })
  );
  passport.use(
    new passportLocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      function (username, password, done) {
        //l("passportLocalStrategy", username, password)
        process.nextTick(async function () {
          //l("passportLocalStrategy")
          //l(username)
          //l(password)

          var valid =
            validator.isEmail(username) && validator.isLength(password, 8);
          if (!valid) {
            return done(null, false, {
              message: "Incorrect username or password",
            });
          }

          username = username.toLowerCase();

          //ALL THIS INFO, except what's deleted before the function returns, is stored in session cookie
          let user = await User.findOne({ where: { email: username } });
          user = user.toJSON();
          if (user === undefined) {
            return done(null, false, {
              message: "Sorry, we couldn't find an account with that email.",
            });
          }

          var hashed_password = await bcrypt.hash(password, user.salt);
          if (hashed_password == user.password) {
            //all good. remove sensitive data before passing further user info
            delete user.password;
            delete user.salt;

            //set convenience user attributes. api-users & common
            user.user_mode = process.env.USER_MODE;
            user.token = jwtLib.sign(user, process.env.JWT_SECRET);

            //l('done user', user)
            done(null, user);
            await User.update(
              { last_signin_date: "now()" },
              {
                where: {
                  id: user.id,
                },
              }
            );
            return;
          }
          return done(null, false, {
            message: "Sorry, that password isn't right.",
          });
        });
      }
    )
  );
}

/*
register user
*/
app.post("/api/users", async (req, res) => {
  var resb = {};
  var valid =
    validator.isLength(req.body.name, 2) &&
    validator.isEmail(req.body.email) &&
    validator.isLength(req.body.password, 8);
  if (!valid) {
    l("/api/users invalid", jsons(req.body));
    res.status(412);
    res.json({
      error:
        "Please complete all fields. Password should be at least 8 characters (use multiple words).",
    });
    return;
  }
  var user_data = req.body;
  user_data.id = Common.generateId();
  user_data.email = user_data.email.toLowerCase().trim();
  if (typeof user_data.referral != "string") {
    //example of optional field at signup
    user_data.referral = null;
  }
  if (typeof user_data.source != "string") {
    user_data.source = null;
  }

  user_data.one_time_signin_token = Common.generateUuid(); //one_time_signin_token, not used

  var salt = await bcrypt.genSalt(10);
  //l('salt', salt)
  // var hashed_password = await bcrypt.hash(user_data.password, salt);
  var hashed_password = await bcrypt.hashSync(user_data.password, salt);
  //l('hashed_password', hashed_password)

  var user;
  var org = { id: null };
  var invite_key = null;
  if (req.body.invite_key && validator.isUUID(req.body.invite_key, 4)) {
    invite_key = req.body.invite_key;
    user_data.referral = "invite";
  }
  var invite;

  if (invite_key) {
    if (typeof req.body.invite_id != "string") {
      res.status(412);
      res.json({
        error:
          "Invalid invite id. Please contact your organization administrator.",
      }); //should be set from invite link
      return;
    }
    user_data.id = req.body.invite_id;
    //check if valid
    try {
      user = await User.update(
        {
          email: user_data.email,
          salt: salt,
          password: hashed_password,
          one_time_signin_token: user_data.one_time_signin_token,
          name: user_data.name,
          first_name: user_data.first_name,
          marketing_unsubscribe_token: Common.generateUuid(),
          referral: user_data.referral,
          struggle: user_data.struggle,
        },
        {
          where: {
            id: user_data.id,
            invite_key,
          },
        }
      );
    } catch (e) {
      l("error", jsons(e));
      res.status(412);
      res.json({
        error:
          "Invalid user id, email or invite key. Please contact your organization administrator.",
      });
      return;
      /*if (typeof e.constraint == 'string' && e.constraint == 'users_email_key') {
                res.status(412)
                res.json({ error: 'This email is already registered. You might want to click Sign in, then Forgot password.' })
                return
            }*/
    }
  } else {
    //no invite_key, regular signup
    if (process.env.USER_MODE == "team") {
      org = {
        id: Common.generateId(),
        name: req.body.org_name,
      };
      await Org.create({ id: org.id, name: org.name, email: user_data.email });
    }

    let options = { type: insertQuery };
    console.log("Options for user inserting ", options);
    user = await User.create({
      id: user_data.id,
      permissions: ["Administrator"],
      org_id: org.id,
      email: user_data.email,
      salt,
      password: hashed_password,
      one_time_signin_token: user_data.one_time_signin_token,
      name: user_data.name,
      first_name: user_data.first_name,
      marketing_unsubscribe_token: Common.generateUuid(),
      referral: user_data.referral,
      source: user_data.source,
    });
    if (!user) {
      return res.status(500).json({ error: "Unable to insert user!" });
    }
    console.log("user inserted", user);
    //l('/api/users options', jsons(options))
    if (
      options.err &&
      typeof options.err.constraint == "string" &&
      options.err.constraint == "users_email_key"
    ) {
      res.status(412);
      res.json({
        error:
          'This email is already registered. You might want to click Sign in, then Forgot password. To use a different email, append "+something" after username, eg "john+company@gmail.com"',
      });
      return;
    }
  }

  //set convenience user attributes. api-users & common
  user.user_mode = process.env.USER_MODE;

  var req_user = user;

  req.login(req_user, async (err) => {
    if (err) {
      l("error req.login(req_user)", err);
      return res.sendStatus(401);
    }
    //user should be signed in now. All user info will be fetched by GET /api/users/sessions
    return res.json({
      id: req_user.id,
      one_time_signin_token: req_user.one_time_signin_token,
    });
  });
});
// sign in
app.post("/api/users/sessions", async (req, res, next) => {
  //app.post('/api/users/sessions', passport.authenticate('local'), async (req, res) => {
  var resb = {};
  req.session.views = (req.session.views || 0) + 1;
  //l('req.session', req.session)
  //potential problems:  I use secure cookie but the connection is not SSL
  //stuff like cookies are only sent by default if the request is coming from the same origin. Otherwise, you have to use the withCredentials flag. Avoid CORS by using _redirects
  passport.authenticate("local", function (err, user, info) {
    //l('POST /api/users/sessions', 'user', user, 'info', info, 'req.user', req.user)
    //req.user undefined. Call req.login manually
    if (err) {
      l("error passport.authenticate", err);
      res.sendStatus(401);
      return;
      //return next(err)
    }

    if (!user) {
      res.sendStatus(401);
      //res.json({ error: "Invalid email or password" })
      return;
    }

    //l('req.login')
    req.login(user, function (err) {
      if (err) {
        l("req.login err");
        l(err);
        return next(err);
      }
      //l("req.login req.user", req.user)
      //keep req.user data under 4k, to fit session cookie
      //l('req.user after login', req.user) //all good!
      res.json(req.user);
    });
    /*
       // https://forum.vuejs.org/t/vue2-authentication-authorization-examples-tutorials/1604/3 no, too complex; KISS
       var token = JWT.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })
       res.json({ token: token })
       */
  })(req, res, next); //passport will set req.user - hmm, doesn't set
});

app.get("/api/users/sessions/delete", async (req, res) => {
  req.logout();
  //https://github.com/jaredhanson/passport/issues/246
  //req.session = null doesn't work
  //https://github.com/expressjs/cookie-session/issues/104
  //https://github.com/expressjs/express/issues/691
  //domain: 'dashboard.project.com',
  res.clearCookie("session", { domain: process.env.APP_HOSTNAME, path: "/" }); //works only if both domain & path are provided

  req.session = null;
  req.sessionOptions.maxAge = 0;

  res.json({});
});

app.patch(
  "/api/users/settings",
  Common.ensureAuthenticated(),
  async (req, res) => {
    //only user self-changable properties. e.g. not permissions
    var resb = {};
    var params = {};

    if (typeof req.body.settings == "object") {
      params.settings = JSON.stringify(req.body.settings);
    }

    if (typeof req.body.password == "string" && req.body.password.length >= 8) {
      //only if actually changed
      var salt = bcrypt.genSalt(10);
      var hashed_password = bcrypt.hash(req.body.password, salt);
      params.salt = salt;
      params.password = hashed_password;
    }

    await User.update(params, { where: { id: req.user.id } });

    res.json(resb);
  }
);

app.patch(
  "/api/users/org-settings",
  Common.ensureAuthenticated("Administrator"),
  async (req, res) => {
    //l('/api/users/org-settings req.user.permissions', req.user.permissions)
    //only user self-changable properties. e.g. not permissions

    var resb = {};
    var params = {};

    if (typeof req.body.settings == "object") {
      params.settings = JSON.stringify(req.body.settings);
    }

    await Org.update(params, { where: { id: req.user.org_id } });
    res.json(resb);
  }
);
/*

var data = {
  email: 'john2@mailinator.com'
}

curl -v -X POST -H "Accept: application/json" -H "Content-type: application/json"  -d '{"email": "john2@mailinator.com"}' -D - https://.herokuapp.com/api/users/password/forgot

curl -v -X POST -H "Accept: application/json" -H "Content-type: application/json"  -d '{"email": "john2@mailinator.com"}' -D - http://localhost:3000/api/users/password/forgot
curl -v -X POST -H "Accept: application/json" -H "Content-type: application/json"  -d '{"email": "john2@mailinator.com"}' -D - http://127.0.0.1:3000/api/users/password/forgot
*/
app.post("/api/users/password/forgot", async (req, res) => {
  var resb = {};
  var valid = validator.isEmail(req.body.email);

  if (!valid) {
    res.status(412);
    res.send("Invalid email");
    return;
  }

  var email = req.body.email.toLowerCase();

  var reset_password_token = Common.generateUuid();
  let result = pgpool.query("UPDATE users SET reset_password_token = '" + reset_password_token + "', reset_password_valid_by = NOW() + INTERVAL '1 hour' WHERE email = '" + email + "'");
  // let user = await User.update(
  //   {
  //     reset_password_token: Common.generateUuid(),
  //     reset_password_valid_by: 'NOW() + INTERVAL `1 hour`',
  //     // reset_password_valid_by: "NOW() + interval '1 hours'",
  //   },
  //   {
  //     where: {
  //       email,
  //     },
  //   }
  // );
  // let user = false;
  if (!result) {
    res.status(412); // Precondition Failed
    res.send("Email does not exist");
    return;
  }

  var emailo = {
    to: email,
    subject: "Password reset",
    body: 'Hello,Somebody, probably you, requested to reset your password. To reset, click https://' + process.env.APP_HOSTNAME + '/set-password?token=' + reset_password_token + ' Link is valid for 1 hour.'
  };

 /* emailo.options = {
    transactional: true, //https://www.sparkpost.com/docs/user-guide/remove-list-unsubscribe-header/
    open_tracking: true,
  }; */

  Common.sendEmail(emailo);

  res.json(resb);
});

/*

var data = {
 token: '...',
 password: '...'
}
*/
app.post("/api/users/password/reset", async (req, res) => {
  var resb = {};

  var valid =
    validator.isLength(req.body.token, 10) &&
    validator.isLength(req.body.password, 6);

  if (!valid) {
    res.status(412);
    res.send("Invalid or expired reset token");
    return;
  }

  var password = req.body.password;

  var salt = await bcrypt.genSalt(10);
  var hashed_password = await bcrypt.hash(password, salt);
  let user = await User.update(
    {
      password: hashed_password,
      salt,
      verified: true,
    },
    {
      where: {
        [Op.and]: {
          reset_password_token: req.body.token,
          reset_password_valid_by: {
            [Op.gt]: "NOW()",
          },
        },
      },
    }
  );

  if (!user) {
    res.status(412);
    res.send("Invalid or expired token.");
    return;
  }

  res.json(resb);
});

//limit to users with 'admin' permission
app.get(
  "/api/staff",
  Common.ensureAuthenticated("Administrator"),
  async (req, res) => {
    let users = await User.findAll({
      where: {
        org_id: req.user.org_id,
      },
      order: [["name", "DESC"]],
    });

    res.json(users.toJSON());
  }
);

app.get(
  "/api/staff/:id",
  Common.ensureAuthenticated("Administrator"),
  async (req, res) => {
    let user = await User.findOne({
      org_id: req.user.org_id,
      id: req.params.id,
    });
    if (!user) {
      return res.json({ user: {} });
    }
    res.json(user.toJSON());
  }
);

app.post(
  "/api/staff",
  Common.ensureAuthenticated("Administrator"),
  async (req, res) => {
    var valid = validator.isEmail(req.body.email);
    if (!valid) {
      res.status(412);
      res.json({ error: "Please complete all fields with valid data" });
      return;
    }

    var user_data = req.body;
    user_data.email = user_data.email.trim().toLowerCase();
    user_data.id = Common.generateId();
    user_data.invite_key = Common.generateUuid();
    var sql = `
        INSERT INTO users (id, org_id, invite_key, permissions, email, marketing_unsubscribe_token, referral) 
        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
        `;
    //l(sql)
    var user = {};
    try {
      user = await User.create({
        id: user_data.id,
        org_id: req.user.org_id,
        invite_key: user_data.invite_key,
        permissions: user_data.permissions,
        email: user_data.email,
        marketing_unsubscribe_token: Common.generateUuid(),
        referral: "invite",
      });
    } catch (e) {
      l("error", jsons(e));
      res.status(412);
      res.json({
        error:
          'This email is already registered. To use a different email, append "+something" after username, eg "john+company@gmail.com"',
      });
    }

    //send invite email
    var email = {
      to: user_data.email,
      reply_to: req.user.email,
      subject: "Invite to join",
      body: 'Hello,' + req.user.name + ' has invited you to join' + req.user.org_name + ' on ' + process.env.APP_NAME + '! To accept the invite, click https://' + process.env.APP_HOSTNAME + '/sign-up/?email=' + user_data.email + '&invite_key=' + user_data.invite_key + '&invite_id=' + user_data.id
        
    };
    Common.sendEmail(email);
    res.json({});
  }
);

app.patch(
  "/api/staff/:id",
  Common.ensureAuthenticated("Administrator"),
  async (req, res) => {
    var valid = validator.isEmail(req.body.email);
    if (!valid) {
      res.status(412);
      res.json({ error: "Please complete all fields with valid data" });
      return;
    }

    var staff = req.body;
    staff.email = staff.email.trim().toLowerCase();
    try {
      let user = await User.update(
        {
          email: staff.email,
          permissions: staff.permissions,
        },
        {
          where: {
            [Op.and]: {
              org_id: req.user.org_id,
              id: req.params.id,
            },
          },
        }
      );
    } catch (e) {
      l("error", jsons(e));
      res.status(412);
      res.json({ error: "Record not found" });
      return;
    }

    res.json({});
  }
);

app.delete(
  "/api/staff/:id",
  Common.ensureAuthenticated("Administrator"),
  async (req, res) => {
    await User.destroy({
      where: {
        [Op.and]: {
          org_id: req.user.org_id,
          id: req.params.id,
        },
      },
    });
    res.json({});
  }
);

app.post("/api/test", passport.authenticate("jwt"), (req, res) => {
  res.status(200).json({ message: "Jwt success", user: req.user });
});

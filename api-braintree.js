const User = require("./models/User");
const Org = require("./models/Org");

//need client to support 3D secure, tokenization key doesn't work with 3D
app.get(
  "/api/braintree/client-token",
  Common.ensureAuthenticated(),
  async (req, res) => {
    l("/api/braintree/client-token for user", req.user.email);
    /*
    If you specify a customerId when generating a client token, it must be a valid one. 
    You do not need to include a customer id when creating a client token for a first time customers. 
    Typically you would create create a customer when handling the submission of your checkout form, and then store that customer id in a database for use later.
    */
    braintree_gateway.clientToken.generate({}, function (err, response) {
      if (err) {
        l("braintree_gateway.clientToken", jsons(err));
        return res.json({
          error: jsons(err),
        });
      }
      //l("clientToken", response.clientToken)
      res.json({
        client_token: response.clientToken,
      });
    });
  }
);

//4111 1111 1111 1111
app.post(
  "/api/braintree/nonce",
  Common.ensureAuthenticated(),
  async (req, res) => {
    var valid = validator.isLength(req.body.nonce, 1);
    if (!valid) {
      res.status(400);
      return res.send("Invalid params");
    }
    //let plan_id = req.body.plan_id || 'default-plan-id' -- when having multiple plans, get chosen plan from dashboard
    let plan_id = process.env.BRAINTREE_PLAN_ID;
    l("error hurray! subscription start for plan_id", plan_id);
    var customer = {
      email: req.user.email,
      id: req.user.id.toString(),
      //customerIp: Common.getClientIp(req), IPv6 format, which braintree doesn't currently support.
      paymentMethodNonce: req.body.nonce,
    };
    l("/api/braintree/nonce customer", jsons(customer));

    //can't create twice with same id
    braintree_gateway.customer.find(
      customer.id.toString(),
      function (err, braintree_customer) {
        if (err) {
          //not found notFoundError
          braintree_gateway.customer.create(customer, function (err, result) {
            if (err) {
              l("error /api/braintree/nonce customer.create", jsons(err));
              return res.json({
                error: jsons(err),
              });
            }

            if (!result.success) {
              l(
                "error /api/braintree/nonce customer.create !result.success",
                jsons(result)
              );
              return res.json({
                error: "braintree !result.success " + result.message,
              });
            }
            braintree_gateway.subscription.create(
              {
                paymentMethodToken: result.customer.paymentMethods[0].token,
                planId: plan_id,
                /*descriptor: {
                            name: process.env.SUBSCRIPTION_DESCRIPTOR_NAME,
                            phone: process.env.SUBSCRIPTION_DESCRIPTOR_PHONE,
                            url: process.env.SUBSCRIPTION_DESCRIPTOR_URL
                        }*/
              },
              function (err, result) {
                if (err) {
                  l(
                    "error /api/braintree/nonce subscription.create",
                    jsons(err)
                  );
                  return res.json({
                    error: jsons(err),
                  });
                }
                //copy-paste for new & existing customers
                if (result.success === false) {
                  err = "Declined";
                  if (typeof result.message === "string") {
                    err = result.message;
                  }
                  return res.json({
                    error: jsons(err),
                  });
                }
                l("error subscription.create SUCCESS1", jsons(result));
                if (typeof result.subscription == "object") {
                  var s = result.subscription;
                  //update session var
                  req.user.subscription_start_date = new Date();
                  var ip =
                    req.headers["x-forwarded-for"] ||
                    req.connection.remoteAddress;
                  var country_code = "";
                  if (
                    typeof s.transactions === "object" &&
                    s.transactions.length &&
                    typeof s.transactions[0].creditCard === "object" &&
                    typeof s.transactions[0].creditCard.customerLocation ===
                      "string"
                  ) {
                    country_code =
                      s.transactions[0].creditCard.customerLocation; //wrongly set to US. "countryOfIssuance": "ROU"
                  }
                  /* TODO paypal else if (typeof result.subscription.transactions == 'object' && typeof result.creditCard.customerLocation === 'string') {
                            country_code = result.creditCard.customerLocation
                        }                        
                        */

                  //users or orgs
                  if (process.env.USER_MODE == "single") {
                    User.update(
                      {
                        subscription_start_date: "NOW()",
                        subscription_ip: ip,
                        subscription_card_country_code: country_code,
                        subscription: jsons(s),
                      },
                      { where: { id: req.user.id } }
                    ).then(() => res.json({}));
                  } else {
                    Org.update(
                      {
                        subscription_start_date: "NOW()",
                        subscription_ip: ip,
                        subscription_card_country_code: country_code,
                        subscription: jsons(s),
                      },
                      { where: { id: req.user.org_id } }
                    ).then(() => res.json({}));
                  }
                } else {
                  return res.json({
                    error: "Empty subscription, probably card is invalid.",
                  });
                }
                //end copy-paste
              }
            );
          });
        } else {
          //l("found customer.find", jsons(braintree_customer))
          braintree_gateway.paymentMethod.create(
            {
              customerId: customer.id,
              paymentMethodNonce: customer.paymentMethodNonce,
              options: {
                makeDefault: true,
              },
            },
            function (err, result) {
              l(" braintree_gateway.paymentMethod.create", jsons(result));
              /*
	"paymentMethod": {
		"bin": "411111",
		"cardType": "Visa",
		"cardholderName": null,
		"commercial": "Unknown",
		"countryOfIssuance": "Unknown",
		"createdAt": "2017-07-13T17:02:26Z",
		"customerId": "4",
		"customerLocation": "US",
		"debit": "Unknown",
		"default": true,
		"durbinRegulated": "Unknown",
		"expirationMonth": "02",
		"expirationYear": "2022",
		"expired": false,
		"healthcare": "Unknown",
		"imageUrl": "https://assets.braintreegateway.com/payment_method_logo/visa.png?environment=sandbox",
		"issuingBank": "Unknown",
		"last4": "1111",
		"payroll": "Unknown",
		"prepaid": "Unknown",
		"productId": "Unknown",
		"subscriptions": [],
		"token": "7q64jp",
		"uniqueNumberIdentifier": "f3c4a896b102fd7c991755fdef7bc55d",
		"updatedAt": "2017-07-13T17:02:26Z",
		"venmoSdk": false,
		"verifications": [],
		"maskedNumber": "411111******1111",
		"expirationDate": "02/2022"
	}

                */
              //will not include the customer
              if (err) {
                l(
                  "error /api/braintree/nonce paymentMethod.create",
                  jsons(err)
                );
                return res.json({
                  error: jsons(err),
                });
              }

              if (!result.success) {
                l(
                  "error /api/braintree/nonce paymentMethod.create !result.success ",
                  jsons(result)
                );
                return res.json({
                  error: "braintree !result.success " + result.message,
                });
              }

              braintree_gateway.subscription.create(
                {
                  paymentMethodToken: result.paymentMethod.token,
                  planId: plan_id,
                },
                function (err, result) {
                  if (err) {
                    l(
                      "error /api/braintree/nonce subscription.create",
                      jsons(err)
                    );
                    return res.json({
                      error: jsons(err),
                    });
                  }

                  //copy-paste for new & existing customers
                  if (result.success === false) {
                    err = "Declined";
                    if (typeof result.message === "string") {
                      err = result.message;
                    }
                    return res.json({
                      error: jsons(err),
                    });
                  }
                  l("error subscription.create SUCCESS2", jsons(result));
                  if (typeof result.subscription == "object") {
                    var s = result.subscription;
                    //update session var
                    req.user.subscription_start_date = new Date();
                    var ip =
                      req.headers["x-forwarded-for"] ||
                      req.connection.remoteAddress;
                    var country_code = "";
                    if (
                      typeof s.transactions === "object" &&
                      s.transactions.length &&
                      typeof s.transactions[0].creditCard === "object" &&
                      typeof s.transactions[0].creditCard.customerLocation ===
                        "string"
                    ) {
                      country_code =
                        s.transactions[0].creditCard.customerLocation;
                    }
                    /* TODO paypal else if (typeof result.subscription.transactions == 'object' && typeof result.creditCard.customerLocation === 'string') {
                            country_code = result.creditCard.customerLocation
                        }*/
                    if (process.env.USER_MODE == "single") {
                      User.update(
                        {
                          subscription_start_date: "NOW()",
                          subscription_ip: ip,
                          subscription_card_country_code: country_code,
                          subscription: jsons(s),
                        },
                        { where: { id: req.user.id } }
                      ).then(() => res.json({}));
                    } else {
                      Org.update(
                        {
                          subscription_start_date: "NOW()",
                          subscription_ip: ip,
                          subscription_card_country_code: country_code,
                          subscription: jsons(s),
                        },
                        { where: { id: req.user.org_id } }
                      ).then(() => res.json({}));
                    }
                  } else {
                    return res.json({
                      error: "Empty subscription, probably card is invalid.",
                    });
                  }
                  //end copy-paste
                }
              );
            }
          );
        }
      }
    );

    //TODO PayPal
    /*
    Paypal.createSubscription(plan, nonce, function (subscribed) {
			if (subscribed) {
				res.render('index', {
					page: 'subscribed',
					data: JSON.stringify(subscribed, null, 3)
				});
			} else {
				// TODO: Something went wrong report back to user
				res.status(404).send('Service is not avialble at this time');
			}
		});

*/
  }
);

app.get(
  "/api/braintree/subscriptions",
  Common.ensureAuthenticated("admin"),
  async (req, res) => {
    //fetch from braintree, to make sure it's up to date, and update db too
    braintree_gateway.customer.find(
      req.user.id.toString(),
      function (err, braintree_customer) {
        if (err) {
          l("braintree_gateway.customer.find", jsons(err));
          return res.json({
            error: jsons(err),
          });
        }

        if (typeof braintree_customer.paymentMethods != "object") {
          return res.json({});
        }
        l("braintree_customer", jsons(braintree_customer.paymentMethods));

        //get all active subscriptions
        var subscriptions = [],
          subscriptions_client = [];
        for (let pm of braintree_customer.paymentMethods) {
          if (typeof pm.subscriptions != "object") {
            continue;
          }
          for (let s of pm.subscriptions) {
            if (s.status != "Active") {
              continue;
            }
            subscriptions.push(s);
            //send less data to client
            subscriptions_client.push({
              nextBillingDate: s.nextBillingDate,
              nextBillAmount: s.nextBillAmount,
              id: s.id,
            });
          }
        }
        if (process.env.USER_MODE == "single") {
          User.update(
            { subscription: jsons(subscriptions[0]) },
            { where: { id: req.user.id } }
          ).then(() => res.json({}));
        } else {
          Org.update(
            { subscription: jsons(subscriptions[0]) },
            { where: { id: req.user.org_id } }
          ).then(() => res.json({}));
        }
      }
    );
  }
);

app.post(
  "/api/braintree/subscription-cancel",
  Common.ensureAuthenticated("admin"),
  async (req, res) => {
    var valid = validator.isLength(req.body.id, 1);
    if (!valid) {
      res.status(400);
      return res.send("Invalid params");
    }
    let dbres = {};
    if (process.env.USER_MODE == "single") {
      dbres = await User.findPk(req.user.id);
    } else {
      dbres = await Org.findPk(req.user.org_id);
    }

    if (dbres.subscription.id != req.body.id) {
      res.status(400);
      return res.send("Invalid params subscription id");
    }

    braintree_gateway.subscription.cancel(req.body.id, function (err, result) {
      if (err) {
        l("error /api/braintree/nonce customer.create", jsons(err));
        return res.json({
          error: jsons(err),
        });
      }
      if (!result.success) {
        l("error /api/braintree subscription.cancel !result.success ");
        return res.json({
          error: "braintree !result.success " + result.message,
        });
      }
      //if (all_subscriptions.length == 1) {
      //had just 1
      if (process.env.USER_MODE == "single") {
        User.update(
          { subscription_start_date: null },
          { where: { id: req.user.id } }
        ).then(() => res.json({}));
      } else {
        Org.update(
          { subscription_start_date: null },
          { where: { id: req.user.org_id } }
        ).then(() => res.json({}));
      }
    });
  }
);

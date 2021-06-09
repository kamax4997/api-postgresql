const sequalize = require("sequelize");
const dataTypes = sequalize.DataTypes;
const User = pgpool.define(
  "user",
  {
    id: {
      type: dataTypes.TEXT,
      allowNull: false,
      primaryKey: true,
    },
    org_id: {
      type: dataTypes.TEXT,
      allowNull: true,
    },
    invite_key: {
      type: dataTypes.TEXT,
      allowNull: true,
    },
    permissions: {
      type: dataTypes.ARRAY(dataTypes.TEXT),
    },
    create_date: {
      type: dataTypes.DATE,
    },
    email: {
      type: dataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    verified: {
      type: dataTypes.BOOLEAN,
    },
    salt: {
      type: dataTypes.TEXT,
    },
    password: {
      type: dataTypes.TEXT,
    },
    last_signin_date: {
      type: dataTypes.TIME,
    },
    one_time_signin_token: {
      type: dataTypes.TEXT,
    },
    reset_password_token: {
      type: dataTypes.TEXT,
    },
    reset_password_valid_by: {
      type: dataTypes.TIME,
    },
    name: {
      type: dataTypes.STRING,
    },
    first_name: {
      type: dataTypes.STRING,
    },
    phone: {
      type: dataTypes.STRING,
    },
    photo: {
      type: dataTypes.JSONB,
    },
    settings: {
      type: dataTypes.JSONB,
    },
    marketing: {
      type: dataTypes.BOOLEAN,
    },
    marketing_unsubscribe_token: {
      type: dataTypes.TEXT,
    },
    referral: {
      type: dataTypes.TEXT,
    },
    source: {
      type: dataTypes.TEXT,
    },
    meta: {
      type: dataTypes.JSONB,
    },
    trial_days: {
      type: dataTypes.NUMBER,
    },
    subscription_start_date: {
      type: dataTypes.TIME,
    },
    subscription_processor: {
      type: dataTypes.TEXT,
    },
    subscription_ip: {
      type: dataTypes.TEXT,
    },
    subscription_card_country_code: {
      type: dataTypes.TIME,
    },
    subscription: {
      type: dataTypes.JSON,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = User;

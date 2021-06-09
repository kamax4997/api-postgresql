const sequalize = require("sequelize");
const dataTypes = sequalize.DataTypes;

const Org = pgpool.define(
  "org",
  {
    id: {
      type: dataTypes.TEXT,
      allowNull: false,
      primaryKey: true,
    },
    create_date: {
      type: dataTypes.DATE,
    },
    created_by: {
      type: dataTypes.TEXT,
    },
    update_date: {
      type: dataTypes.DATE,
    },
    update_by: {
      type: dataTypes.TEXT,
    },
    name: {
      type: dataTypes.TEXT,
    },
    email: {
      type: dataTypes.TEXT,
    },
    homepage_url: {
      type: dataTypes.TEXT,
    },
    logo: {
      type: dataTypes.JSONB,
    },
    plan: {
      type: dataTypes.TEXT,
      allowNull: false,
    },
    settings: {
      type: dataTypes.JSONB,
    },
    settings_private: {
      type: dataTypes.JSONB,
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

module.exports = Org;

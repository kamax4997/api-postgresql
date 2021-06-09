const sequalize = require("sequelize");
const dataTypes = sequalize.DataTypes;

const Product = pgpool.define(
  "product",
  {
    id: {
      type: dataTypes.TEXT,
      allowNull: false,
      primaryKey: true,
    },
    create_date: {
      type: dataTypes.DATE,
    },
    update_date: {
      type: dataTypes.DATE,
    },
    org_id: {
      type: dataTypes.TEXT,
      allowNull: false,
    },
    title: {
      type: dataTypes.TEXT,
    },
    description: {
      type: dataTypes.TEXT,
    },
    type: {
      type: dataTypes.TEXT,
    },
    tags: {
      type: dataTypes.ARRAY(dataTypes.TEXT),
    },
    price: {
      type: dataTypes.NUMBER,
    },
    images: {
      type: dataTypes.JSONB,
    },
    meta: {
      type: dataTypes.JSONB,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = Product;

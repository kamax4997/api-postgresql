require('dotenv').config(); // this is important!
module.exports = {
    "development": {
        "username": 'jobs',
        "password": 'postgres',
        "database": 'jobs',
        "host": 'localhost',
        "dialect": "postgres"
    },
    "test": {
        "username": "root",
        "password": null,
        "database": "database_test",
        "host": "127.0.0.1",
        "dialect": "postgres"
    },
    "production": {
        "username": "root",
        "password": null,
        "database": "database_production",
        "host": "127.0.0.1",
        "dialect": "postgres"
    }
};
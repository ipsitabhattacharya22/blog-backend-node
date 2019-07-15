// Importing dependencies
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
var compression = require('compression')
var secure = require('express-secure-only');
var helmet = require('helmet');
var path = require('path');
// const logger = require('./utils/logger')(__filename);

const app = express();
app.use(compression());
app.enable('trust proxy');
require('dotenv').config();

// security features enabled in production
if (app.get('env') === "production") {
    // redirects http to https
    app.use(secure());

    // helmet with defaults
    app.use(helmet());
}

corsoptions = {
    "origin": ["http://localhost:4200", "https://localhost:4200", "http://localhost:4205", "https://localhost:4205"],
    "credentials": true,
    "preflightContinue": false,
    "optionsSuccessStatus": 204,
    "maxAge": 1234,
    "allowedHeaders": ['application/json', 'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'x-client-key', 'x-client-token', 'x-client-secret', 'Authorization'],
    "allowMethods": ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors(corsoptions));
app.options('*', cors(corsoptions));



// error handler
app.use(function (err, req, res, next) {
    if (err) {
        // logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
        res.status(err.status || 500);
        res.send('Server Error');
    }
    else {
        // logger.info(`${req.originalUrl} - ${req.method} - ${req.ip}`);
        next();
    }
});

app.use(express.static(path.join(__dirname, 'dist')));

//Router

app.use('', require('./router/api'));

//Listening Port
var port = process.env.PORT || 4000;
app.listen(port, () => { console.log(`port ${port} is connected to server`) });
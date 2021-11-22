const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const proxy = require('express-http-proxy');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = low(adapter);

function getHost(req) {
    return db.get(req.headers.host).value() || undefined;
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.route('/add')
    .get((req, res, next) => {
        if (req.headers.host !== 'domains.akshit.xyz') next();
        res.render('index');
    })
    .post((req, res, next) => {
        if (req.headers.host !== 'domains.akshit.xyz') next();
        if (!req.body.host || !req.body.address) return next(createError(400, 'Missing host or address!'));
        if (!!db.get(req.body.host).value()) return next(createError(403, 'This host already has a host attached. Please contact staff.'));
        db.set(req.body.host, req.body.address).write();
        res.render('success');
    });

app.use('/', proxy(getHost, {
    proxyReqPathResolver: async function (req) {
        let parts = req.url.split('?');
        let queryString = parts[1];
        let updatedPath = parts[0].replace(/test/, 'tent');
        return updatedPath + (queryString ? '?' + queryString : '');
    },
    proxyErrorHandler: function (err, res, next) {
        // Terrible error handling at it's best! :)
        if (err.toString() === "TypeError: Cannot read property 'request' of undefined") {
            return next(createError(400, 'The website you are trying to reach does not exist on this Sperse.'));
        }
        switch (err && err.code) {
            case 'ECONNRESET': {
                return next(createError(503, 'The origin service is currently unavailable.'));
            }
            case 'ECONNREFUSED': {
                return next(createError(502, 'Gateway Error! Can not connect to the origin service.'));
            }
            default: {
                return next(createError(500, 'The server encountered an error.'));
            }
        }
    }
}));

app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.code = err.status;
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
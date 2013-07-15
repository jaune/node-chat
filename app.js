/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    chat = require('./routes/chat'),
    http = require('http'),
    hbs = require('hbs'),
    amqp = require('amqp'),
    path = require('path'),
    events = require('events'),
    util = require("util"),
    fs = require('fs');

var app = express();



var MessageListener = function (name) {
    this.abortTimeout = null;
    this.stopTimeout = null;

    this.name = name;
    this.queue = null;
    this.consumerTag = null;

    this.messages = [];

    events.EventEmitter.call(this);
};
util.inherits(MessageListener, events.EventEmitter);

MessageListener.prototype.listen = function (exchanges) {
        var me = this;

        exchanges = exchanges || [];

        this.resetAbortTimeout();

        connection.queue(this.name, {
        }, function (queue) {
            me.queue = queue;

            console.log(queue.name);

            queue.subscribe(function (message, headers, deliveryInfo) {
                me.onMesage(message);
            }).addCallback(function(ok) {
                console.log('subscribe `'+ok.consumerTag+'`');
                me.consumerTag = ok.consumerTag;
            });

            exchanges.forEach(function (exchange) {
                console.log('bind `'+exchange+'`');
                queue.bind(exchange, '#');
            });
        });
    };

MessageListener.prototype.onMesage = function (message) {
    var me = this;

    this.resetAbortTimeout();

    this.messages.push(message);
    if (this.messages.length === 1) {
        this.stopTimeout = setTimeout(function () {
            me.onEnd();
        }, 1 * 1000);
    }
};

MessageListener.prototype.onEnd = function () {
    clearTimeout(this.abortTimeout);
    clearTimeout(this.stopTimeout);

    if (this.queue && this.consumerTag) {
        console.log('end (unsubscribe `'+this.consumerTag+'`)');
        this.queue.unsubscribe(this.consumerTag);
    }

    this.emit('end', this.messages);
};

MessageListener.prototype.resetAbortTimeout = function () {
    var me = this;

    if (this.abortTimeout) {
        clearTimeout(this.abortTimeout);
    }

    this.abortTimeout = setTimeout(function () {
        me.onAbort();
    }, 15 * 1000);

};

MessageListener.prototype.onAbort = function () {
    clearTimeout(this.abortTimeout);
    clearTimeout(this.stopTimeout);

    if (this.queue && this.consumerTag) {
        console.log('abort (unsubscribe `'+this.consumerTag+'`)');
        this.queue.unsubscribe(this.consumerTag);
    }

    this.emit('abort');
};




// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'hbs');
app.set('amqp url', 'amqp://localhost');

app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());

app.use(function(req, res, next){

    var exchanges = {};

    function sendMessage(exchange, body, next) {
        console.log('|-->');
        exchange.publish('all', body);
        console.log('-->|');
        next(null, body);
    }

    req.services = {
         amqp: {
             createMessageListener: function (config) {
                 var ml = new MessageListener(config.queue);
                 ml.listen(config.exchanges);
                 return ml;
             },
             sendMessage: function (exchange, body, next) {
                 if (!exchanges.hasOwnProperty(exchange)) {
                     connection.exchange(exchange, {
                         type: 'fanout'
                     }, function (exchange) {
                         sendMessage(exchange, body, next);
                     });
                 } else {
                     sendMessage(exchanges[exchange], body, next);
                 }
             }
         }
    };
    next();
});

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

app.get('/chats/', chat.index);
app.post('/chats/messages/', chat.postMessage);
app.get('/chats/messages/', chat.waitMessages);

require(path.join(__dirname, 'helpers.js')).registerHelpers(app, hbs);

var connection = amqp.createConnection({url: app.get('amqp url')});

connection.on('ready', function () {
    console.log('RabbitMQ connection: ready');
/*
    connection.exchange('channel-42', {
        type: 'fanout'
    }, function (exchange) {
        console.log('Exchange `' + exchange.name + '` is open');



    });
*/
    http.createServer(app).listen(app.get('port'), function () {
        console.log('Express server listening on port ' + app.get('port'));
    });

});




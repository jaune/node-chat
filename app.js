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


var MessageDispatcher = function () {
    this.connection = null;

    this.exchanges = {};
    this.queues = {};
};

MessageDispatcher.prototype.connect = function (url, next) {
    var readyCounter = 0;
    this.connection = amqp.createConnection({url: url});
    this.connection.on('ready', function () {
        console.log('RabbitMQ connection: ready ('+readyCounter+')');
        if (readyCounter === 0) {
            next(null);
        }
        readyCounter++;
    });
    this.connection.on('error', function (error) {
        throw error;
    });
};

MessageDispatcher.prototype.sendMessage = function (exchange_name, message, next) {
    this.lookupExchange(exchange_name, function (exchange) {
        exchange.publish('all', message, {
            deliveryMode: 2 // Non-persistent (1) or persistent (2)
        });
        next(null, message);
    });
}

MessageDispatcher.prototype.lookupExchange = function (exchange_name, next) {
    var me = this;

    if (!this.exchanges.hasOwnProperty(exchange_name)) {
        console.log('lookup exchange `'+exchange_name+'`.');
        this.connection.exchange(exchange_name, {
            type: 'fanout',
            durable: true
        }, function (exchange) {
            console.log('found exchange `'+exchange.name+'`.');
            me.exchanges[exchange.name] = exchange;
            next(exchange);
        });
    } else {
        next(this.exchanges[exchange_name]);
    }
};

MessageDispatcher.prototype.lookupQueue = function (queue_name, next) {
    var me = this;

    if (!this.queues.hasOwnProperty(queue_name)) {
        console.log('lookup queue `'+queue_name+'`.');
        var queue = this.connection.queue(queue_name, {
            durable: true,
            autoDelete: false
        }, function (queue) {
            console.log('found queue `'+queue.name+'`.');
            me.queues[queue.name] = queue;
            next(queue);
        });
    } else {
        next(this.queues[queue_name]);
    }
};

MessageDispatcher.prototype.createMessageListener = function (name) {
    return new MessageListener(this, name);
};


var MessageListener = function (dispatcher, name) {
    this.abortTimeout = null;
    this.stopTimeout = null;

    this.dispatcher = dispatcher;
    this.name = name;
    this.queue = null;
    this.consumerTag = null;

    this.messages = [];

    events.EventEmitter.call(this);
};
util.inherits(MessageListener, events.EventEmitter);

MessageListener.prototype.subscribe = function (exchanges) {
    var me = this;

    exchanges = exchanges || [];

    this.resetAbortTimeout();

    this.dispatcher.lookupQueue(this.name, function (queue) {
        me.queue = queue;

        console.log(queue.name);

        queue.subscribe({
        },function (message, headers, deliveryInfo) {
            me.onMesage(message);
        }).addCallback(function (ok) {
            console.log('subscribe `' + ok.consumerTag + '`');
            me.consumerTag = ok.consumerTag;
        });

        exchanges.forEach(function (exchange_name) {
            console.log('bind `' + exchange_name + '`');
            me.dispatcher.lookupExchange(exchange_name, function (exchange) {
                queue.bind(exchange.name, '#');

            });
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
        }, 500);
    }
};

MessageListener.prototype.onEnd = function () {
    clearTimeout(this.abortTimeout);
    clearTimeout(this.stopTimeout);

    if (this.queue && this.consumerTag) {
        console.log('end (unsubscribe `' + this.consumerTag + '`)');
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
        me.onTimeout();
    }, 15 * 1000);

};

MessageListener.prototype.onTimeout = function () {
    this.unsubscribe();
    this.emit('timeout');
};

MessageListener.prototype.unsubscribe = function () {
    clearTimeout(this.abortTimeout);
    clearTimeout(this.stopTimeout);

    if (this.queue && this.consumerTag) {
        console.log('abort (unsubscribe `' + this.consumerTag + '`)');
        this.queue.unsubscribe(this.consumerTag);
    }
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



app.use(function (req, res, next) {
    req.services = {
        amqp: {
            createMessageListener: function (config) {
                var ml = dispatcher.createMessageListener(config.queue);
                ml.subscribe(config.exchanges);
                return ml;
            },
            sendMessage: function (exchange, message, next) {
                dispatcher.sendMessage(exchange, message, next);
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

var dispatcher = new MessageDispatcher();
dispatcher.connect(app.get('amqp url'), function () {

    http.createServer(app).listen(app.get('port'), function () {
        console.log('Express server listening on port ' + app.get('port'));
    });

});


/*
 var redis = require('redis');
 var url = require('url');
 var client = redis.createClient('14332', 'pub-redis-14332.eu-west-1-1.2.ec2.garantiadata.com', {no_ready_check: true});
 client.auth('testtest');

 client.set('foo', 'bar');
 client.get('foo', function (err, reply) {
 console.log(reply.toString()); // Will print `bar`
 });
 */






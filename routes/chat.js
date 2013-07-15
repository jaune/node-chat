
/*
 * GET home page.
 */

exports.index = function(req, res){
    res.render('chat/index', { title: 'Express' });
};



exports.postMessage = function(req, res){
    var agent = req.query.agent;

    if (!agent) {
        res.json(400, {
            message: 'Missing parameter `agent`.'
        });
        return;
    }



    req.services.amqp.sendMessage('channel-42', {
        agent: agent,
        sent_at: req.body.date,
        posted_at: new Date(),
        text: req.body.text
    }, function (err, message) {
        if (err) {
            res.json(500, {
                message: 'Unexpected error.'
            });
            return;
        }

        res.json({
            agent: agent,
            message: message
        });

    });

};


exports.waitMessages = function(req, res){
    var agent = req.query.agent;

    if (!agent) {
        res.json(400, {
            message: 'Missing parameter `agent`.'
        });
        return;
    }

    if (false) {
    setTimeout(function () {
        res.json({
            message: 'abort',
            messages: []
        });
    }, 15 * 1000);
    } else {

    var ml = req.services.amqp.createMessageListener({
        queue: 'agent-'+agent,
        exchanges: ['channel-42']
    });

    ml.on('abort', function () {
        res.json({
            message: 'abort',
            messages: []
        });
    });

    ml.on('end', function (messages) {
        res.json({
            message: 'end',
            messages: messages
        });
    });

    }
};


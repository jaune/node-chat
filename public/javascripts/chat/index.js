(function ($) {
    var agent = null;

    var $messages = $('#chat\\.index\\.messages');

    var $tplMessageLeft = $('#template\\:chat\\/message\\/left');
    var $tplMessageRight = $('#template\\:chat\\/message\\/right');

    var tplMessageLeft = Handlebars.compile($tplMessageLeft.html());
    var tplMessageRight = Handlebars.compile($tplMessageRight.html());

    function sendMessage (text) {
        if (!agent) {
            return;
        }

        var date = new Date();

        var locals = {
            text: text,
            author: 'Me',
            date: date.toLocaleString()
        };

        var message = {
            text: text,
            date: date
        };

        var jqXHR = $.ajax({
            type: 'POST',
            url: '/chats/messages/?agent='+agent,
            data: JSON.stringify(message),
            timeout: 25 * 1000,
            dataType: 'json',
            contentType: 'application/json',
            success: function (data, textStatus, jqXHR) {
//                console.debug('success');
            },
            error: function (jqXHR, textStatus, errorThrown) {
//                console.debug('error');
            },
            complete: function (jqXHR, textStatus) {
//                console.debug('complete');

            }
        });
    }

    function waitMessages () {
        if (!agent) {
            return;
        }
        var date = new Date();
        var disbaleCache = date.getTime().toString(36)+Math.round(Math.random()*3141592).toString(36);

        var jqXHR = $.ajax({
            type: 'GET',
            url: '/chats/messages/?agent='+agent+'&dc='+disbaleCache,
            timeout: 25 * 1000,
            dataType: 'json',
            success: function (data, textStatus, jqXHR) {
//                console.debug('success');
                receiveMessages(data.messages || []);
            },
            error: function (jqXHR, textStatus, errorThrown) {
//                console.debug('error');
            },
            complete: function (jqXHR, textStatus) {
//                console.debug('complete');

            }
        });
    }

    function receiveMessages (messages) {
        if (!agent) {
            return;
        }
        messages.forEach(function (message) {
            if (message.agent === agent) {
                $messages.prepend(tplMessageLeft(message));
            } else {
                $messages.prepend(tplMessageRight(message));
            }
        });

        //setTimeout(function () {
            waitMessages();
        //}, 7.5 * 1000);


    }

    (function () {
        var $formSendMessage = $('#chat\\.index\\.formSendMessage');

        $formSendMessage.submit(function() {
            var $input = $formSendMessage.find('input[name="message"]');
            var text = $input.val();
            if (text.length) {
                sendMessage(text);
                $input.val('');
            }
            return false;
        });
    })();

    (function () {
        var $formConnect = $('#chat\\.index\\.formConnect');

        $formConnect.submit(function() {
            window.setTimeout(function () {
                var $input = $formConnect.find('input[name="agent"]');
                var text = $input.val();
                if (text.length) {
                    agent = text;
                    $formConnect
                        .parent('div.container')
                        .append('<span class="brand">Agent: `'+agent+'`</span>');
                    $formConnect.remove();
                    waitMessages();
                }
            }, 1);
            return false;
        });
    })();


})(jQuery);
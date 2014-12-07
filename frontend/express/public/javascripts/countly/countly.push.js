(function (countlyPush, $, undefined) {

    window.MessageStatus = {
        Initial:        0,
        InQueue:        1 << 1,
        InProcessing:   1 << 2,
        Sent:           1 << 3,
        Error:          1 << 4,
        Aborted:        1 << 5,
        Deleted:        1 << 6
    };


    //Private Properties
    var _pushDb = {},
        _activeAppKey = 0,
        _initialized = false;

    countlyPush.debug = function() {
        console.log('debug');
    };

    //Public Methods
    countlyPush.initialize = function () {
        if (!countlyCommon.DEBUG) {
            _activeAppKey = countlyCommon.ACTIVE_APP_KEY;
            _initialized = true;

            return $.ajax({
                    type: "GET",
                    url:  countlyCommon.API_PARTS.pushes.r + '/all',
                    data: {
                        "api_key": countlyGlobal.member.api_key,
                        "period": countlyCommon.getPeriodForAjax()
                    },
                    dataType: "jsonp",
                    success: function (json) {
                        _pushDb = prepareMessages(json);
                    }
                });
        } else {
            return true;
        }
    };

    countlyPush.refresh = countlyPush.initialize;

    countlyPush.getAudience = function(data, success, error) {
        return $.ajax({
            type: "GET",
            url:  countlyCommon.API_PARTS.pushes.w + '/audience',
            data: { "api_key": countlyGlobal.member.api_key, args: JSON.stringify(data) },
            dataType: "jsonp",
            success: success,
            error: error
        })
    };

    countlyPush.createMessage = function(message, date, success, error) {
        return $.ajax({
            type: "GET",
            url:  countlyCommon.API_PARTS.pushes.w + '/create',
            data: { "api_key": countlyGlobal.member.api_key, args: JSON.stringify(message), date: date ? date.toString() : '' },
            dataType: "jsonp",
            success: function(json){
                if (json.error) {
                    error (json.error);
                } else {
                    success(prepareMessage(json))
                }
            }
        })
    };

    countlyPush.refreshMessage = function(message, success, error) {
        return $.ajax({
            type: "GET",
            url:  countlyCommon.API_PARTS.pushes.w + '/refresh',
            data: { "api_key": countlyGlobal.member.api_key, mid: message._id },
            dataType: "jsonp",
            success: function(json){
                var msg = prepareMessage(json);
                for (var i = 0; i < _pushDb.length; i++) {
                    if (_pushDb[i]._id == msg._id) _pushDb[i] = msg;
                }
                success(prepareMessage(json))
            },
            error: error
        })
    };

    countlyPush.retryMessage = function(messageId, success, error) {
        return $.ajax({
            type: "GET",
            url:  countlyCommon.API_PARTS.pushes.w + '/retry',
            data: { "api_key": countlyGlobal.member.api_key, mid: messageId },
            dataType: "jsonp",
            success: function(json){
                if (json.error) error(json.error);
                else success(prepareMessage(json));
            }
        })
    };

    countlyPush.deleteMessage = function(messageId, success, error) {
        return $.ajax({
            type: "GET",
            url:  countlyCommon.API_PARTS.pushes.w + '/delete',
            data: { "api_key": countlyGlobal.member.api_key, mid: messageId },
            dataType: "jsonp",
            success: function(json){
                if (json.error) error(json.error);
                else {
                    var msg = prepareMessage(json);
                    for (var i = 0; i < _pushDb.length; i++) {
                        if (_pushDb[i]._id == msg._id) {
                            _pushDb.splice(i, 1);
                            success(msg);
                        }
                    }
                }
            }
        })
    };

    countlyPush.reset = function () {
        _pushDb = {};
        _errorDb = {};
    };

    countlyPush.getMessagesForCurrApp = function () {
        var currAppMsg = [];

        for (var i = 0; i < _pushDb.length; i++) {
            if (_pushDb[i].apps.indexOf(countlyCommon.ACTIVE_APP_ID) !== -1) {
                currAppMsg.push(_pushDb[i]);
            }

            if (currAppMsg.length >= 10) {
                break;
            }
        }

        return currAppMsg;
    };

    countlyPush.getAllMessages = function () {
        return _pushDb;
    };

    function prepareMessages(msg) {
        if (msg._id) {
            return prepareMessage(msg);
        } else {
            return _.map(msg, function(msg){ return prepareMessage(msg); });
        }
    }

    function prepareMessage(msg) {
        if (typeof msg.result.sent == 'undefined' || msg.result.sent == 0) {
            msg.percentDelivered = 0;
            msg.percentNotDelivered = 100;
        } else {
            msg.percentDelivered = +(100 * msg.result.delivered / msg.result.sent).toFixed(2);
            msg.percentNotDelivered = +(100 * (msg.result.sent - msg.result.delivered) / msg.result.sent).toFixed(2);
        }

        if (typeof msg.result.total == 'undefined' || msg.result.total == 0) {
            msg.percentSent = 0;
            msg.percentNotSent = 100;
        } else {
            msg.percentSent = +(100 * msg.result.sent / msg.result.total).toFixed(2);
            msg.percentNotSent = +(100 * (msg.result.total - msg.result.sent) / msg.result.total).toFixed(2);
        }

        msg.local = {
            created: moment(msg.created).format("D MMM, YYYY HH:mm")
        };

        if (msg.date) msg.local.date = moment(msg.date).format("D MMM, YYYY HH:mm");
        if (msg.sent) msg.local.sent = moment(msg.sent).format("D MMM, YYYY HH:mm");

        return msg;
    }

}(window.countlyPush = window.countlyPush || {}, jQuery));
(function (countlyPushEvents, $, undefined) {
    var _periodObj,
        _pushEventsDb = {},
        _activeAppKey,
        _initialized;

    //Public Methods
    countlyPushEvents.initialize = function() {
        if (_initialized && _period == countlyCommon.getPeriodForAjax() && _activeAppKey == countlyCommon.ACTIVE_APP_KEY) {
            return countlyPushEvents.refresh();
        }

        _period = countlyCommon.getPeriodForAjax();

        if (!countlyCommon.DEBUG) {
            _activeAppKey = countlyCommon.ACTIVE_APP_KEY;
            _initialized = true;

            return $.when(
                    eventAjax("[CLY]_push_sent"),
                    eventAjax("[CLY]_push_open"),
                    eventAjax("[CLY]_push_action")
                ).then(function(){
                    return true;
                });

            function eventAjax(key) {
                return $.ajax({
                    type: "GET",
                    url: countlyCommon.API_PARTS.data.r,
                    data: {
                        "api_key": countlyGlobal.member.api_key,
                        "app_id" : countlyCommon.ACTIVE_APP_ID,
                        "method" : "events",
                        "event": key,
                        "segmentation": "no-segment",
                        "period":_period
                    },
                    dataType: "jsonp",
                    success: function(json) {
                        _pushEventsDb[key] = json;
                    }
                });
            }
        } else {
            return true;
        }
    };

    countlyPushEvents.refresh = function() {
        if (!countlyCommon.DEBUG) {
            return $.when(
                    eventAjax("[CLY]_push_sent"),
                    eventAjax("[CLY]_push_open"),
                    eventAjax("[CLY]_push_action")
                ).then(function(){
                    return true;
                });

            function eventAjax(key) {
                return $.ajax({
                    type: "GET",
                    url: countlyCommon.API_PARTS.data.r,
                    data: {
                        "api_key": countlyGlobal.member.api_key,
                        "app_id" : countlyCommon.ACTIVE_APP_ID,
                        "method" : "events",
                        "action" : "refresh",
                        "event": key,
                        "segmentation": "no-segment",
                        "period":_period
                    },
                    dataType: "jsonp",
                    success: function(json) {
                        countlyCommon.extendDbObj(_pushEventsDb[key], json);
                    }
                })
            }
        } else {
            _pushEventsDb = {"2012":{}};
            return true;
        }
    };

    countlyPushEvents.getDashDP = function() {
        var total = {
                chartDP: [],
                chartData: [],
                keyEvents: []
            },
            events = ["[CLY]_push_sent", "[CLY]_push_open", "[CLY]_push_action"],
            titles = [jQuery.i18n.map["common.sent"], jQuery.i18n.map["common.delivered"], jQuery.i18n.map["common.actions"]];
        events.forEach(function(event, i){
            var noSegmentIndex = _.pluck(_pushEventsDb[event], "_id"),
                eventDb = _pushEventsDb[event][noSegmentIndex.indexOf('no-segment')] || {},
                chartData = [
                    { data:[], label: titles[i], color: countlyCommon.GRAPH_COLORS[i] }
                ],
                dataProps = [
                    { name:"c" }
                ],
                eventData = countlyCommon.extractChartData(eventDb, countlyEvent.clearEventsObject, chartData, dataProps);

            total.chartDP.push(eventData.chartDP[0]);
            total.chartData.push(eventData.chartData[0]);
            total.keyEvents.push(eventData.keyEvents[0]);
        });
        return total;
    };

    countlyPushEvents.getDashSummary = function() {
        var events = ["[CLY]_push_sent", "[CLY]_push_open", "[CLY]_push_action"],
            titles = [jQuery.i18n.map["common.sent"], jQuery.i18n.map["common.delivered"], jQuery.i18n.map["common.actions"]],
            helps = ["dashboard.push.sent", "dashboard.push.delivered","dashboard.push.actions"],
            data = [];
        events.forEach(function(event, i){
            var ev = countlyPushEvents.getDashEventData(event);
            ev.title = titles[i];
            ev.help = helps[i];
            data.push(ev);
        });
        return data;
    };

    countlyPushEvents.getEventData = function(eventKey) {
        var chartData = [
                { data:[], label:jQuery.i18n.map["events.table.count"], color:'#DDDDDD', mode:"ghost"},
                { data:[], label:jQuery.i18n.map["events.table.count"], color: countlyCommon.GRAPH_COLORS[1] }
            ],
            dataProps = [
                {
                    name:"pc",
                    func:function (dataObj) {
                        return dataObj["c"];
                    },
                    period:"previous"
                },
                { name:"c" }
            ];

        var eventData = countlyCommon.extractChartData(_pushEventsDb[eventKey], countlyEvent.clearEventsObject, chartData, dataProps);
        eventData["eventName"] = eventKey;
        eventData["dataLevel"] = 1;
        eventData["tableColumns"] = [jQuery.i18n.map["common.date"], jQuery.i18n.map["events.table.count"]];

        var countArr = _.pluck(eventData.chartData, "c");
        if (countArr.length) {
            eventData.totalCount = _.reduce(countArr, function(memo, num){ return memo + num; }, 0);
        }

        return eventData;
    };

    countlyPushEvents.getDashEventData = function(eventKey) {
        _periodObj = countlyCommon.periodObj;

        var noSegmentIndex = _.pluck(_pushEventsDb[eventKey], "_id"),
            eventDb = _pushEventsDb[eventKey][noSegmentIndex.indexOf('no-segment')] || {};

        if (!eventDb) {
            return {
                total: 0,
                change: 'NA',
                trend: 'u',
                sparkline: '0,0'
            };
        }

        var currentTotal = 0,
            previousTotal = 0;

        if (_periodObj.isSpecialPeriod) {
            for (var i = 0; i < (_periodObj.currentPeriodArr.length); i++) {
                currentTotal += eventCount(eventDb, _periodObj.currentPeriodArr[i]);
                previousTotal += eventCount(eventDb, _periodObj.previousPeriodArr[i]);
            }
        } else {
            currentTotal = eventCount(eventDb, _periodObj.activePeriod);
            previousTotal = eventCount(eventDb, _periodObj.previousPeriod);
        }

        var changeTotal = countlyCommon.getPercentChange(previousTotal, currentTotal);

        return {
            "total":currentTotal,
            "change":changeTotal.percent,
            "trend":changeTotal.trend
        };
    };

    countlyPushEvents.calcSparklineData = function(eventKey) {
        var sparkLine = [];
        _periodObj = countlyCommon.periodObj;

        if (!_periodObj.isSpecialPeriod) {
            for (var i = _periodObj.periodMin; i < (_periodObj.periodMax + 1); i++) {
                var tmpObj = countlyCommon.getDescendantProp(_pushEventsDb[eventKey], _periodObj.activePeriod + "." + i);
                sparkLine.push((tmpObj && tmpObj.c) ? tmpObj.c : 0);
            }
        } else {
            for (var i = 0; i < (_periodObj.currentPeriodArr.length); i++) {
                var tmpObj = countlyCommon.getDescendantProp(_pushEventsDb[eventKey], _periodObj.currentPeriodArr[i]);
                sparkLine.push((tmpObj && tmpObj.c) ? tmpObj.c : 0);
            }
        }

        return sparkLine.join(',');
    };

    function eventCount(eventDb, period) {
        var tmpObj = countlyCommon.getDescendantProp(eventDb, period);
        return (tmpObj && tmpObj.c) ? tmpObj.c : 0;
    }

}(window.countlyPushEvents = window.countlyPushEvents || {}, jQuery));
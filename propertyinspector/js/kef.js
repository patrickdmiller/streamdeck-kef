$(function () {
    let websocket = null;
    let uuid = null;
    let actionInfo = {};
    let setConnectionState = function(connected=true){
        if(connected){
            $('.status').removeClass('red').addClass('green');
        }else{
            $('.status').removeClass('green').addClass('red');
        }
    }
    

    connectElgatoStreamDeckSocket = function (inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
        uuid = inUUID;

        //actioninfo doesn't have the settings because we saved them into global since its connecting to teh speakers. 
        actionInfo = JSON.parse(inActionInfo); // cache the info
        websocket = new WebSocket('ws://localhost:' + inPort);

        websocket.onopen = function () {
            var json = {
                event: inRegisterEvent,
                uuid: inUUID
            };

            websocket.send(JSON.stringify(json));

        }

        websocket.onmessage = function (evt) {
            if (evt && evt.data) {
                var jsonObj = JSON.parse(evt.data);
                if (jsonObj && jsonObj.event == 'sendToPropertyInspector' && jsonObj.payload) {
                    //if it's settings with client address inside
                    if (jsonObj.payload.settings && jsonObj.payload.settings.clientAddress) {
                        const addressSelector = document.getElementById("clientAddress");
                        addressSelector.value = jsonObj.payload.settings.clientAddress
                    }else if (jsonObj.payload.kef) {
                    //if it's state
                    // this is what the object looks like . {"kef":{"muted":false,"onoff":1,"socketState":"socket:connect","source":"AUX","volume":46}}}
                    
                        if (jsonObj.payload.kef.hasOwnProperty('socketState')) {
                            let e = document.getElementById('connected')
                            e.value = jsonObj.payload.kef.socketState;
                            setConnectionState(jsonObj.payload.kef.socketState == 'socket:connect')
                        }

                        if (jsonObj.payload.kef.hasOwnProperty('volume')) {
                            let e = document.getElementById('volume');
                            e.value = jsonObj.payload.kef.volume;
                        }

                        if (jsonObj.payload.kef.hasOwnProperty('source')) {
                            let e = document.getElementById('source')
                            e.value = jsonObj.payload.kef.source;
                        }

                        if (jsonObj.payload.kef.hasOwnProperty('muted')) {

                            let e = document.getElementById('muted')
                            e.value = jsonObj.payload.kef.muted;
                        }
                    } else if (jsonObj.payload.connect!==null){

                        setConnectionState(jsonObj.payload.connect)
                        
                    
                    } else {
                    //otherwise just show it in debug
                        const value = JSON.stringify(jsonObj.payload)
                        const addressSelector = document.getElementById("Address");
                        addressSelector.value = value
                    }
                }
            }
        }
    }
    $('.sdpi-item-value.user-defined').change(function (e) {
        let value = $(this).val();
        let param = $(this).attr('data-param')
        if (websocket) {
            const json = {
                "action": actionInfo['action'],
                "event": "sendToPlugin",
                "context": uuid,
                "payload": {
                    newSettings: {
                        [param]: value
                    }

                }
            };

            websocket.send(JSON.stringify(json));
        }

    })
    var sendValueToPlugin = function(value, param) {
        if (websocket) {
            const json = {
                "action": actionInfo['action'],
                "event": "sendToPlugin",
                "context": uuid,
                "payload": {
                    newSettings: {
                        [param]: value
                    }

                }
            };
            websocket.send(JSON.stringify(json));
        }
    }
});
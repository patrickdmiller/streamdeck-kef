//OPTIONS, sadly we can't ask streamdeck to pass extra params when it launches this binary
//this may log a lot of data depending on what you set log.
ENABLE_LOGGING = false;
LOG_LEVEL = 'info';
LOG_FILE_PATH = '/tmp/keflog.log'


const SimpleNodeLogger = require('simple-node-logger');
const KEF = require('kef-wireless-js');
const args = require('args')
const WebSocketClient = require('websocket').client;

args
  .option('port', 'ws port', -1)
  .option('pluginUUID', 'A unique identifier string that should be used to register the plugin once the WebSocket is opened')
  .option('registerEvent', 'The event type that should be used to register the plugin once the WebSocket is opened')
  .option('info', 'A stringified json containing the Stream Deck application information and devices information.')

const flags = args.parse(process.argv.map(x => x.replace('-', '--')))

if (flags.port == '-1') {
  throw new Error("No port specified for connection to streamdeck service")
}


// if logging is disabled, don't try and use the log file and just set all the log functions to dead functions
const log = ENABLE_LOGGING ? SimpleNodeLogger.createSimpleLogger({
  logFilePath: LOG_FILE_PATH,
  level: LOG_LEVEL
}) : Object.fromEntries(SimpleNodeLogger.Logger.STANDARD_LEVELS.map(key => [key, function () {}]));

//catch all errors and send output to log (because streamdeck runs our binary we won't know what happened otherwise)
process.on('uncaughtException', function (err) {
  log.error('Caught exception: ' + err.stack.toString());
});

// //these are disabled images for the buttons. we can set the image of a button using setImage and passing the base64 image data
const disabledImages = require('./disabledImages.json');

//this holds buttons shown currently so we can pass data/events to them
let buttons = {}

//this holds the currently in-view property inspector (if there is one)
let propertyInspector = {
  context: null,
  action: null
};

// simple streamdeck object
let SD = {
  connected: false,
  port: flags.p,
  pluginUUID: flags.P,
  kefSetup: false,
  power: {
    state: 0
  },
  mute: {
    state: 0
  },
  globalSettings: {
    clientAddress: '1.2.3.4'
  }
}

//instantiate a kef object but don't connect it until we give it a real IP
let kef = new KEF({
  ip: '1.2.3.4',
  connectOnInstantiation: false,
  checkStateInterval: 2000
});



//function to connect/reconnect if a valid IP has been set in the propinspector or global settings
function setupKef({
  success = function () {},
  fail = function () {}
}) {
  //first end it in case it was already connected.
  kef.end(() => {
    //make sure the ip isn't bogus
    if (SD.globalSettings.clientAddress != '1.2.3.4') {
      log.info(" ATTEMPTING CONNECT")
      //if connect/error handlers are set
      kefConnectHandlerSuccess = success;
      kefConnectHandlerError = fail;

      //set ip and connect. 
      kef.ip = SD.globalSettings.clientAddress
      kef.connect();
    } else {
      log.error(" WE DO NOT HAVE A VALID IP TO CONNECT")
    }
  });
}

//placeholders for callbacks 
let kefConnectHandlerSuccess = function () {
  //override with what you want. 
}

let kefConnectHandlerError = function () {
  //override with what you want. 
}

//events on kef object -
kef.on('socket:connect', () => {
  log.info("connect success")
  SD.connected = true;
  setConnectedImage(true);
  kefConnectHandlerSuccess();
  kefConnectHandlerSuccess = function () {}
});

kef.on('socket:close', () => {
  SD.connected = false;
  log.info("connect fail")
  setConnectedImage(false);
  kefConnectHandlerError();
  kefConnectHandlerError = function () {}
})

kef.on('state', (state) => {
  log.info(" -- state -- ", JSON.stringify(state));
  if (state) {

    //if we have a propertyInspector open.. 
    if (propertyInspector.context !== null) {
      sendToPropertyInspector(propertyInspector.action, propertyInspector.context, {
        kef: state
      });
    }
    //ok for each button, if needed, set disabled
    // setConnectedState(state.socketState);
    if (state.onoff !== null && state.onoff !== -1) {
      SD.power.state = state.onoff;
      log.info(" - onoff - ", SD.power.state)
      log.info(" - buttons ", JSON.stringify(buttons))
      //any power buttons we need to update??
      for (let key in buttons) {
        if (buttons[key] == 'com.patrickdmiller.kef.power') {
          setState(key, SD.power.state)
        }
      }
    }

    if (state.volume) {

    }

    if (state.muted !== null && state.muted !== -1) {
      for (let key in buttons) {
        if (buttons[key] == 'com.patrickdmiller.kef.mute') {
          
        }
      }
    }

    if (state.source !==-1){
      for (let key in buttons) {
        if (buttons[key] == 'com.patrickdmiller.kef.source') {
          setTitle(key, state.source)
        }
      }
    }
  }
});

//ws for connecting to streamdeck service
let ws = new WebSocketClient();
ws.on('connectFailed', function (error) {
  log.error('Connect Error: ' + error.toString());
});

//connection
let c = null
ws.on('connect', function (connection) {
  c = connection;
  //registration object
  let reg = {
    event: "registerPlugin",
    uuid: SD.pluginUUID
  }

  log.info("Connected to WS, sending: " + JSON.stringify(reg))
  connection.send(JSON.stringify(reg))

  //grab global settings from streamdeck , do we need to add a delay? possible race condition with registration?
  getGlobalSettings(SD.pluginUUID)

  connection.on('error', function (error) {
    log.error("Connection Error: " + error.toString());
  });

  connection.on('message', function (message) {
    SDHandlers.dataHandler(message)
  });
});

//connect to the websocket
ws.connect('ws://localhost:' + flags.port);


//disable log if sending lots of data (for example image data)
function sendToStreamdeck(msg, disableLog = false) {
  if (c && c.send) {
    try {
      !disableLog ? log.info(" -- MSG to streamdeck -- ", JSON.stringify(msg)) : null;
      c.send(JSON.stringify(msg));
    } catch (e) {
      log.error("Error Sending to Streamdeck" + e.toString())
    }
  }
}

function getSettings(ctx) {
  sendToStreamdeck({
    "event": "getSettings",
    "context": ctx
  });
}

function setState(ctx, state) {
  sendToStreamdeck({
    "event": "setState",
    "context": ctx,
    "payload": {
      "state": state
    }
  });
}

function setTitle(ctx, title){
  sendToStreamdeck({
    "event": "setTitle",
    "context": ctx,
    "payload": {
      "title":title
    }
  });
}

function getGlobalSettings(ctx) {
  sendToStreamdeck({
    "event": "getGlobalSettings",
    "context": ctx
  })
}

function setGlobalSettings(ctx, payload) {
  sendToStreamdeck({
    "event": "setGlobalSettings",
    "context": ctx,
    "payload": payload
  })
}

function setImage(ctx, img) {
  sendToStreamdeck({
    "event": "setImage",
    "context": ctx,
    "payload": {
      "image": img,
      "target": 0
    }
  }, true)
}

function setConnectedImage(connected = false) {
  if (connected) {
    for (let key in buttons) {
      setImage(key, null)
    }
  } else {
    for (let key in buttons) {
      if (disabledImages[buttons[key]]) {
        log.info("setting an image disabled for ", key, " ", buttons[key])
        setImage(key, disabledImages[buttons[key]])
      }
    }
  }
}

function sendToPropertyInspector(action, ctx, payload) {
  sendToStreamdeck({
    "action": action,
    "event": "sendToPropertyInspector",
    "context": ctx,
    "payload": payload
  })
}

// --- Handlers for data incoming
let SDHandlers = {
  dataHandler: function (msg) {
    log.info(" -- received data from streamdeck -- ", JSON.stringify(msg));
    if (msg && msg.utf8Data) {
      try {
        let m = JSON.parse(msg.utf8Data);
        switch (m.event) {
          case 'sendToPlugin':
            this.sendToPluginHandler(m);
            break;
          case 'propertyInspectorDidAppear':
            this.propertyInspectorDidAppearHandler(m);
            break;

          case 'propertyInspectorDidDisappear':
            this.propertyInspectorDidDisappearHandler(m);
            break;

          case 'didReceiveGlobalSettings':
            this.didReceiveGlobalSettingsHandler(m);
            break;

          case 'keyDown':
            this.keyDownHandler(m);
            break;

          case 'willAppear':
            this.willAppearHandler(m);
            break;

          case 'willDisAppear':
            this.willDisappearHandler(m);
            break;

          default:
            // log.warning("received unknown event ", m.event)  
            break;
        }
      } catch (e) {
        log.error("Unable to parse message:  ", e.toString());
      }
    }
  },

  willAppearHandler: function (m) {
    if (m && m.context && m.action) {
      buttons[m.context] = m.action
    } else {
      log.error("missing parameters on message " + JSON.stringify(m))
    }
  },

  willDisappearHandler: function (m) {
    if (m && m.context) {
      delete buttons[m.context]
    } else {
      log.error("missing parameters on m " + JSON.stringify(m))
    }
  },

  sendToPluginHandler: function (m) {
    if (m && m.payload) {
      if (m.payload.newSettings) {
        log.info("received new settings ", JSON.stringify(m.payload.newSettings))
        for (let key in m.payload.newSettings) {
          SD.globalSettings[key] = m.payload.newSettings[key];
        }

        //send streamdeck our new global settings to save. 
        setGlobalSettings(SD.pluginUUID, SD.globalSettings);
        setupKef({
          success: function () {
            sendToPropertyInspector(m.action, m.context, {
              "connect": true
            })
          },
          fail: function () {
            sendToPropertyInspector(m.action, m.context, {
              "connect": false
            })
          }
        });
      }
    }
  },

  propertyInspectorDidAppearHandler: function (m) {
    propertyInspector.context = m.context
    propertyInspector.action = m.action;

    sendToPropertyInspector(m.action, m.context, {
      settings: SD.globalSettings
    })

    //we can also query kef and see if we have the known state. we can do it all at once, but kept it separate
    sendToPropertyInspector(m.action, m.context, {
      kef: kef.toJSON()
    });

  },

  propertyInspectorDidDisappearHandler: function (m) {
    propertyInspector = {
      context: null,
      action: null
    }
  },

  didReceiveGlobalSettingsHandler: function (m) {
    if (m && m.payload && m.payload.settings) {
      SD.globalSettings = m.payload.settings
    }
    setupKef({});
  },

  keyDownHandler: function (m) {
    let action = m.action;
    switch (action) {
      case 'com.patrickdmiller.kef.power':
        if (SD.power.state == 0) {
          kef.turnOnOrSwitchSource();
        } else {
          kef.turnOff();
        }
        break;

      case 'com.patrickdmiller.kef.volup':
        kef.changeVolume(1);
        break;

      case 'com.patrickdmiller.kef.voldown':
        kef.changeVolume(-1);
        break;

      case 'com.patrickdmiller.kef.mute':
        kef.muteToggle();
        break;

      case 'com.patrickdmiller.kef.source':
        kef.cycleSource();
        // kef.muteToggle();
        break;
    }
  }
}

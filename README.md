# KEF Streamdeck Plugin - UNOFFICIAL

Tested on mac and partially on Windows 10. 
** Windows Note** Windows didn't let it open the socket until i ran the streamdeck app as Administrator (right click > run as Administrator). I'm not versed in windows dev, so if there's a better way to correct this please let me know. 

Uses a global settings object to store the IP of the speakers. If you set 1 button's IP, they're all set. 

**Note**:  Only 1 computer on the network can use this plugin because KEF speakers only accommodate a single socket connection at a time.

# Structure

The plugin is a compiled node.js application since opening a socket is required. Binary is compiled using the pkg package.

# Download  

[Link to plugin (macOs)](https://github.com/patrickdmiller/streamdeck-kef/releases/download/1.0.1/com.patrickdmiller.kef.streamDeckPlugin)

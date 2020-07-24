---
layout: post
title: Analyzing Android Apps
categories: mobile android
tags: genymotion
---

# Setup
We need a few tools:
* Burpsuite
* Genymotion
* Xposed
* SSLUnpinning

## Genymotion
Explained how to install [previously]({% post_url 2020-6-18-owasp-mstg %}).  
I'll be using a Android 6.0 device here (SDK 23). I'm bridging the network connection.  
Android 7.0+ didn't want to accept my burp certificate. Worked on my laptop though...

If you want to use the Google Play store, press Install OpenGAPPS.
## Xposed
To use modules like SSLUnpinning we need Xposed. To install:

Homepage is [here](https://repo.xposed.info/module/de.robv.android.xposed.installer).  
But as we use a Android >5.0 device, we need to go the [forums](https://forum.xda-developers.com/showthread.php?t=3034811).  
Download the XposedInstaller_3.1.5.apk from there (wasn't online for me, got it from [here](https://github.com/hvdwolf/JoyingBinRepo/blob/master/px5-Xposed/XposedInstaller_3.1.5.apk); no clue how safe that is).  
Then download the xposed_X.zip from [here](https://dl-xda.xposed.info/framework/). Choose your android version and **x86**.

1. Download the files
2. Drag-and-drop the xposed_X.zip onto the virtual device window
3. Restart the device
4. Drag-and-drop the apk onto the window
5. Open the installer. If it shows "Xposed is installed but not active", reboot your device again. If it still doesn't work, no clue. Google. Probably.

## SSLUnpinning
We may need this if our app uses [SSL Pinning](https://owasp.org/www-community/controls/Certificate_and_Public_Key_Pinning). To install:

1. Download the apk from [here](https://github.com/ac-pm/SSLUnpinning_Xposed) for your android version
2. Just drag-and-drop the apk on the window

## Burpsuite
We'll use Burpsuite to catch/manipulate requests. Download from [here](https://portswigger.net/burp). The setup:

1. Download and install
2. Under Proxy > Options > Proxy Listeners add a listener on all interfaces.
3. On your device set the network proxy to your ip and port of the proxy (default 8080). For Android 7.0: Settings > Wi-Fi > Long Press on WiredSSID > Modify Network > Proxy > Manual.

If we now make a web request (like browse to google.com), burp should catch the request. If not you fucked up or the proxy isn't intercepting.

You also need to import the burp certificate: 
1. Export the certificate in Proxy > Options > Import / Export > Certificate in DER Format
2. Drag-and-drop the .crt file
3. Settings > Wi-Fi > Dots in the top right corner > Advanced > Install Certificates || Settings > Security > Install from SD Card
4. Select the file from Android > Download

You may need to set a pin/password/pattern
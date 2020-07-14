---
layout: post
title: OWASP MSTG Part 2
categories: reversing mobile ios
tags: mobile-security-testing-guide
---

# Mobile Security Testing Guide 2: Electric Boogaloo
This time iOS...  
Because I don't have a mac I needed to create a vm. Problem is VMWare doesn't allow MacOS vms on a windows/linux machine.

So I downloaded a sketchy vmdk and VMWare unlocker (which just patched the exe's and create some darwin iso stuff). I have no idea how many backdoors I have now installed.

There may be a simpler way with VirtualBox (because I think it allows Mac vms anywhere), but you still need to download the .iso from somewhere (Apple does only give you a tool to make a bootable usb drive. Not sure if you can use it on linux/windows, but if so you could build a iso from there).

### ipa files
You can unzip the .ipa directly (it's just a normal zip file). Inside /Payload/MyApp.app/ is a file MyApp (where the app is called MyApp), which can be put into Ghidra.

Remember that we work in objective c or swift here, so no easy bytecode reversing.

In that folder are some more files like app icons, startup images, info files and other resources.

# Mac OS
First impression: Pretty slick. We even have a inhouse dark mode.  
A bit annoying was during installation the confirmations of some parts like "no I don't want you to track me" (they still probably do). Reminds me of the Windows installation/update thingy. Just let install that os without any tracking/analytics/voice recognition.

To open the Terminal:
Launchpad (the rocket) > Other > Terminal

## xcode/Emulator (Doesn't work blackbox, just leaving this here if you have the source code)
We need to get a simulated iOS device. For that we need xcode.

_Watch out: Depending on your device and mac version, you might need to update your mac and select a newer xcode. Don't be like be and download xcode 3 times._

If you're on an older version you can use [xcodereleases.com](xcodereleases.com) (8gb download, 10.14 does not equal 10.14.4).  
To find your version, click on the Apple icon top left (in the bar) > "About This Mac".

Just do a double click on the .xip file or use `xip -x Xcode_X.Y.Z.xip`.  
Then double click the xcode app.  
If you had another version of xcode installed before you need to

```
sudo xcode-select -s /path/to/xcode
```

for xcodebuild and such to work.

I just found out that while you can start the simulator, it's an simulator and not a emulator. So it gets compiled to x86 and you need the source code to test stuff.

You'd probably need a Corellium subscription (SaaS emulator, no trials).

## [idbtool](https://www.idbtool.com/)
This is a hopefully neat tool, which not only runs on macos, but while we're at it why not install that too.

### Mac OS
Install rvm & ruby with:
```
curl -sSL https://get.rvm.io | bash -s stable
rvm install 4.7 --enable-shared
```

Then install some qt libraries, for those we need homebrew:

Go to [brew.sh](brew.sh) and install homebrew with
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
```
_Note: This may take a bit longer_

To install the libs:
```
brew tap cartr/qt4
brew tap-pin cartr/qt4
brew install cartr/qt4/qt@4
brew install cmake usbmuxd libimobiledevice
```

Then finally you can (hopefully) install idb
```
gem install idb
```

### Windows
On Windows just:
```
gem install idb
```
This still needs a ssh access, so you need a jailbroken device.

# UnCrackable Level 1
Let's first look for strings.  
"isEqualToString:"? Maybe it calls them through some wrapper?
```c++
void Verify(undefined4 param_1)
{
  ...
  _objc_msgSend(uVar2,PTR_s_text_000109a8);
  uVar3 = _objc_retainAutoreleasedReturnValue();
  _objc_msgSend(param_1,PTR_s_theLabel_00010994);
  uVar4 = _objc_retainAutoreleasedReturnValue();
  _objc_msgSend(uVar4,puVar1);
  uVar5 = _objc_retainAutoreleasedReturnValue();
  uVar6 = _objc_msgSend(uVar3,PTR_s_isEqualToString:_000109ac,uVar5);
  ...
  uVar2 = _objc_msgSend(PTR__OBJC_CLASS_$_UIAlertView_00010a4c,PTR_s_alloc_000109b0);
  if ((uVar6 & 0xff) == 0) {
    pcVar7 = &cf_VerificationFailed.;
    pcVar8 = &cf_Thisisnotthestringyouarelookingfor.Tryagain.;
  }
  else {
    pcVar7 = &cf_Congratulations!;
    pcVar8 = &cf_Youfoundthesecret!!;
  }
  ...
}
```

Okay apparently it gets the value from the controls "text" and "theLabel".  
If we open up the app, we can also see that the text is in a hidden label.  
Let's see if `theLabel` gets a value assigned somewhere:
```c++
void InitControls(undefined4 param_1)
{
  ...
  puVar1 = PTR_s_theLabel_00010994;
  _objc_msgSend(param_1,PTR_s_theLabel_00010994);
  uVar3 = _objc_retainAutoreleasedReturnValue();
  _objc_msgSend(uVar3,PTR_s_setHidden:_00010998,1);
  _objc_release(uVar3);
  puVar2 = PTR__OBJC_CLASS_$_NSString_00010a48;
  uVar3 = GetSecret();
  _objc_msgSend(puVar2,PTR_s_stringWithCString:encoding:_0001099c,uVar3,1);
  uVar3 = _objc_retainAutoreleasedReturnValue();
  _objc_msgSend(param_1,puVar1);
  uVar4 = _objc_retainAutoreleasedReturnValue();
  _objc_msgSend(uVar4,PTR_s_setText:_000109a0,uVar3);
  _objc_release(uVar4);
  ...
}
```
We see that `theLabel` gets set hidden and then the return value (`GetSecret`) of another function gets set as the value.

The GetSecret Function looks pretty wonky though:
```c++
char* GetSecret(void)
{
  DAT_00011254 = 0;
  DAT_00011250 = 0;
  DAT_00011258 = 0;
  bVar1 = FUN_0000beaa();
  DAT_00011250 = DAT_00011250 & 0xffffff00 | (uint)bVar1;
  uVar2 = FUN_0000b460();
  DAT_00011250._0_2_ = CONCAT11(uVar2,(undefined)DAT_00011250);
  DAT_00011250 = DAT_00011250 & 0xffff0000 | (uint)(ushort)DAT_00011250;
  uVar2 = FUN_0000bbf2();
  DAT_00011250._0_3_ = CONCAT12(uVar2,(ushort)DAT_00011250);
  DAT_00011250 = DAT_00011250 & 0xff000000 | (uint)(uint3)DAT_00011250;
  bVar1 = FUN_0000ac22();
  DAT_00011250 = DAT_00011250 & 0xffffff | (uint)bVar1 << 0x18;
  bVar1 = FUN_0000ae76();
  DAT_00011254 = DAT_00011254 & 0xffffff00 | (uint)bVar1;
  uVar2 = FUN_0000bcb8();
  DAT_00011254._0_2_ = CONCAT11(uVar2,(undefined)DAT_00011254);
  DAT_00011254 = DAT_00011254 & 0xffff0000 | (uint)(ushort)DAT_00011254;
  uVar2 = FUN_0000b7e4();
  DAT_00011254._0_3_ = CONCAT12(uVar2,(ushort)DAT_00011254);
  DAT_00011254 = DAT_00011254 & 0xff000000 | (uint)(uint3)DAT_00011254;
  bVar1 = FUN_0000b1de();
  DAT_00011254 = DAT_00011254 & 0xffffff | (uint)bVar1 << 0x18;
  bVar1 = FUN_0000a174();
  DAT_00011258 = DAT_00011258 & 0xffffff00 | (uint)bVar1;
  uVar2 = FUN_0000bf72();
  DAT_00011258._0_2_ = CONCAT11(uVar2,(undefined)DAT_00011258);
  DAT_00011258 = DAT_00011258 & 0xffff0000 | (uint)(ushort)DAT_00011258;
  uVar2 = FUN_0000b71e();
  DAT_00011258._0_3_ = CONCAT12(uVar2,(ushort)DAT_00011258);
  DAT_00011258 = DAT_00011258 & 0xff000000 | (uint)(uint3)DAT_00011258;
  return &DAT_00011250;
}
```
That's fucky. All those other function have some stack overflow protection but no glue what they do.

## Dynamic Approach
I'm too lazy to find out what that does so let's try to read out the label dynamically.

For that we need the mac vm, because we need to patch the ipa with frida, so it can connect to objection. If you have a jailbroken device, you can just install frida through cydia.

We of course need a physical device for this. If you have a emulated one, it shouldn't be too much different? No glue.

### Patching & signing the app
[Here](https://github.com/sensepost/objection/wiki/Patching-iOS-Applications) is the guide I used.

First install xcode. Sign into xcode with a [developer](https://developer.apple.com/register/) apple id and generate a code signing certificate.

```
security find-identity -p codesigning -v
```

Then we need a .mobileprovision file:
* Start Xcode
* Create new project
* iOS > Single View App
* Connect your iOS device
* Select target device
* Hit the play button
* Trust the account on your device

_Note: For some reason the vm didn't recognize my device. You need to ([Source](https://stackoverflow.com/questions/36139020/macos-on-vmware-doesnt-recognize-ios-device)):_
In the vm settings:
* Set the usb compability to usb 2.0
* Check "Show all USB input devices"
And then reboot

_If you get a error because of your ios version, you can change the deployment target under Project > Build Settings > Deployment > iOS Deployment Target_


Some other dependencies:
```
brew install zip
brew install unzip
brew install p7zip
brew install npm
npm install -g applesign
git clone https://github.com/Tyilo/insert_dylib
cd insert_dylib
xcodebuild
cp build/Release/insert_dylib /usr/local/bin/insert_dylib
```

Install objection
```
brew install python3
pip3 install objection
```

Patch the ipa with frida
```
objection patchipa --source my-app.ipa --codesign-signature 0C2E8200Dxxxx
```

npm install -g passionfruit

### Deploying the app
You can also do this on linux (Check this guide [here](https://github.com/sensepost/objection/wiki/Running-Patched-iOS-Applications#installing-and-running-on-macos)). On MacOS:

Install ios-deploy
```
npm install -g ios-deploy
```
To run the app (which we signed before)
```
unzip my-app.ipa
ios-deploy --bundle Payload/my-app.app -W -d
```
Error 0xe8008001: An unknown error has occurred. AMDeviceSecureInstallApplication
Error: invalid entitlements
=> no clue


Apparently it's because of iOS 13 and apparently you need a developer cert. Fuck.

I've found this old iPhone 4S on iOS 9.3.5 lying around...  
One problem: it's icloud bound. Don't know the password though (it's not stolen or anything like that. just from a familiy member)...

Let's jailbreak:
* First download Phoenix (the jailbreak for 9.3.5-9.3.6) from [here](https://phoenixpwn.com/)
* Then download Cydia Impactor, select the device - What where is the device?

Apparently you need iTunes. Let's do it in a vm.
* Select the device, drag and drop the ipa and:
```
file: provision.cpp; line: 81; what:

ios/listAllDevelopmentCerts = 3018
Please update to Xcode 7.3 or later to continue developing with your Apple ID
```

uhhh apparently Apple patched it server side and nobody updated impactor. Reddit says "just install AltStore", which, I found after installing and hating apple, does only work on iOS 12+.

Apparently there is no solution on windows - that I know of.  
Good thing we have a mac vm...

Let's try that again:
* Download Phoenix (the jailbreak for 9.3.5-9.3.6) from [here](https://phoenixpwn.com/)
* Download AltDeploy from [here](https://github.com/pixelomer/AltDeploy/releases)
* Start it, select a device and a custom IPA and click Start
* It will install some mail plugin
* Open the mail app and add a mail account if you don't have one (I used a new one from yandex.com)
* Enable it via Mail > Preferences... > General > Manage Plug-ins...
* Restart the mail app and keep it open
* Press start, login with a apple id
* It should now start

Now let's get rid of that icloud account
* Start the Phoenix app
* Jailbreak (who the hell promotes his mixtape there)
* Open Cydia and install Filza File Manager
* Go to /var/mobile/Library/Accounts
* Remove/rename the Accounts3.sqlite
* Restart the device
* Done

The problem is that 7 day limit of the certificate. Let's downgrade the device to get a untethered jailbreak.

Following [this guide](https://www.redmondpie.com/downgrade-ios-9.3.5-to-8.4.1-6.1.3-without-shsh-blobs-on-any-32-bit-device-and-untether-jailbreak/).

* In Filza, open /System/Library/CoreServices
* Open SystemVersion.plist and:
* Change the ProductVersion to 6.0
* Change the BuildVersion to 12H321
* Reboot (Ignore the white update screen on boot)
* In Settings > General > Software Update, update to 8.4.1

6.1.3/10B329 => search for update failed
6.0/10A403 => same. maybe too many tries? let's try again later

You need to play around with the values. Take a look into the comments and try out those.

If you fuck up you need to rejailbreak to access Filza. Phoenix will ask for offsets, get those from [here](https://phoenixpwn.com).  
Sometimes Phoenix will fail to jailbreak. Just try again.
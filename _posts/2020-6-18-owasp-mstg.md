---
layout: post
title: OWASP MSTG
categories: reversing mobile
tags: mobile-security-testing-guide
---

# Mobile Security Testing Guide
The Mobile Security Testing Guide (MSTG) is a comprehensive manual for mobile app security development, testing and reverse engineering. 

blabla. It's a book with a nice checklist and all the techniques you need for pentesting. There is also a complementary book for writing secure software (MASVS).

We sometimes do app pentests so I thought I'd look into the OWASP MSTG and do the examples to get a hang of the tools (and a excuse to finally get a android vm up and running).

Link [here](https://github.com/OWASP/owasp-mstg) and the CrackMes are [here](https://github.com/OWASP/owasp-mstg/tree/master/Crackmes).

# Tools, Setup and Stuff
### Emulator
As a emulator I'm using Genymotion with an Android 9.0 device (because DIVA didn't run on 7.0, but any version above 4.4 should work).  
To install Genymotion, first install virtualbox with

```
sudo apt install virtualbox
```

then

### Decompiler
To de/recompile I'm using apktool. You could use apt to install that, but I had problems with the dirty version.  
Head over to [the website](https://ibotpeaches.github.io/Apktool/) and follow the install instructions (download wrapper & jar, chmod, run).

You also need a java version. I'm using openjdk-11, but it's recommended to use jdk-8.

### MobSF
Another useful tool is mobsf, a static/dynamic analysis framework for all kinds of mobile apps (iOS, Windows, Android).  
I'm running it in a docker container, because it's way easier to use.

```
sudo apt install docker.io
sudo service docker start
sudo docker pull opensecurity/mobile-security-framework-mobsf
sudo docker run -p 8000:8000 opensecurity/mobile-security-framework-mobsf
```

Also a docker-compose file
```
version: "2.0"
services:
 mobfs:
  ports: 
   - 8000:8000
  image: opensecurity/mobile-security-framework-mobsf
```
It's then reachable on port 8000.

![MobSF]({{ site.baseurl }}/assets/images/mstg/mobsf.png "MobSF")


# Uncrackable Level 1
Drag-and-drop the apk into our emulator and it should start directly.  
We immediately get prompted with this message:

![Level 1 Root Detection]({{ site.baseurl }}/assets/images/mstg/lvl1-root-detection.png "Level 1 Root Detection")

And it exits. Uhh Genymotion automatically roots the device. Can we like disable that? _No._

Let's decompile the app and change the code.

```
apktool d UnCrackable-Level1.apk
```

We now have the code in `smali/sg/vantagepoint` but it's only dex files. Either use some program like dex2jar on it or use

### MobSF
Upload the .apk in the web interface and it should something like this

![Level1.apk in MobSF]({{ site.baseurl }}/assets/images/mstg/lvl1-mobsf.png "Level1.apk in MobSF")

Scroll down till you see "View Java" to look at the java code.

In MainActivity.java:
```java
/* access modifiers changed from: protected */
    public void onCreate(Bundle bundle) {
        if (c.a() || c.b() || c.c()) {
            a("Root detected!");
        }
        if (b.a(getApplicationContext())) {
            a("App is debuggable!");
        }
        super.onCreate(bundle);
        setContentView(R.layout.activity_main);
    }
```
In /smali/sg/vantagepoint/uncrackable1/MainActivity.smali:
```
.method protected onCreate(Landroid/os/Bundle;)V
    .locals 1

    invoke-static {}, Lsg/vantagepoint/a/c;->a()Z
    move-result v0
    if-nez v0, :cond_0
    invoke-static {}, Lsg/vantagepoint/a/c;->b()Z

    ...

    if-eqz v0, :cond_2
    const-string v0, "App is debuggable!"
    invoke-direct {p0, v0}, Lsg/vantagepoint/uncrackable1/MainActivity;->a(Ljava/lang/String;)V
    :cond_2
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V
```

Let's remove that in the decompiled source (Everything between `.locals 1` and `:cond2`) and recompile with

```
apktool b UnCrackable-Level1
```

If you now drop the apk from /dist/ into the emulator it will show an error. Why? Because it's not signed.

Now we will:
* Install apksigner 
* Generate a key in ~/.android/debug.keystore (if there isn't already one => android studio creates one too)
* Sign the new apk with our key

```
sudo apt install apksigner
keytool -genkey -v -keystore ~/.android/debug.keystore -alias signkey -keyalg RSA -keysize 2048 -validity 20000
apksigner sign --ks ~/.android/debug.keystore --ks-key-alias signkey UnCrackable-Level1.apk
```

Now we can install the apk on the device and start it without problems (hopefully).

![Level 1 Detection Bypass]({{ site.baseurl }}/assets/images/mstg/lvl1-detection-bypass.png "Level 1 Detection Bypass")

Now onto the secret string...

We have this verifiy function in MainActivity:
```java
public void verify(View view) {
        String str;
        String obj = ((EditText) findViewById(R.id.edit_text)).getText().toString();
        AlertDialog create = new AlertDialog.Builder(this).create();
        if (a.a(obj)) {
            create.setTitle("Success!");
            str = "This is the correct secret.";
        } else {
            create.setTitle("Nope...");
            str = "That's not it. Try again.";
        }
        create.setMessage(str);
        create.setButton(-3, "OK", new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface dialogInterface, int i) {
                dialogInterface.dismiss();
            }
        });
        create.show();
    }
```

Looks good. Let's look at a.a() in uncrackable1/a.java:
```java
public class a {
    public static boolean a(String str) {
        byte[] bArr;
        byte[] bArr2 = new byte[0];
        try {
            bArr = sg.vantagepoint.a.a.a(b("8d127684cbc37c17616d806cf50473cc"), Base64.decode("5UJiFctbmgbDoLXmpL12mkno8HT4Lv8dlat8FxR2GOc=", 0));
        } catch (Exception e) {
            Log.d("CodeCheck", "AES error:" + e.getMessage());
            bArr = bArr2;
        }
        return str.equals(new String(bArr));
    }

    public static byte[] b(String str) {
        int length = str.length();
        byte[] bArr = new byte[(length / 2)];
        for (int i = 0; i < length; i += 2) {
            bArr[i / 2] = (byte) ((Character.digit(str.charAt(i), 16) << 4) + Character.digit(str.charAt(i + 1), 16));
        }
        return bArr;
    }
}
```

What does sg.vantagepoint.a.a.a()?
```java
public class a {
    public static byte[] a(byte[] bArr, byte[] bArr2) {
        SecretKeySpec secretKeySpec = new SecretKeySpec(bArr, "AES/ECB/PKCS7Padding");
        Cipher instance = Cipher.getInstance("AES");
        instance.init(2, secretKeySpec);
        return instance.doFinal(bArr2);
    }
}

```

Okay so it:
* Does some funky stuff with `8d127684cbc37c17616d806cf50473cc` and base64 decodes `5UJiFctbmgbDoLXmpL12mkno8HT4Lv8dlat8FxR2GOc=`
* Gives that into an AES Cipher (and decrypts it thereby)
* Compares the decrypted string with the input

There are several ways we can now get the secret. Here's my way:

I just copy the java and run it in some online compiler. ayyy.
```java
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

public class HelloWorld{

     public static void main(String []args){
        a("test");
     }
     
     public static byte[] decrypt(byte[] bArr, byte[] bArr2) {
         try
         {
        SecretKeySpec secretKeySpec = new SecretKeySpec(bArr, "AES");
        Cipher instance = Cipher.getInstance("AES");
        instance.init(2, secretKeySpec);
        return instance.doFinal(bArr2);
         }
         catch (Exception e)
         {
             System.out.println(e);
             System.out.println("fck");
         }
         return null;
    }
    
    public static boolean a(String str) {
        byte[] bArr;
        byte[] bArr2 = new byte[0];
        try {
            bArr = decrypt(b("8d127684cbc37c17616d806cf50473cc"), Base64.getDecoder().decode("5UJiFctbmgbDoLXmpL12mkno8HT4Lv8dlat8FxR2GOc="));
        } catch (Exception e) {
            bArr = bArr2;
        }
        System.out.println(new String(bArr));
        return str.equals(new String(bArr));
    }

    public static byte[] b(String str) {
        int length = str.length();
        byte[] bArr = new byte[(length / 2)];
        for (int i = 0; i < length; i += 2) {
            bArr[i / 2] = (byte) ((Character.digit(str.charAt(i), 16) << 4) + Character.digit(str.charAt(i + 1), 16));
        }
        return bArr;
    }
}
```
_Notice the Class Name_

And it outputs the secret `I want to believe`.  
Put that into the app and we get a prompt:

![Level 1 Success]({{ site.baseurl }}/assets/images/mstg/lvl1-success.png "Level 1 Success")

### ADB
We can also use adb (Android Debug Bridge) to get a shell (shell), install apps (install) or read the logs (logcat) of our physicial/virtual device.
For that use:

```
adb connect IP_ADDRESS
```

and then your desired adb command (ex. adb shell).  
Notice: the IP Address is not the one in the Genymotion window name. Get it through Settings > System > About Phone or Settings > Network > Wi-Fi > The Wifi > Advanced > IP address.

# Uncrackable Level 2
Same layout, can't start in genymotion (because of superuser)
Again Root & Debugable Detection + Debugger Check in MainActivity.onCreate => remove, recompile with

```
apktool b UnCrackable-Level2
```

But it gave this error:

```
Picked up _JAVA_OPTIONS: -Dawt.useSystemAAFontSettings=on -Dswing.aatext=true
I: Using Apktool 2.4.1
I: Checking whether sources has changed...
I: Smaling smali folder into classes.dex...
I: Checking whether resources has changed...
I: Building resources...
W: /home/exp/Downloads/UnCrackable-Level2/AndroidManifest.xml:1: error: No resource identifier found for attribute 'compileSdkVersion' in package 'android'
W: 
W: /home/exp/Downloads/UnCrackable-Level2/AndroidManifest.xml:1: error: No resource identifier found for attribute 'compileSdkVersionCodename' in package 'android'
W: 
brut.androlib.AndrolibException: brut.common.BrutException: could not exec (exit code = 1): [/tmp/brut_util_Jar_15841733277938222659.tmp, p, --forced-package-id, 127, --min-sdk-version, 19, --target-sdk-version, 28, --version-code, 1, --version-name, 1.0, --no-version-vectors, -F, /tmp/APKTOOL6222115682080151551.tmp, -e, /tmp/APKTOOL16926908881491950083.tmp, -0, arsc, -I, /home/exp/.local/share/apktool/framework/1.apk, -S, /home/exp/Downloads/UnCrackable-Level2/res, -M, /home/exp/Downloads/UnCrackable-Level2/AndroidManifest.xml]
```


[Here](https://github.com/iBotPeaches/Apktool/issues/1842#issuecomment-407102329) the solution:

```
apktool empty-framework-dir --force
```

Now we can recompile it again and push onto the device.

Let's look at the code again:
```java
...
public void onCreate(Bundle bundle) {
...
this.m = new CodeCheck();
...
}

public void verify(View view) {
    ...
    if (this.m.a(obj)) {
        create.setTitle("Success!");
        str = "This is the correct secret.";
    } else {
    ...
}
```

Okay this time we give our input into CodeCheck.a():
```java
public class CodeCheck {
    private native boolean bar(byte[] bArr);

    public boolean a(String str) {
        return bar(str.getBytes());
    }
}
```

So we check it in the native library...

### Short Digression: Native Libraries
I'll just yoink the text out the MSTG
> Some ambiguity exists when discussing native apps for Android as the platform provides two development kits - the Android SDK and the Android NDK. The SDK, which is based on the Java and Kotlin programming language, is the default for developing apps. The NDK (or Native Development Kit) is a C/C++ development kit used for developing binary libraries that can directly access lower level APIs (such as OpenGL). These libraries can be included in regular apps built with the SDK. Therefore, we say that Android native apps (i.e. built with the SDK) may have native codebuilt with the NDK.

TL;DR: Native Libraries are just in C/C++ compiled libs, so no easy reversing from java bytecode.

### Back again

The library is found under /lib/ARCH/libfoo.so

```
file libfoo.so
libfoo.so: ELF 32-bit LSB shared object, Intel 80386, version 1 (SYSV), dynamically linked, BuildID[sha1]=1adb8eb0bf49daddce60e3e1ed000158e424bc9d, stripped
```

A fuck, ~~I can't believe you've done this~~ it's stripped.
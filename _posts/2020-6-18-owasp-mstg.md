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
* Download the .bin from [here](https://www.genymotion.com/download/).
* Execute that file (it's a bash script; execute as root if you want it in /opt/).
* Start Genymotion and create a device (any version should suffice)
* You should now be able to boot into a android device

### Decompiler
To de/recompile I'm using apktool. You could use apt to install that, but I had problems with the dirty version.  
Head over to [the official website](https://ibotpeaches.github.io/Apktool/) and follow the install instructions (download wrapper & jar, chmod, run).

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

Also a docker-compose file, cause I'm too lazy to save the long ass docker name
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

### Ghidra
The ol' trusty decompiler. Needed later...

# Uncrackable Level 1
> This app holds a secret inside. Can you find it?

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
> This app holds a secret inside. May include traces of native code.

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

After I read the section of reversing native code in the MSTG, I know that it still has symbols (which makes sense, cause it's a library). You can read those with readelf(linux)/greadelf (mac).

```
readelf -W -s libfoo.so

Symbol table '.dynsym' contains 17 entries:
   Num:    Value  Size Type    Bind   Vis      Ndx Name
     0: 00000000     0 NOTYPE  LOCAL  DEFAULT  UND
     1: 00000000     0 FUNC    GLOBAL DEFAULT  UND waitpid@LIBC (2)
     2: 00000000     0 FUNC    GLOBAL DEFAULT  UND __cxa_atexit@LIBC (2)
     3: 00000000     0 FUNC    GLOBAL DEFAULT  UND __cxa_finalize@LIBC (2)
     4: 00000000     0 FUNC    GLOBAL DEFAULT  UND __stack_chk_fail@LIBC (2)
     5: 00000000     0 FUNC    GLOBAL DEFAULT  UND fork@LIBC (2)
     6: 00000000     0 FUNC    GLOBAL DEFAULT  UND getppid@LIBC (2)
     7: 00000f60   199 FUNC    GLOBAL DEFAULT   12 Java_sg_vantagepoint_uncrackable2_CodeCheck_bar
     8: 00000000     0 FUNC    GLOBAL DEFAULT  UND _exit@LIBC (2)
     9: 00000f30    40 FUNC    GLOBAL DEFAULT   12 Java_sg_vantagepoint_uncrackable2_MainActivity_init
    10: 00000000     0 FUNC    GLOBAL DEFAULT  UND ptrace@LIBC (2)
    11: 00000000     0 FUNC    GLOBAL DEFAULT  UND strncmp@LIBC (2)
    12: 00000000     0 FUNC    GLOBAL DEFAULT  UND pthread_create@LIBC (2)
    13: 00000000     0 FUNC    GLOBAL DEFAULT  UND pthread_exit@LIBC (2)
    14: 00004004     0 NOTYPE  GLOBAL DEFAULT  ABS __bss_start
    15: 00004009     0 NOTYPE  GLOBAL DEFAULT  ABS _end
    16: 00004004     0 NOTYPE  GLOBAL DEFAULT  ABS _edata
```

So let's put it in Ghidra and go to the interesting functions (CodeCheck_bar & MainActivity_init). I'm using the x86 lib here (but it shouldn't make any difference if your tool supports that arch).

CodeCheck_bar:
```
Java_sg_vantagepoint_uncrackable2_CodeCheck_bar(int *param_1,undefined4 param_2,undefined4 param_3)
{
  ...
  if (DAT_00014008 == '\x01') {
    local_30 = 0x6e616854;
    local_2c = 0x6620736b;
    local_28 = 0x6120726f;
    local_24 = 0x74206c6c;
    local_20 = 0x6568;
    local_1e = 0x73696620;
    local_1a = 0x68;
    __s1 = (char *)(**(code **)(*param_1 + 0x2e0))(param_1,param_3,0);
    iVar1 = (**(code **)(*param_1 + 0x2ac))(param_1,param_3);
    if (iVar1 == 0x17) {
      iVar1 = strncmp(__s1,(char *)&local_30,0x17);
      if (iVar1 == 0) {
        uVar2 = 1;
  ...
}
```

Three parameters? The java code only puts in a byte array.  
Seems like it strncmp some hex values with `_sl`. Is that our input? Does it get transformed?  
Let's first convert those hex values into a string (Ghidra: In asm window > right click on hex > Convert > Char Sequence) and have a look if those make any sense. 

![Converted String]({{ site.baseurl }}/assets/images/mstg/lvl2-string.png "Converted String")

So long and "Thanks for all the fish"?  
Was that already the secret? Let's put it in the app:

![Level 2 Success]({{ site.baseurl }}/assets/images/mstg/lvl2-success.png "Level 2 Success")

Okay... That worked? No encryption or encoding? Interesting...

# Uncrackable Level 3
> The crackme from hell!

First look into the code in MobSF:
* a xorKey "pizzapizzapizzapizzapizz"
* Native Function again from libfoo.so: baz, init(byte[]), bar(byte[])
* It uses an crc checksum of libs & classes.dex in verifyLibs() to check for tampering

Order of Functions:  
onCreate():
* verifyLibs()
* init(xorkey)
* Debugger Detection
* Root Detection
* Creates CodeCheck object

Verify():
* Calls check.check_code(input)

check_code(str):
* bar(str.getBytes()) => native func

What to patch:
* verifyLibs call
* Debugger Detection
* Root Detection

To decompile
```
apktool d UnCrackable-Level3.apk
```

Patching out:
In onCreate I found this `.line X` marker. A quick google showed that those numbers are used for debugging. When something goes wrong it can show the java line code.  
So we're safe to delete those.

I patched out in onCreate:
```
.method protected onCreate(Landroid/os/Bundle;)V
    .registers 6

    .line 104
    invoke-direct {p0}, Lsg/vantagepoint/uncrackable3/MainActivity;->verifyLibs()V
    const-string v0, "pizzapizzapizzapizz"
    .line 106
    invoke-virtual {v0}, Ljava/lang/String;->getBytes()[B
    move-result-object v0
    invoke-direct {p0, v0}, Lsg/vantagepoint/uncrackable3/MainActivity;->init([B)V
    .line 109 
    new-instance v0, Lsg/vantagepoint/uncrackable3/MainActivity$2;

    ...
    
    .line 130
    :cond_46
    new-instance v0, Lsg/vantagepoint/uncrackable3/CodeCheck;
    ...
```
The verifyLibs call, leave the const and the init call there, and basically everything from there till the CodeCheck call.


The ol' razzle dazzle:
```
apktool b UnCrackable-Level3
cd UnCrackable-Level3/dist/
apksigner sign --ks ~/.android/debug.keystore --ks-key-alias signkey UnCrackable-Level3.apk
```

If we've done it right, it should now be able to start and accept any string on our emulator.

What to check in native lib:
* MainActivity::init => what does it do with the xorkey? set it and in bar xors?
* MainActvity::baz => not really necessary; should return classes.dex checksum; maybe sets though
* CodeCheck::bar => get key; maybe xor it

MainActivity_baz:
```c++
undefined8 Java_sg_vantagepoint_uncrackable3_MainActivity_baz(void)
{
  return 0x18110e3;
}
```
* Only returns checksum. Nice.

MainActivity_init:
```c++
void Java_sg_vantagepoint_uncrackable3_MainActivity_init
               (int *param_1,undefined4 param_2,undefined4 param_3)
{
  char *__src;
  
  FUN_00013250();
  __src = (char *)(**(code **)(*param_1 + 0x2e0))(param_1,param_3,0);
  strncpy((char *)&DAT_0001601c,__src,0x18);
  (**(code **)(*param_1 + 0x300))(param_1,param_3,__src,2);
  DAT_00016038 = DAT_00016038 + 1;
  return;
}
```
* FUN_00013250: checks for debugger via ptrace
* Copies probably the xorkey (also a length of 0x18/24) into 0x1601c
* 0x16038: checks == 2 in bar => probably a init check

CodeCheck_bar:
```c++
undefined4
Java_sg_vantagepoint_uncrackable3_CodeCheck_bar(int *param_1,undefined4 param_2,undefined4 param_3)
{
    ...
    if (isInited == 2) {
        FUN_00010fa0(&local_40);
        input = (**(code **)(*param_1 + 0x2e0))(param_1,param_3,0);
        inputLength = (**(code **)(*param_1 + 0x2ac))(param_1,param_3);
        if (inputLength == 0x18) {
            uVar1 = 0;
            puVar3 = &xorkey;
            do {
                if (*(byte *)(input + uVar1) != (*(byte *)puVar3 ^ *(byte *)((int)&local_40 + uVar1)))
                    goto LAB_00013456;
                uVar1 = uVar1 + 1;
                puVar3 = (undefined4 *)((int)puVar3 + 1);
            } while (uVar1 < 0x18);
            uVar2 = CONCAT31((int3)(uVar1 >> 8),1);
            if (uVar1 == 0x18) goto LAB_00013458;
        }
    }
  ...
}
```
* Gets a string from 0x10fa0
* Xors that with the key, byte-for-byte, and compares with the input

Some things
* Input has the same length as the xorkey and the xored bytes (0x18)

FUN_00010fa0:
```c++
void FUN_00010fa0(undefined4 *param_1)
{
  uVar4 = DAT_00016004 * 0x41c64e6d + 0x3039;
  DAT_00016004 = uVar4;
  puVar2 = (uint *)malloc(8);
  if (puVar2 != (uint *)0x0) {
    *puVar2 = uVar4 & 0x7fffffff;
    ppuVar3 = (uint **)&_1_sub_doit__opaque_list1_1;
    if (_1_sub_doit__opaque_list1_1 == (uint *)0x0) {
      *(uint **)(puVar2 + 1) = puVar2;
    }
    else {
      ppuVar3 = (uint **)(_1_sub_doit__opaque_list1_1 + 1);
      puVar2[1] = _1_sub_doit__opaque_list1_1[1];
    }
    *ppuVar3 = puVar2;
  }
  ...
```

That's confusing? It's a really long function too (1500 loc)...  
If we take a look at the end we see this though:
```c++
  if (_1_sub_doit__opaque_list1_1 != (uint *)0x0) {
    param_1[1] = 0;
    *param_1 = 0;
    param_1[3] = 0;
    param_1[2] = 0;
    *(undefined *)(param_1 + 6) = 0;
    *param_1 = 0x1311081d;
    param_1[1] = 0x1549170f;
    param_1[2] = 0x1903000d;
    param_1[3] = 0x15131d5a;
    param_1[4] = 0x5a0e08;
    param_1[5] = 0x14130817;
  }
```

That looks more interesting... Don't forget the 0x00.

If we put that into CyberChef we get: cxrgt9~ucbpdoi|*3trucamz  
Not a nice flag. Input that into the emulator and it fails...

I searched a bit around, looked in the other libs, weirdly enough for x86_64 the last bytes are reversed...

### Parameters found
I also found this in main:
```c++
undefined8 main(undefined4 param_1,undefined8 param_2,undefined8 param_3)
{
  _global_argc = param_1;
  _global_envp = param_3;
  _global_argv = param_2;
  return 0;
}
```

Maybe all lib functions have this scheme?

### The Solution
Okay I'm retarded?  

Okay if we look at this:
```
*param_1 = 0x1311081d;
std::cout << std::hex << param_1[i] << std::endl;
```
We get like we would expect `0x1311081d`.  
But because we're little endian, in memory the address will look like this: 0x1d081113.  
And if we ask c++ to transform that into a byte it will give us 0x1d.  
But if we just copy the hex string out (which is reversed) and xor it with a string (which is in the right order) it of course won't work.

But the question is, how did not notice that until now? I mean I often use the Ghidra Convert function, but I also copied xored bytes out with no problem? Maybe because the key was also inverted? Fuckin hell, I have no clue. At least now I know it.

Okay so the solution: Take those bytes, reverse them, then concat them and xor.
The key: make owasp great again

### Debugging
While I haven't used it it's pretty useful.
```
adb connect <IP>
adb shell
    ps -A (the -A shows all processes; only needed for >=Android 8) | grep uncrackable
    gdbserver :<PORT> --attach <PID>
gdb
target remote <IP>:<PORT>
```

And it should load all the libs and such.
You could also port forward to your system with
```
adb forward tcp:<LOCAL PORT> tcp:<REMOTE PORT>
```
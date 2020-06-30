---
layout: post
title: Learning Frida
categories: reversing frida
tags: cheat-engine
---

# Setup
Installation is as easy as it gets
```
pip install frida-tools
```
And that's it.

# Playing around
Get a list of all the processes with
```
frida-ps
```
If you can't find your process, try to run it as sudo/admin.

### [frida-discover](https://frida.re/docs/frida-discover/)
Discover is used to find all the used functions while tracing
```
frida-discover Tutorial-x86_64.exe
Tracing 6 threads. Press ENTER to stop.

Tutorial-x86_64.exe
        Calls           Function
        2               sub_1d00
        2               sub_11ec0
        2               sub_126b0
        2               sub_145db0
        2               sub_19b0
        2               sub_1360
        2               sub_12670
        2               sub_11f00
        2               sub_1370
        1               sub_33980
        1               sub_26400
        1               sub_85540
        1               sub_26d40
        1               sub_25aa0
        1               sub_339b0
        1               sub_39560
        1               sub_24470
        1               sub_24d30
        1               sub_19a0
        1               sub_28540
        1               sub_15d70
        1               sub_8e20
        1               sub_29e60
        1               sub_c42f0
        1               sub_25a80
        1               sub_140300
        1               sub_c47d0
        1               sub_c4320
        1               sub_1430
        1               sub_85600
        1               sub_15880
        1               sub_140020
        1               sub_25ac0
        1               sub_140000
        1               sub_1ae0

ntdll.dll
        Calls           Function
        87              RtlAcquireSRWLockExclusive
        ...
```

### [frida-trace](https://frida.re/docs/frida-trace/)
Trace is used to trace functions (duh). With it you can do the hooking and stuff.

### Cheat Engine Tutorial
We've got a health of 100 and a "Hit me" button.  
I wanna hook the function and log there or smth.
_I wanted to use discover here, but it didn't catch the hitme function_

And search in cheat engine for 100. Then press hit me.  
Search for 95 and you'll get `0x1629EB0`.

If we now look at the function that changes the value in CE (Find out what writes):
```
10002B089 - 83 C0 01 - add eax,01
10002B08C - 29 83 F0070000  - sub [rbx+000007F0],eax <<
10002B092 - 48 8D 4D F8  - lea rcx,[rbp-08]
```
Show in disassembler, Select current function => `Tutorial-x86_64.exe+2B060`

Because we don't have symbols, we need to hook by the address with
```
frida-trace -a Tutorial-x86_64.exe!2B060 Tutorial-x86_64.exe
Instrumenting...
sub_2b060: Auto-generated handler at "XXX\\__handlers__\\Tutorial_x86_64.exe\\sub_2b060.js"
Started tracing 1 function. Press Ctrl+C to stop.
```

If we take a look at sub_2b060.js
```javascript
{
/**
   * Called synchronously when about to call sub_2b060.
   *
   * @this {object} - Object allowing you to store state for use in onLeave.
   * @param {function} log - Call this function with a string to be presented to the user.
   * @param {array} args - Function arguments represented as an array of NativePointer objects.
   * For example use args[0].readUtf8String() if the first argument is a pointer to a C string encoded as UTF-8.
   * It is also possible to modify arguments by assigning a NativePointer object to an element of this array.
   * @param {object} state - Object allowing you to keep state across function calls.
   * Only one JavaScript function will execute at a time, so do not worry about race-conditions.
   * However, do not use this to store function arguments across onEnter/onLeave, but instead
   * use "this" which is an object for keeping state local to an invocation.
   */
onEnter: function (log, args, state) {
    log('sub_2b060()');
  },

    /**
   * Called synchronously when about to return from sub_2b060.
   *
   * See onEnter for details.
   *
   * @this {object} - Object allowing you to access state stored in onEnter.
   * @param {function} log - Call this function with a string to be presented to the user.
   * @param {NativePointer} retval - Return value represented as a NativePointer object.
   * @param {object} state - Object allowing you to keep state across function calls.
   */
  onLeave: function (log, retval, state) {
  }
}
```

If we now press the "Hit me" button again, the frida console shows this:
```
Started tracing 1 function. Press Ctrl+C to stop.
           /* TID 0x244c */
199715 ms  sub_2b060()
```

Let's look back at the write:
```
10002B084 - E8 D749FEFF - call Tutorial-x86_64.exe+FA60
10002B089 - 83 C0 01 - add eax,01
10002B08C - 29 83 F0070000  - sub [rbx+000007F0],eax <<
```
So we get a number (probably the random number) + 1 and subtract that from our health.  
Some ideas:
* Hook the random number and return a negative number
* Just change the health directly

Let's look at the params (add those to `onEnter`):  
* `log(args);` => `747923 ms  [object InvocationArgs]`
* `log(args[0]);` => `1025835 ms  0x16296c0`

Okay let's change that then
```javascript
onEnter: function (log, args, state) {
    log('hit me()');
    this["health_addr"] = args[0].add(0x7F0);
  },

  onLeave: function (log, retval, state) {
    log("health: " + this["health_addr"].readS32());
  }
```
We can't change the health in `onEnter`, because it will get changed afterwards (well we can and add the random number, but that's not nice).  
In `onLeave` we can't get the args (for whatever reason), so we can save it in the this object (a temporary state object).

The number displayed isn't updated because it gets set in the same function and we set the health afterwards.

If we want to change a function/replace value, (if I read it right) we have to replace the function and that's not possible with frida-trace.

# Python Setup
Simple as before (this is already installed with frida-tools)
```
pip install frida
```

### Python Script
First we gotta attach and create a session
```python
import frida, sys

def on_message(message, data):
    print("[on_message] message:", message, "data:", data)

process = "Tutorial-x86_64.exe"
script = session.create_script("""
    send("i'm in");
""")
script.on("message", on_message)
script.load()
sys.stdin.read()
```
The message callback is there to log stuff.

Now attach to our previous found "Hit me" function
```javascript
const base = Module.findBaseAddress("Tutorial-x86_64.exe")
const hitme = base.add(0x2B060);

Interceptor.attach(ptr(hitme), {
    onEnter: function(args) {
        send("hitme()");
        this["health"] = args[0].add(0x7F0);
    },
    onLeave: function(retval) {
        send("health: " + this["health"].readS32());
    }
});
```
Inside the onEnter/onLeave you can also use `this` to get some other fancy stuff like [returnAddress, registers, etc](https://frida.re/docs/javascript-api/#interceptor).

If we want to change a function call, we can use `Interceptor.replace`
```javascript
const base = Module.findBaseAddress("Tutorial-x86_64.exe")
const random = base.add(0xFA60);

var randomOrig = new NativeFunction(random, "int", ["int"]);
var rand = Interceptor.replace(randomOrig,new NativeCallback(
    function(int)
    {
        send("random(" + int + ")");
        return -1;
    }, 
    "int", ["int"]));
```
You should be able to call `rand(int)`, but it crashed the program, so probably wrong args.  
This returns just -1, which adds 1 and then subtracts that from our health.

# Conclusion
Oh god, this is nice.  
The best thing is changing a log call and not having to detach, recompile, wait for c++, reattach and maybe even restart the process.

# Bonus
```python
import frida, sys

def on_message(message, data):
    print("[on_message] message:", message, "data:", data)

process = "Tutorial-x86_64.exe"
hitmeOffset = 0x2B060
randomOffset = 0xFA60

session = frida.attach(process)

script = session.create_script("""
const base = Module.findBaseAddress("Tutorial-x86_64.exe")
const hitme = base.add(%s);
const random = base.add(%s);

send("Hit Me: " + hitme);
send("Random: " + random);
var randomOrig = new NativeFunction(random, "int", ["int"]);

Interceptor.attach(ptr(hitme), {
    onEnter: function(args) {
        send("hitme()");
        this["health"] = args[0].add(0x7F0);
    },
    onLeave: function(retval) {
        send("health: " + this["health"].readS32());
    }
});

var rand = Interceptor.replace(randomOrig,new NativeCallback(
    function(int)
    {
        send("random(" + int + ")");
        return -1;
    }, 
    "int", ["int"]));
send("finished setup");
""" % (hitmeOffset, randomOffset)
)
script.on("message", on_message)
script.load()
sys.stdin.read()
```
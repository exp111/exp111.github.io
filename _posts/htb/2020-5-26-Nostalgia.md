---
layout: post
title: HTB - Nostalgia
categories: htb reversing
tags: ghidra gba
---

## Foreword
So I did this a few weeks ago, but it was a nice reversing challenge so I thought I'd write this first (first writeup so formatting might be off).

I can only recommend to do this on your own if you're interested in Reverse Engineering.

## Preparation
The info text says

>It's late at night and your room's a mess, you stumble upon an dusty old looking box and you decide to go through it, you start unveiling hidden childhood memories and you find a mesmerising gamebody advanced flash card labeled "Nostalgia", you pop the card in and a logo welcomes you, this strange game expects you to input a cheatcode. Can you figure it out? 

As I grew up with the Gameboy it instantly piqued my interest (and those 70 points aren't shabby either).

Okay let's download the zip file and look inside:

```
exp@manjaro:~# unzip -l Nostalgia.zip 
Archive:  Nostalgia.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
    72812  2020-05-06 10:47   Nostalgia.gba
      164  2020-05-06 10:47   instructions.txt
---------                     -------
    72976                     2 files
```

Okay, we've got a gba file and a txt file.
Let's look at the instructions first:


>Open the rom in a GBA emulator of your choice. Select is to clear the input on the screen and start is to submit it, if the cheatcode is wrong, nothing will happen.


Let's look for a Emulator then...

### The Emulator
[LiveOverflow](https://www.youtube.com/channel/UClcE-kVhqyiHCcjYwcpfj9w) (if you don't know him, he makes great videos on itsec topics) recently reversed Pokemon Red, so I knew a bit about the Gameboy. I looked up which emulator he used (SameBoy) and installed it.

Start it and.... it doesn't work. Apparently Gameboy and Gameboy Advanced is something different.
A quick google and I found mGBA (and it's in the arch user repo).

### Static Analysis Tools
I really like Ghidra 'cause it's free and I'm used to it, so let's install a architecture plugin too. As we now know GBA is something different so we can't use GhidraBoy here.
I decided to use [GhidraGBA by SiD3W4y](https://github.com/SiD3W4y/GhidraGBA).

To install use this (replace /opt/ghidra with your ghidra installation directory):
```
git clone https://github.com/SiD3W4y/GhidraGBA.git
cd GhidraGBA
export GHIDRA_INSTALL_DIR=/opt/ghidra
gradle
```
Then a .zip should be build in dist/.
Go into Ghidra, "File" > "Install Extensions..." and select the zip.   
If it doesn't work use google, I don't know how I fixed anything.

Okay back to mGBA.
The controls are written in the man page ([RTFM](https://xkcd.com/293/)), but here they are too (GBA Button = Key):

* A = x
* B = z
* L = a
* R = s
* Start = Enter
* Select = Backspace
* Arrows = Arrows

## The fun stuff with fancy images

Let's boot up the game with
```
mgba Nostalgia.gba
```

And the Hack The Box logo greets us in fancy pixel art:  
![The startup screen]({{ site.baseurl }}/assets/images/nostalgia/start.png "The startup screen")

Let's try pressing some buttons:  
![Buttons pressed]({{ site.baseurl }}/assets/images/nostalgia/buttons.gif "Buttons pressed")  
Okay the input get printed out to screen. Seems like we need to get the right code (if we had read the instructions we would know that by now).

We can't input anymore than 8 buttons, pressing Start does nothing and Select resets it. We could try to brute force it, but where is the fun in that...

## Time to look what's under the hood or:
### The nerdy fun stuff

Boot up Ghidra and import the .gba file.
If the installation of the extension worked it should be recognized as a GBA ROM.

```c++
void _entry(void)
{
  IME = 0x4000000;
  FUN_0800019c(0x2240,0x8000000,0x2000000,0x1386c);
  /* WARNING: Treating indirect jump as call */
  (*(code *)0x2000000)();
  return;
}
```
The entry point seems pretty wonky and that makes sense because it probably does some gba bootup stuff or ghidra doesn't recognize the right function. So let's take

### Another approach
We know that the "game" mainly reads out the input and I know that the key input is memory mapped (thanks to LiveOverflow's video).

So let's take a look where this is saved. Google spits out the address 0x4000130 and GhidraGBA even labeled the address as KEYINPUT.  
We even already can see two refs (and one is a pointer) `0x080015fa (R)` and `0x080017ac (*)`. Nice!  
Okay let's jump to 0x080015fa:

### One long ass function
The pseudocode is about 150 lines long so let's look at it part-by-part:

```c++
void ReadInput(void)
{
  DISPCNT = 0x1140;
  FUN_08000a74();
  FUN_08000ce4(1);
  DISPCNT = 0x404;
  FUN_08000dd0(&DAT_02009584,0x6000000,&DAT_030000dc);
  FUN_08000354(&DAT_030000dc,0x3c);
  ...
```
This is probably just some init stuff but nothing interesting right now, but on a sidenote:  
DISPCNT is the Display Control Register of the GameBoy and just tells the display what you're about to do to it.

### Pressing Issue
```c++
do {
  lastKeys = uVar3;
  activeKeys = KEYINPUT | 0xfc00;
  puVar5 = &DAT_0200b03c;
  uVar3 = activeKeys;
  do {
    uVar1 = DAT_030004dc;
    uVar4 = *puVar5;
   /* pressed last frame and doesn't now? */
   if ((uVar4 & lastKeys & ~uVar3) != 0) {
     ...
```
Okay here it get's more interesting.  
The last frame's pressed keys are saved and then compared with the current frames.  
Seems like we want to know if uVar4 was in lastKeys and not in the current keys, also called letting go off a button.

### Know your enemy
If we want to know which keys are pressed we probably need a enum right?
Well here it is
```c++
typedef enum KEYS
{
  A       = (1 << 0),
  B       = (1 << 1),
  SELECT  = (1 << 2),
  START   = (1 << 3),
  RIGHT   = (1 << 4),
  LEFT    = (1 << 5),
  UP      = (1 << 6),
  DOWN    = (1 << 7),
  R       = (1 << 8),
  L       = (1 << 9)
}
```
Well that's nice to look at but I want the numbers mason...
```c++
A = 1
B = 2
SELECT = 4
START = 8
RIGHT = 16
LEFT = 32
UP = 64
DOWN = 128
R = 256
L = 256
```

### Button Events
Okay now that's out of the way, it may get interesting.

```c++
/* SELECT */
if (uVar4 == 4) {
  inputCount = 0;
  uVar2 = FUN_08001c24(DAT_030004dc);
  FUN_08001868(uVar1,0,uVar2);
  _DAT_05000000 = 0x1483;
  FUN_08001844(&DAT_0200ba18);
  FUN_08001844(&DAT_0200ba20,&DAT_0200ba40);
  incVal = 0;
  uVar3 = activeKeys;
}
else {
  ...
```
Okay SELECT resets a few values and that makes sense if it resets all input.Notable here are inputCount and incVal, but more on those later.

### The finish line?
```c++
  /* START */
  if (uVar4 == 8) {
    if (incVal == 0xf3) {
      DISPCNT = 0x404;
      FUN_08000dd0(&DAT_02008aac,0x6000000,&DAT_030000dc);
      FUN_08000354(&DAT_030000dc,0x3c);
      uVar3 = activeKeys;
    }
  }
  else {
    ...
```
START is supposed to submit the code and it checks here a variable (incVal) and then does something. But how do we get incVal to 0xf3?

### Where it gets ugly
```c++
if (inputCount < 8) {
  inputCount = inputCount + 1;
  FUN_08000864();
  /* RIGHT */
  if (uVar4 == 0x10) {
    incVal = incVal + 0x3a;
LAB_08001742:
    local_2c = &DAT_0200ba0c;
  }
else {
  if (uVar4 < 0x11) {
    ...
```
It checks a variable for 8 and we have a length of 8 so maybe it's the current code length? (spoiler: _it is_).  
After that it gets fucky. Probably the decompilers fault, but many labels get introduced and those seem sometimes pretty useless.
But hey, incVal get's increased by 0x3a when we press RIGHT. But that is not enough to get to our target of 0xf3...

### More buttons
```c++
/* A */
if (uVar4 == 1) {
  incVal = incVal + 3;
LAB_08001766:
  local_2c = &DAT_0200b9f8;
}
else {
  iVar4 = 0xe;
  /* B */
  if (uVar4 != 2) {
LAB_0800168a:
    iVar4 = 0;
  }
  incVal = iVar4 + incVal;
  ...
```
Have some more of that weird decompiled code. A adds 3 to our value and B adds 0xe.
I see a pattern here...

### I'm out of header titles
The code pretty much continues to check for the button keys and adds it to incVal if it was pressed.  
Here a list of the buttons and the increase value (I'd prefer a table, but Jekyll Now is apparently not able to do that...):
* A = 0x3
* B = 0xe
* UP = 0x28
* DOWN = 0xc
* LEFT = 0x6e
* RIGHT = 0x3a

### I also suck at math
We now can calculate the needed buttons as we don't need exactly 8 inputs, but only max 8.  
You could probably calculate which code is correct, but here is the code I found out by manually subtracting:  
`UP UP UP UP UP UP A`  
`0x28 * 6 + 0x3 = 0xF3`

Enter that sucker and press start and you'll be greeted by the flag. Well, kinda short...

## Afterword
All in all a pretty cool but easy challenge (if you know where to start). Would love to reverse more weird architecture like the GameBoy.  
You can spawn a gdb session to debug with mGBA too, but that wasn't necessary here.  
I noticed that I should probably make screenshots while doing the challenges and not afterwards. Also mGBA only makes screenshots in the native resolution.

## Bonus
Here is the full pseudocode if you want to see that decompiled monster
```c++
void ReadInput(void)
{
  DISPCNT = 0x1140;
  FUN_08000a74();
  FUN_08000ce4(1);
  DISPCNT = 0x404;
  FUN_08000dd0(&DAT_02009584,0x6000000,&DAT_030000dc);
  FUN_08000354(&DAT_030000dc,0x3c);
  uVar3 = activeKeys;
  do {
    lastKeys = uVar3;
    activeKeys = KEYINPUT | 0xfc00;
    puVar5 = &DAT_0200b03c;
    uVar3 = activeKeys;
    do {
      uVar1 = DAT_030004dc;
      uVar4 = *puVar5;
      /* pressed last frame and doesn't now? */
      if ((uVar4 & lastKeys & ~uVar3) != 0) {
                    /* SELECT */
        if (uVar4 == 4) {
          inputCount = 0;
          uVar2 = FUN_08001c24(DAT_030004dc);
          FUN_08001868(uVar1,0,uVar2);
          _DAT_05000000 = 0x1483;
          FUN_08001844(&DAT_0200ba18);
          FUN_08001844(&DAT_0200ba20,&DAT_0200ba40);
          incVal = 0;
          uVar3 = activeKeys;
        }
        else {
          /* START */
          if (uVar4 == 8) {
            if (incVal == 0xf3) {
              DISPCNT = 0x404;
              FUN_08000dd0(&DAT_02008aac,0x6000000,&DAT_030000dc);
              FUN_08000354(&DAT_030000dc,0x3c);
              uVar3 = activeKeys;
            }
          }
          else {
            if (inputCount < 8) {
              inputCount = inputCount + 1;
              FUN_08000864();
              /* RIGHT */
              if (uVar4 == 0x10) {
                incVal = incVal + 0x3a;
LAB_08001742:
                local_2c = &DAT_0200ba0c;
              }
              else {
                if (uVar4 < 0x11) {
                    /* A */
                  if (uVar4 == 1) {
                    incVal = incVal + 3;
LAB_08001766:
                    local_2c = &DAT_0200b9f8;
                  }
                  else {
                    iVar4 = 0xe;
                    /* B */
                    if (uVar4 != 2) {
LAB_0800168a:
                      iVar4 = 0;
                    }
                    incVal = iVar4 + incVal;
                    /* LEFT */
                    if (uVar4 == 0x20) {
LAB_080016ea:
                      local_2c = &DAT_0200ba08;
                    }
                    else {
                      if (uVar4 < 0x21) {
                        if (uVar4 == 2) {
                          local_2c = &DAT_0200b9fc;
                        }
                        else {
                          if (uVar4 == 0x10) goto LAB_08001742;
                          if (uVar4 == 1) goto LAB_08001766;
                        }
                      }
                      else {
                        if (uVar4 == 0x80) goto LAB_08001754;
                        if (uVar4 < 0x81) {
                          if (uVar4 == 0x40) goto LAB_08001778;
                        }
                        else {
                          if (uVar4 == 0x100) {
                            local_2c = &DAT_0200ba04;
                          }
                          else {
                            if (uVar4 == 0x200) {
                              local_2c = &DAT_0200ba00;
                            }
                          }
                        }
                      }
                    }
                  }
                }
                else {
                  /* UP */
                  if (uVar4 == 0x40) {
                    incVal = incVal + 0x28;
LAB_08001778:
                    local_2c = &DAT_0200ba10;
                  }
                  else {
                    /* DOWN */
                    if (uVar4 != 0x80) {
                      /* LEFT */
                      if (uVar4 != 0x20) goto LAB_0800168a;
                      incVal = incVal + 0x6e;
                      goto LAB_080016ea;
                    }
                    incVal = incVal + 0xc;
LAB_08001754:
                    local_2c = &DAT_0200ba14;
                  }
                }
              }
              uVar1 = FUN_08001bc4(DAT_030004dc,local_2c);
              _DAT_05000000 = 0x1483;
              DAT_030004dc = uVar1;
              FUN_08001844(&DAT_0200ba18);
              FUN_08001844(&DAT_0200ba20,uVar1);
              uVar3 = activeKeys;
            }
          }
        }
      }
      puVar5 = puVar5 + 1;
    } while (puVar5 != (ushort *)&UNK_0200b050);
  } while( true );
}
```

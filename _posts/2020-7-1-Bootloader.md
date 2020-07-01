---
layout: post
title: 247CTF - The Flag Bootloader
categories: reversing 247ctf
tags: bootloader dos gdb qemu
---

# [The Flag Bootloader](https://247ctf.com/)
I found this challenge linked on the ReverseEngineering subreddit.

HxD => shows some strings:  
* "Unlock code:"
* "Invalid code!"
* "247CTF{w!g0`5xy.. rpu)+.\!pbce`...;;}"

Last one looks like a flag, but probably encrypted/encoded.

Ghidra doesn't recognize the language => just select x86.  
IDA does a significant better job though.

```
file .\flag.com
.\flag.com: DOS/MBR boot sector
```
Really a mbr bootloader (duh)

qemu to emulate whatever that is
```
.\qemu-system-x86_64.exe -drive format=raw,file=.\flag.com
```
We get this prompt
```
Booting from Hard Disk...
Unlock code:

```

Let's debug this:

Just stole this command from [here](https://github.com/VoidHack/write-ups/tree/master/Square%20CTF%202017/reverse/floppy)
```
qemu-system-x86_64 -s -S -m 512 -fda flag.com
```
Now attach gdb and break at the beginning
```
gdb
target remote localhost:1234
break *0x7c00
c
```

`sub_10108` prints stuff
```
seg000:0115 int     10h             ; - VIDEO - WRITE CHARACTER AND ADVANCE CURSOR (TTY WRITE)
                                    ; AL = character, BH = display page (alpha modes)
                                    ; BL = foreground color (graphics modes)
```
break *7c1d

`sub_10102` reads keystrokes
```
seg000:0102 sub_10102       proc near               ; CODE XREF: start+3A↓p
seg000:0102                 mov     ax, 1000h
seg000:0105                 int     16h             ; KEYBOARD - GET ENHANCED KEYSTROKE (AT model 339,XT2,XT286,PS)
seg000:0105                                         ; Return: AH = scan code, AL = character
seg000:0107                 retn
seg000:0107 sub_10102       endp
```
Where al is the ascii char of the keystroke.

Using these two informations:
```
seg000:0137 loc_10137:
seg000:0137                 mov     si, 7DE6h
seg000:013A                 call    sub_10102
seg000:013D                 mov     ds:7DE6h, al
seg000:0140                 call    sub_10108
seg000:0143                 mov     bx, ds:7DEAh
seg000:0147                 cmp     bx, 7DFDh
seg000:014B                 jz      loc_10284
seg000:014F                 mov     [bx], al
seg000:0151                 add     bx, 1
seg000:0154                 mov     ds:7DEAh, bx
seg000:0158                 cmp     byte ptr ds:7DE6h, 0Dh
seg000:015D                 jnz     short loc_10137
```
This is the read & write loop. And we can see that the input is saved into `0x7DE6`

If we input more than 18 characters we get the message `No memory!`.  
Which we can see here (`0x7DEA` is the input length).
```
seg000:0143                 mov     bx, ds:7DEAh
seg000:0147                 cmp     bx, 7DFDh
seg000:014B                 jz      loc_10284
seg000:014F                 mov     [bx], al
seg000:0151                 add     bx, 1
seg000:0154                 mov     ds:7DEAh, bx
```

We can see the exit jump here:
```
seg000:0158                 cmp     byte ptr ds:7DE6h, 0Dh
seg000:015D                 jnz     short loc_10137
seg000:015F                 mov     si, 7DD5h
seg000:0162                 call    sub_10108
seg000:0165                 call    sub_1016A
```
Checks `0x7DE6` for `0x0D` (which is the ascii code for enter).

`sub_1016A` is the check function, which basically consists of this:
```
seg000:016B                 mov     bx, 7DECh
seg000:016E                 mov     si, 7DAAh
seg000:0171                 add     si, 7
seg000:0174                 mov     al, 4Bh
seg000:0176                 xor     al, 0Ch
seg000:0178                 cmp     [bx], al
seg000:017A                 jnz     loc_1027C
```
Checks the character with an xor'ed value and quits if it's not equal.  
There is also sometimes a sneaky `sub al,X` in there.  
As the program uses not the user input to xor the key, there is no need for us to input that.  
I just added break points at all the checks and changed the z flag there (to skip the jump).

Breakpoint list
```
break *0x7c7a
break *0x7c8b
break *0x7c9c
break *0x7cad
break *0x7cbe
break *0x7ccf
break *0x7ce0
break *0x7cf1
break *0x7d02
break *0x7d11
break *0x7d20
break *0x7d2f
break *0x7d3e
break *0x7d4d
break *0x7d5c
break *0x7d6b
```
To set the z flag:
```
(gdb) set $eflags |= (1 << 6)
```

If we're at `0x7D74`, we can print the flag with
```
(gdb) x/s 0x7DAA
```

Or we just enter `c` and let the program print it out (can't copy though).
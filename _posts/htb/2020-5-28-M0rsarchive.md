---
layout: post
title: HTB - M0rsarchive
categories: HTB Misc
tags: Python Morse WSL Bash
---

## Foreword
Found in the HackTheBox challenges under the Misc category.
Not really reversing but nonetheless a nice challenge.

The info text:
> Just unzip the archive ... several times ... 

## First look
Let's unzip the archive
```
Archive:  M0rsarchive.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
   624814  2018-10-03 20:02   flag_999.zip
       95  2018-10-03 20:02   pwd.png
---------                     -------
   624909                     2 files
```

Mhh seems like another passworded zip inside and the pwd.png should contain the password.

I recently did the Eternal Loop challenge in which you needed to unzip loop and unzip with the zip name. Maybe it's here the same?
The name of the challenge suggests some morse encoding so let's look at the image:

![First pwd.png]({{ site.baseurl }}/images/m0rsarchive/pwd1.png "First pwd")

That's uhhh.. tiny...
Zoom! Enhance!

![pwd.png but big]({{ site.baseurl }}/images/m0rsarchive/pwd1-big.png "pwd.png but big")

Okay that's better.
Seems like the morse is written in the picture. Let's decode it (----.) and put it into [CyberChef](https://gchq.github.io/CyberChef/). It decodes to 9. I'll do it manually now...

### The next one
The next archive shows something similar:
```
Archive:  flag_999.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
   624326  2018-10-03 20:02   flag/flag_998.zip
       99  2018-10-03 20:02   flag/pwd.png
---------                     -------
   624425                     2 files
```

Open up the pwd.png:

![Second pwd.png]({{ site.baseurl }}/images/m0rsarchive/pwd2.png "Second pwd")

This time there are two rows. I'm now too lazy to write that down manually so we'll do it automatic.

## Automatic parsing
We can see a few things now about the format of the pwd.png:
* The morse character is in a different color
* The character is always 3 or 1 pixels long
* There can be multiple rows => a new line means a new character
* There is always a empty line between rows (and at the beginning end)
* There is always a empty pixel before the row

We can parse it now easily. There are 2 steps:
* Read the image pixel by pixel and get the morse characters
* Decode the morse string to something morse readable (_base64?_)

### Step 1: Read the image
I'm using Python 'cause it's my go-to language to write fast & dirty scripts in.
A bit of googling gives me the Python Image Library (PIL) to read out images as pixel arrays. Justa access the image through `pix[x,y]`
```python
import sys
from PIL import Image

im = Image.open(sys.argv[1])
pix = im.load()

width,height = im.size
bgColor = pix[0,0]
morseCode = ""
count = 0
# Loop through the pixel lines
for y in range(1, height - 1, 2): # start at 1 to skip first line, - 1 cuz we index at 0, step by 2 (to skip even lines)
    for x in range(1, width - 1): # start at 1 to skip first pixel, -1 cuz we index at 0
        if pix[x,y] != bgColor:
            count += 1 # add 1 to count if pixel has other color
        else: # we back to bgcolor
            if count != 0: # have we found a colored pixel?
                morseCode += ("-" if count == 3 else ".") # depending on the length add morse char
                count = 0 # reset pixel length
    morseCode += " " # new character
```
This fills `morseCode` with the morse string.

### Step 2: From Morse to Readable
For this part I just stole the [shortest answer from StackOverflow](https://stackoverflow.com/a/32094652). I actually was searching for a library because I'm too lazy to write down the whole morse character table.
```python
CODE = {'A': '.-',     'B': '-...',   'C': '-.-.', 
        'D': '-..',    'E': '.',      'F': '..-.',
        'G': '--.',    'H': '....',   'I': '..',
        'J': '.---',   'K': '-.-',    'L': '.-..',
        'M': '--',     'N': '-.',     'O': '---',
        'P': '.--.',   'Q': '--.-',   'R': '.-.',
        'S': '...',    'T': '-',      'U': '..-',
        'V': '...-',   'W': '.--',    'X': '-..-',
        'Y': '-.--',   'Z': '--..',

        '0': '-----',  '1': '.----',  '2': '..---',
        '3': '...--',  '4': '....-',  '5': '.....',
        '6': '-....',  '7': '--...',  '8': '---..',
        '9': '----.' 
        }

CODE_REVERSED = {value:key for key,value in CODE.items()}
def from_morse(s):
    return ''.join(CODE_REVERSED.get(i) for i in s.split())

print(from_morse(morseCode).lower())
```
_Professional Programmer™_  
This prints out the decoded morse string.

## Short Digression: Windows Subsystem for Linux (WSL)
Okay I'm currently on my main Windows pc and I'm too lazy to power on my laptop or my vm.  
The Problem: I don't know how I can easily unzip all those 999 zips on Windows. Python probably can't do that without a library and 7z is not in my PATH.  
And I only use this as a excuse to test out the WSL.
It's a optional feature so activate it with
> dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

And for good measure also activate the Virtual Machine Platform

> dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Now restart your pc and download any linux distro from the Windows Store (never thought I'd do this one day...).
As a professional Hacker I of course choose kali (which doesn't matter because apparently you don't have anything useful installed).

Boot it up, create a unix user and your normal harddrives should be mounted under /mnt/ as c,d,...

First do this  
```
sudo apt update
sudo apt upgrade
```

Install unzip, python3 & PIL with  
```
sudo apt install unzip
sudo apt install python3
sudo apt install python3-pil
```

And you should be ready to go...

## Back to bash scripting

I wrote this script and it worked fine (except some chmod issues because I worked on my Windows harddrive)
```bash
#!/bin/bash
START=999

while [ $START -gt 0 ]
do
NEXT=$((START-1))
pw=$(python3 ./readImgMorse.py flag_$START/flag/pwd.png)
if [ -z "$pw" ]
then
    echo "something fucked up"
    exit
fi
echo $pw
unzip -P $pw -o flag_$START/flag/flag_$NEXT.zip -d flag_$NEXT
START=$NEXT
done
```
But let's look at some of my

## Errors along the way
### First Mistake
I first didn't add the space after each row and it died at the second zip, because it wasn't valid morse then.  
Solution: Add `morseCode += " "` after every y loop. (Note: this adds a space after the last char but apparently unzip ignores that...)

After that I added the fail exit `if [ -z "$pw" ]` (checks if pw is empty) into the bash script.

### Second Mistake
Then it went till 986.zip and the password was wrongly read.

![pwd 986]({{ site.baseurl }}/images/m0rsarchive/pwd986.png "pwd 986")

My script read `JSZONJREP0FVVP` and the morse code was `.--- ... --.. --- -. .--- .-. . .--. ----- ..-. ...- ...- .--.` which should be decoded to the script output...
So what went wrong?  
Apparently you have to lowercase the password. I mean it makes sense that morse code can be interpreted as lower or uppercase, but really? Every decoder I found online uppercased morse code...  
Solution: Add .lower() into the print. Or you could just change the morse dictionary.

### The flag
And that's it! Inside the flag_0.zip should be the flag file with the HTB{...} formatted flag.

## Bonus
The readImgMorse.py
```python
import sys
from PIL import Image

if len(sys.argv) != 2:
    print("Usage: readImgMorse.py $file")
    exit()

# Step 1: Read Image and get the morse symbols (- .)
# Images look like this:
#########################
#                       #
# ### ### ### ### #     #
#                       #
#########################

##########################
#                        #
# ### ### ### ### ###    #
#                        #
# ### ### ### # #        #
#                        #
##########################
# => only read lines 1,3,5,..., ignore first & last pixel

im = Image.open(sys.argv[1])
pix = im.load()

width,height = im.size
bgColor = pix[0,0]
morseCode = ""
count = 0
# Loop through the pixel lines
for y in range(1, height - 1, 2): # start at 1 to skip first line, - 1 cuz we index at 0, step by 2 (to skip even lines)
    for x in range(1, width - 1): # start at 1 to skip first pixel, -1 cuz we index at 0
        if pix[x,y] != bgColor:
            count += 1 # add 1 to count if pixel has other color
        else: # we back to bgcolor
            if count != 0: # have we found a colored pixel?
                morseCode += ("-" if count == 3 else ".") # depending on the length add morse char
                count = 0 # reset pixel length

# Step 2: morse to readable
# https://stackoverflow.com/a/32094652
CODE = {'A': '.-',     'B': '-...',   'C': '-.-.', 
        'D': '-..',    'E': '.',      'F': '..-.',
        'G': '--.',    'H': '....',   'I': '..',
        'J': '.---',   'K': '-.-',    'L': '.-..',
        'M': '--',     'N': '-.',     'O': '---',
        'P': '.--.',   'Q': '--.-',   'R': '.-.',
        'S': '...',    'T': '-',      'U': '..-',
        'V': '...-',   'W': '.--',    'X': '-..-',
        'Y': '-.--',   'Z': '--..',

        '0': '-----',  '1': '.----',  '2': '..---',
        '3': '...--',  '4': '....-',  '5': '.....',
        '6': '-....',  '7': '--...',  '8': '---..',
        '9': '----.' 
        }

CODE_REVERSED = {value:key for key,value in CODE.items()}
def from_morse(s):
    return ''.join(CODE_REVERSED.get(i) for i in s.split())

print(from_morse(morseCode).lower())
```
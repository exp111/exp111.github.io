---
layout: post
title: Yet another PwnAdventure3 Writeup
categories: reversing game
tags: pwn-adventure hax
---

# Server Setup
Basically follow [this video](https://www.youtube.com/watch?v=VkXZXwQP5FM)/[this post](https://github.com/LiveOverflow/PwnAdventure3).

Here what I did:

Install Debian 20.04 Server in VirtualBox
2Gb Ram
10Gb Drive (Edit: which is not enough)
Setup the Network correctly, I'm using a host only adapter

If you want to use docker, don't install the snap docker from the server installer.  
It conflicts with docker-compose or something like that.

```
sudo apt update
sudo apt upgrade

sudo apt install docker.io
sudo apt install docker-compose

git clone https://github.com/LiveOverflow/PwnAdventure3.git
cd PwnAdventure3
wget http://pwnadventure.com/pwn3.tar.gz
tar -xvf pwn3.tar.gz

docker-compose build
docker-compose up
```

If you want to change the keylayout, use `loadkeys en` (with your language code); resets after every reboot.

I couldn't even unzip the pwn3.tar.gz. So I upgraded the hard drive to 50 gigs.
In VirtualBox: File > Virtual Media Manager... > PwnAdventureServer.vdi > Properties
You would need to resize the partition too. You can do that with Gparted/pghidra
arted.

Note: The `docker-compose build` step took a time for me and was stuck at `Building Init` for like 5-10min. Just wait. It'll do something (hopefully).

# Client Setup
On Windows
Insert into /etc/hosts (on Windows %WINDIR%/System32/drivers/etc/hosts)
```
10.0.0.103 master.pwn3
10.0.0.103 game.pwn3
```

Change the server.ini in PwnAdventure3\PwnAdventure3_Data\PwnAdventure3\PwnAdventure3\Content\Server
```
[MasterServer]
Hostname=master.pwn3
...

[GameServer]
Hostname=game.pwn3
...
```

Launch the game, create a account and you should be good to go.  
The db is not persistent. So just pause the vm.

# Tools
I'm using Ghidra for static analysis, Cheat Engine for dynamic analysis and ReClass.NET for getting structs.

# Let's do stuff
Okay you start in this cave and have to escape. There is a bush blocking the way out and you can find a fireball in the same cave.  
Collect the spell and fire it. It reduces mana! So let's look for that value.

### Mana
Attach Cheat Engine, look for 100, shoot a fireball and look for a decreased value. I'd recommend setting hotkeys for decreased & increased values.  
After a few times I found 4 addresses all containing the same value.

I found no connection to the player though.
Let's look at something different instead.

_I fucked up here and ignored this, but you can find the player here too:_
One address has this write:
```
542C45E6 - 89 82 2C010000  - mov [edx+0000012C],eax <<

EAX=00000053
EDX=3D59B050
```
And EDX is our player

### Current Item
Look at current selected item in toolbar.  
Search for Unknown Number, Decreased, Increased etc.  
Found the value (it's indexed, starts at 0). Look at writes.  
Found one in GameLogic.dll:
```
56613E8D - 8B 8E B8010000  - mov ecx,[esi+000001B8]
56613E93 - 89 96 80010000  - mov [esi+00000180],edx <<
```
esi => Player?  
ReClass.NET shows RTTI:
```
<DATA>GameLogic.dll.56658440 Player : Actor : IActor : IPlayer
```

### Player Class
Let's look at the class then.
Here a few things I found:
* 0x79: Player Name
* 0x90: Team Name
* 0xF4: Level Name (Contains 'LostCave')
* 0x12C: Our mana (it's even the address we found before)
* 0x180: currentItem

If we have a look at the vtable in Ghidra and look where it's referenced:
```c++
0x4ffc0
void __thiscall InitPlayer(void *this,undefined param_1)
{
  ...
  FUN_00002560(local_30,(int **)"Player",(int *)&IMAGE_DOS_HEADER_00000000.e_crlc);
  local_8 = 0;
  FUN_000019c0(this,local_30);
  if (0xf < local_1c) {
    operator_delete(local_30[0]);
  }
  *(undefined4 *)((int)this + 0x70) = 0x6f438;
  *(undefined4 *)this = 0x78440;
  *(undefined4 *)((int)this + 0x70) = 0x78334;
  *(undefined4 *)((int)this + 0x8c) = 0xf;
  *(undefined4 *)((int)this + 0x88) = 0;
  *(undefined *)((int)this + 0x78) = 0;
  ...
}
```
If we have a look where that is referenced, we can see 4 functions and before each call 01xdc get's alloced.
```c++
  this = operator_new(0x1dc);
  local_8 = 0;
  if (this == (void *)0x0) {
    local_34 = (int *)0x0;
  }
  else {
    local_34 = (int *)InitPlayer(this,0);
  }
```
Now we have the Player Class size.

### Out of the cave
Let's go out of the cave to get some more items and info.

We get into the severs and see a few rats. After being attacked, we can see that our health at player+0x30 changes.

I also just noticed that all of the strings are probably std::string's or some other implementation. We can see that after the char[16], we have a size value and after that a capacity value.
```
struct String
{
    char[16] val;
    unsigned int size;
    unsigned int capacity;
}
```
Or something like that.

### Items
Out of the severs are a few bears that drop Items, namely Pistol, Shotgun and Rifle Ammunition.
After a few item count searches I found the address.
If we look at the writes it leads us back to the 2nd Player vtable at [10].

After some digging around Player + 0xBC is probably the inventory and 0xC0 the itemCount.
I also noticed that Player + 0x158 is a array with all the hotbar items.

The inventory is structured weird.
It took some time and graph drawing but it's probably a tree.
```c++
struct InventorySlot
{
    InventorySlot* leftChild;
    InventorySlot* parent;
    InventorySlot* rightChild;
    int val;
    Item* item;
    Item* item2;
    int count;
}
```

Here is a script to print out the inventory as a tree. Player address needs to be given.
```lua
function toHex(int)
         return string.format("%02X", int)
end

player = 0x3D59B050
invOffset = 0xBC
inventory = readPointer(player + invOffset)
print("Inventory: " .. toHex(inventory))
print("ItemCount: " .. readInteger(player + invOffset + 4))

firstChild = readPointer(inventory + 0x4)

function printNode(cur, i)
         local left = readPointer(cur)
         --parent = readPointer(cur + 0x4) -- We shouldn't need to print this, as we probs come from there
         local right = readPointer(cur + 0x8)
         if left and left ~= inventory then
            printNode(left, i + 1)
         end

         val = toHex(readInteger(cur + 0xC))
         count = readInteger(cur + 0x18)
         countStr = ""
         if count then
            count = ", Count: " .. count
         end
         print(string.rep("-",i) .. "Item [" .. toHex(cur) .. "]: Val: " .. val .. count)

         if right and right ~= inventory then
            printNode(right, i + 1)
         end
end

printNode(firstChild, 0)
```

### Quests
I got some bear quest while trying to change my money and I found a pointer at Player + 0x18C.  
RTTI shows:
```
<DATA>GameLogic.dll.54308650 Quest : IQuest ...
```

With ReClass I found:
* 0x4 (String): questID (probably some internal quest string)
* 0x1C (char*): questName
* 0x3C: QuestState* (Name showed in RTTI)

QuestState:
* 0x8 (String): stateName ('Initial')
* 0x20 (char*): infoText (shows what to do 'Solve the puzzles in Fort Blox')

### Dejavu
Right under the Quest pointer are 2 floats with the values 200.f and 420.f.  
Changing the first made me fast as fuck boi. Probably the max speed.  
I thought the second one was the acceleration, but it's the jump height.

With these I should be able to find the position.
They are accessed through the vtable, but the call stems from PwnAdventure3.exe.
Uhh I didn't analyze that yet.

While that is analyzing, let's try finding a static pointer to our player.

### Achieving Persistence
The InitPlayer function we found at the beginning is called in InitLocal, which is apparently a export. A parameter is an `ILocalPlayer` pointer and apparently Player + 0x1B8 gets set to that pointer.

Inside the function `DAT_97d7c` gets initialized too and the vtable is set to the `LocalWorld` vtable.  
If we have a look in ReClass, we see that it's indeed a `World`, but not the LocalWorld, but `ClientWorld`.  
If we have a look at the cross references to the ClientWorld vtable, we see the Export InitClient. In there `DAT_97e48` is used: 
```c++
  if (DAT_97e48 == 0) {
    iVar2 = 0;
  }
  else {
    iVar2 = DAT_97e48 + -0x70;
  }
```
-0x70? Isn't that our IPlayer vtable offset? (The 2nd vtable inside our Player Class).

A look in ReClass shows that this is indeed a pointer to our IPlayer object.

### Part 1?
This is probably enough for one post...

<!--
## The code
Will cruising through the world with 4000 speed units I discovered a pirate chest.

It wants a DLC unlock code, so let's find it out?  
Search for "The unlock code entered is not valid".
```c++
  FUN_00002560(local_4c,inputCode,(int *)ppiVar3);
  cVar1 = CheckCode(local_4c);
  if (0xf < local_38) {
    operator_delete(local_4c[0]);
  }
  if (cVar1 == '\0') {
    if (*(int **)(local_50 + 0x148) != (int *)0x0) {
      (**(code **)(**(int **)(local_50 + 0x148) + 0x70))
                ("Invalid Unlock Code","The unlock code entered is not valid. Please try again.");
    }
  }
```
Ah yes, calculating if the code is valid on client side.
The code is checked in `FUN_3ad20` (CheckCode) and it get's just given as a string.
Let's have a look into the CheckCode function:

```c++
...
if (code[4] != 0) {
  capacity = code[5];
  do {
    puVar1 = code;
    if (0xf < capacity) {
      puVar1 = (undefined4 *)*code;
    }
    if (*(char *)((int)puVar1 + i) != ' ') {
      puVar1 = code;
      if (0xf < capacity) {
        puVar1 = (undefined4 *)*code;
      }
      if (*(char *)((int)puVar1 + i) != '-') {
        if (0x18 < uVar4) goto LAB_0003ada7;
        puVar1 = code;
        if (0xf < capacity) {
          puVar1 = (undefined4 *)*code;
        }
        cVar5 = *(char *)((int)puVar1 + i);
        array[uVar4] = 0;
        if ((byte)(cVar5 + 0x9fU) < 0x1a) {
          cVar5 = cVar5 + -0x20;
        }
        cur = '0';
        allowedChars = "0123456789ABCDEFHJKLMNPQRTUVWXYZ";
        while (cur != cVar5) {
          allowedChars = allowedChars + 1;
          array[j] = array[j] + '\x01';
          cur = *allowedChars;
          if (cur == '\0') goto LAB_0003ada7;
        }
        capacity = code[5];
        uVar4 = j + 1;
        j = uVar4;
      }
    }
    i = i + 1;
  } while (i < (uint)code[4]);
  ...
```
* Code must not be empty
* ' ' and '-' are ignored
* maxLength of 0x18 (24)
* Code must only contain 0123456789ABCDEFHJKLMNPQRTUVWXYZ

Every character gets transformed into a number depending on their position in the allowedChars string
-->
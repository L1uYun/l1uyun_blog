---
title: vivifytech
tags:
  - sec
date: 2024-02-13T12:46:25
lastmod: 2025-09-29T20:51:23
toc: "true"
draft: "false"
---

192.168.10.12
## 端口扫描
![HMM_vivifytech_image_1](https://img.l1uyun.one/HMM_vivifytech_image_1.png)

## web目录扫描
进一步扫描 WordPress 下的目录

![HMM_vivifytech_image_2](https://img.l1uyun.one/HMM_vivifytech_image_2.png)

发现敏感文件 secret. txt,

![HMM_vivifytech_image_3](https://img.l1uyun.one/HMM_vivifytech_image_3.png)
## 根据收集的用户名, 密码爆破 ssh

![HMM_vivifytech_image_4](https://img.l1uyun.one/HMM_vivifytech_image_4.png)

![HMM_vivifytech_image_5|400](https://img.l1uyun.one/HMM_vivifytech_image_5.png)

![HMM_vivifytech_image_6](https://img.l1uyun.one/HMM_vivifytech_image_6.png)


![HMM_vivifytech_image_7](https://img.l1uyun.one/HMM_vivifytech_image_7.png)

```bash
sarah:bohicon
```

## USER. txt PWD

![HMM_vivifytech_image_8](https://img.l1uyun.one/HMM_vivifytech_image_8.png)
## 收集泄露信息,横向移动
jresig secret
![HMM_vivifytech_image_9](https://img.l1uyun.one/HMM_vivifytech_image_9.png)


![HMM_vivifytech_image_10](https://img.l1uyun.one/HMM_vivifytech_image_10.png)

```bash
sarah@VivifyTech:~/.gnupg/crls.d$ cat DIR.txt
v:1:
```

在用户目录里面发现了 TASK. txt 文件
下次应该直接全局找一下. txt 文件

![HMM_vivifytech_image_11](https://img.l1uyun.one/HMM_vivifytech_image_11.png)

```bash
sarah@VivifyTech:~/.private$ cat Tasks.txt
- Change the Design and architecture of the website
- Plan for an audit, it seems like our website is vulnerable
- Remind the team we need to schedule a party before going to holidays
- Give this cred to the new intern for some tasks assigned to him - gbodja:4Tch055ouy370N
```
## 利用 sudo git 提权

![HMM_vivifytech_image_12](https://img.l1uyun.one/HMM_vivifytech_image_12.png)

![HMM_vivifytech_image_13](https://img.l1uyun.one/HMM_vivifytech_image_13.png)

![HMM_vivifytech_image_14](https://img.l1uyun.one/HMM_vivifytech_image_14.png)

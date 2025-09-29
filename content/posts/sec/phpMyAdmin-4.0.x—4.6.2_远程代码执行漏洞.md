---
title: phpMyAdmin-4.0.x—4.6.2_远程代码执行漏洞
cve: CVE-2016-5734
tags:
  - sec
date: 2024-09-18T16:59:09
lastmod: 2025-09-29T20:52:29
toc: "true"
draft: "false"
---
##  漏洞简介
phpMyAdmin是一套开源的、基于Web的MySQL数据库管理工具。

在其查找并替换字符串功能中，将用户输入的信息拼接进preg_replace函数第一个参数中。
在PHP5.4.7以前，preg_replace的第一个参数可以利用\\0进行截断，并将正则模式修改为e。众所周知，e模式的正则支持执行代码，此时将可构造一个任意代码执行漏洞。

##  影响版本
// 漏洞涉及的组件,版本

phpmyadmin
4.0.x-4.0.10.16
4.4.x-4.4.15.7
4.6.x-4.6.3（实际上由于该版本要求PHP5.5+，所以无法复现本漏洞）

Php版本： 4.3.0 ~5.4.6
Php 5.5 版本以上的将 preg_replace 的 /e修饰符给废弃掉了

## 利用条件
// 利用这个漏洞的前置要求,例如进后台啥的

这个漏洞需要登录，且要能够写入数据。

## 前置知识
### preg_replace的/e参数

```php
mixed preg_replace ( mixed pattern, mixed replacement, mixed subject,[int limit],[int count])

$pattern: 要搜索的模式，可以是字符串或一个字符串数组。反斜杠定界符尽量不要使用，而是使用 # 或者 ~
$replacement: 用于替换的字符串或字符串数组。
$subject: 要搜索替换的目标字符串或字符串数组。
$limit: 可选，对于每个模式用于每个 subject 字符串的最大可替换次数。默认是-1（无限制）。
$count: 可选，为替换执行的次数。
```
/e 修正符使 preg_replace() 将 replacement 参数当作 PHP 代码(在适当的逆向引用替换完之后)。
提示：要确保 replacement 构成一个合法的 PHP 代码字符串，否则 PHP 会在报告在包含 preg_replace() 的行中出现语法解析错误。
例如,对于下面这个代码,访问h=phpinfo(),就能触发phpinfo页面
```php
<?php
preg_replace("/test/e",'phpinfo()',"jutst test");
?>
```
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_1.png)
## 漏洞复现
//手测,脚本

使用的vulhub的环境,使用docker启动就行

这里是直接使用了exploit-db中的poc
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_2.png)


## 漏洞分析
// 分析原理,调用链

参照网上其他人的分析文章,
首先找到preg_replace()函数的调用位置,
发现是在 /libraries/TableSearch.class.php 文件中的_getRegexReplaceRows方法里面

![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_3.png)
接下来就是依次寻找find,replaceWith和row[0]这三个参数的来源

可以看到find,replaceWith是直接从getReplacePreview中传递过去的
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_4.png)
继续往上查找getReplacePreview方法,发现是在tbl_find_replace.php中被调用的,这里的可以看到find,replaceWith都是直接从POST中传递进来的
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_5.png)

解决了前面两个参数,接下来就是看第三个参数是怎么来的,毕竟这个/e参数要成功执行代码,需要正则的模式被匹配到.

回到_getRegexReplaceRows方法,可以看到row\[0\]应该是sql语句查询结果的第一列数据
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_6.png)
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_7.png)
sql语句的内容如下
```sql
SELECT 
    PMA_Util::backquote($column),   -- 获取列名并进行反引号处理
    1,                              -- 添加一个额外的列，该列用于存储替换后的值
    COUNT(*)                        -- 计算匹配的行数
FROM 
    PMA_Util::backquote($this->_db)   -- 数据库名，反引号处理
    .PMA_Util::backquote($this->_table) -- 表名，反引号处理
WHERE 
    PMA_Util::backquote($column)       -- 目标列
    RLIKE '" . PMA_Util::sqlAddSlashes($find) . "'  -- 使用正则匹配 $find，确保字符转义
    COLLATE " . $charSet . "_bin      -- 使用二进制排序规则进行区分大小写的比较
GROUP BY 
    PMA_Util::backquote($column)       -- 按目标列分组
ORDER BY 
    PMA_Util::backquote($column) ASC   -- 按目标列升序排列
```
这里面我们需要能够控制column,\_db,\_table,其中column是来自columnIndex这个参数,这个也是POST传进来的

剩下两个参数是PMA_TableSearch类的属性,是在构造函数里面被定义的
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_8.png)
继续回溯,tbl_find_replace.php中创建了这个类,并传入了$db, $table这两个参数
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_9.png)
这两个参数是包含的libraries/common.inc.php文件,这两个参数可以通过REQUEST方法来接收变量并将其设置为全局变量。
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_10.png)

结合上面的分析,看看exploit-db给的poc

使用poc,然后用burpsuite抓了一下包,脚本先是进行了登录
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_11.png)
前面两个数据包好像都是在获取一些Cookie信息,第一个是在登录获取token值,第二个包是在访问主页,获取了另外的一些值
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_12.png)
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_13.png)
第三个包访问了/import.php,这个文件是PhpMyAdmin中处理SQL导入的页面。这个页面允许管理员导入SQL查询语句，并在数据库中执行。

创建了一个数据库test,数据表prgpwn,以及插入了数据(`0/e\0`)  即0/e和一个null byte
![|900](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_14.png)
最后一个包,访问了漏洞所在的php文件,/tbl_find_replace.php

传入了db,table,find,replaceWith这些参数,find和replaceWith直接被拼接到了preg_replace的前面两个参数中,而POST的数据中的db,table,columnIndex指定了sql查询得到的结果,这个结果被拼接到了preg_replace的第三个参数,从而触发了preg_replace的/e参数的执行代码功能.
![](https://img.l1uyun.one/phpMyAdmin_4.0.x—4.6.2_远程代码执行漏洞_image_15.png)
find参数中传进去的%00也就是空字符,将拼接之后的/给截断了
```php
<?php
	echo preg_replace("/0/e\0/","system('id')","0/e\0")
?>
```
## 漏洞修复
// 升级版本,打补丁,黑名单,白名单.....

及时更新版本。

## 参考资料
[phpMyAdmin 4.6.2 - (Authenticated) Remote Code Execution - PHP webapps Exploit](https://www.exploit-db.com/exploits/40185)

[PHP安全之慎用preg\_replace的/e修饰符 - y'ang - 博客园](https://www.cnblogs.com/angly/p/3157736.html)

[CVE-2016-5734 phpmyadmin后台代码执行漏洞复现](https://xz.aliyun.com/t/7836)
